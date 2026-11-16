// Post-processes the Vite demo build into a single self-contained
// docs-demo/index.html: the emitted IIFE script and stylesheet are inlined,
// so the page works opened directly from disk (file://), not only over HTTP.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs-demo');
const htmlPath = resolve(outDir, 'index.html');

const js = readFileSync(resolve(outDir, 'assets/demo.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(resolve(outDir, 'assets/demo.css'), 'utf8').replace(/<\/style/gi, '<\\/style');

let html = readFileSync(htmlPath, 'utf8');

let scripts = 0;
let styles = 0;
let jsTag = '';
html = html.replace(/<script[^>]*src="[^"]*demo\.js"[^>]*><\/script>/g, () => {
    scripts++;
    jsTag = `<script>\n${js}\n</script>`;
    return '';
});
html = html.replace(/<link[^>]*href="[^"]*demo\.css"[^>]*>/g, () => {
    styles++;
    return `<style>\n${css}\n</style>`;
});

if (scripts !== 1 || styles !== 1) {
    throw new Error(`inline-demo: expected 1 script + 1 stylesheet, found ${scripts} + ${styles}`);
}

// Vite emits the script into <head>; a classic inline script must run after
// the body is parsed, so re-insert it just before </body>.
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd === -1) throw new Error('inline-demo: no </body> in built HTML');
html = html.slice(0, bodyEnd) + jsTag + '\n' + html.slice(bodyEnd);

writeFileSync(htmlPath, html);
rmSync(resolve(outDir, 'assets'), { recursive: true, force: true });
console.log(`demo: self-contained docs-demo/index.html (${Math.round(html.length / 1024)} KB)`);
