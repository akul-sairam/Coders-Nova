"""
schemas.py - Data Contracts and Pydantic Models for Offline Edge EMS AI

EDGE OPTIMIZATION NOTES:
1. Pydantic v2 Core:
   - Uses Rust-based pydantic-core underneath for near-instant serialization
     and deserialization, saving precious CPU clock cycles on constrained edge devices.
2. Grammar-Based Sampling (GBNF) Integration:
   - ClinicalExtraction.model_json_schema() is used to derive strict context-free
     grammars for llama-cpp-python. This restricts the Small Language Model (SLM)
     sampling distribution to only emit tokens that satisfy this exact JSON schema,
     eliminating JSON syntax errors, markdown fences, and hallucinations.
3. FHIR-lite Compatibility:
   - Represents HL7 FHIR (Fast Healthcare Interoperability Resources) Release 4
     in a lightweight format optimized for bandwidth-constrained field handovers.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# 1. CLINICAL EXTRACTION SCHEMAS (SLM TARGETS VIA GBNF)
# ============================================================================

class MedicationEntry(BaseModel):
    """
    Represents an administered medication or intravenous fluid during EMS care.
    Captures both verbatim transcript terms and normalized clinical standards.
    """
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    name: str = Field(
        ...,
        description="Standard clinical name of medication (e.g., Epinephrine, Naloxone, Nitroglycerin, Normal Saline 0.9%)"
    )
    raw_term: Optional[str] = Field(
        None,
        description="Verbatim spoken slang or acronym from transcript (e.g., 'epi', 'narcan', 'nitro', 'mikes')"
    )
    dose: Optional[str] = Field(
        None,
        description="Numeric dosage value as a string (e.g., '1', '0.4', '100', '500')"
    )
    unit: Optional[str] = Field(
        None,
        description="Standardized unit of measurement (e.g., 'mg', 'mcg', 'mL', 'puff', 'spray', 'g')"
    )
    route: Optional[str] = Field(
        None,
        description="Administration route (e.g., 'IV Push', 'IM', 'IO', 'Sublingual', 'Intranasal', 'Nebulized', 'Oral')"
    )
    timestamp: Optional[str] = Field(
        None,
        description="Resolved ISO 8601 timestamp (e.g., 2026-10-29T21:45:00Z) or HH:MM"
    )
    relative_time_phrase: Optional[str] = Field(
        None,
        description="Raw relative temporal phrase if spoken (e.g., '2 minutes ago', 'on arrival', 'prior to contact')"
    )
    notes: Optional[str] = Field(
        None,
        description="Clinical indications or observations (e.g., 'given for anaphylaxis', 'cardiac arrest protocol')"
    )


class ProcedureEntry(BaseModel):
    """
    Represents an emergency medical procedure performed on scene or en route.
    """
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    name: str = Field(
        ...,
        description="Standardized clinical procedure name (e.g., 'Endotracheal Intubation', '12-Lead ECG', 'Intravenous Access', 'Bag-Valve-Mask Ventilation', 'Defibrillation')"
    )
    raw_term: Optional[str] = Field(
        None,
        description="Verbatim spoken EMS phrasing (e.g., 'tubed', 'started 18g iv', 'shocked at 200j', '12-lead')"
    )
    site: Optional[str] = Field(
        None,
        description="Anatomical location or device size (e.g., 'Left antecubital fossa', 'Right chest 2nd intercostal', 'Size 7.5 ETT 22cm')"
    )
    success: Optional[bool] = Field(
        True,
        description="Whether procedure was successful (true) or attempted/unsuccessful (false)"
    )
    timestamp: Optional[str] = Field(
        None,
        description="Resolved ISO 8601 timestamp or HH:MM"
    )
    relative_time_phrase: Optional[str] = Field(
        None,
        description="Original temporal reference (e.g., 'just now', '3 mins ago')"
    )
    details: Optional[str] = Field(
        None,
        description="Technical details, confirmation steps (e.g., 'Confirmed with waveform capnography and bilateral breath sounds')"
    )


class VitalSigns(BaseModel):
    """
    Structured physiological measurements.
    """
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    bp_systolic: Optional[int] = Field(None, description="Systolic blood pressure (mmHg)")
    bp_diastolic: Optional[int] = Field(None, description="Diastolic blood pressure (mmHg)")
    heart_rate: Optional[int] = Field(None, description="Heart rate (beats per minute)")
    respiratory_rate: Optional[int] = Field(None, description="Respiratory rate (breaths per minute)")
    spo2: Optional[int] = Field(None, description="Oxygen saturation percentage (0-100)")
    gcs: Optional[int] = Field(None, description="Glasgow Coma Scale total score (3-15)")
    blood_glucose: Optional[int] = Field(None, description="Blood glucose level (mg/dL)")
    pain_scale: Optional[int] = Field(None, description="Pain rating (0-10)")
    timestamp: Optional[str] = Field(None, description="Timestamp of vitals acquisition")


class PatientDemographics(BaseModel):
    """
    Field-accessible patient information and incident identifiers.
    """
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    age: Optional[int] = Field(None, description="Estimated or verified patient age")
    gender: Optional[str] = Field(None, description="Patient gender (Male, Female, Unknown)")
    chief_complaint: Optional[str] = Field(None, description="Primary clinical presentation or dispatch reason")
    call_sign_or_unit: Optional[str] = Field(None, description="EMS unit callsign (e.g., Medic 12, Rescue 4)")
    incident_id: Optional[str] = Field(None, description="CAD or Incident dispatch identifier")


class ClinicalExtraction(BaseModel):
    """
    Master schema passed to GBNF Grammar Generator for Small Language Model inference.
    Strictly structures raw paramedic transcripts into validated EMS fields.
    """
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    patient: PatientDemographics = Field(
        default_factory=PatientDemographics,
        description="Patient demographics and unit info"
    )
    vitals: List[VitalSigns] = Field(
        default_factory=list,
        description="Recorded physiological vital sign sets"
    )
    medications: List[MedicationEntry] = Field(
        default_factory=list,
        description="Administered medications and fluids"
    )
    procedures: List[ProcedureEntry] = Field(
        default_factory=list,
        description="Medical interventions and clinical procedures"
    )
    narrative_summary: str = Field(
        "",
        description="Synthesized objective clinical narrative summarizing the emergency encounter"
    )
    flags_or_allergies: List[str] = Field(
        default_factory=list,
        description="Critical clinical alerts, allergies, or safety warnings"
    )


# ============================================================================
# 2. FHIR-LITE RESOURCE MODELS (HL7 FHIR R4 COMPATIBLE)
# ============================================================================

class FHIRLiteResource(BaseModel):
    """
    Base generic resource wrapper for HL7 FHIR Lite resources.
    """
    resourceType: str
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    meta: Optional[Dict[str, Any]] = None
    status: Optional[str] = "completed"


class FHIRLiteBundle(BaseModel):
    """
    HL7 FHIR Document Bundle aggregating patient, encounter, observations,
    procedures, and medication administrations into a single edge exchange payload.
    """
    resourceType: str = "Bundle"
    id: str = Field(default_factory=lambda: f"bundle-{uuid.uuid4().hex[:12]}")
    type: str = "document"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    total: int = 0
    entry: List[Dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# 3. CRYPTOGRAPHIC AUDIT LEDGER MODELS
# ============================================================================

class AuditBlock(BaseModel):
    """
    Represents an immutable, tamper-evident block in the SHA-256 cryptographic chain.
    Prevents post-incident record alteration in EMS liability contexts.
    """
    index: int = Field(..., description="Sequential block height in the ledger (0 = Genesis)")
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp when block was sealed")
    encounter_id: str = Field(..., description="Unique incident or encounter identifier")
    payload_hash: str = Field(..., description="SHA-256 hash of the canonical JSON clinical data")
    prev_hash: str = Field(..., description="SHA-256 hash of the preceding block (links chain)")
    block_hash: str = Field(..., description="SHA-256 hash of (index + timestamp + encounter + payload_hash + prev_hash)")
    payload: Dict[str, Any] = Field(..., description="The verified clinical payload")


class LedgerVerificationResult(BaseModel):
    """
    Cryptographic verification report for audit and legal compliance.
    """
    is_valid: bool
    total_blocks: int
    latest_block_hash: str
    verified_at: str
    broken_block_index: Optional[int] = None
    message: str


# ============================================================================
# 4. API REQUEST & RESPONSE MODELS
# ============================================================================

class ProcessNoteRequest(BaseModel):
    """
    Request model for processing raw typed or dictated text notes.
    """
    text: str = Field(..., description="Raw transcript or written notes from EMS personnel")
    encounter_id: Optional[str] = Field(None, description="Optional incident identifier")
    call_sign: Optional[str] = Field("Medic 1", description="Responding EMS unit callsign")


class ProcessNoteResponse(BaseModel):
    """
    Unified response holding raw transcript, structured data, FHIR-lite bundle,
    and the cryptographic audit seal.
    """
    success: bool
    encounter_id: str
    transcript: str
    clinical_data: ClinicalExtraction
    fhir_bundle: FHIRLiteBundle
    audit_block: AuditBlock
    processing_time_ms: float
    edge_metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Edge compute statistics (ASR duration, SLM token rate, RAM usage)"
    )


class TranscribeResponse(BaseModel):
    """
    Response model for direct audio speech-to-text.
    """
    success: bool
    transcript: str
    language: str
    duration_seconds: float
    segments: List[Dict[str, Any]] = Field(default_factory=list)
    processing_time_ms: float
