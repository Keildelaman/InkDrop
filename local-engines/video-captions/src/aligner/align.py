"""
WhisperX audio alignment for InkDrop video captions.

This script is intentionally standalone so the Node engine can call it from an
isolated Python environment without importing Python dependencies in Node.
"""

import argparse
import json
import os
import sys
import time

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import torch

_original_torch_load = torch.load


def _patched_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _original_torch_load(*args, **kwargs)


torch.load = _patched_torch_load


def get_device():
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def align_audio(audio_path: str, language: str, output_path: str, model_size: str = "medium"):
    import whisperx

    device = get_device()
    compute_type = "float16" if device == "cuda" else "float32"

    print(f"Device: {device}", flush=True)
    print(f"Audio: {audio_path}", flush=True)
    print(f"Language: {language}", flush=True)
    print(f"Model: {model_size}", flush=True)

    total_start = time.time()

    print("\n[1/4] Loading audio...", flush=True)
    audio = whisperx.load_audio(audio_path)
    audio_duration = len(audio) / 16000
    print(f"Audio duration: {audio_duration:.2f}s", flush=True)

    print("\n[2/4] Transcribing with Whisper...", flush=True)
    transcribe_start = time.time()
    model = whisperx.load_model(model_size, device, compute_type=compute_type, vad_method="silero")
    result = model.transcribe(audio, batch_size=16, language=language)
    print(f"Transcription complete ({time.time() - transcribe_start:.2f}s)", flush=True)

    del model
    if device == "cuda":
        torch.cuda.empty_cache()

    print("\n[3/4] Aligning with wav2vec2...", flush=True)
    align_start = time.time()
    model_a, metadata = whisperx.load_align_model(language_code=language, device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
    print(f"Alignment complete ({time.time() - align_start:.2f}s)", flush=True)

    del model_a
    if device == "cuda":
        torch.cuda.empty_cache()

    print("\n[4/4] Extracting word timestamps...", flush=True)
    words = []
    for segment in result.get("segments", []):
        for word_info in segment.get("words", []):
            if "start" in word_info and "end" in word_info:
                word = str(word_info["word"]).strip()
                if word:
                    words.append(
                        {
                            "word": word,
                            "start": round(float(word_info["start"]), 3),
                            "end": round(float(word_info["end"]), 3),
                        }
                    )

    output_data = {
        "totalDuration": round(audio_duration, 3),
        "wordCount": len(words),
        "language": language,
        "words": words,
    }

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved: {output_path}", flush=True)
    print(f"Words: {len(words)}", flush=True)
    print(f"Total time: {time.time() - total_start:.2f}s", flush=True)
    return output_data


def main():
    parser = argparse.ArgumentParser(description="InkDrop WhisperX audio alignment")
    parser.add_argument("--audio", required=True, help="Path to input WAV file")
    parser.add_argument("--language", required=True, help="Language code, for example de")
    parser.add_argument("--output", required=True, help="Path to output JSON file")
    parser.add_argument("--model", default="medium", help="Whisper model size")
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(f"Error: Audio file not found: {args.audio}", file=sys.stderr, flush=True)
        sys.exit(1)

    try:
        align_audio(args.audio, args.language, args.output, args.model)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
