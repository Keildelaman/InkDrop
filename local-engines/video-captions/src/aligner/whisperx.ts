import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../ffmpeg/process.js';
import { validateTimestamps } from '../subtitles/generator.js';
import type { TimestampsFile } from '../subtitles/types.js';

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

export interface WhisperXAlignmentOptions {
  audioPath: string;
  outputPath: string;
  language: string;
  model: WhisperModel;
  pythonPath?: string;
  onProgress?: (message: string) => void;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(moduleDir, '../..');
const alignerScriptPath = resolve(moduleDir, 'align.py');

export function getPythonPath(): string {
  if (process.env.INKDROP_VIDEO_CAPTIONS_PYTHON) {
    return process.env.INKDROP_VIDEO_CAPTIONS_PYTHON;
  }

  const venvPython = process.platform === 'win32'
    ? resolve(engineRoot, '.venv/Scripts/python.exe')
    : resolve(engineRoot, '.venv/bin/python');

  return existsSync(venvPython) ? venvPython : 'python';
}

export async function runWhisperXAlignment(options: WhisperXAlignmentOptions): Promise<TimestampsFile> {
  const pythonPath = options.pythonPath || getPythonPath();
  await runProcess(
    pythonPath,
    [
      alignerScriptPath,
      '--audio',
      options.audioPath,
      '--language',
      options.language,
      '--output',
      options.outputPath,
      '--model',
      options.model,
    ],
    {
      env: {
        PYTHONIOENCODING: 'utf-8',
        HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
      },
      onStdout: options.onProgress,
      onStderr: options.onProgress,
    }
  );

  const raw = await readFile(options.outputPath, 'utf8');
  return validateTimestamps(JSON.parse(raw));
}
