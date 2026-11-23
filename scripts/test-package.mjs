import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';
import { decoratorTransform, oxcOptions } from './vite-transform.mts';

// The consumer sample below uses a decorator, and Oxc (Vite 8) cannot lower
// TC39 Stage 3 decorators yet, so Babel handles the decorator-bearing files.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.env.npm_execpath;

if (!npm) throw new Error('Run this script through npm run test:package');

const temporary = await mkdtemp(join(tmpdir(), 'mvvm-dom-consumer-'));

function run(file, args, cwd) {

  return execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

try {

  const packResult = JSON.parse(run(process.execPath, [npm, 'pack', '--json', '--pack-destination', temporary], root));
  // npm 11 returns an array; npm 12 returns an object keyed by package name.
  const packages = Array.isArray(packResult) ? packResult : Object.values(packResult);

  if (packages.length !== 1 || !Array.isArray(packages[0]?.files) || typeof packages[0]?.filename !== 'string') {
    throw new Error('Unexpected npm pack result: expected exactly one package with files and filename');
  }

  const packed = packages[0];
  const names = new Set(packed.files.map(file => file.path));

  for (const required of ['package.json', 'LICENSE', 'README.md', 'docs/guide.md', 'docs/testing.md', 'docs/custom-bindings.md', 'dist/index.js', 'dist/index.d.ts']) {
    if (!names.has(required)) throw new Error(`Missing package file: ${required}`);
  }

  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

  if (Object.keys(manifest.dependencies ?? {}).length) throw new Error('Unexpected runtime dependencies');
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund', join(temporary, packed.filename)], temporary);

  const installed = join(temporary, 'node_modules', 'mvvm-dom');
  const installedManifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  if (installedManifest.version !== manifest.version) throw new Error('Tarball version differs from the source manifest');
  if (Object.keys(installedManifest.dependencies ?? {}).length) throw new Error('Tarball has runtime dependencies');

  let importIndex = 0;

  for (const name of ['README.md', 'CHANGELOG.md', 'docs/guide.md', 'docs/guide.en.md', 'docs/api.md', 'docs/api.en.md', 'docs/custom-bindings.md', 'docs/custom-bindings.en.md', 'docs/testing.md', 'docs/testing.en.md']) {
    const text = await readFile(join(installed, name), 'utf8');

    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^(https?:|mailto:)/.test(link)) continue;
      await readFile(resolve(installed, dirname(name), decodeURIComponent(link)));
    }

    for (const match of text.matchAll(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"]mvvm-dom['"];?/g)) {
      await writeFile(join(temporary, `doc-import-${importIndex++}.ts`), `${match[0]}\n`);
    }

  }

  if (!importIndex) throw new Error('No documentation imports were checked');

  const nodeCheck = `
    import { ViewModel, propertyChange } from 'mvvm-dom';
    const model = new ViewModel();
    model.registerProperty('name', 'Node');
    if (model.getPropertyValue('name') !== 'Node' || typeof propertyChange !== 'function') throw new Error('Invalid ESM exports');
    model.dispose();
  `;

  await writeFile(join(temporary, 'node-check.mjs'), nodeCheck);
  run(process.execPath, ['node-check.mjs'], temporary);

  const sample = `
    import { View, ViewModel, propertyChange } from 'mvvm-dom';
    class Model extends ViewModel {
      @propertyChange() accessor name = 'Anna';
    }
    declare global { interface Window { model: Model } }
    const model = new Model();
    const template = document.getElementById('form');
    if (!(template instanceof HTMLTemplateElement)) throw new Error('Missing template');
    const view = new View(template, model);
    document.body.append(...view.viewNodeList);
    window.model = model;
  `;

  await writeFile(join(temporary, 'consumer.ts'), sample);

  await writeFile(join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020', lib: ['ES2020', 'DOM', 'ESNext.Decorators'],
      module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      noEmit: true, useDefineForClassFields: false, skipLibCheck: true,
    },
    include: ['consumer.ts', 'doc-import-*.ts'],
  }));

  run(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], temporary);

  await writeFile(join(temporary, 'index.html'), `<template id="form"><input data-bind="{value: name, mode: twoWay, triggerType: input}"></template><script type="module" src="/consumer.ts"></script>`);
  
  const config = {
    configFile: false,
    root: temporary,
    oxc: oxcOptions,
    plugins: [decoratorTransform()],
    build: { outDir: 'build' },
    logLevel: 'error',
  };

  await build(config);
  const server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } });
  let browser;
 
  try {

    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Vite did not bind a TCP port');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(`http://127.0.0.1:${address.port}`);
    if (!response?.ok()) throw new Error(`Consumer page failed: ${response?.status()}`);
    const input = page.locator('input');
    await input.waitFor();
    if (await input.inputValue() !== 'Anna') throw new Error('Initial model value did not reach DOM');
    await input.fill('Ola');
    if (await page.evaluate(() => window.model.name) !== 'Ola') throw new Error('Input did not update model');

  } finally {

    if (browser) await browser.close();
    await server.close();

  }
  console.log('Tarball, documentation links/imports, Node ESM, NodeNext types, Vite build and Chromium consumer passed.');

} finally {

  await rm(temporary, { recursive: true, force: true });
  
}
