# Changelog

All notable changes to this project are documented in this file.

## 1.0.2 - 2026-11-23

- Prevent disposed command bindings from reconnecting through callbacks retained
  in a command-registry notification snapshot. Add lifecycle regression tests
  for registry changes, disposal during input handling and recovery after a
  real input callback throws, including synchronization with a surviving view.

- Include the original thrown value in CompositeDisposable teardown warnings,
  preserving cleanup order, continuation after failures and idempotency.

- Continue command registry notifications after listener failures, then rethrow
  the first original thrown value. Preserve listener snapshots and synchronous
  nested notifications; registry changes are not rolled back. Add regression
  tests for both registry operations and shared-view command availability.

- Publish retained property values after validator/callback exceptions in
  `setPropertyValueFromView` and `setPropertyValueAndNotify`, then rethrow the
  original error. Preserve View-write coalescing, explicit-write behavior and
  silent `setPropertyValue`. Skip completion for disposed models and removed
  or re-registered properties. Add regression coverage and document the contract.


## 1.0.1 - 2026-11-19

- Document the complete empty-value binding matrix in Polish and English, including selection errors, structural bindings, scroll no-ops and style ownership.
- Add regression coverage for remaining empty-value contracts and decorator callback directions, including identical writes, both validation/propertyChange stacking orders and real input writeback. Verify empty style behavior against real browser CSS.

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

- Fixed `style` binding retaining stale styles for `null` and `undefined`:
  both now follow the existing empty-string behavior. With `styleName`, only
  the named declaration is cleared; without it, the entire inline style is
  cleared and `style=""` remains. This also clears template inline styles on
  the first render when the bound value is nullish. Whole-style bindings can
  overwrite declarations set by other bindings; use distinct `styleName`
  properties when combining bindings.

- Fixed `display` binding retaining its previous state for `null` and
  `undefined`: both now apply `falseVal` (`none` by default), including on
  the first render. An empty string still clears only the inline `display`
  declaration so CSS can determine the display mode. Other inline styles are
  preserved. Added unit and browser coverage for these distinct behaviors.

- Fixed `radio` binding selecting `value=""` for `null` or `undefined`.
  Nullish values now uncheck bound radios, including on the first render;
  an empty string still selects `value=""`. This changes the documented
  1.0.0 behavior: applications that need the empty-value option selected must
  explicitly use `''` instead of nullish. Non-null conversion and two-way
  user selection remain unchanged.

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
