# MVVM - adding custom bindings

The examples use the public API of the `mvvm-dom` package.

## Division of responsibilities

A binding implements element behaviour. `View` connects it to the context,
passes values, applies converters for regular bindings and manages
subscriptions. Adding a binding does not require a conditional branch in `View`
nor does the binding import `View`. Register the factory before creating views.

## Regular binding - the aria-label attribute

The complete module below adds a binding that works from the model to the DOM.

```ts
import { Binding } from 'mvvm-dom';
import { BindingMode } from 'mvvm-dom';
import { BindingFactory } from 'mvvm-dom';

export class AriaLabelBinding extends Binding {
  constructor(element: HTMLElement, propertyName: string, args: string[]) {
    super(element, propertyName, args);
    if (this.mode !== BindingMode.OneWay) {
      throw new Error('ariaLabel supports only mode: oneWay');
    }
    if (Object.keys(this.args).length) {
      throw new Error('ariaLabel does not accept extra arguments');
    }
  }

  setValue(value: unknown): void {
    if (value == null) this.element.removeAttribute('aria-label');
    else this.element.setAttribute('aria-label', String(value));
  }
}

BindingFactory.registerBinding('ariaLabel', (element, name, args) =>
  new AriaLabelBinding(element, name, args));
```

```html
<button data-bind="{ariaLabel: accessibleName}">Save</button>
```

The base class provides `mode` parsing, subscriptions and idempotent teardown
of the binding's own event listeners. It does not automatically tear down DOM
listeners or observers created by the derived class.

For the reverse direction, listen to the appropriate event only in
`OneWayToSource`/`TwoWay` and call the protected `dispatchEvent(value)`.
Do not write to the ViewModel yourself: write coordination, back-conversion
and notifications belong to the existing infrastructure. `setValue` should
update the DOM without unconditionally emitting a reverse event.

## Structural binding - a branch for the ready state

A structural binding receives an `IBindingFragment`, not a `View` instance.

```ts
import { BindingFactory } from 'mvvm-dom';
import type { IBindingFragment, IStructuralBinding } from 'mvvm-dom';

export class WhenReadyBinding implements IStructuralBinding {
  constructor(private readonly fragment: IBindingFragment, args: string[]) {
    if (args.length) throw new Error('whenReady does not accept arguments');
  }

  setValue(value: unknown): void {
    if (value === 'ready') this.fragment.mount();
    else this.fragment.unmount();
  }
}

BindingFactory.registerStructuralBinding('whenReady', (fragment, _name, args) =>
  new WhenReadyBinding(fragment, args));
```

```html
<section data-bind="{whenReady: status}">
  <span data-bind="{text: title}"></span>
  <button data-command="{click: save}">Save</button>
</section>
```

The fragment manages the anchor and the branch instance. `unmount()` removes
the branch along with its bindings and commands; a subsequent `mount()` creates
new DOM. The model is borrowed. The fragment is owned by the view
infrastructure, not by the custom binding. The binding's optional `dispose()`
is for its own resources.

`setValue` receives the raw model value: structural bindings do not use the
automatic converters of regular bindings. One element may have one structural
binding plus additional regular bindings. Both registries share one namespace;
re-registering a name is an error, not an override.

For collections, the fragment offers optional `createChild` and `setChildren`.
Check their availability before use. A child that was created but not handed to
the fragment due to an error must be released by its creator. `setChildren`
keeps the instances it is given and releases the children it omits.

## Command event binding - the double click

A command binding type is registered in `CommandBindingFactory` and used by the
`data-command` attribute. The command registry has its own namespace, separate
from the binding registries.

```ts
import { CommandBindingFactory, EventCommandBinding } from 'mvvm-dom';
import type { ICommandActionEventTarget, IEventCommandBinding } from 'mvvm-dom';

export class DblClickCommandBinding extends EventCommandBinding implements IEventCommandBinding {
  private dblCallback = this.dblClickElement.bind(this);

  constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget) {
    super(element, commandName, argList, eventTarget);
    this.element.addEventListener('dblclick', this.dblCallback);
  }

  private dblClickElement(event: Event): void {
    this.eventTarget.commandAction(this.commandName, this.element, event);
  }

  public override dispose(): void {
    this.element.removeEventListener('dblclick', this.dblCallback);
    super.dispose();
  }
}

CommandBindingFactory.registerCommandBinding('dblClick',
  (element, name, args, eventTarget) => new DblClickCommandBinding(element, name, args, eventTarget));
```

```html
<button data-command="{dblClick: save}">Edit</button>
```

The `EventCommandBinding` base class parses the `name:value` arguments into
`args`, manages the `command-action` subscriptions and tears them down in
`dispose()`. The factory always receives a provided `eventTarget`. The binding
only has to listen to its event and call `eventTarget.commandAction(...)`;
command execution, `canExecute` and the `parameter` are handled by the
type-agnostic `CommandBindingCoordinator`.

## Validation error binding - aria-invalid

A validation error binding type is registered in `ValidationErrorBindingFactory`
and used by the `data-validate-error` attribute. That registry has its own
namespace; the names `class`, `message` and the `click` alias are taken.

```ts
import { ValidationErrorBinding, ValidationErrorBindingFactory } from 'mvvm-dom';
import type { IValidationErrorBinding } from 'mvvm-dom';

export class AriaInvalidErrorBinding extends ValidationErrorBinding implements IValidationErrorBinding {
  setValid(isValid: boolean, message?: string): void {
    super.setValid(isValid, message);
    this.element.setAttribute('aria-invalid', isValid ? 'false' : 'true');
    this.element.title = isValid ? '' : (message ?? '');
  }

  reset(): void {
    super.reset();
    this.element.setAttribute('aria-invalid', 'false');
    this.element.title = '';
  }
}

ValidationErrorBindingFactory.registerValidationErrorBinding('ariaInvalid',
  (element, name, args, eventTarget) => new AriaInvalidErrorBinding(element, name, args, eventTarget));
```

```html
<input data-bind="{value: name}" data-validate-error="{ariaInvalid: name}">
```

The base class manages the `error-change` subscriptions and argument parsing.
`View` invokes `setValid`/`reset` in reaction to the property validation state
- the binding only renders the DOM.

## Initialization and resources

`beginInitialization()` and `endInitialization()` belong to the regular
`IBinding`. The first method is called after construction, before setting
values; the second after regular bindings and subscriptions are prepared. On an
error there is no guarantee that `endInitialization()` will run - `dispose()`
must work even before it.

If the constructor or factory throws before returning an instance, it must
roll back its own partial initialization. `View` does not yet have an object it
could release. Every acquired resource must have symmetrical teardown. A
rollback error should not mask the original initialization error. The
`selectedValues` binding is a production example of this.

## Extension acceptance criteria

- The initial value and a later change produce the expected DOM.
- Supported directions cause no loops; unsupported ones are rejected explicitly.
- A missing or malformed argument has defined behaviour.
- `dispose()` detaches resources; calling it again is safe.
- An error at any initialization stage allows creation to be retried.
- A structural branch keeps nested bindings and commands working after remount
  and does not destroy the shared model.

Run instructions: [MVVM tests](testing.en.md).

## Verifying the examples

All complete TypeScript modules were type-checked in strict mode without
errors. In Chrome a shared scenario was verified: no branch at first, mounting,
setting aria-label, updating text, unmounting and remounting with current
data. This was an isolated execution of the examples, not the full Vitest
suite or the project's Playwright tests. The `dblClick` and `ariaInvalid`
examples are mirrored in the Vitest tests: `tests/unit/integration/customRegistries.test.ts`
registers the same types and drives them through `View`.
