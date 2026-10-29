"""
download_models.py - Optional CLI Utility to Cache Quantized Edge Models

Downloads:
1. Qwen2.5-1.5B-Instruct-Q4_K_M.gguf (~1.0 GB) for GBNF constrained decoding
2. Pre-caches faster-whisper tiny.en INT8 model
"""

import os
import sys
import urllib.request

MODELS_DIR = os.path.dirname(os.path.abspath(__file__))
QWEN_GGUF_URL = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
QWEN_TARGET_PATH = os.path.join(MODELS_DIR, "qwen2.5-1.5b-instruct-q4_k_m.gguf")


def download_progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100.0, (downloaded / total_size) * 100)
        mb_down = downloaded / (1024 * 1024)
        mb_total = total_size / (1024 * 1024)
        sys.stdout.write(f"\rDownloading Qwen2.5 GGUF: {percent:.1f}% ({mb_down:.1f}/{mb_total:.1f} MB)")
        sys.stdout.flush()


def download_gguf():
    if os.path.exists(QWEN_TARGET_PATH):
        print(f"[OK] GGUF model already present at: {QWEN_TARGET_PATH}")
        return

    print(f"Downloading Qwen2.5-1.5B-Instruct-Q4_K_M.gguf to {MODELS_DIR}...")
    try:
        urllib.request.urlretrieve(QWEN_GGUF_URL, QWEN_TARGET_PATH, download_progress)
        print("\n[OK] Model download complete!")
    except Exception as e:
        print(f"\n[Warning] Could not complete automatic download: {e}")
        print("EdgeAIEngine will run in high-speed deterministic fallback mode.")


def prefetch_whisper():
    try:
        from faster_whisper import WhisperModel
        print("Pre-fetching faster-whisper tiny.en INT8 model...")
        WhisperModel("tiny.en", device="cpu", compute_type="int8", download_root=MODELS_DIR)
        print("[OK] Whisper tiny.en cached successfully!")
    except Exception as e:
        print(f"[Notice] Whisper download deferred: {e}")


if __name__ == "__main__":
    prefetch_whisper()
    # GGUF download can be optionally triggered
    if "--download-llm" in sys.argv:
        download_gguf()
    else:
        print("Tip: Run `python download_models.py --download-llm` to download the 1.0GB Qwen2.5 GGUF SLM model.")
