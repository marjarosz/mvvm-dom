# Changelog

All notable changes to this project are documented in this file.

## 1.0.0 - 2026-11-11

First stable release.

- Public extension registries for command event bindings
  (`CommandBindingFactory.registerCommandBinding`) and validation error
  bindings (`ValidationErrorBindingFactory.registerValidationErrorBinding`),
  with exported factory types (`CommandBindingCreate`,
  `ValidationErrorBindingCreate`), name collision checks mirroring
  `BindingFactory`, and Map-backed registries so any name (including
  `constructor`/`toString`/`__proto__`) is safe to register and resolve
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
