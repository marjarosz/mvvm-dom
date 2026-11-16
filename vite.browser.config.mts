import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { decoratorTransform, oxcOptions } from './scripts/vite-transform.mts';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [decoratorTransform()],
  root: local('./tests/browser/fixture'),
  publicDir: false,
  resolve: { alias: { '@mvvm': local('./src') } },
  oxc: oxcOptions,
  server: {
    host: '127.0.0.1', port: 4179, strictPort: true,
    fs: { allow: [local('./tests/browser/fixture'), local('./src'), local('./node_modules')] },
  },
});
