// Tiny static preview server using Node built-ins. No package installation needed.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const productionPreview = process.argv.includes('--dist');
const root = fileURLToPath(new URL(productionPreview ? './dist/' : '.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root) || pathname.split('/').some(segment => segment.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    if (!(await stat(filename)).isFile()) throw new Error('Not a file');
    const content = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请使用 PORT=5174 npm start` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`\n  Cyber Aquarium${productionPreview ? ' · dist 生产文件预览' : ''}\n  Local: http://127.0.0.1:${port}\n  按 Ctrl+C 停止预览\n`));
