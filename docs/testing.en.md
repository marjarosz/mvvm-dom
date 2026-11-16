# Building and testing

Git, Node.js 24 and npm are required to work with the sources. Node is a
development tool; the views need a browser DOM. Development packages are
specified in `package-lock.json`; the library has no runtime dependencies.

In the project root directory:

```sh
npm ci
npm run types
npm test
npm run coverage
npm run build
```

`npm run test:watch` runs the tests in watch mode. The coverage report is in
`coverage/`. Green tests alone do not guarantee full coverage.

## Real browser

```sh
npx playwright install chromium
npm run test:browser
```

Playwright starts a temporary Vite server on `127.0.0.1:4179`, so the port
must be free. The tests cover Chromium; they do not claim compatibility with
other browsers. The HTML report is in `playwright-report/`, and failure traces
are in `test-results/`.

`npm run test:package` installs the tarball into a temporary project and checks
the ESM import in Node, the TypeScript declarations and a browser example with
Vite. It requires a previous build and an installed Chromium.

```sh
npm run test:package
```

`npm run check` runs the type check, unit tests, build, browser tests and the
package test. On Windows, when PowerShell blocks `npm.ps1`, use `npm.cmd` and
`npx.cmd` instead of `npm` and `npx`.

Do not enable `experimentalDecorators`: the library uses standard decorators
and auto-accessors. If installation fails, first check the Node version and the
output of `npm ci`; do not weaken test assertions just to get a green run.

## Demo and GitHub Pages

```sh
npm run demo:dev
npx playwright install chromium firefox webkit
npm run test:demo
```

`test:demo` checks demo types, builds the self-contained `docs-demo/index.html`,
then tests that production artifact in Chromium, Firefox and WebKit, including
an emulated mobile viewport. Its temporary server uses port 4180 and the
`/mvvm-dom/` subpath. The suite covers task editing, validation, asynchronous
saving and cancellation, resets, source panels, shared-view ownership, theme
persistence, fragment links and layout overflow. Mobile emulation is not a
physical-device test.

`npm run demo:build` creates a single HTML file that also opens directly from
disk. GitHub deployment configuration is maintained outside this repository.
The artifact to publish is `docs-demo`; run the type checks, unit tests and
`npm run test:demo` before publishing it. Demo data is session-local; only the
theme preference is stored in localStorage.
