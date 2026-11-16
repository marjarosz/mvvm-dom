# mvvm-dom

A TypeScript MVVM library that connects models to plain HTML through DOM
bindings, commands and observable collections. No runtime dependencies.

[User guide](docs/guide.en.md) · [API reference](docs/api.en.md) ·
[Demo source](https://github.com/marjarosz/mvvm-dom/tree/main/demo) ·
[Changelog](CHANGELOG.md) · [Polska dokumentacja](docs/guide.md)

## What it does

Use mvvm-dom to add reactive forms, lists and interactions to browser interfaces
built with HTML templates. Model changes update the bound DOM nodes directly;
two-way bindings write user input back to the model. There is no virtual DOM
or framework-specific template compiler.

- **Models and forms:** reactive properties, one-way and two-way bindings,
  synchronous validation and value converters.
- **Commands:** DOM event bindings, parameters, `canExecute` and optional
  blocking while an asynchronous command is running.
- **Data collections:** `CollectionObserver` with the `collection` binding
  creates rows from a template and observes changes to their data.
- **Collections of views:** `ArrayObserver<View>` with `innerHTML` manages
  existing views, preserving their state when reordered.
- **Explicit lifecycle:** detach views for reuse; dispose them to release
  bindings and subscriptions.
- **Extensions:** register custom property bindings, structural bindings,
  command bindings, validation error bindings and converters.

The library handles model-to-DOM connections. Application structure, routing,
data fetching and persistence remain under your control.

## Installation and requirements

```sh
npm install mvvm-dom
```

The package provides **ES modules and TypeScript declarations**. Use an
ESM-capable application build or module loader; a CommonJS entry point is not
provided. Creating views requires a browser DOM. Bindings that observe element
dimensions or DOM mutations also require `ResizeObserver` or `MutationObserver`.

**Decorators are optional.** The example below uses the registration API and
works without decorator transforms. If you use decorators, configure your
compiler for standard ECMAScript decorators and auto-accessors (TypeScript 5.2
or newer), not legacy `experimentalDecorators`. Your build tool must transform
that syntax for its target browsers; see the [guide](docs/guide.en.md).

## Quick start

Add the template and a host element to your page:

```html
<template id="user-form">
  <label>
    Name
    <input data-bind="{value: name, mode: twoWay, triggerType: input}">
  </label>
  <p>Hello, <span data-bind="{text: name}"></span>!</p>
</template>
<div id="app"></div>
```

Run this module through your application build after the HTML is available:

```ts
import { View, ViewModel } from 'mvvm-dom';

const template = document.getElementById('user-form');
const host = document.getElementById('app');
if (!(template instanceof HTMLTemplateElement) || !host) {
  throw new Error('Missing user-form template or app host');
}

const model = new ViewModel();
model.registerProperty('name', 'Anna');

const view = new View(template, model);
host.append(...view.viewNodeList);

// Model changes update both the input and the greeting.
model.setPropertyValueAndNotify('name', 'Ola');

// When the interface is no longer needed, call:
// view.dispose();
```

Typing into the input updates the model and the greeting. Bindings default to
model → view; `mode: twoWay` enables writing back to the model.

### The same example with a decorator

Alternatively, use `@propertyChange()` to register a reactive accessor. Keep the
same HTML template and mounting code; replace the model declaration above with:

```ts
import { ViewModel, propertyChange } from 'mvvm-dom';

class UserModel extends ViewModel {
  @propertyChange()
  accessor name = 'Anna';
}

const model = new UserModel();
```

After mounting the view, assign `model.name = 'Ola'` instead of calling
`setPropertyValueAndNotify()`. The decorator publishes the change automatically;
typing into the input updates the same accessor through the two-way binding.
Use `accessor`, not a plain class field, and the standard decorator configuration
described above. The HTML binding declaration is identical in both versions.

## Lifecycle and ownership

- `view.detach()` removes its nodes but keeps bindings and subscriptions alive
  so the same view can be reattached.
- `view.dispose()` removes its nodes and releases its bindings and subscriptions.
  By default, it also disposes the supplied model.
- For a shared model, create views with
  `new View(template, model, undefined, { ownsDataContext: false })` and let the
  application's owner dispose the model after all its views are finished.
- The `innerHTML` binding borrows child views: removing a view from its array
  detaches it. The owner must call `dispose()` when that child is no longer needed.

See the [guide](docs/guide.en.md) for collection ownership, validation,
converters and binding modes. Use `text` or interpolation for user-supplied
content; string values passed to `innerHTML` must be trusted HTML.

## Documentation

| Topic | English | Polski |
| --- | --- | --- |
| Usage and examples | [User guide](docs/guide.en.md) | [Podręcznik](docs/guide.md) |
| Public API | [API reference](docs/api.en.md) | [Referencja API](docs/api.md) |
| Extension points | [Custom bindings](docs/custom-bindings.en.md) | [Własne bindingi](docs/custom-bindings.md) |
| Build and tests | [Development guide](docs/testing.en.md) | [Budowanie i testy](docs/testing.md) |

## Roadmap

These are future directions, **not features available in 1.0.0**. Planned items
express intended work; API details, release order and timing may change.
Considering items are exploratory. No release dates are committed.

| Direction | Status | Intended benefit |
| --- | --- | --- |
| Async validation | Planned | Pending state and validation that can wait for external results |
| Accessible validation feedback | Planned | Better integration of error messages with field accessibility attributes |
| Batched notifications | Planned | Fewer repeated DOM updates during related model changes |
| One-time bindings and debounced input | Planned | More control over when values propagate |
| Declarative sub-views / components | Planned | Compose views with their own models and parameters |
| Keyed reconciliation for large collections | Planned | Retain row identity across replacement data and improve matching performance |
| Routing companion package | Planned | Navigation built on the view-composition API |
| Windowed list rendering | Considering | Render only the visible portion of large lists |
| Translation companion package | Considering | Reactive locale and translation support |

The core is intended to remain dependency-free. Routing and translation are
planned as optional companion packages. Existing `View` composition and
reference-based list reconciliation are already available; the roadmap extends
those capabilities. Released functionality is recorded in the [changelog](CHANGELOG.md).

## Development and feedback

From a checkout of the [repository](https://github.com/marjarosz/mvvm-dom), with
the tooling described in the [development guide](docs/testing.en.md):

```sh
npm ci
npx playwright install chromium
npm run check
```

`check` runs type checks, unit tests, the library build, browser tests and a
packed-package consumer test. To explore or verify the demo:

```sh
npm run demo:dev
# For browser tests of the built demo:
npx playwright install chromium firefox webkit
npm run test:demo
```

For bug reports, include the library version, browser, build-tool versions and
a small reproducible example. Feature proposals should describe the use case;
roadmap entries are a starting point for discussion.

## License

[MIT](LICENSE).
