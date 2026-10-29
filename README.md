# Edge EMS AI: Voice-to-Structured Clinical Note Generator

An entirely offline, edge-deployed clinical dictation system for emergency first responders (EMS, paramedics, combat medics). Converts spoken or typed on-scene notes into a structured, timestamped record of medications and procedures, generating an HL7 FHIR-lite JSON payload and a tamper-evident, cryptographically chained handover PDF—all running on low-power edge CPUs with **zero cloud API dependencies**.

The project code is located in:
- `backend/` (or `edge-ems-ai/backend/`): FastAPI, faster-whisper INT8, llama-cpp-python GBNF, SQLite SHA-256 Ledger, ReportLab PDF
- `frontend/` (or `edge-ems-ai/frontend/`): React, Vite, Tailwind CSS, Web Audio API, Timeline Visualizer
- `models/` (or `edge-ems-ai/models/`): Quantized GGUF and Whisper model cache

See [edge-ems-ai/README.md](file:///c:/Users/akult/Downloads/Coders%20Nova/edge-ems-ai/README.md) for full architecture and documentation.
