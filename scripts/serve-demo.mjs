// Serve the production artifact under the same subpath as a GitHub project page.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../docs-demo/index.html', import.meta.url));
export const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/mvvm-dom' || path === '/') {
        response.writeHead(302, { Location: '/mvvm-dom/' }); response.end(); return;
    }
    if (path !== '/mvvm-dom/' && path !== '/mvvm-dom/index.html') {
        response.writeHead(404); response.end('Not found'); return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html);
}).listen(4180, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4180/mvvm-dom/'));
