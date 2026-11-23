import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { decoratorTransform, oxcOptions } from './scripts/vite-transform.mts';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const { version } = JSON.parse(readFileSync(local('./package.json'), 'utf8'));

export default defineConfig({
  plugins: [decoratorTransform(), {
    name: 'demo-package-version',
    transformIndexHtml: html => html.split('%MVVM_VERSION%').join(version),
  }],
  root: local('./demo'),
  base: './',
  publicDir: false,
  resolve: { alias: { '@mvvm': local('./src') } },
  oxc: oxcOptions,
  build: {
    outDir: local('./docs-demo'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    modulePreload: false,
    // Classic script bundle with stable names; scripts/inline-demo.mjs then
    // inlines it into index.html so the page also runs from file:// (no CORS).
    // Rolldown already forces one chunk for an iife build (codeSplitting: false),
    // so no inlineDynamicImports flag is needed here.
    rolldownOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/demo.js',
        assetFileNames: 'assets/demo[extname]',
      },
    },
  },
});
