# Edge EMS AI - Offline Model Directory

This directory stores quantized weights for offline edge execution (zero cloud API dependencies).

## 1. Small Language Model (SLM) - GGUF 4-bit Quantized
The inference engine (`ai_engine.py`) automatically discovers any `.gguf` file placed in this folder.

Recommended Edge Models:
- **Qwen2.5-1.5B-Instruct-Q4_K_M.gguf** (~1.0 GB)
  - URL: `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf`
  - High accuracy on medical nomenclature and GBNF JSON grammar constraints.
- **SmolLM2-1.7B-Instruct-Q4_K_M.gguf** (~1.1 GB)
  - URL: `https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf`

### Instant Download Command (PowerShell):
```powershell
Invoke-WebRequest -Uri "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf" -OutFile "qwen2.5-1.5b-instruct-q4_k_m.gguf"
```

## 2. Speech-to-Text (ASR) - faster-whisper CTranslate2 INT8
- Model: `tiny.en` (~75 MB) or `base.en` (~140 MB)
- Quantization: `int8` executed via CTranslate2
- Silero VAD (Voice Activity Detection): Built-in, drops non-speech frames
- Download: Handled automatically by `faster-whisper` on first run into this directory.

## 3. Instant Edge Fallback Mode
If no `.gguf` model is downloaded yet, `ai_engine.py` operates using an embedded high-speed deterministic regex/NER clinical parser that maps directly to the exact same Pydantic schemas, enabling instant offline operation with zero weight downloads.
