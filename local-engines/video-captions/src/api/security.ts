import type { IncomingMessage } from 'node:http';

const GITHUB_PAGES_ORIGINS = new Set(['https://keildelaman.github.io']);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);

    if (url.protocol === 'https:' && GITHUB_PAGES_ORIGINS.has(url.origin)) {
      return true;
    }

    if (url.protocol !== 'http:') {
      return false;
    }

    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  } catch {
    return false;
  }
}

export function getRequestOrigin(req: IncomingMessage): string | undefined {
  const origin = req.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

export function isAuthorized(req: IncomingMessage, token: string): boolean {
  const provided = req.headers['x-inkdrop-token'];
  return !Array.isArray(provided) && provided === token;
}
