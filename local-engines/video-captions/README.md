# InkDrop Video Captions Engine

Local-only engine for burning styled captions into videos. This package is isolated from the GitHub Pages app and is intended to run on the user's machine.

## Current Scope

Implemented for the first spike:

- mocked German word timestamps
- ASS subtitle generation
- normal, phrase, karaoke, and keyword caption modes
- native FFmpeg burn-in
- sample render command
- WhisperX setup and doctor scripts
- real-video QA command for script-first burned-in captions
- unit tests for subtitle rendering behavior
- German script alignment workflow through WhisperX when the Python environment is installed
- script/transcript review summary before rendering

Not implemented yet:

- timeline editing and per-word manual correction
- soft subtitle exports

## Requirements

- Node.js 20 or newer
- FFmpeg available on `PATH`
- FFmpeg built with `libass`
- ffprobe available on `PATH`
- Python 3.10+ available as `python` or in `.venv`
- WhisperX installed in the Python environment for automatic script timing

Check the local tools:

```powershell
ffmpeg -version
ffprobe -version
python --version
python -c "import whisperx; print('whisperx ready')"
```

Or run the doctor:

```powershell
npm run doctor
```

## Commands

```powershell
npm install
npm run check
npm test
npm run doctor
npm run server
npm run render:sample
npm run qa:real -- --video C:\path\video.mp4 --script C:\path\script.txt
```

## Local API

Start the engine:

```powershell
npm run server
```

The server binds to `127.0.0.1:4777`, prints a one-time connection URL, and requires the printed token for rendering requests.

Example:

```txt
Connection URL: http://127.0.0.1:4777/?token=...
```

Paste that URL into InkDrop's Video Captions tool.

The `/health` endpoint reports separate readiness for FFmpeg, ffprobe, Python, and WhisperX. Manual timestamp rendering only needs FFmpeg and ffprobe. Script timing needs Python and WhisperX too.

## WhisperX Setup

This repo does not auto-install WhisperX or PyTorch because those packages are large, hardware-specific, and may download several GB of model files on first use.

Recommended setup:

```powershell
cd C:\Users\Manuel\Dev\InkDrop\local-engines\video-captions
npm run setup:whisperx
npm run doctor
```

Recommended Windows setup:

```powershell
cd C:\Users\Manuel\Dev\InkDrop\local-engines\video-captions
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126
pip install whisperx
```

Run the engine:

```powershell
npm run server
```

By default, the engine prefers `.venv\Scripts\python.exe` when it exists, then falls back to `python`. To use a specific interpreter, set:

```powershell
$env:INKDROP_VIDEO_CAPTIONS_PYTHON="C:\Users\Manuel\Dev\InkDrop\local-engines\video-captions\.venv\Scripts\python.exe"
npm run server
```

The first alignment run downloads Whisper and alignment models into the normal Hugging Face and PyTorch caches. Those model files are not tracked by git.

## Real Video QA

After WhisperX is installed, run a local end-to-end check against a real video and script:

```powershell
npm run qa:real -- --video C:\path\video.mp4 --script C:\path\script.txt --language de --model medium --preset youtube --mode karaoke
```

The command extracts audio, runs WhisperX, compares the transcript against the provided script, writes reviewed word timestamps, burns captions into a copy of the video, and verifies that resolution and frame rate stayed the same.

Generated QA files are ignored by git and written under:

- `qa-output/`

`render:sample` writes generated files under ignored folders:

- `work/`
- `output/`

The sample verifies that the captioned output keeps the same resolution and frame rate as the generated input.
