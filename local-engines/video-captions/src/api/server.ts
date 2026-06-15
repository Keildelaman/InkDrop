import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVideoCaptionsServer } from './http.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(moduleDir, '../..');
const host = '127.0.0.1';
const port = Number(process.env.INKDROP_VIDEO_CAPTIONS_PORT ?? 4777);
const token = process.env.INKDROP_VIDEO_CAPTIONS_TOKEN ?? randomBytes(24).toString('base64url');
const connectionUrl = `http://${host}:${port}/?token=${encodeURIComponent(token)}`;

const { server } = createVideoCaptionsServer({
  rootDir: engineRoot,
  token,
});

server.listen(port, host, () => {
  console.log('InkDrop video captions engine is running.');
  console.log(`Health: http://${host}:${port}/health`);
  console.log(`Connection URL: ${connectionUrl}`);
  console.log('Keep this terminal open while rendering from InkDrop.');
});

server.on('error', (err) => {
  console.error('Failed to start video captions engine:', err);
  process.exitCode = 1;
});
