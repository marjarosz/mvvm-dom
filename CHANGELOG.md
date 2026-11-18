# Changelog

All notable changes to this project are documented in this file.


## 1.0.1 - Unreleased

- Corrected the Polish and English guides: `null` and `undefined` render as
  empty text in `text`, `value`, the text path of `innerHTML` and `interpolate`.
  Other values on these paths use `String(...)` conversion.
- Clarified callback execution for `@propertyChange`, `@validate` and
  `@propertyAlias` in JSDoc, API references and guides. Plain accessor assignment
  and initialization do not invoke the callback. Explicit writes follow
  `callbackExecute`; View writes invoke it only when the value changes according
  to `Object.is`. Updated property-registration and metadata descriptions too.
- The documentation corrections above describe existing behavior.
- Fixed `class` binding retaining stale dynamic classes for `null` and
  `undefined`: these values now clear dynamic classes, just like an empty
  string. Template classes remain intact, including on the first render,
  and subsequent string values can add dynamic classes again. Other non-string
  inputs remain ignored. Public API signatures are unchanged.

## 1.0.0 - 2026-11-11

First stable release.

- Reactive model properties with dependency-property semantics
- Declarative `data-bind` bindings (value, text, innerHTML, if, class, style,
  checked, radio, options, visibility, sizing, scroll, interpolation)
- Reactive data rows with `CollectionObserver` and `collection`
- Collections of views with `ArrayObserver<View>` and `innerHTML`
- Restored nested ViewModel observation after item listeners resubscribe,
  including cached proxies, shared models and cyclic object graphs
- Commands with enable/disable state and event wiring
- Validation integration (`validationErrorBinding`, `ViewModelValidator`)
- Extension points: custom bindings (`BindingFactory`) and value converters
  (`registerConverter`)
- English and Polish documentation (`docs/`)
- Public extension registries for command event bindings
  (`CommandBindingFactory.registerCommandBinding`) and validation error
  bindings (`ValidationErrorBindingFactory.registerValidationErrorBinding`),
  with exported factory types (`CommandBindingCreate`,
  `ValidationErrorBindingCreate`), name collision checks mirroring
  `BindingFactory`, and Map-backed registries so any name (including
  `constructor`/`toString`/`__proto__`) is safe to register and resolve