// Sunset Shores — a tiny static file server for local playtesting.
// Serves this repository directory so game/index.html opens in a browser.
// Usage: node serve.ts [port]   (default port 8903)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8903);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/game/index.html';
    const file = normalize(join(repoRoot, path));
    if (!file.startsWith(repoRoot + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    const bytes = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Sunset Shores dev server: http://localhost:${port}/game/index.html`);
});
