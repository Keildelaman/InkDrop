import { runProcess } from '../ffmpeg/process.js';
import type { ToolHealth } from './types.js';
import { getPythonPath } from '../aligner/whisperx.js';

export async function checkTool(command: 'ffmpeg' | 'ffprobe'): Promise<ToolHealth> {
  try {
    const result = await runProcess(command, ['-version']);
    return { available: true, version: firstLine(result.stdout) };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkPython(): Promise<ToolHealth> {
  try {
    const result = await runProcess(getPythonPath(), [
      '-c',
      'import json, sys; print(json.dumps({"path": sys.executable, "version": sys.version.split()[0]}))',
    ]);
    const info = JSON.parse(result.stdout.trim()) as { path?: string; version?: string };
    return { available: true, version: info.version, path: info.path };
  } catch (err) {
    return {
      available: false,
      guidance: 'Install Python 3.10+ or set INKDROP_VIDEO_CAPTIONS_PYTHON to a Python executable.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkWhisperX(): Promise<ToolHealth> {
  try {
    const result = await runProcess(getPythonPath(), [
      '-c',
      'import json, sys, torch, whisperx; print(json.dumps({"path": sys.executable, "version": getattr(whisperx, "__version__", "installed"), "cudaAvailable": bool(torch.cuda.is_available()), "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"}))',
    ]);
    const info = JSON.parse(result.stdout.trim()) as {
      path?: string;
      version?: string;
      cudaAvailable?: boolean;
      device?: string;
    };
    return {
      available: true,
      version: info.version || 'installed',
      path: info.path,
      cudaAvailable: info.cudaAvailable,
      device: info.device,
    };
  } catch (err) {
    return {
      available: false,
      guidance: 'Run npm run setup:whisperx or install WhisperX in the configured Python environment.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function firstLine(value: string): string | undefined {
  return value.split(/\r?\n/).find(Boolean);
}
