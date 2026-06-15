import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVideoCaptionsServer } from '../src/api/http.js';
import { JobStore, sanitizeFileName } from '../src/api/job-store.js';
import { isAllowedOrigin } from '../src/api/security.js';

describe('API security helpers', () => {
  it('allows local origins and the deployed GitHub Pages origin', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(isAllowedOrigin('https://keildelaman.github.io')).toBe(true);
  });

  it('rejects unknown web origins', () => {
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin('http://192.168.1.10:5173')).toBe(false);
  });

  it('sanitizes uploaded filenames', () => {
    expect(sanitizeFileName('..\\bad:name?.mp4', 'fallback.mp4')).toBe('bad_name_.mp4');
    expect(sanitizeFileName('', 'fallback.mp4')).toBe('fallback.mp4');
  });
});

describe('video captions HTTP API', () => {
  let rootDir: string;
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'inkdrop-video-captions-'));
    const { server } = createVideoCaptionsServer({
      rootDir,
      token: 'test-token',
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () => new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  afterEach(async () => {
    await closeServer();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('returns health without a token', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json() as { authRequired: boolean };

    expect(response.status).toBe(200);
    expect(body.authRequired).toBe(true);
  });

  it('rejects job creation without a token', async () => {
    const response = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      body: JSON.stringify({ fileName: 'video.mp4' }),
    });

    expect(response.status).toBe(401);
  });

  it('validates the local session token without creating a job', async () => {
    const missingTokenResponse = await fetch(`${baseUrl}/session`);
    expect(missingTokenResponse.status).toBe(401);

    const validTokenResponse = await fetch(`${baseUrl}/session`, {
      headers: {
        'X-InkDrop-Token': 'test-token',
      },
    });
    const body = await validTokenResponse.json() as { ok: boolean };

    expect(validTokenResponse.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('creates a job with a valid token and allowed origin', async () => {
    const response = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-InkDrop-Token': 'test-token',
      },
      body: JSON.stringify({
        fileName: 'video.mp4',
        fileSize: 123,
        mimeType: 'video/mp4',
      }),
    });
    const body = await response.json() as { id: string; status: string; hasInput: boolean };

    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('created');
    expect(body.hasInput).toBe(false);
  });

  it('publishes detailed script review fields on public jobs', async () => {
    const store = new JobStore(rootDir);
    const job = await store.createJob({ fileName: 'video.mp4' });
    const updated = store.updateJob(job.id, {
      progressLabel: 'Timings ready.',
      rawTimestamps: {
        totalDuration: 1,
        wordCount: 1,
        language: 'de',
        words: [{ word: 'Wort', start: 0, end: 0.4 }],
      },
      reviewedTimestamps: {
        totalDuration: 1,
        wordCount: 1,
        language: 'de',
        words: [{ word: 'Hallo', start: 0, end: 0.4 }],
      },
      scriptReview: {
        confidence: 0.5,
        matched: 1,
        changed: 1,
        missing: 0,
        extra: 1,
        scriptWordCount: 2,
        transcriptWordCount: 3,
        reviewedWordCount: 2,
        warnings: ['Review needed.'],
      },
      scriptReviewWords: [
        { word: 'Hallo', start: 0, end: 0.4, status: 'matched', transcriptWord: 'Hallo' },
        { word: 'Welt', start: 0.5, end: 0.8, status: 'changed', transcriptWord: 'Wort' },
      ],
      scriptReviewExtraWords: [
        { word: 'extra', start: 0.9, end: 1 },
      ],
    });

    const publicJob = store.toPublicJob(updated);

    expect(publicJob.hasTimestamps).toBe(true);
    expect(publicJob.rawTimestamps?.words).toEqual([{ word: 'Wort', start: 0, end: 0.4 }]);
    expect(publicJob.reviewedTimestamps?.words).toEqual([{ word: 'Hallo', start: 0, end: 0.4 }]);
    expect(publicJob.scriptReviewWords?.map((word) => word.status)).toEqual(['matched', 'changed']);
    expect(publicJob.scriptReviewExtraWords).toEqual([{ word: 'extra', start: 0.9, end: 1 }]);
  });

  it('validates align requests before running WhisperX', async () => {
    const createResponse = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-InkDrop-Token': 'test-token',
      },
      body: JSON.stringify({ fileName: 'video.mp4' }),
    });
    const created = await createResponse.json() as { id: string };

    const badScriptResponse = await fetch(`${baseUrl}/jobs/${created.id}/align`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-InkDrop-Token': 'test-token',
      },
      body: JSON.stringify({ script: 123 }),
    });

    expect(badScriptResponse.status).toBe(400);

    const missingUploadResponse = await fetch(`${baseUrl}/jobs/${created.id}/align`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-InkDrop-Token': 'test-token',
      },
      body: JSON.stringify({ language: 'de', model: 'medium' }),
    });

    expect(missingUploadResponse.status).toBe(409);
  });

  it('rejects disallowed preflight origins', async () => {
    const response = await fetch(`${baseUrl}/jobs`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(response.status).toBe(403);
  });
});
