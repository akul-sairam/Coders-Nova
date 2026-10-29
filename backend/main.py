"""
main.py - FastAPI Offline Edge Entrypoint for Voice-to-Structured EMS Note Generator

EDGE COMPUTING ARCHITECTURE & ASYNC DESIGN:
1. Pure Offline Operation:
   - Zero outbound requests to cloud LLM or ASR providers (No OpenAI, AWS, or GCP calls).
   - Designed to run on ruggedized edge laptops, field ambulances, and air medical tablets.

2. Async I/O with asyncio.to_thread():
   - FastAPI routes are declared as `async def`. Heavy CPU-intensive AI inference
     (faster-whisper CTranslate2 decoding, llama-cpp-python GBNF sampling, ReportLab PDF rendering)
     is dispatched to worker threads via `asyncio.to_thread()`.
   - This ensures the FastAPI event loop is never blocked, keeping the UI snappy and responsive
     even while multi-second acoustic transcription is underway.

3. Zero-Copy In-Memory Audio Routing:
   - Reads raw audio bytes asynchronously via `await file.read()` into RAM.
   - Passes the byte array directly to the ASR engine in memory via io.BytesIO,
     completely avoiding disk I/O latency and preserving tablet flash NAND endurance.

4. Cryptographic Non-Repudiation:
   - Every processed encounter is immediately hashed (SHA-256) and chained into the
     tamper-evident local SQLite ledger before returning the response.
"""

import os
import io
import time
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

# Project modules
from schemas import (
    ClinicalExtraction,
    FHIRLiteBundle,
    AuditBlock,
    LedgerVerificationResult,
    ProcessNoteRequest,
    ProcessNoteResponse,
    TranscribeResponse
)
from ai_engine import edge_ai_instance
from normalizer import normalize_clinical_data, convert_to_fhir_bundle
from ledger import ledger_instance
from pdf_generator import generate_handover_pdf


# Initialize FastAPI Application
app = FastAPI(
    title="Edge EMS Voice-to-Structured Clinical Note Generator",
    description="Offline Edge AI for Voice Transcriptions, FHIR-lite Bundles, and Cryptographic Handover Sheets",
    version="1.0.0"
)

# Enable Cross-Origin Resource Sharing (CORS) for local React / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# 1. HEALTH & SYSTEM METRICS
# ============================================================================

@app.get("/api/health", tags=["System"])
async def get_health_status() -> Dict[str, Any]:
    """
    Returns edge system health, available hardware threads, and engine status.
    """
    latest_block = ledger_instance.get_latest_block()
    return {
        "status": "online",
        "mode": "offline-edge",
        "cpu_threads": edge_ai_instance.cpu_threads,
        "whisper_model": edge_ai_instance.whisper_model_size,
        "whisper_compute_type": edge_ai_instance.whisper_compute_type,
        "llm_configured": edge_ai_instance.llm_model_path is not None or os.path.exists(
            os.path.join(os.path.dirname(__file__), "..", "models")
        ),
        "ledger_block_height": latest_block.index if latest_block else 0,
        "latest_block_hash": latest_block.block_hash if latest_block else "GENESIS",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ============================================================================
# 2. AUDIO INGESTION & SPEECH-TO-TEXT (ASR)
# ============================================================================

@app.post("/api/transcribe", response_model=TranscribeResponse, tags=["Audio"])
async def transcribe_audio(
    file: UploadFile = File(..., description="16kHz mono audio file (WAV or WebM)")
) -> TranscribeResponse:
    """
    EDGE OPTIMIZATION: Zero-Copy In-Memory Audio Transcription
    - Ingests audio directly into RAM without saving to physical disk.
    - Runs faster-whisper INT8 inference in a background thread to prevent blocking event loop.
    """
    t0 = time.perf_counter()

    try:
        # Zero-copy async read into RAM buffer
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file provided.")

        # Dispatch CPU-bound ASR to thread pool
        transcript, metadata = await asyncio.to_thread(
            edge_ai_instance.transcribe_audio_stream,
            audio_bytes=audio_bytes
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000

        return TranscribeResponse(
            success=True,
            transcript=transcript,
            language=metadata.get("detected_language", "en"),
            duration_seconds=metadata.get("duration_seconds", 0.0),
            processing_time_ms=round(elapsed_ms, 1)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Speech transcription failed: {str(e)}"
        )


# ============================================================================
# 3. CLINICAL EXTRACTION & NORMALIZATION (SLM)
# ============================================================================

@app.post("/api/extract", response_model=ClinicalExtraction, tags=["Extraction"])
async def extract_clinical_info(
    request: ProcessNoteRequest
) -> ClinicalExtraction:
    """
    Extracts structured EMS clinical entities from text and applies
    slang normalizations and relative timestamp resolutions.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # Execute SLM extraction in worker thread
    raw_extraction, _ = await asyncio.to_thread(
        edge_ai_instance.extract_clinical_data,
        transcript=request.text
    )

    # Apply deterministic clinical slang and temporal normalizations
    normalized = normalize_clinical_data(raw_extraction)
    return normalized


# ============================================================================
# 4. END-TO-END PIPELINE (VOICE / AUDIO)
# ============================================================================

@app.post("/api/process-audio", response_model=ProcessNoteResponse, tags=["Pipeline"])
async def process_audio_pipeline(
    file: UploadFile = File(...),
    encounter_id: Optional[str] = Form(None),
    call_sign: Optional[str] = Form("Medic 1")
) -> ProcessNoteResponse:
    """
    COMPLETE EDGE PIPELINE:
    1. Zero-copy RAM audio ingestion -> faster-whisper INT8 with Silero VAD
    2. Constrained SLM extraction (GBNF / deterministic NER)
    3. Normalization of EMS slang ('epi', 'mikes', 'wide open') & temporal resolution
    4. Canonical HL7 FHIR-lite Bundle generation
    5. SHA-256 Cryptographic Audit Ledger chaining
    """
    start_total = time.perf_counter()
    enc_id = encounter_id or f"EMS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # Step 1: Read audio into RAM
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio payload received.")

    # Step 2: Local ASR in thread pool
    t_asr = time.perf_counter()
    transcript, asr_meta = await asyncio.to_thread(
        edge_ai_instance.transcribe_audio_stream,
        audio_bytes=audio_bytes
    )
    asr_time_ms = (time.perf_counter() - t_asr) * 1000

    # Step 3: Information Extraction
    t_slm = time.perf_counter()
    raw_extraction, slm_meta = await asyncio.to_thread(
        edge_ai_instance.extract_clinical_data,
        transcript=transcript
    )
    slm_time_ms = (time.perf_counter() - t_slm) * 1000

    # Step 4: Slang & Time Normalization
    raw_extraction.patient.incident_id = enc_id
    raw_extraction.patient.call_sign_or_unit = call_sign
    normalized_clinical = normalize_clinical_data(raw_extraction)

    # Step 5: Convert to FHIR-lite Bundle
    fhir_bundle = convert_to_fhir_bundle(normalized_clinical, encounter_id=enc_id)

    # Step 6: Immutable Cryptographic Ledger Chaining
    ledger_payload = {
        "encounter_id": enc_id,
        "transcript": transcript,
        "clinical_data": normalized_clinical.model_dump(),
        "fhir_bundle_id": fhir_bundle.id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    audit_block = await asyncio.to_thread(
        ledger_instance.append_record,
        encounter_id=enc_id,
        clinical_payload=ledger_payload
    )

    total_elapsed_ms = (time.perf_counter() - start_total) * 1000

    return ProcessNoteResponse(
        success=True,
        encounter_id=enc_id,
        transcript=transcript,
        clinical_data=normalized_clinical,
        fhir_bundle=fhir_bundle,
        audit_block=audit_block,
        processing_time_ms=round(total_elapsed_ms, 1),
        edge_metrics={
            "asr_duration_ms": round(asr_time_ms, 1),
            "slm_duration_ms": round(slm_time_ms, 1),
            "asr_engine": asr_meta.get("engine", "faster-whisper"),
            "slm_engine": slm_meta.get("engine", "qwen2.5-gbnf"),
            "grammar_constrained": slm_meta.get("grammar_constrained", False)
        }
    )


# ============================================================================
# 5. END-TO-END PIPELINE (TYPED / TEXT NOTES)
# ============================================================================

@app.post("/api/process-text", response_model=ProcessNoteResponse, tags=["Pipeline"])
async def process_text_pipeline(
    request: ProcessNoteRequest
) -> ProcessNoteResponse:
    """
    Processes typed EMS narrative notes through SLM, normalizer, FHIR-lite,
    and the cryptographic ledger.
    """
    start_total = time.perf_counter()
    enc_id = request.encounter_id or f"EMS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Clinical note text cannot be empty.")

    # Step 1: SLM Extraction
    t_slm = time.perf_counter()
    raw_extraction, slm_meta = await asyncio.to_thread(
        edge_ai_instance.extract_clinical_data,
        transcript=request.text
    )
    slm_time_ms = (time.perf_counter() - t_slm) * 1000

    # Step 2: Slang & Time Normalization
    raw_extraction.patient.incident_id = enc_id
    raw_extraction.patient.call_sign_or_unit = request.call_sign
    normalized_clinical = normalize_clinical_data(raw_extraction)

    # Step 3: FHIR-lite Bundle Synthesis
    fhir_bundle = convert_to_fhir_bundle(normalized_clinical, encounter_id=enc_id)

    # Step 4: Cryptographic Ledger Chaining
    ledger_payload = {
        "encounter_id": enc_id,
        "transcript": request.text,
        "clinical_data": normalized_clinical.model_dump(),
        "fhir_bundle_id": fhir_bundle.id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    audit_block = await asyncio.to_thread(
        ledger_instance.append_record,
        encounter_id=enc_id,
        clinical_payload=ledger_payload
    )

    total_elapsed_ms = (time.perf_counter() - start_total) * 1000

    return ProcessNoteResponse(
        success=True,
        encounter_id=enc_id,
        transcript=request.text,
        clinical_data=normalized_clinical,
        fhir_bundle=fhir_bundle,
        audit_block=audit_block,
        processing_time_ms=round(total_elapsed_ms, 1),
        edge_metrics={
            "slm_duration_ms": round(slm_time_ms, 1),
            "slm_engine": slm_meta.get("engine", "qwen2.5-gbnf"),
            "grammar_constrained": slm_meta.get("grammar_constrained", False)
        }
    )


# ============================================================================
# 6. DOCUMENT GENERATION: TAMPER-EVIDENT PDF
# ============================================================================

class GeneratePDFRequest(BaseModel):
    clinical_data: ClinicalExtraction
    audit_block: AuditBlock
    encounter_id: str
    call_sign: Optional[str] = "Medic 1"

@app.post("/api/generate-pdf", tags=["PDF"])
async def generate_pdf_endpoint(
    req: GeneratePDFRequest
) -> Response:
    """
    Renders a tamper-evident clinical handover PDF in-memory.
    Streams binary PDF directly to the client with the SHA-256 seal stamped.
    """
    try:
        pdf_bytes = await asyncio.to_thread(
            generate_handover_pdf,
            clinical_data=req.clinical_data,
            audit_block=req.audit_block,
            encounter_id=req.encounter_id,
            call_sign=req.call_sign
        )

        filename = f"handover_{req.encounter_id}_{req.audit_block.index}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Audit-Block-Index, X-Block-Hash",
                "X-Audit-Block-Index": str(req.audit_block.index),
                "X-Block-Hash": req.audit_block.block_hash
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@app.get("/api/download-pdf/{encounter_id}", tags=["PDF"])
async def download_pdf_by_encounter(encounter_id: str) -> Response:
    """
    Direct GET download for handover PDF by encounter ID.
    Enables native browser downloads, direct links, and preview without memory blob issues.
    """
    block = ledger_instance.get_block_by_encounter_id(encounter_id)
    if not block:
        raise HTTPException(status_code=404, detail=f"No record found for encounter: {encounter_id}")

    try:
        raw_clinical = block.payload.get("clinical_data", {})
        clinical_data = ClinicalExtraction.model_validate(raw_clinical)
        call_sign = clinical_data.patient.call_sign_or_unit or "Medic 1"

        pdf_bytes = await asyncio.to_thread(
            generate_handover_pdf,
            clinical_data=clinical_data,
            audit_block=block,
            encounter_id=encounter_id,
            call_sign=call_sign
        )

        filename = f"handover_{encounter_id}_{block.index}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Audit-Block-Index, X-Block-Hash",
                "X-Audit-Block-Index": str(block.index),
                "X-Block-Hash": block.block_hash
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF compilation failed: {str(e)}")


# ============================================================================
# 7. CRYPTOGRAPHIC AUDIT LEDGER ENDPOINTS
# ============================================================================

@app.get("/api/ledger", response_model=List[AuditBlock], tags=["Ledger"])
async def get_ledger_history(limit: int = 50) -> List[AuditBlock]:
    """
    Retrieves the sequential blocks from the local cryptographic audit ledger.
    """
    blocks = await asyncio.to_thread(ledger_instance.get_history, limit=limit)
    return blocks


@app.get("/api/ledger/verify", response_model=LedgerVerificationResult, tags=["Ledger"])
async def verify_ledger_chain() -> LedgerVerificationResult:
    """
    Audits the cryptographic SHA-256 chain from Block #0 to the tip.
    Validates mathematical continuity, payload integrity, and header seals.
    """
    result = await asyncio.to_thread(ledger_instance.verify_integrity)
    return result


# Run directly via `python main.py`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
