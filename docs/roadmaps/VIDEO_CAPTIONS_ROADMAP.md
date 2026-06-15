# Video Captions Roadmap

## Goal

Add a local-only video captions workflow to InkDrop that can align a provided German script to a video, generate styled captions, and export a new MP4 with burned-in subtitles while keeping visual quality as close to the source as practical.

The GitHub Pages version remains a static app. Heavy video work runs through an optional local engine on the user's machine.

## Product Shape

- InkDrop keeps the existing deployed browser app for browser-safe tools.
- A new Video Captions tool appears in the UI.
- If the local engine is not running, the tool shows setup/start instructions and a disconnected state.
- If the local engine is running, the UI can send a selected video and script to `127.0.0.1`, monitor progress, preview settings, and save the rendered output.
- The local engine handles FFmpeg, WhisperX, model files, temporary media, and rendered outputs.

## Quality Constraint

Burned-in captions require video re-encoding because caption pixels are added to the frames. The implementation should preserve:

- original resolution
- original frame rate
- original duration
- audio stream copy when compatible
- high-quality H.264 export by default, targeting visually close output

For true unchanged video streams, the tool should also support soft subtitle exports such as `.srt`, `.vtt`, and `.ass`.

## Proposed Structure

```txt
InkDrop/
  src/
    components/
      video-captions/
    lib/
      video-captions/
  local-engines/
    video-captions/
      api/
      aligner/
      ffmpeg/
      subtitles/
      README.md
```

Source files and setup scripts are committed. Generated files, downloaded models, Python environments, uploaded videos, temp audio, subtitle outputs, and rendered videos stay ignored.

## Phase 0: Reference Audit And Engine Spike

Objective: prove the local architecture before building UI.

Tasks:

- Extract the useful concepts from `C:\Users\Manuel\Dev\VSCode_Projects\youtube-automation`.
- Identify which subtitle modules can be ported cleanly.
- Create a minimal local engine folder.
- Add a local health-check endpoint.
- Check that native FFmpeg is available or provide a clear setup error.
- Generate a tiny `.ass` subtitle file.
- Burn that `.ass` file into a short sample video.

Acceptance criteria:

- A local command can render a test video with burned-in captions.
- The rendered output keeps source resolution and frame rate.
- Generated media and temp files are ignored by git.
- The spike documents required local dependencies.

## Phase 1: Subtitle Renderer MVP

Objective: build the caption styling and rendering core without WhisperX yet.

Tasks:

- Port or adapt ASS subtitle generation from the reference project.
- Define shared caption types:
  - word timestamps
  - caption style
  - caption mode
  - render preset
- Support caption modes:
  - normal sentence captions
  - phrase captions with max words
  - karaoke/current-word highlighting
  - keyword highlighting
- Support style controls:
  - font family
  - font size
  - primary color
  - highlight color
  - outline color
  - outline width
  - shadow depth
  - top/center/bottom position
  - horizontal and vertical margins
- Add presets:
  - YouTube
  - Shorts/Karaoke
  - Minimal
  - Custom
- Add unit tests for grouping, timing, color conversion, and ASS escaping.

Acceptance criteria:

- Given word timestamps, the engine generates valid `.ass`.
- Normal, karaoke, and keyword modes render differently and predictably.
- German text, punctuation, and umlauts render correctly.

## Phase 2: Local Engine API

Objective: make the renderer usable from InkDrop without tying the frontend to native tooling.

Tasks:

- Add a local HTTP API bound to `127.0.0.1`.
- Add health/status endpoint.
- Add render job creation endpoint.
- Add job progress endpoint.
- Add output download/open endpoint.
- Add job cancellation.
- Add local-only CORS allowlist for InkDrop origins:
  - local Vite dev origin
  - GitHub Pages deployment origin
- Add a per-session local token so random websites cannot call the engine.

Acceptance criteria:

- InkDrop can detect whether the local engine is connected.
- A render job can be submitted, tracked, cancelled, and downloaded.
- The engine rejects requests without the local session token.
- The engine does not expose arbitrary filesystem or shell access.

## Phase 3: InkDrop UI Shell

Objective: add the user-facing Video Captions tool with local-engine connection handling.

Tasks:

- Add Video Captions to the tool picker.
- Add local engine connection status.
- Add setup/start instructions when disconnected.
- Add video file selector.
- Add script text area.
- Add language selector defaulting to German.
- Add mode selector:
  - Normal
  - Karaoke
  - Keyword
- Add style controls.
- Add render progress UI.
- Add output action after render completes.

Acceptance criteria:

- The deployed GitHub Pages app remains functional without the local engine.
- The Video Captions tool clearly explains when local rendering is unavailable.
- The local development version can connect to the engine and submit jobs.
- No heavy local-engine dependencies are bundled into the web build.

## Phase 4: WhisperX German Alignment

Objective: generate word-level timestamps from a video and a user-provided German script.

Tasks:

- Extract audio from the selected video.
- Add Python environment setup instructions.
- Add WhisperX German transcription/alignment command.
- Emit normalized word timestamp JSON.
- Track model download/cache location outside git.
- Add progress states:
  - extracting audio
  - loading model
  - transcribing
  - aligning
  - writing timestamps
- Add CPU/GPU detection or clear configuration.

Acceptance criteria:

- A German video produces word-level timestamps.
- A short video around 1-2 minutes can complete locally.
- Videos up to around 10 minutes are supported as the expected target.
- Model files and intermediate audio are not tracked by git.

## Phase 5: Script Verification And Correction

Objective: use the provided script as the source of truth while still relying on WhisperX for timing.

Tasks:

- Normalize provided script and WhisperX transcript.
- Compare script words against detected words.
- Highlight missing, extra, or changed words.
- Align script words to WhisperX timestamps where confidence is good.
- Add a review step for mismatches.
- Allow manual text correction before render.

Acceptance criteria:

- The rendered captions use the user's script text where alignment is confident.
- Obvious transcript/script mismatches are visible before export.
- The user can proceed, correct, or cancel after review.

## Phase 6: Preview And Editing

Objective: make styling decisions fast before full export.

Tasks:

- Add browser preview of captions over the selected video.
- Add style preview without full FFmpeg render.
- Add short segment render preview for final accuracy.
- Add timeline scrubber.
- Allow split/merge of caption groups.
- Allow max words per group changes.
- Allow keyword list editing.
- Allow per-word timing edits for small corrections.

Acceptance criteria:

- The user can inspect how captions look before rendering the whole video.
- Style changes are visible quickly.
- Common timing/grouping corrections do not require editing raw JSON.

## Phase 7: Export Modes And Presets

Objective: give the user control over output type and repeatable styles.

Tasks:

- Add burned-in MP4 export.
- Add soft subtitle exports:
  - `.srt`
  - `.vtt`
  - `.ass`
- Add saved style presets.
- Add Shorts and landscape YouTube presets.
- Add export quality choices:
  - high quality
  - smaller file
  - custom CRF/preset advanced settings
- Copy audio stream where possible.

Acceptance criteria:

- The user can choose burned-in or soft subtitle output.
- Burned-in output preserves resolution/frame rate.
- Presets can be reused across projects.

## Phase 8: Reliability, Packaging, And Docs

Objective: make the local feature maintainable and safe.

Tasks:

- Add local-engine README.
- Add setup scripts for Windows first.
- Add dependency checks:
  - FFmpeg
  - Python
  - WhisperX
  - model/cache location
- Add clear error messages for unsupported files.
- Add cleanup for stale temp jobs.
- Add tests for API validation and render command generation.
- Add manual QA checklist with sample German video.

Acceptance criteria:

- A fresh Windows setup has clear installation steps.
- Common failures are actionable.
- Temp files do not accumulate indefinitely.
- The repo stays clean after local rendering.

## Git Hygiene

Tracked:

- source code
- setup scripts
- API definitions
- subtitle generation logic
- tests
- documentation

Ignored:

- Python virtual environments
- WhisperX/model caches
- uploaded input videos
- extracted audio
- generated `.ass`, `.srt`, `.vtt`
- rendered video outputs
- temp job folders

The current `.gitignore` includes scoped `local-engines/**` rules for these generated files.

## Recommended First Implementation Target

Start with Phase 0 and Phase 1 only:

> Given a short local video and mocked German word timestamps, generate styled ASS captions and burn them into an MP4 using native FFmpeg.

This proves the hardest rendering path before adding WhisperX, script matching, and the larger UI.
