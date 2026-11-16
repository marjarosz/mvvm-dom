# MVVM - user guide

This document describes the `mvvm-dom` library. It covers not only the
`data-bind`, `data-command` and `data-validate-error` syntax, but also the
full data flow, view creation, validation, dynamic lists, object lifecycles
and the rules for preventing memory leaks.



### Companion documentation

- [API reference](api.en.md).
- [Adding custom bindings](custom-bindings.en.md).
- [Installation and running the tests](testing.en.md).
- [Library MIT license](../LICENSE).

Examples with truncated context (e.g. a bare class method) are fragments to be
inserted in the appropriate place. Imports come from the `mvvm-dom` package.

### Requirements and imports

The library requires no external dependencies.
It provides no validator implementations and does not require
an external validation library.

Decorators use standard ECMAScript syntax (TypeScript 5.2 or
later). Reactive properties must be declared as auto-accessors:

```ts
@propertyChange()
accessor name = 'Anna';
```

The `experimentalDecorators` option must not be enabled, because it selects an
incompatible, older decorator protocol. The decorators use ECMAScript
metadata; they do not require `reflect-metadata` or `emitDecoratorMetadata`.
Views need a browser DOM; the size and attribute bindings in the View →
ViewModel direction require `ResizeObserver` and `MutationObserver`
respectively.

## 1. Mental model

The library consists of four main parts:

```text
HTML template
  |
  | data-bind / data-command / data-validate-error
  v
View
  |
  | subscribes to changes and creates handler objects
  v
Binding / EventCommandBinding / ValidationErrorBinding
  |
  v
ViewModel
  |
  | properties, commands, validators, events
  v
application state and business logic
```

### ViewModel

`ViewModel` holds state and logic. It should not manipulate
the DOM directly. It publishes state changes through the `property-change`
event, and commands are exposed under names.

### View

`View` imports the template, finds the `data-*` attributes, creates the
appropriate handler objects for bindings and commands, and then connects
them to the `ViewModel`.

`View` also keeps a list of its nodes in `viewNodeList`. Thanks to this,
the view can be inserted into different containers without being recreated.

### Infrastructure parts

- `Binding` synchronizes a specific property with a DOM element.
- `EventCommandBinding` turns a DOM event into a named command.
- `ValidationErrorBinding` presents the validation state and message.
- `ArrayObserver` publishes array changes.
- `CollectionObserver` observes data collections and the objects reachable through them.
- `CompositeDisposable` stores teardown operations.
- `ViewFactory` creates `View` instances from a template and a dataContext.
- `ViewModelFactoryBase` abstract factory of ViewModel instances selected by name.

## 2. Minimal flow

A typical case looks like this:

```ts
import { View } from 'mvvm-dom';
import { ViewModel } from 'mvvm-dom';

class UserFormViewModel extends ViewModel {
  constructor() {
    super();
    this.registerProperty('name', 'Anna');
  }
}

const viewModel = new UserFormViewModel();
const source = document.getElementById('userFormTemplate');
if (!(source instanceof HTMLElement)) throw new Error('Missing userFormTemplate');
const view = new View(source, viewModel);

document.body.append(...view.viewNodeList);
```

Before running the code, place this in the document:

```html
<template id="userFormTemplate">
  <input data-bind="{value: name, mode: twoWay, triggerType: input}">
</template>
```

When you are done using the view, call `view.detach()`, then `view.dispose()`.
By default the view's dispose also destroys its ViewModel (section 12).

The `View` constructor takes:

```ts
constructor(
  template: HTMLElement,
  context?: IBindingContext,
  id?: number,
  options?: IViewOptions
)
```

`IViewOptions.ownsDataContext` (default `true`) controls whether `dispose()`
destroys the passed dataContext - the same as the `ownsDataContext` field.

- `template` - a `<template>` element or another `HTMLElement`, not its ID or HTML text.
- `context` - an optional `ViewModel` (dataContext).
- `id` - an optional view identifier (default `null`).

`View` also has a public `name: string` field (default `''`).

The view clones the contents of the `<template>` or the whole element passed
in. It does not look up the source in the document and does not parse HTML
text. `viewNodeList` also preserves root-level text, whitespace and comments.
For a root-level `if` it also contains the condition anchor and the currently
mounted branch. Fetch `view.viewNodeList` directly before attaching the view.

The `View` constructor works in the following order:

1. The `dataContext` is stored, i.e. the passed `ViewModel`.
2. The template is cloned with `document.importNode`.
3. `View` subscribes to `property-change`, `error-change` and `error-reset`.
4. Elements with structural bindings, e.g. `if` and `collection`, are separated into individual templates.
5. The view prepares regular bindings, validation, and then commands.
6. Structural bindings receive current model values and manage their fragments.

After the view is created, a value can flow in two directions:

```text
ViewModel property
  -> property-change
  -> View.propertyChange
  -> Binding.setValue
  -> DOM

DOM event
  -> Binding / EventCommandBinding
  -> View
  -> ViewModel.setPropertyValueFromView or ICommand.execute
```

## 3. ViewModel

### 3.1 Registering properties

A property can be registered manually:

```ts
export class UserViewModel extends ViewModel {
  constructor() {
    super();

    this.registerProperty('name', '');
    this.registerProperty('isActive', false);
  }
}
```

Reading and writing through the API:

```ts
const name = viewModel.getPropertyValue('name');

viewModel.setPropertyValue('name', 'Anna');
viewModel.setPropertyValueAndNotify('name', 'Anna');
```

The difference:

- `setPropertyValue` sets the value and optionally runs the property callback,
  but does not emit `property-change`; if validators are registered for the
  property, it also calls `validateProperty`;
- `setPropertyValueAndNotify` sets the value and then emits the change to the View;
- the third parameter `callbackExecute` defaults to `false` in
  `setPropertyValueAndNotify`.

In practice, to refresh the view, most often use:

```ts
this.setPropertyValueAndNotify('name', newName);
```

A change coming from the DOM, after conversion, reaches
`setPropertyValueFromView`. For a changed value the model stores the field,
validates it, runs the callback and broadcasts the final value to all views.
Repeating the same value according to `Object.is` skips the write. The source
control keeps its caret. If the callback normalizes the data, that same
control receives the corrected value too. Notifications of the same field
during the callback are coalesced. The event command sees the write result.
A custom context implementing `IBindingContext` may add this method. Older
contexts use the existing `setPropertyValue`. `setPropertyValue` and
`setPropertyValueAndNotify` do not register a missing property; first use
`registerProperty` or a decorated field initializer. These methods also do not
skip same-value writes.

### 3.2 Property callback

A property can have a callback run by `setPropertyValue`:

```ts
this.registerProperty(
  'scrollTopList',
  0,
  this.scrollChange.bind(this)
);
```

Do not use the callback as a replacement for `property-change`. The callback
may serve as a local ViewModel reaction, while `setPropertyValueAndNotify` is
the communication mechanism with the View.

**Important:** The callback is invoked only when `setPropertyValue` was called
with `callbackExecute = true` (the default). The `@propertyChange` and
`@validate` decorators use `setPropertyValueAndNotify`, which by default passes
`callbackExecute = false`, so a callback registered through a decorator
**is not invoked** when the property is set through the setter. It is,
however, invoked on a write coming from the View - `setPropertyValueFromView`
passes `callbackExecute = true`. This split is deliberate: the callback is
meant as a hook for changes arriving from the View/DOM (e.g.
`ResizeObserver`), not for every programmatic write from code.

### 3.3 ViewModel events

The ViewModel exposes:

- `subscribeProperties` / `unsubscribeProperties`;
- `subscribeValidationState` / `unsubscribeValidationState`;
- `subscribeValidationReset` / `unsubscribeValidationReset`.

Every manually added listener must later be detached with the same function
reference:

```ts
const callback = (event: Event) => {
  // reaction
};

viewModel.subscribeProperties(callback);
viewModel.unsubscribeProperties(callback);
```

Do not use this pattern:

```ts
viewModel.subscribeProperties(this.onChange.bind(this));
viewModel.unsubscribeProperties(this.onChange.bind(this));
```

Each `bind(this)` creates a new function. The second function is not equal to
the first, so the observer will stay attached.

The above concerns ViewModel subscriptions. In the base classes `Binding`,
`EventCommandBinding` and `ValidationErrorBinding`, `unsubscribe(callback)`
removes exactly the callback passed in, and `dispose()` detaches all stored
subscribers - so you can attach many listeners and detach them by name.
ArrayObserver has a separate multi-subscriber mechanism (section 11.3).

After the element's `dispose()`, calling `subscribe()` throws, so teardown is
unambiguous and a listener cannot accidentally be attached to a dead object.

## 4. Property decorators

### 4.1 `@propertyChange`

`@propertyChange()` creates a getter and setter connected to the ViewModel's
property map.

```ts
export class PanelViewModel extends ViewModel {
  @propertyChange()
  accessor title = '';

  @propertyChange()
  accessor visible = true;
}
```

The accessor's initializer registers the property in the ViewModel. On
subsequent sets it uses `setPropertyValueAndNotify`.

### 4.2 `@propertyChange(callback)`

You can point to a callback method:

```ts
@propertyChange('onWidthChanged')
accessor width = 0;

private onWidthChanged(value: unknown, propertyName: string) {
  // local ViewModel reaction
}
```

The callback is looked up on the object's prototype. The name must be correct.

**Note:** As described in section 3.2, a callback registered through a
decorator is invoked on a write coming from the View
(`setPropertyValueFromView`), not on a programmatic set through the setter,
because `setPropertyValueAndNotify` passes `callbackExecute = false` by default.

### 4.3 `@propertyAlias`

`@propertyAlias('realProperty')` lets you expose several names that point to
the same ViewModel property:

```ts
@propertyAlias('displayValue')
accessor aliasValue = '';
```

Use this carefully, because the name in the HTML may suggest a different state
than what is actually stored in the ViewModel.

### 4.4 Inheriting reactive accessors

Redeclaring the same accessor with a decorator, under the same model property
name, replaces its initial value, validator and callback:

```ts
class Base extends ViewModel {
  @propertyChange()
  @validate({ isValid: value => value === 'base' })
  accessor name = 'base';
}

class Child extends Base {
  @propertyChange()
  @validate({ isValid: value => value === 'child' })
  accessor name = 'child';
}
```

`new Child().name` returns `'child'` and is checked by the child's validator.
Initializers run in base → child order; each declaration registers its own
value and validates it once if it has a validator. Stacking `@validate` and
`@propertyChange` does not add a second write or a second validation. After
initialization only the child declaration's validator is used.

A new declaration without `@validate` removes the inherited declaration's
validator; likewise, omitting the callback removes the base callback. A derived
class alone, without a redeclaration, keeps the base property and its
configuration. The rules also apply to `@propertyAlias` when the public
property name stays the same. Other accessors pointing to a shared alias are
not treated as overriding the same declaration.

Initialization does not invoke the change callback. The callback works on
writes from the view according to the rules of section 3.2; the getter reads
the new model value immediately. In the base constructor do not call the
setters of accessors redeclared in the child: their private backing fields are
not initialized yet. At that stage you can use the model API to write; the
child's later initializer will replace such a value with its initial value.

## 5. Template and the `data-*` parser

### 5.1 Basic syntax

```html
<template id="userFormTemplate">
  <section data-bind="{class: panelClass}, {display: visible, trueVal: flex}">
    <h2 data-bind="{text: title}"></h2>
    <input data-bind="{value: name, mode: twoWay, triggerType: input}">
    <button data-command="{click: save}">Save</button>
  </section>
</template>
```

Type names are case-sensitive. The canonical name of the HTML binding is `innerHTML`.

### 5.2 Multiple bindings

Declarations can be separated with a comma or written next to each other,
e.g. `{click: save}{resize: refresh}`. A single comma after the last
declaration is allowed.

```html
<div data-bind="{class: stateClass}, {display: isVisible, trueVal: flex}"></div>
```

When splitting arguments, the parser takes quotes, escape characters and
nesting into account. Quotes and escape sequences are not removed or decoded,
however. For example, a message containing a space needs no extra quotes:

```html
<span data-validate-error="{message: email, defaultMessage: Invalid email}"></span>
```

Do not treat this format as full JSON, though. It is a light configuration
syntax, and values end up passed as argument text.
`defaultMessage: 'Invalid email'` will display the apostrophes as well.
Arguments are interpreted by the specific binding; `attribute` takes the value
from the property, not from a `value` argument. Text outside braces, unclosed
or mismatched brackets, a missing name and a repeated argument cause a syntax
error. The message indicates the attribute, the 1-based character position and
the template ID, when available.

### 5.3 Arguments

An argument has the form:

```text
argName: argValue
```

The colon splits an argument only at the first level. This is worth using for
URLs, but do not put unnecessarily complicated structures into an attribute.
When the configuration grows large, it is better to move the logic into a
separate ViewModel or a custom binding.

### 5.4 Factories work in fail-fast mode

Factories use no default fallbacks. An unknown type is an error:

- `BindingFactory` throws for an unknown binding;
- `CommandBindingFactory` throws for an unknown command type;
- `ValidationErrorBindingFactory` throws for an unknown error type.

Example error:

```text
CommandBindingFactory: unknown command type 'mousenter' for command 'hover'
```

This error is deliberate. A typo will not be silently treated as `click`,
`class` or another default element. This way the problem is visible while
creating the `View`, not only after a click or a property change.

Types are case-sensitive. `innerHTML` is a registered binding type, but
accidental, incomplete or misspelled variants are not.

If you create your own binding, command binding or validation error binding,
register it only once. The fragment below assumes an existing CurrencyBinding
class implementing IBinding; complete examples are in the
[extension guide](custom-bindings.en.md):

```ts
BindingFactory.registerBinding(
  'currency',
  (element, name, args) => new CurrencyBinding(element, name, args)
);
```

The same rules apply to the command and validation error type registries:
`CommandBindingFactory.registerCommandBinding` and
`ValidationErrorBindingFactory.registerValidationErrorBinding`. Each registry
has its own namespace, matching its attribute (`data-bind`, `data-command`,
`data-validate-error`).

Re-registering the same name throws as well. This prevents hidden conflicts
dependent on import order.

The optional `beginInitialization()` and `endInitialization()` methods let a
binding defer actions until the view finishes initializing.
`beginInitialization()` is called after the binding is created, before values
are set; `endInitialization()` after initial values are set and subscriptions
of all the view's regular bindings are in place. If view creation fails,
`dispose()` is called, with no guarantee of `endInitialization()`.

Register a binding that manages a whole element and its descendants through
`registerStructuralBinding`. For instance, `data-bind="{whenReady: status}"`
can mount the element only for one model state:

```ts
BindingFactory.registerStructuralBinding('whenReady', fragment => ({
  setValue(status) {
    if (status === 'ready') fragment.mount();
    else fragment.unmount();
  }
}));
```

The factory receives the fragment, the property name and the declaration's
arguments. The `setValue` method gets the raw field value. The fragment handles
the anchor, repeated mounting, descendant bindings and DOM teardown. The
binding's optional `dispose()` is for releasing its own resources. One element
can have one structural binding and many regular ones. Both binding kinds
share one namespace.

After a construction error, `View` detaches its own subscriptions and releases
resources returned by the factories, including those in active `if` branches.
The caller receives the original exception and can reuse the model. If a
factory throws before returning an object, it is itself responsible for
releasing resources it acquired earlier.

Factories check types, not the existence of a named property or command in the
model. A missing command in the model is ignored on the event, because
templates can be shared between views with different ViewModels. **An unknown
type** (a typo in `data-command`) **is an error** - fail-fast applies to types,
not to command names. The names `constructor`, `toString` and `__proto__` can
be registered explicitly like any other names. Factories report an error for an
unknown type. The `registerProperties` method picks up only the own enumerable
fields of the object passed in.

## 6. `mode` modes

The shared `mode` argument controls the data direction:

| Value | Meaning |
|---|---|
| `oneWay` | ViewModel → View, the default value |
| `oneWayToSource` | View → ViewModel |
| `twoWay` | ViewModel ↔ View |

Example of a two-way field:

```html
<input data-bind="{value: email, mode: twoWay, triggerType: input}">
```

With `oneWay` the value is set from the ViewModel, but the element's event
should not change the ViewModel. With `oneWayToSource` the View does not take
an initial value from the ViewModel the way a two-way binding does, which is
why this mode is useful for elements driven solely from the DOM. Concretely,
`oneWayToSource` skips the initial setValue and later updates from the model.
Not every binding type supports the reverse direction; e.g. `text`, `class`
and `disabled` only set the DOM. Omitting `mode` means `oneWay`. An explicitly
empty or unknown value is an error; the accepted spellings `oneWay`,
`oneWayToSource` and `twoWay` are case-sensitive, and surrounding whitespace
is trimmed. An error in `data-bind` indicates the template context, the
position and the value. Direct construction of a binding derived from `Binding`
also rejects a bad value instead of silently falling back. **An unknown
binding type** is an error as well.

## 7. Built-in bindings

### `innerHTML`

Inserts into the element:

- a string as `innerHTML`;
- an `HTMLElement`;
- a `View` through its `viewNodeList`;
- arrays of `HTMLElement`/`View`;
- an `ArrayObserver` with snapshot-based reconciliation of insertions, removals and order.

```html
<div data-bind="{innerHTML: contentView}"></div>
<div data-bind="{innerHTML: itemsView, place: start}"></div>
```

`place` puts the whole managed range at the start (`start`) or at the end
(`end`, the default) of the host. The order of elements in the collection is
preserved for both values.

Assigning a new View, HTMLElement, array or ArrayObserver replaces the previous
content managed by this binding. Re-assigning the same ArrayObserver attaches
subscriptions without duplicating them and reconciles its current snapshot.
Collection changes are also reconciled from the snapshot, which is why sort,
reverse, fill and copyWithin preserve node identity and order.

An array element must be an `HTMLElement` or a View containing rendered nodes.
Do not insert the same entry more than once, and do not overlap roots of
different entries. A plain array is not observed after the first render; use
`ArrayObserver` for reactive changes.

Removing a View from the collection or changing the source detaches its nodes
but does not destroy them. The View's owner is responsible for `dispose()`.
Changing the value to a string first detaches the managed Views, then sets the
string as HTML.

**Limitations:**

- An array of strings is not a list of texts - list entries must be rendered
  views or DOM elements. Use the `text` binding for safe text.
- Direct index changes on an `ArrayObserver` are observed; there is no such
  guarantee for plain arrays (section 11).

### `text`

Sets the element's text:

```html
<span data-bind="{text: title}"></span>
<span data-bind="{text: description}"></span>
```

Use `text` when data comes from the user and should not be interpreted as
HTML. `innerHTML` is meant for trusted HTML content or managed views.

`text`, `value` and the text path of `innerHTML` use prepareValue:
`undefined` yields empty text, but `null` throws. Normalize null to `''`
before passing it to these bindings. The `interpolate` binding is the
exception - it is null-safe: it renders `null` and `undefined` as empty text.

### `interpolate`

Reactive text interpolation: it substitutes `{{name}}` tokens in the element's
text content (and its descendants) with the property value.

```html
<label data-bind="{interpolate: behaviorSkipLabel}">
  <input type="radio" name="behavior" value="skip" checked>
  {{behaviorSkipLabel}}
</label>
```

The name in `data-bind` must be identical to the token name in the double
braces. Only tokens with that name are substituted; other `{{...}}` tokens
stay unchanged:

```html
<span data-bind="{interpolate: title}">{{title}} ({{otherProperty}})</span>
```

Properties and behaviour:

- Reactive: the tokens stay in the template (turned into empty text slots),
  so every property assignment updates all places at once.
- Text only: the value reaches the DOM as text (`Text.data`), never through
  `innerHTML`. Values containing `<b>`, `<img>`, `<script>` etc. are rendered
  literally - this removes the XSS vector.
- Descendant-safe: the update does not rewrite innerHTML, so existing
  elements, their attributes, values (e.g. in inputs) and event handling stay
  untouched.
- Scope: tokens are substituted only in the element's text descendants.
  Tokens in attributes and in the content of `script`, `style` and `template`
  are ignored.
- Null-safe: `null` and `undefined` are rendered as empty text.

For variable text next to an input you can now use `interpolate` directly in
the label - no need for a separate `<span data-bind="{text: ...}">`.

### `value`

Handles inputs, textareas and file inputs.

```html
<input data-bind="{value: name, mode: twoWay, triggerType: input}">
<input type="file" data-bind="{value: files, mode: oneWayToSource}">
```

`triggerType`:

- `input` listens continuously;
- a missing argument or any other value uses `change`.

`triggerType` applies only to the `value` binding; it is not a command event
setting.

### `visibility`

Sets `style.visibility` based on a boolean value.

```html
<div data-bind="{visibility: isVisible}"></div>
```

### `if` - conditional rendering

```html
<div data-bind="{if: exportDisplayButton}" data-command="{click: exportMaterialsCommand}">
    <span data-bind="{text: exportMaterialsBtText}"></span>
</div>
```

Declare in the ViewModel e.g. `@propertyChange() accessor exportDisplayButton: boolean = false;`.
With `true` the element is created along with its descendants. Bindings read
current data, and commands work on the element carrying the condition itself
as well. With `false`, `null` or `undefined` only a comment marking the
position remains. Unmounting releases the branch's subscriptions. The model
stays the property of its previous owner. The next `true` after unmounting
creates fresh DOM. To keep focus and local control state while hiding, use
`display`.

`if` reads the raw field value in the model → view direction. Values of other
types (including the string `"false"`) cause an error. One condition without
arguments per element. It can be combined with other declarations, e.g.
`data-bind="{if: canExport}, {text: label}"`, used at the view root and
nested. Toggling the condition alone does not emit `ready`. CSS determines
the layout of the visible element.

### `display`

For a boolean it sets `style.display`:

```html
<div data-bind="{display: isOpen, trueVal: flex, falseVal: none}"></div>
```

Arguments:

- `trueVal`, default `block`;
- `falseVal`, default `none`.

For a string the display mode is set directly:

```html
<div data-bind="{display: displayMode}"></div>
```

### `attribute`

Sets the attribute indicated by `attributeName`:

```html
<img data-bind="{attribute: imageUrl, attributeName: src}">
<label data-bind="{attribute: inputId, attributeName: for}"></label>
```

The value comes from the property named in `attribute` (`imageUrl`);
`attributeName` only selects the target DOM attribute (`src`).

Boolean values add or remove the attribute.

**Notes:**
- When `mode` is not `oneWay`, a `MutationObserver` is attached to the binding
  to monitor attribute changes and emits changes to the ViewModel.
- The observer tracks the element's own attribute, skips echoes of model
  writes and is detached by `dispose()`.

### `class`

Sets a set of CSS classes from text:

```html
<div data-bind="{class: stateClass}"></div>
```

The ViewModel should return the class text, for example:

```ts
this.buttonClass = isLocked ? 'button-lock' : 'button-active';
```

The binding remembers the classes present when it was created and keeps them
as static. On a change it removes stale dynamic classes and adds the new ones.
An empty string removes the dynamic classes but keeps the static ones, even if
they previously also occurred in the binding's value.

### `style`

The `styleName` argument sets a single CSS property:

```html
<div data-bind="{style: color, styleName: color}"></div>
```

Without `styleName` the binding sets the whole style text.

### `height` and `width`

```html
<aside data-bind="{height: asideHeight, unit: px}"></aside>
<div data-bind="{width: panelWidth, unit: rem}"></div>
```

For a number the unit is appended. For a string the CSS value is set directly.

**Note:** When `mode` is not `oneWay`, a `ResizeObserver` is attached to the
binding to monitor the element's size and emits changes to the ViewModel.
`dispose()` detaches the attached `ResizeObserver`. Reverse values come from
contentRect and are pixel dimensions, regardless of the `unit` argument.

### `size`

`size` handles `[width, height]` in both directions. For a single dimension
use `height`/`width`.

**Notes:**
- In the View → ViewModel direction the value is `[width, height]` from the
  `ResizeObserver` (contentRect, pixels), regardless of the `unit` argument.
- `dispose()` detaches the attached `ResizeObserver`.

### `scrollTop` and `scrollLeft`

Synchronizes `element.scrollTop`:

```html
<div data-bind="{scrollTop: scrollPosition, mode: twoWay}"></div>
<div data-bind="{scrollLeft: horizontalPosition, mode: twoWay}"></div>
```

With `twoWay` DOM scrolling updates the ViewModel, and a property change sets
the scroll positions. `scrollLeft` works analogously for the horizontal axis.
Both bindings accept a number and listen to the `scroll` event when the
direction allows writing to the model.

### `checked`

Handles a checkbox:

```html
<input type="checkbox" data-bind="{checked: enabled, mode: twoWay}">
```

Accepted are a boolean, the string `true` and a positive number (number or
bigint). The reverse direction listens to `click`, not `change`.

### `radio`

The property stores the selected option's value, not a boolean:

```html
<input type="radio" name="behavior" value="skip"
  data-bind="{radio: behavior, mode: twoWay}">
<input type="radio" name="behavior" value="update"
  data-bind="{radio: behavior, mode: twoWay}">
```

Register `behavior`, e.g. with the value `'skip'`. setValue compares the
property's text value with input.value and sets checked. The `change` event
writes input.value only for the checked input. null/undefined are treated as
an empty string here. Updating the property's other bindings requires a
separate notification according to section 3.1.

### `options`

Builds select options from an array of `OptionValue`:

```ts
import { OptionValue } from 'mvvm-dom';

const options = [
  new OptionValue('pl', 'Polski', true),
  new OptionValue('en', 'English', false)
];

this.registerProperty('languages', options);
```

```html
<select data-bind="{options: languages, mode: twoWay}"></select>
```

**Notes:**
- An array of `IOptionValue` objects with `value` and `label` strings and an
  `isSelected` boolean is accepted; a class instance is not required.
- An empty array removes the options; the empty value `''` is valid.
- For a single select, the first option with `isSelected: true` is selected.
  For `<select multiple>`, all such options are selected.
- With `twoWay` and `oneWayToSource`, a user change publishes a new array of
  records with current `isSelected`. The binding does not mutate the objects
  passed in; `oneWay` does not write changes back to the model.
- The write after `change` reads all current options from the DOM, also inside
  `optgroup`, in their order. This applies to both single and multiple
  selection. Each record contains `value`, `label` (the option text) and
  `isSelected`; extra model data fields are not carried into the result.
- In `oneWayToSource` you can use static HTML options without a prior
  `setValue`. Initialization does not replace them with model data nor write
  to the model. A change to the list, text or value of an option is picked up
  at the next `change`; the DOM change itself does not trigger a write through
  this binding.
- Duplicate `value`s stay separate records carrying the selection state of the
  specific option. No selection yields records with `isSelected: false`; an
  empty result array means no options.

### `selectedValues`

A multiple selection can also be stored as `string[]`, separately from the
option list:

```html
<select multiple data-bind="{options: languages}, {selectedValues: selectedLanguages, mode: twoWay}"></select>
```

`languages` is an `IOptionValue[]`, and `selectedLanguages` e.g.
`['pl', 'en']`. When both bindings are used together, `options` must be
`oneWay` (the default) and only provides the options; `selectedValues`
controls the selection. In `oneWayToSource` mode `selectedValues` does not
drive the DOM, so the initial `isSelected` comes from `options`. The binding
also works with static options, without `options`.

The result is a unique array of values in DOM option order; `[]` means no
selection, and `''` is a valid value. If several options share the same value,
all of them get selected. In `twoWay`, missing values are removed from the
model after initialization and after a change of the option list in the DOM,
its text or the `value` and `selected` attributes. DOM observation is
asynchronous; a programmatic write to the `option.selected` property does not
by itself trigger synchronization. `oneWay` never writes to the model, and
`oneWayToSource` emits only on `change`. A malformed element or a value other
than an array of strings causes an error.

### `readonly` and `disabled`

```html
<input data-bind="{readonly: readonly}">
<button data-bind="{disabled: saving}">Save</button>
```

These are ViewModel → View bindings. The button's state should be driven by a
property, not by manual DOM manipulation in a command method.

**Note:** The binding reacts to strict `true` (boolean) only. Other truthy
values (e.g. `1`, `'true'`) do not set the attribute.

## 8. Value converters (IValueConverter)

The library provides a value converter system - the equivalent of the classic
`IValueConverter` from WPF/WinUI. It allows automatic value transformations
between the ViewModel and the View without manual recalculation in binding
code.

Converters are available from the package's main export.

### 8.1 The `IValueConverter` interface

```ts
export interface IValueConverter {
    /**
     * ViewModel -> View
     * @param value       raw value from the ViewModel
     * @param parameter   optional parameter (e.g. a CSS class name, an enum map)
     */
    convert(value: unknown, parameter?: unknown): unknown;

    /**
     * View -> ViewModel (optional - used when mode: twoWay / oneWayToSource)
     */
    convertBack?(value: unknown, parameter?: unknown): unknown;
}
```

- `convert` - required. Invoked on the ViewModel → View flow.
- `convertBack` - optional. Invoked on the View → ViewModel flow
  (only when `mode` is `oneWayToSource` or `twoWay`).

### 8.2 Registering a converter

Converters are stored in a global named registry:

```ts
import { registerConverter } from 'mvvm-dom';

registerConverter('numberToPercent', {
    convert: (value) => (typeof value === 'number' ? value + '%' : ''),
    convertBack: (value) => {
        const n = parseFloat(String(value).replace('%', ''));
        return isNaN(n) ? 0 : n;
    },
});
```

Available functions:

| Function | Description |
|---|---|
| `registerConverter(name, converter)` | Registers a converter under a name. Re-registering overwrites. |
| `unregisterConverter(name)` | Removes a converter from the registry. |
| `getConverter(name)` | Returns the converter; throws if the name does not exist. |

**Important:** A converter must be registered **before** the `View` that uses
it is created. Otherwise `getConverter` throws
`ValueConverter: "name" is not registered. Use registerConverter() first.`

### 8.3 The `@convert` decorator

The decorator assigns a converter to a specific ViewModel property:

```ts
import { convert } from 'mvvm-dom';
import { propertyChange } from 'mvvm-dom';

export class PanelViewModel extends ViewModel {
    @propertyChange()
    @convert('boolToClass', 'dis_ctr_opc_act')
    public accessor isActive: boolean = false;
}
```

Decorator arguments:

| Argument | Description |
|---|---|
| `converterName` | Name of the registered converter (the registry key). |
| `parameter` | Optional parameter passed to `convert` / `convertBack`. |

The `@propertyChange` and `@convert` decorators are independent - the order
of application does not affect behaviour.

### 8.4 Data flow with a converter

```text
ViewModel.setPropertyValueAndNotify('isActive', true)
  -> property-change
  -> View.propertyChange
  -> convertToView(true, 'isActive', viewModel)
  -> IValueConverter.convert(true, 'dis_ctr_opc_act')
  -> returns e.g. 'dis_ctr_opc_act'
  -> Binding.setValue('dis_ctr_opc_act')
  -> DOM (the CSS class was added)

DOM (a change in an input)
  -> View.propertyElementChange
  -> convertToViewModel('dis_ctr_opc_act', 'isActive', viewModel)
  -> IValueConverter.convertBack('dis_ctr_opc_act', 'dis_ctr_opc_act')
  -> returns e.g. true
  -> ViewModel.setPropertyValueFromView('isActive', true)
```

When a property has **no** `@convert` decorator, the value passes through
unchanged (a transparent passthrough).

### 8.5 Helper functions (used internally by `view.ts`)

| Function | Description |
|---|---|
| `hasConverterFor(propertyName, vm)` | Returns `true` if the property has an assigned converter. |
| `getConverterMetadataFor(propertyName, vm)` | Returns the metadata (converter name + parameter) or `undefined`. |
| `convertToView(value, propertyName, vm)` | Passes the value through `convert`. Without `@convert` - returns the value unchanged. |
| `convertToViewModel(value, propertyName, vm)` | Passes the value through `convertBack`. Without `@convert` or without `convertBack` - returns the value unchanged. |

These functions are invoked automatically by `View` in the
`propertyChange` (ViewModel → View) and `propertyElementChange`
(View → ViewModel) methods. You do not need to call them manually.

### 8.6 Full usage example

```ts
// 1. Define and register a converter (e.g. in a file initConverters.ts)
import { registerConverter } from 'mvvm-dom';

registerConverter('boolToClass', {
    convert: (value: unknown, param?: unknown) =>
        (value === true ? String(param ?? '') : ''),
    convertBack: (value: unknown, param?: unknown) =>
        (value !== '' && value !== undefined ? true : false),
});

// 2. Use the decorator in the ViewModel
import { convert } from 'mvvm-dom';
import { propertyChange } from 'mvvm-dom';

export class ButtonViewModel extends ViewModel {
    @propertyChange()
    @convert('boolToClass', 'btn-active')
    public accessor isActive: boolean = false;
}
```

3. The binding in the template receives the already processed value:

```html
<template id="btnTemplate">
    <button data-bind="{class: isActive}">Button</button>
</template>
```

With `isActive = true` the `class` binding receives `'btn-active'`.
With `isActive = false` the `class` binding receives `''` (empty string - the class is removed).

### 8.7 Metadata and inheritance

The `@convert` decorator assigns a converter to a field with a text name. A
derived class inherits converters and can replace the converter of a chosen
field. In both conversion directions the declaration closest to the instance's
class applies. Two `@convert` decorators on the same field of one class report
an error at class definition time.

With `@propertyAlias` the converter is available under the model property's
public name used in the binding. The order of these two decorators does not
matter:

```ts
@propertyAlias('canonical')
@convert('myConverter', 'parameter')
accessor label = 'hello';
```

```html
<input data-bind="{value: canonical, mode: twoWay}">
```

The binding calls `convert` on read and the optional `convertBack` on write to
`canonical`. The `label` getter immediately sees the stored model value. The
`hasConverterFor`, `getConverterMetadataFor`, `convertToView` and
`convertToViewModel` functions also take the public name `canonical`, not the
accessor name `label`. The `propertyName` field of the returned metadata
contains this public name.

An inherited converter follows the accessor alias in effect in the derived
class. The child's own `@convert` replaces the base converter; no own
`@convert` keeps the inherited converter. Changing the alias or the converter
in the child does not change the metadata of the base or of sibling classes.

Plain records without converter metadata pass values unchanged, also as
`collection` entries. This covers objects created with `Object.create(null)`
and records with an own `constructor` field. That data field is not read during
converter lookup; the getter of that field is not invoked either. Class
metadata is recognized through its prototype. An own `constructor` field
neither disables the real model class's converters nor lets a record be
assigned another class's converters.

### 8.8 Rules and limitations

- A converter works **only** for properties that have the `@convert`
  decorator. Other properties pass through unchanged.
- `convertBack` is optional. When it does not exist, the View → ViewModel
  value passes unchanged.
- The converter parameter is static (fixed in the decorator). It cannot be
  changed on the fly without redeclaring the property.
- The registry is global (module-level). Converters registered in one module
  are visible across the whole application.
- There are no built-in converters - each must be registered manually.
- Converter names are case-sensitive.

## 9. Commands

### 9.1 Syntax and types

```html
<button data-command="{click: save}">Save</button>
<div data-command="{mouseInOut: hover, trigger: both}"></div>
```

| Type | Event |
|---|---|
| `click` | `element.click` |
| `mouseInOut` | `mouseenter` and `mouseleave` |
| `mousedown` | `element.mousedown` |
| `mouseup` | `element.mouseup` |
| `mousemove` | `element.mousemove`, without stopping propagation |
| `ready` | a custom `ready` event emitted on insertion by the `innerHTML` binding |
| `change` | `element.change` |
| `input` | `element.input` |
| `focusout` | `element.focusout` |
| `resize` | `window.resize` |
| `animationend` | `element.animationend` |
| `key` | local `element.keydown` for the configured shortcuts |
| `enter` | `element.keydown` (Enter key only, calls `preventDefault()`) |
| `submit` | `element.submit` (for `<form>`, blocks the default page reload) |
| `dragover` | `element.dragover` (blocks the default behaviour, sets `dropEffect = 'copy'`) |
| `dragleave` | `element.dragleave` |
| `drop` | `element.drop` (blocks the default opening of a file in the browser) |

### Keyboard shortcuts

```html
<div data-command="{key: select, keys: Ctrl+S | Enter, parameter: object.id}">
  <input>
</div>
```

The required `keys` contains alternatives separated by `|`. Each combination
has one `KeyboardEvent.key` and optional `Ctrl`, `Alt`, `Shift`, `Meta`
modifiers separated by `+`. Modifiers and single letters are compared
case-insensitively; other key names, e.g. `Enter`, `Escape`, `ArrowDown`,
`F1`, are case-sensitive. Use `Plus`, `Pipe` and `Space` for the `+`, `|` and
space keys. A malformed configuration reports an error. By default an exact
modifier match is required; Ctrl and Meta are distinct. `KeyboardEvent.key`
depends on the keyboard layout and Shift.

Optional boolean values (`true`/`false`):

- `preventDefault: false` does not block the matched shortcut's default action.
  By default it is blocked even with `canExecute=false` or a missing command.
- `allowRepeat: true` permits repetition while the key is held.
- `allowComposition: true` permits events during IME composition.
- `allowExtraModifiers: true` permits extra modifiers.

The last three options default to `false`. Ignored events are not cancelled.
The listener covers the element and events bubbling up from its descendants;
it is not global and does not stop propagation. Nested bindings may therefore
run several commands. System or browser shortcuts may not be delivered at all
or may not be cancelable.

`commandData.args` contains the key exactly as in the event, followed by the
active modifiers in the order `Ctrl`, `Alt`, `Shift`, `Meta`, e.g.
`['s', 'Ctrl']`. The parameter goes separately into `commandData.parameter`,
and the original `KeyboardEvent` into `sourceEvent`.

The legacy `enter` stays compatible: it reacts to Enter with any extra
modifiers, repeat and IME, calls `preventDefault` and passes an empty `args`.
Use `key` for new declarations.

`ready` is not a native browser event and does not fire on the creation of
`View` alone. The `innerHTML` binding emits it for the root and descendants of
the managed element (View, HTMLElement or an array) on the first insertion;
for a string value set as HTML it is not emitted. In the command,
`objectSender` points to the element that received the event:

```html
<div data-command="{ready: onReady}"></div>
```

The event emitted by the binding reaches each element individually, does not
bubble and is emitted at most once per element during the list controller's
lifetime. Moving an already inserted element elsewhere does not emit it again.
A listener on a parent element will not receive a child's `ready` - attach the
command directly to the element that should react. Application code can
independently emit its own `ready` events with bubbling explicitly.

`mouseInOut` takes the `trigger` argument: `mouseIn`, `mouseOut` or `both`
(the default). Supplying an unsupported `trigger` value means the command
attaches no observer at all.

```html
<div data-command="{mouseInOut: hover, trigger: mouseIn}"></div>
<div data-command="{mouseInOut: hover, trigger: mouseOut}"></div>
```

The trio `dragover`, `dragleave` and `drop` is meant for file drag & drop.
All three pass the `HTMLElement` element to the command as
`commandData.objectSender`, and the native `DragEvent` is available through
`commandData.sourceEvent`. `dragover` and `drop` call `preventDefault()`.
Without it the browser would not allow the drop and would open the file in a
new tab.

```html
<div
  data-command="{dragover: onDragOver}, {dragleave: onDragLeave}, {drop: onDrop}">
</div>
```

```ts
@command('onDrop')
private onDrop(command: ICommand) {
  const sender = command.commandData.objectSender as HTMLElement;
  const event = command.commandData.sourceEvent as DragEvent;
  const files = event.dataTransfer?.files;
}
```

### 9.2 Manual registration

```ts
import { Command, type ICommand } from 'mvvm-dom';

this.registerCommand('save', new Command((command: ICommand) => {
  const data = command.commandData;
  this.save(data.objectSender);
}));
```

`commandData` contains `commandName`, `objectSender`, `args`, `sourceEvent`
(the original DOM event) and the optional `parameter` (the resolved command
parameter). Each invocation gets a separate snapshot; the `commandData` object
itself and the copied `args` array are frozen. `args` is not the argument map
from HTML: `mouseInOut` passes `['mouseIn']` or `['mouseOut']`, `key` passes
the key and modifiers, and the remaining built-in commands pass an empty
array.

All built-in commands pass as objectSender the element the `data-command`
handler was pinned to (this.element). Clicking an icon inside a button returns
the button as objectSender, while the icon stays in
`command.commandData.sourceEvent.target` (the original DOM event).

`Command` gives each invocation its own frozen `commandData` snapshot; the
`args` array is copied and frozen. For async operations copy the needed data
before await, e.g. `const sender = command.commandData.objectSender`. The
callback may return a Promise, and `command.isExecuting` is true while at
least one invocation is in progress.
`command.subscribeExecutionState(observer)` lets you react to state
transitions and returns a function that detaches the observer. Parallel
invocations are allowed. The constructor's second argument can handle an
error; without `onError` `View` reports a rejected Promise to `console.error`,
and a caller invoking `execute` directly should handle the returned Promise.
The full constructor signature (`executeCallback`, `onError?`, `options?`) is
documented in the [API reference](./api.en.md#command). The snapshot is
shallow - sender and sourceEvent remain references to the original DOM objects.

A synchronous callback error or an error reading its result (e.g. a throwing
`then` getter) is rethrown by `execute`, after that run finishes. It is not
passed to `onError`. A promise rejection goes to `onError` if provided; an
exception from `onError` itself rejects the promise returned by `execute`.
Even then the execution state is released. An error in one attempt does not
end other running executions. After the last attempt finishes, `isExecuting`
returns to `false` and the `blockWhileExecuting` lock is released.

### CanExecute and the command parameter

```html
<ul>
  <li data-bind="{collection: items}">
    <button data-command="{click: select, parameter: object.id}">{{object.name}}</button>
  </li>
</ul>
```

```ts
const select = new Command(
  cmd => this.selectItem(cmd.commandData.parameter),
  undefined,
  { canExecute: id => typeof id === 'number' && id > 0, blockWhileExecuting: true }
);
this.registerCommand('select', select);
// After a change of the external state the condition depends on:
select.notifyCanExecuteChanged();
```

The parameter is the raw value of a ViewModel property or of an `object` /
`parent` path in a row, without a converter and without JavaScript
expressions. A missing value yields `undefined`. It is read again on every
event; changes of an observed parameter refresh the control's state. The
snapshot is shallow: the parameter object is neither copied nor frozen.

Without a predicate the command can execute. `canExecute(parameter)` also
blocks a direct `execute`. After a change of the predicate's independent
state, call `notifyCanExecuteChanged()`; the library does not automatically
track all of its dependencies. `blockWhileExecuting` is optional and blocks
further invocations until the operation finishes, including on an error. By
default parallel operations remain allowed.

Native controls supporting `disabled` are blocked when any attached command
cannot execute or is unregistered. This state is combined with the `disabled`
binding; without such a binding the initial attribute is preserved. Other
elements get no attribute, but the command is still checked. `ViewModel`
notifies views about command registration, replacement and removal; a custom
context may expose an optional `subscribeCommands`.

The predicate and the lock option can also be given to the decorator:

```ts
@command<MyViewModel>('select', {
  canExecute(this: MyViewModel, id) { return this.canSelect(id); },
  blockWhileExecuting: true
})
private selectCommand(cmd: ICommand) { /* ... */ }
```

### 9.3 Command decorators

```ts
import type { ICommand } from 'mvvm-dom';
import {
  autoRegisterCommands,
  command
} from 'mvvm-dom';

@autoRegisterCommands()
export class FormViewModel extends ViewModel {
  @command('save')
  private saveCommand(command: ICommand) {
    // save logic
  }
}
```

`@command` stores metadata. The registrations are performed by
`@autoRegisterCommands()`. The `@command('save')` argument must match the name
in `data-command="{click: save}"`. The TypeScript method name may differ.

A derived class can assign an inherited command name to a different method
through `@command`. It can also override the method itself under its existing
name, without re-decorating. Assigning the same command name twice in one
class reports an error at class definition time.

### 9.4 Command lifecycle

`EventCommandBinding` attaches the DOM observer in the constructor. The
command layer connects it to the context, looks up the command and calls
`command.execute(...)`.

On `View.dispose()` the command:

- removes the DOM observer;
- removes `window.resize`, if it was used;
- detaches the callback from `CommandActionEventTarget`.

`View.detach()` does not remove the command.

### 9.5 Event propagation and ordering with the binding

Built-in commands do not call `stopImmediatePropagation()`. They do not block
further observers of the same event or further propagation, and resize
commands attached to window do not shadow each other - every active view
receives the event.

The View attaches bindings before commands (constructor order:
`prepareProperties` → `prepareValidateError` → `prepareCommands`). For the
same event, the field write and validation (the binding) run first, then the
command executes. You can therefore safely combine, on one element, an input
command with a value binding of triggerType input, a change command with a
change binding, or a click command with checked. To react to a field change,
use a property callback; saving the form can be a separate submit command.

The `submit`, `enter`, `dragover` and `drop` commands call `preventDefault()`,
because that is the control's justified behaviour (blocking the reload, the
file opening). `key` cancels matched shortcuts by default, unless
`preventDefault: false` is given. The remaining commands do not modify the
event.

## 10. Validation

The validation flow:

```text
property setter / validateProperty() / validate()
  -> validator Set
  -> storing the field state and error-change with the validation result
  -> View
  -> data-validate-error
```

`error-reset` is emitted separately by `resetPropertyValidationState(name)`.

### 10.1 Decorators

One general-purpose decorator is available:

- `@validate(providerOrProviders, callback?)`.

Rules are stored as a single validator provider or an array of providers. The
old specialized validator decorators were removed to avoid two different
validation registration mechanisms.

Example of a custom rule, without a base class or an extra library:

```ts
import type { IViewModelValidator } from 'mvvm-dom';
import { validate } from 'mvvm-dom';
import { ViewModel } from 'mvvm-dom';

class NotEmpty implements IViewModelValidator {
  isValid(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  getMessage(): string {
    return 'Field is required';
  }
}

class FormViewModel extends ViewModel {
  @validate(() => new NotEmpty())
  accessor label = '';
}
```

The rule accepts only text that is non-empty after trimming leading and
trailing whitespace. The provider may return new instances for a specific
ViewModel.

**Notes:**
- The second `callback` argument works like the `@propertyChange` callback
  (see section 3.2).
- Initialization, an assignment in code and a write from a binding each
  trigger one field validation. Both orders of `@validate` and
  `@propertyChange` use the same value. The `input` command reads it
  immediately through the getter.
- You can pass IViewModelValidator instances instead of provider functions,
  but such an instance will be shared by the models using the decorator.

### 10.2 Registering rules

A decorator's validator is registered during auto-accessor initialization.

Field validation iterates over the registered rules and stops at the first
error. The public call is `validateProperty(name)`; `validate()` checks all
fields with validators. That is why it is worth registering general rules
before specific ones.

### 10.3 Error classes

```html
<input
  data-bind="{value: email, mode: twoWay, triggerType: input}"
  data-validate-error="{class: email, errorClass: input-error, noErrorClass: input-ok, focusIn: true, focusOut: true}">
```

Arguments of the `class` type:

- `errorClass` - the class for an error;
- `noErrorClass` - the class for a valid value;
- `focusOut: true` - react to `blur`;
- `focusIn: true` - react to `focus`.

**Note:** `View` also adds a `focusin` observer to each `data-validate-error`
element, which calls `validateProperty` on the dataContext.

The message element:

```html
<span
  data-validate-error="{message: email, defaultMessage: Invalid email, hideClass: hidden, showClass: visible}">
</span>
```

`message` uses the validator's message, and falls back to `defaultMessage`
when there is none.

**Note:** When `showClass`/`hideClass` are not given, the element uses
`style.display` (`''` / `'none'`) to toggle visibility.

### 10.4 Submit

```ts
public save() {
  if (!this.validate()) {
    return;
  }

  // send valid data
}
```

Validation on `input` improves UX, but `validate()` should be called
always before sending data.

`validate()` checks all fields with validators. Within a field it stops at the
first unsatisfied rule. It returns `true` when all fields pass validation.
Every checked field publishes the result through `error-change`.

### 10.5 Reading the validation state

`ViewModel` exposes the validation state of a single property:

```ts
viewModel.isPropertyValid('email');
viewModel.getPropertyValidationMessage('email');
viewModel.hasPropertyBeenValidated('email');
viewModel.getPropertyValidationState('email');
```

`getPropertyValidationState` returns a `{ isValid, message, validated }`
object. If the property has no stored state yet, the defaults are
`isValid: true`, no `message` and `validated: false`.

`validateProperty(name)`, `validate()` and a manual report through
`setPropertyValidationState` store the result before notifying the view.
Success removes the previous message and sets `validated: true`.
`resetPropertyValidationState` restores the initial state and emits
`error-reset`. `getPropertyValidationState` returns a copy. A new view, also
after a remount through `if`, replays this state without rerunning the rules.

### 10.6 The validator contract

`IViewModelValidator` requires a synchronous `isValid(value: unknown)` method:
`true` means a valid value, `false` an error. The optional
`getMessage(value: unknown)` method returns the error message. The library
imposes no base class and ships no ready-made rules - custom validators
implement this interface and are attached through the `@validate` decorator
(see section 10.1). The library contains no built-in validators.
IViewModelValidator is a contract - the implementations (e.g. NoEmpty,
Length, Email) are part of the application, not of the library.

## 11. Collections and ArrayObserver

### 11.1 CollectionObserver and the `collection` binding

`collection` duplicates the element it is declared on for every entry of the
source. The text tokens `{{object.path}}` inside the row are interpolated
automatically:

```ts
import { CollectionObserver } from 'mvvm-dom';

const items = new CollectionObserver(
  { name: 'Anna', description: 'Project', details: { status: 'Active' } },
  { name: 'John', description: 'Testing', details: { status: 'New' } }
);
viewModel.registerProperty('items', items);

items[0].name = 'Maria';
items[0].details.status = 'Done';
items.push({ name: 'Olga', description: 'Project', details: { status: 'New' } });
```

```html
<ul>
  <li data-bind="{collection: items}">
    <span>{{object.name}}</span>
    <span>{{object.description}}</span>
    <span>{{object.details.status}}</span>
  </li>
</ul>
```

`object` means the current row's entry, and `parent` the entry of the directly
containing collection. Nested collections have their own scope:

```html
<section data-bind="{collection: groups}">
  <h2>{{object.name}}</h2>
  <p data-bind="{collection: object.members}">{{parent.name}}: {{object.name}}</p>
</section>
```

Paths consist of identifiers separated by dots. They are not JavaScript
expressions; they support no calls and no bracket indexing. A missing or `null`
value yields empty text. Data is inserted as text, not HTML; attributes and the
content of `script`, `style` and `template` are not interpolated
automatically. The parent ViewModel's other bindings and commands remain
available. Bindings inside a row are model → view only; `mode: twoWay` and
`mode: oneWayToSource` are rejected.

Write data through references taken from the `CollectionObserver`, e.g.
`items[0].details.status = 'Done'`. Their Proxies are stable for a given
observer, also for shared objects and cycles. Earlier raw references do not
capture writes. The methods and events of structural changes work as in
`ArrayObserver`; change records contain snapshots of the elements stored in the
array, which may be raw references. To keep editing under observation, fetch
the element again through the collections.

Usually nested objects and ViewModel instances are observed. The ViewModel
keeps correct access to private fields: its methods act on the original, and
decorated accessors publish changes through `property-change`. Changes to
undecorated fields made inside such methods are not observed automatically; a
direct write through the Proxy is observed. Usually arrays inside objects and
other class instances, e.g. `Date`, `Map` or DOM elements, are not deeply
observed. Use a separate `CollectionObserver` for a nested reactive list. A
non-configurable, non-writable object property is returned unwrapped, as the
Proxy invariants require.

A plain array used as the source is a snapshot: its mutations are not
tracked. Republish the ViewModel property after changing the array or its
entries. `null` and `undefined` mean an empty list; another type reports an
error without removing the previously rendered rows. Removing rows, changing
the source and `dispose()` release the associated views and subscriptions, but
do not destroy the supplied objects or ViewModel instances.

Optionally, item changes can be observed independently of the view:

```ts
const onItemChange = () => console.log('Item changed');
items.subscribeItemChanges(onItemChange);
items.unsubscribeItemChanges(onItemChange);
```

The callback is a change signal, not a change record or an item identifier.
Subscriber exceptions are logged, and the remaining subscribers still receive
the notification. `subscribeChanges` observes structural changes.

### 11.2 ArrayObserver

`ArrayObserver<T>` extends `Array` and lets you update the view without
setting the whole array again:

The calls below demonstrate the available operations, not a sequence of
inserting the same View instances into one rendered list:

```ts
const items = new ArrayObserver<IView>();

items.push(view);
items.unshift(view);
items.pop();
items.shift();
items.deleteItem(view);
items.splice(1, 0, anotherView);
items.insertAfter(0, anotherView);
items.clear();
```

`subscribeChanges` publishes the `CollectionChange<T>` type:

```ts
type CollectionChange<T> =
  | { type: 'splice'; index: number; removed: readonly T[]; added: readonly T[] }
  | { type: 'reset'; previous: readonly T[]; current: readonly T[] };
```

Each logical mutation emits one record. `push`, `unshift`, `pop`, `shift`,
`splice`, `clear`, `deleteItem` and direct index writes and `length` shortening
emit `splice` with an index and element snapshots. `sort`, `reverse`, `fill`
and `copyWithin` emit `reset` with snapshots before and after the change.
`ViewListController` incrementally updates safe insertions/removals and
reconciles the remaining changes with the DOM via a snapshot.

Reordering kept elements through `ViewListController` preserves the control's
focus and the range and direction of the text selection in supporting inputs
and textareas. It also covers view descendants of multi-node views,
`start`/`end` and `ArrayObserver` source changes. The restore uses
`preventScroll` and happens before the `ready` events, whose handlers may
deliberately move focus. A control removed from the list is not activated
again. The renderer does not take focus from another active control nor re-fires
`focus` if the reordered element is still active. This is not a guarantee of no
blur/focus events during the move, nor of selection preservation in
`contenteditable`.

Mutation semantics (consistent with native Array):

- Indices are truncated per ToInteger: NaN → 0, fractions → Math.trunc,
  ±Infinity stays unchanged; negative indices count from the end.
- `splice()` with no arguments is a no-op; `splice(start)` removes from start
  to the end; `splice(start, undefined, item)` and `splice(start, NaN, item)`
  remove nothing and only insert; `splice(start, undefined)` changes nothing.
  The splice record describes the removal and the insertion atomically with
  one index.
- pop/shift emit a removal record whenever the array is not empty - also for
  an element whose value is undefined.
- `insertAfter(index, ...items)` requires an integer index in the range
  -1 .. length - 1 (index = -1 inserts at the beginning); other values (NaN,
  ±Infinity, fractions, length) throw RangeError. An empty item list is a
  no-op without an exception.
- Direct assignment to an existing index, assignment at `items.length` and
  shortening `items.length` emit a `splice` record.
- A write creating a hole (`items[index] = value` for `index > length`),
  increasing `length` and `delete items[index]` of an existing element throw
  without changing the collection. Use push/splice/deleteItem to keep the
  elements dense.
- The event type is read-only, and each callback gets its own copies of the
  snapshots. Reentrant mutations are delivered to all subscribers of the
  current record before the next event is delivered.

### 11.3 Multiple subscribers

```ts
const callback = (change: CollectionChange<IView>) => handleChange(change);

items.subscribeChanges(callback);
items.unsubscribeChanges(callback);
```

Adding the same function again does not create a duplicate. Subscriber
exceptions are logged and do not interrupt notifying the others. The old API
`subscribe`, `unsubscribe`, `changeCallback` and `ChangeType` was replaced by
this protocol.

### 11.4 Array of views

```ts
@propertyChange()
accessor itemsView = new ArrayObserver<IView>();
```

```html
<div data-bind="{innerHTML: itemsView}"></div>
```

Tell apart:

```text
items.deleteItem(view) -> the view is detached from the DOM
view.dispose()         -> the view stops existing
```

Removal from the collection detaches the view but leaves the dispose decision
to the application. Changing or disposing the `innerHTML` binding also detaches
the managed views without destroying them (section 7).

## 12. Lifecycle and memory

### Resilience to initialization and teardown errors

`SelectedValuesBinding` rolls back its registration, the `change` observer and
the observer if initialization fails. It reports the original exception even
when detaching the observer throws another error. Retrying for the same select
is possible; a conflict with an existing binding does not remove that binding's
registration or observer. The code assumes the native observer-detaching
mechanisms work; after an error each teardown operation is attempted
independently of the others.

`ViewModel.dispose()` first removes properties, commands, validators,
validation state and the existing subscriptions. It then notifies
`subscribeCommands` recipients about removed commands, using the recipient
snapshot taken at the start of teardown. Every recipient receives every removed
command name, even if an earlier recipient throws or unsubscribes during
notification. Recipients see the already cleaned model.

Errors of these callbacks are collected and reported at the end as
`ViewModelDisposalError` (exported from `viewModel.ts`). Its unmodifiable
`errors` array keeps the original thrown values and the order of their
occurrence. This also covers a single error and values other than `Error`.
Without errors `dispose()` finishes normally. A repeated and nested call does
not rerun teardown or notifications.

This contract concerns direct `ViewModel.dispose()`; a parent teardown
mechanism may handle the exception by its own rules. It does not change
`ownsDataContext`: a view sharing a model does not take over its ownership.
After `dispose()` the model has ended its lifecycle - do not re-register it or
add subscriptions to it again, including inside teardown callbacks.

### 12.1 `detach()`

```ts
view.detach();
```

Removes the nodes from the DOM but keeps the ViewModel, bindings, commands,
validators and `ArrayObserver` subscriptions. Use it for transitions, hiding
and re-inserting the view.

### 12.2 `dispose()` of a View

```ts
view.detach();
view.dispose();
```

It means the end of the view's life. `View` first detaches the nodes from the
DOM (`detach()`), then runs the teardown of bindings, commands, validation
observers, ViewModel events and ArrayObserver subscriptions. Finally it clears
`viewNodeList` and the `properties` and `errors` maps, and the `_dataContext`
field is set to `undefined` - after dispose there are no active subscriptions
or data references left.

`ownsDataContext` defaults to **true**, so it also destroys the dataContext
exactly once (even if dispose is called again). You can set it in the
constructor via `options.ownsDataContext` or as the `view.ownsDataContext`
field. For a shared model set **false** and clean up the model at its owner,
after all views finish their work - such Views do not destroy the shared model.

Dispose is idempotent - calling it again does nothing. Since dispose detaches
the nodes, you do not have to call `detach()` first, but detach remains useful
when re-inserting the view before destroying it.

You must not re-insert the same View after this, because its active
subscriptions were removed.

### 12.3 `ViewModel.dispose()`

The base ViewModel is idempotent and clears `properties`, `commands`,
`validators` and the old event targets. After dispose it should not be used
again. Removing a field's validators clears its stored result and resets the
presentation. `dispose()` releases all stored validation states.

A derived class must clean its own fields before `super.dispose()`:

```ts
public dispose(): void {
  this.items?.clear();
  this.childViewModel?.dispose();
  super.dispose();
}
```

Do not do:

```ts
super.dispose();
this.items.clear();
```

After `super.dispose()` a decorated property may return `undefined`.

### 12.4 CompositeDisposable

```ts
private readonly disposables = new CompositeDisposable();

constructor() {
  super();
  const callback = this.onExternalChange.bind(this);
  externalSource.subscribe(callback);
  this.disposables.add(() => externalSource.unsubscribe(callback));
}

public dispose(): void {
  this.disposables.dispose();
  super.dispose();
}
```

Teardowns run in the reverse order of registration, and a further dispose does
not rerun them.

**Note:** When a `CompositeDisposable` has already been released, a subsequent
`add(teardown)` call **executes the teardown immediately** (instead of storing
it). This prevents a leak when teardown is added too late.

## 13. Factories and widgets

### 13.1 ViewFactory

`ViewFactory` is a simple factory creating `View`s:

```ts
import { ViewFactory } from 'mvvm-dom';

const viewFactory = new ViewFactory();
const view = viewFactory.getViewById('templateId', viewModel);
const source = viewFactory.getTemplateById('templateId');
const anotherView = viewFactory.getView(source, viewModel, { ownsDataContext: false });
```

`getViewById` looks up the element by ID and creates the view;
`getTemplateById` returns the element itself, e.g. for the constructor of a
class deriving from `View`. Both lookup methods report an error with the ID
when the element does not exist or is not an `HTMLElement`. `getView` accepts
an element only, and the context and options are optional. A malformed source
is rejected at runtime as well.

API change: replace the old `new View('templateId', model)` with
`new View(viewFactory.getTemplateById('templateId'), model)` or
`viewFactory.getViewById('templateId', model)`. Replace the old
`viewFactory.getView('templateId', model)` with `getViewById`. A string is not
interpreted as an ID or as HTML code by `View` or `getView`.

### 13.2 ViewModelFactoryBase

`ViewModelFactoryBase` is an abstract factory of ViewModel instances selected
by name:

```ts
import { ViewModelFactoryBase } from 'mvvm-dom';

class MyViewModelFactory extends ViewModelFactoryBase {
  protected getViewModelHandler() {
    return {
      'myViewModel': MyViewModel,
      'otherViewModel': OtherViewModel
    };
  }
}

const factory = new MyViewModelFactory();
const vm = factory.getViewModel('myViewModel', ...args);
```

When the name is not present in the map, the factory throws.

## 14. View owner

The object that creates a ViewModel/View should know when to destroy them.
ArrayObserver itself does not destroy its entries. The innerHTML binding's
reset path does not destroy views either: it detaches the nodes from the DOM
and releases the list controller, but the view's owner calls `dispose()`.
Adopt this ownership rule - every detach keeps the view alive. The example
below mounts a single View directly into the DOM:

```ts
private formViewModel = new FormViewModel();
private formView = new ViewFactory().getViewById('formTemplate', this.formViewModel);

showForm(container: HTMLElement) {
  container.append(...this.formView.viewNodeList);
}

hideForm() {
  this.formView.detach();
}

destroyForm() {
  this.formView.detach();
  this.formView.dispose();
}
```

With the default ownsDataContext the model is destroyed by the View. When you
set false, the owner must additionally destroy the model after detaching all
views.

## 15. Dynamic forms

Keep the observed view collection and the form data separate:

```ts
@propertyChange()
accessor formsView = new ArrayObserver<IView>();

formViewModels: FormItemViewModel[] = [];
```

For a full rebuild, first clear the observed collection so the renderer
detaches the views. Then dispose the entries that will not be reused, clear
the model list, and only then create the new objects.

```ts
const oldViews = this.formsView.clear(); // The renderer detaches the nodes first.
for (const oldView of oldViews) {
  oldView.detach();
  oldView.dispose();
}

this.formViewModels = [];
```

If the entries are shared, remove them from the collection without dispose and
leave the destruction to their owner. When ownsDataContext=false, clearing
formViewModels alone does not destroy the models - that must be done
separately.

## 16. Best practices

- Keep state in the ViewModel, and DOM in the View.
- Use `setPropertyValueAndNotify` when the change should reach the View.
- Use `text` for user data; `innerHTML` only for trusted HTML.
- Store callbacks as fields and use the same reference when removing them.
- Every `window`, `document` and `MediaQueryList` observer must have teardown.
- Do not create new ViewModel instances on every render if the view is only toggled.
- Re-validate through `validate()` right before submit.
- Do not dispose a view just because it was removed from the DOM.
- One place should own a given ViewModel and its View.
- Register value converters before creating the View that uses them.

## 17. Common mistakes

### The view stopped reacting

`dispose()` was probably called instead of `detach()` during reuse.

### `Cannot read properties of undefined` in dispose

Check whether the derived class uses a decorated property after
`super.dispose()`. The order must be: children and collections first, then
`super.dispose()`.

### The list duplicates elements

The `innerHTML` binding reconciles the full snapshot and detaches the previous
source when it changes. Check whether the collection contains a repeated
reference or nodes overlapping between entries. Details in sections 7 and 11.

### A command runs multiple times

Check for duplicated Views, a missing dispose of an old View, and different
`bind(this)` references in subscribe/unsubscribe.
For ready, remember the event does not bubble and is emitted once per element
per controller (section 9.1).

### A field stops saving values after a command was added

Check whether the value/checked binding has `mode` set (`twoWay` or
`oneWayToSource`) and a triggerType consistent with the command
(`input`/`change`/`click`). Bindings are attached before commands, so the
value should be saved before the command runs (section 9.5).

### A validator does not work

Check the decorator, the property name, the shared `dataContext`, the setter
running, and `validate()` being called before submit.

If a factory error appears, also check the type in `data-validate-error`. The
factory supports the `class` and `message` types plus the compatibility-preserved
alias `click`. An unknown type will not be turned into a default element.

### View is not created after changing the template

Check the console. With fail-fast the message contains the type and the
property or command name. The most frequent causes are:

- a typo in the type name;
- different letter case;
- a command unsupported by `CommandBindingFactory`;
- a custom binding not registered before the View was created;
- registering the same custom binding name twice.

### A converter does not work

- Check whether the converter was registered (`registerConverter`) before the
  View was created.
- Check whether the property has the `@convert` decorator with the correct
  converter name.
- Check whether `mode` allows the direction in which you expect conversion
  (`convertBack` works only with `oneWayToSource` / `twoWay`).
- Converter names are case-sensitive.

## 18. Debugging

When a value does not reach the DOM:

1. Check the template and `data-bind`.
2. Check the property name in the ViewModel.
3. Check `setPropertyValueAndNotify` or the decorator's setter.
4. Check `mode`.
5. Check the factory and letter case.
6. Check whether the View was released.
7. For lists, check the `ArrayObserver` subscriptions.
8. If the property has `@convert`, check whether the converter is registered
   and whether `convert` returns the expected value.

When a command does not work:

1. Check the name in `data-command` and in the ViewModel.
2. Check the event type.
3. Check whether the View was released.
4. Check whether the global observer was attached correctly.

## 19. Checklist before removal

```text
Will this View be used again?
```

If yes:

```ts
view.detach();
```

If not:

```ts
view.detach();
view.dispose();
```

The most important rule:

```text
detach = unhook temporarily
dispose = end its life
```
