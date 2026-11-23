# mvvm-dom - API reference

English reference of the public interfaces of the `mvvm-dom` package - that is,
everything that can be imported from the package's main export. The section
order matches the export order in `src/index.ts`.

The type, property and method signatures correspond exactly to the package's
TypeScript declarations. This document deliberately contains no code examples -
usage examples are in the [user guide](guide.en.md).

## Terminology

| Term | Meaning in this document |
|---|---|
| **binding** | a reactive connection between a ViewModel property and a DOM element (`Binding` and its specializations) |
| **command** | a named ViewModel action invoked from a DOM event (`Command`, `EventCommandBinding`) |
| **converter** | a value transformation between the ViewModel and the View (`IValueConverter` and built-in converters) |
| **validation** | data correctness rules and the presentation of their errors (`ViewModelValidator`, `ValidationErrorBinding`) |
| **factory** | a class that creates instances (`BindingFactory`, `ViewFactory`, `ViewModelFactoryBase`) |
| **subscriber** | an event receiver registered through the `subscribe*` methods; the value returned from registration cancels the subscription |
| **template** | a `<template>` element forming the view's structure |
| **view** | a `View` instance created from a template |
| **collection** | `CollectionObserver` (a collection of objects) and `ArrayObserver` (a reactive array) |
| **event** | an `Event` object emitted by the library, e.g. `PropertyChangeEvent`, `CommandActionEvent`, `ValidationStateEvent` |
| **property** | a registered, observable value in the ViewModel (`registerProperty`) |

## Section index

Sections follow the export order in `src/index.ts`:

1. [arrayObserver](#arrayobserver)
2. [binding](#binding)
3. [bindingFactory](#bindingfactory)
4. [bindingFragment](#bindingfragment)
5. [bindingMode](#bindingmode)
6. [collectionObserver](#collectionobserver)
7. [command](#command)
8. [commandActionEvent](#commandactionevent)
9. [commandActionEventTarget](#commandactioneventtarget)
10. [commandBindingFactory](#commandbindingfactory)
11. [commandDecorators](#commanddecorators)
12. [compositeDisposable](#compositedisposable)
13. [disposable](#disposable)
14. [eventCommandBinding](#eventcommandbinding)
15. [propertyChangeEvent](#propertychangeevent)
16. [propertyChangeEventTarget](#propertychangeeventtarget)
17. [propertyDecorators](#propertydecorators)
18. [validationErrorBinding](#validationerrorbinding)
19. [validationErrorBindingFactory](#validationerrorbindingfactory)
20. [validationStateEvent](#validationstateevent)
21. [validationStateEventTarget](#validationstateeventtarget)
22. [valueConverter](#valueconverter)
23. [view](#view)
24. [viewFactory](#viewfactory)
25. [viewListController](#viewlistcontroller)
26. [viewModel](#viewmodel)
27. [viewModelFactoryBase](#viewmodelfactorybase)
28. [viewModelValidator](#viewmodelvalidator)
29. [optionsBinding](#optionsbinding)

## arrayObserver

Module's public content: the `CollectionChange<T>` type, the `ArrayObserver<T>` class.

### `CollectionChange<T>`

A single logical collection change. A union type with two variants:

```ts
type CollectionChange<T> =
    | {
        readonly type: 'splice';
        readonly index: number;
        readonly removed: readonly T[];
        readonly added: readonly T[];
      }
    | {
        readonly type: 'reset';
        readonly previous: readonly T[];
        readonly current: readonly T[];
      };
```

- the `splice` variant describes an in-place change: the index, removed and added elements;
- the `reset` variant describes a full content swap: the previous and the current state.

### `ArrayObserver<T>`

A subclass of `Array` that notifies subscribers about modifications
(`push` / `unshift` / `pop` / `shift` / `splice` / `clear` / `sort` /
`reverse` / `fill` / `copyWithin` / `deleteItem`, plus index writes and
`length`). Subscribers receive one index-based change description per logical
modification.

Failing subscriber callbacks are isolated; recursive changes are queued until
every subscriber has received the current change description.

- **`constructor(...items: T[])`**
  Initial elements or a single number treated as the initial length (as in
  `Array`).
- **`subscribeChanges(callback: (change: CollectionChange<T>) => void): void`**
  Registers a change subscriber. Called for every logical modification with a
  change description - always a copy, never mutated by later changes.
- **`unsubscribeChanges(callback: (change: CollectionChange<T>) => void): void`**
  Removes a previously registered subscriber.
- **`push(...items: T[]): number`**
  Appends elements at the end and notifies with one `splice` description.
- **`unshift(...items: T[]): number`**
  Prepends elements at the start and notifies with one `splice` description.
- **`pop(): T | undefined`**
  Removes the last element and notifies with a `splice` description.
- **`shift(): T | undefined`**
  Removes the first element and notifies with a `splice` description.
- **`splice(): T[]`** / **`splice(start: number): T[]`** /
  **`splice(start: number, deleteCount: number | undefined, ...items: T[]): T[]`**
  Native `Array.splice` semantics; notifies with one `splice` description when
  the modification is non-empty.
- **`insertAfter(index: number, ...item: T[]): void`**
  Inserts elements after the given index (`index` = -1 means the beginning).
  Contract: `index` must be an integer in the range -1 .. length - 1,
  otherwise a `RangeError` is thrown (no silent value clamping).
  An empty element list is a no-op (no exception).
- **`clear(): T[]`**
  Removes all elements, notifies with one `splice` description and returns
  the removed elements.
- **`deleteItem(item: T): number`**
  Removes the first element equal to `item` (compared as in
  `Array.prototype.indexOf`) and notifies with a `splice` description. Returns
  the index of the removed element or -1 when not found.
- **`sort(compareFn?: (a: T, b: T) => number): this`**
  Sorts in place and notifies with one `reset` description when the order changed.
- **`reverse(): this`**
  Reverses in place and notifies with one `reset` description.
- **`fill(value: T, start?: number, end?: number): this`**
  Fills a range with a value and notifies with one `reset` description.
- **`copyWithin(target: number, start: number, end?: number): this`**
  Copies a range in place and notifies with one `reset` description.

Indices are converted to integers per the ECMAScript ToInteger rules
(NaN → 0, ±Infinity unchanged, other values → `Math.trunc`) and normalized to
the [0, length] range (negative indices counted from the end).

## binding

Module's public content: the `IBinding` interface, the abstract `Binding` class.

### `IBinding`

A connection between a view element's property and a data context property.

Instances are created by `BindingFactory` (or a custom binding registration)
and `View` owns the bindings.

- **`mode: BindingMode`** (readonly)
  The binding direction resolved from the `mode` argument (OneWay by default).
- **`beginInitialization?(): void`**
  Optional lifecycle around the initial values and subscriptions of all
  bindings in the view.
- **`endInitialization?(): void`**
  Optional lifecycle (the phase ending initialization).
- **`setValue(value: unknown): void`**
  Sets the bound value on the view element; `value` is already converted
  for the view.
- **`subscribe(propertyChangeEvent: (event: Event) => void): void`**
  Registers a listener for the binding's `property-change` events; called for
  every change.
- **`unsubscribe(propertyChangeEvent: (event: Event) => void): void`**
  Removes a previously registered listener.
- **`dispose(): void`**
  Releases the binding along with all its subscriptions. Idempotent.

### `Binding`

The base class of all bindings.

Parses the `mode` argument and the remaining `name: value` arguments from the
binding declaration. Property changes are broadcast as `property-change`
events (`PropertyChangeEvent`); it is `View` that sets the initial value and
connects reverse propagation to the data context.

- **`constructor(element: HTMLElement, propertyName: string, argList: string[])`**
  `element` - the host element the binding is pinned to;
  `propertyName` - the data context property to bind;
  `argList` - the raw `name: value` arguments of the binding declaration.
  @throws {SyntaxError} when an argument uses the unsupported `bindWay` name
  or the `mode` argument is not a known `BindingMode`.
- **`element: HTMLElement`** (protected) - the host element.
- **`propertyName: string`** (protected) - the data context property name.
- **`valueChangeCallback: (value: any) => void`**
  An optional callback invoked with the value set on the binding.
- **`args: { [argName: string]: string }`** (protected)
  Arguments parsed from the binding declaration.
- **`mode: BindingMode`** (readonly)
  The binding direction resolved from the `mode` argument (OneWay by default).
- **`prepareValue(value: unknown): string`** (protected)
  Converts the value for the DOM: `null`/`undefined` becomes an empty string.
- **`dispatchEvent(value: unknown): void`** (protected)
  Emits a `property-change` event carrying `value` for `propertyName`.
- **`subscribe(propertyChangeEvent: (event: Event) => void): void`**
  Registers a listener for the binding's `property-change` events.
  @throws {Error} when the binding has already been released.
- **`unsubscribe(propertyChangeEvent: (event: Event) => void): void`**
  Removes a previously registered listener.
- **`dispose(): void`**
  Removes all `property-change` listeners. Idempotent.

## bindingFactory

Module's public content: the `BindingFactory` class (static methods only).

The registry and factory of all binding types. Property bindings (e.g. `text`,
`value`) are created by `createBinding`; structural bindings (e.g. `if`,
`collection`) are obtained via `getStructuralBindingFactory`. New types can be
added through `registerBinding` and `registerStructuralBinding`.

- **`createBinding(type: string, element: HTMLElement, name: string, argList: string[]): IBinding`** (static)
  Creates a binding of the given type. `type` - the binding type (e.g. `text`,
  `value`); `element` - the host element; `name` - the data context property to
  bind; `argList` - the raw `name: value` arguments of the declaration.
  @throws {Error} when `type` is not a registered binding type.
- **`registerBinding(name: string, bindElement: (element: HTMLElement, name: string, argList: string[]) => IBinding): void`** (static)
  Registers a new property binding type. `bindElement` - a factory invoked with
  the element, the property name and the arguments.
  @throws {Error} when the name is already registered.
- **`getStructuralBindingFactory(name: string): StructuralBindingFactory | undefined`** (static)
  Returns the factory for the given structural binding type. `name` - the
  structural binding type (e.g. `if`, `collection`). Returns the factory or
  `undefined` when the type is not structural.
- **`registerStructuralBinding(name: string, create: StructuralBindingFactory): void`** (static)
  Registers a new structural binding type. `create` - a factory invoked with
  the fragment, the property and the arguments.
  @throws {Error} when the name is already registered.

## bindingFragment

Module's public content: the `IBindingFragment`, `MountedFragment`,
`IStructuralBinding` interfaces, the `StructuralBindingFactory` type, the
`BindingFragment` class.

### `IBindingFragment`

A structural placeholder in a view: a comment anchor plus lazily created
descendants. Structural bindings (`if`, `collection`) mount and unmount
fragments to add or remove child views.

- **`nodes: readonly ChildNode[]`** (readonly)
  All currently mounted child nodes, in DOM order.
- **`context?: IBindingContext`** (readonly)
  The data context used for creating children.
- **`mount(): void`** - mounts the fragment (creates the child if needed).
- **`unmount(): void`** - unmounts the fragment (releases all children).
- **`createChild?(context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void): MountedFragment`**
  Creates a child fragment for `context`, optionally preparing its template
  first.
- **`setChildren?(children: readonly MountedFragment[]): void`**
  Replaces the mounted children with `children`, releasing the removed ones.

### `MountedFragment`

A created child `BindingFragment`: its DOM nodes and resource release.

- **`viewNodeList: ChildNode[]`** (readonly)
  The child's DOM nodes, in order.
- **`dispose(): void`** - detaches the child's nodes and releases its resources.

### `IStructuralBinding`

The binding side of a structural declaration (e.g. `if: visible`).

- **`setValue(value: unknown): void`**
  Applies the current source value to the fragment (mounting/unmounting).
- **`dispose?(): void`** - releases the structural binding's resources.

### `StructuralBindingFactory`

The type creating an `IStructuralBinding` for a parsed structural declaration:

```ts
type StructuralBindingFactory =
    (fragment: IBindingFragment, property: string, args: string[]) => IStructuralBinding;
```

### `BindingFragment`

The default implementation of `IBindingFragment`.

Wraps a comment anchor: while mounted it holds exactly one child fragment (the
view rendered for `context`); unmounting releases it. `setChildren` patches the
DOM incrementally and preserves focus and text selection for nodes that
survived.

- **`constructor(anchor: Comment, create: (context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void) => MountedFragment, context: IBindingContext | undefined)`**
  `anchor` - the comment node marking the fragment's position;
  `create` - the factory creating a child fragment for a context;
  `context` - the data context used for creating children.
- **`context: IBindingContext | undefined`** (readonly)
  The data context used for creating children.
- **`get nodes(): ChildNode[]`**
  All currently mounted child nodes, in DOM order.
- **`createChild(context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void): MountedFragment`**
  Creates a child fragment using the fragment's `create` factory.
  `context` - the child's data context; `prepare` - an optional template
  preparation hook. Returns the created child fragment.
  @throws {Error} when the fragment has already been released.
- **`setChildren(children: readonly MountedFragment[]): void`**
  Replaces the mounted children with `children`: kept nodes are re-inserted
  in their places, removed children are released, and the focus / text
  selection of surviving nodes is preserved.
  `children` - the new child fragments (must be unique).
  @throws {Error} when the fragment has been released or `children` contains
  duplicates.
- **`mount(): void`** - mounts the fragment: creates the single child if needed.
- **`unmount(): void`** - unmounts the fragment: releases all children.
- **`dispose(): void`**
  Releases all current children and removes the anchor comment.
  Idempotent.

## bindingMode

Module's public content: the `BindingMode` enum, the `parseBindingMode` function.

### `BindingMode`

The direction in which a binding flows between a ViewModel property and a DOM
element.

| Value | Meaning |
|---|---|
| `BindingMode.TwoWay` (= 0) | ViewModel → View and View → ViewModel |
| `BindingMode.OneWay` (= 1) | ViewModel → View only |
| `BindingMode.OneWayToSource` (= 2) | View → ViewModel only: the DOM writes the value back to the property |

### `parseBindingMode`

```ts
function parseBindingMode(value: string): BindingMode | undefined;
```

Parses the `mode` argument of a binding fragment and returns the matching
`BindingMode`.

`value` - the raw mode string written in the binding fragment; matching is
case-sensitive (`twoWay`, `oneWay`, `oneWayToSource`). Returns the matching
mode or `undefined` when the value is not recognized.

## collectionObserver

Module's public content: the `CollectionObserver<T>` class.

### `CollectionObserver<T>`

An `ArrayObserver` that additionally observes the elements themselves.

Index reads return element proxies: modifying a plain object or a `ViewModel`
element behind the proxy - including `ViewModel` property changes - notifies
all item-change subscribers.

`Symbol.species` is `Array`, so array methods that produce derivatives (e.g.
`slice`, `filter`) return plain arrays.

- **`static get [Symbol.species](): ArrayConstructor`**
  The species constructor: a plain `Array`.
- **`constructor(...items: T[])`**
  Initial elements; the supplied elements are added (and observed).
- **`subscribeItemChanges(callback: () => void): void`**
  Registers a subscriber for changes inside elements (property writes on
  elements behind proxies, including `ViewModel` property changes).
  Called with no arguments for every logical item change.
- **`unsubscribeItemChanges(callback: () => void): void`**
  Removes a previously registered subscriber. When no subscriber remains, the
  observation of `ViewModel` elements is released.
- **`deleteItem(item: T): number`**
  Removes the first element matching `item` - comparing proxies with their
  originals - and notifies with a `splice` description. Returns the index of
  the removed element or -1 when not found.

The class inherits all `ArrayObserver` members (among others
`subscribeChanges`, `push`, `splice`, `insertAfter`, `clear`, `sort`).

## command

Module's public content: the `CommandData`, `ICommand`, `CommandOptions`
interfaces, the `Command` class.

### `CommandData`

Immutable data describing the calling context of a command execution.

- **`commandName: string`** (readonly) - the command name.
- **`objectSender: object`** (readonly)
  The object that invoked the command (usually the source element).
- **`args: readonly string[]`** (readonly)
  The raw text arguments of the binding fragment that invoked the command.
- **`sourceEvent: Event`** (readonly)
  The original DOM event that invoked the command.
- **`parameter?: unknown`** (readonly) - an optional resolved command parameter.

### `ICommand`

A ViewModel command: an executable unit of business logic that views invoke
through command bindings. Commands support an optional `canExecute` gate,
execution state tracking and reentrancy blocking.

- **`commandData: CommandData`** (readonly)
  Call data of the newest (or pending) execution.
- **`isExecuting?: boolean`** (readonly)
  Whether at least one execution is currently in progress.
- **`subscribeExecutionState?(listener: (isExecuting: boolean) => void): () => void`**
  Subscription to execution state changes (entering/leaving the "executing"
  state). Returns a function that removes the subscription.
- **`canExecute?(parameter?: unknown): boolean`**
  Checks whether the command can be executed with the given parameter.
- **`subscribeCanExecuteChanged?(listener: () => void): () => void`**
  Subscription to `canExecute` state changes (the executability may have
  changed). Returns a function that removes the subscription.
- **`notifyCanExecuteChanged?(): void`**
  Notifies subscribers that the `canExecute` state may have changed.
- **`execute(event: CommandActionEvent): void | Promise<void>`**
  Executes the command. Returns a promise when the execution is asynchronous,
  otherwise `undefined`.

### `CommandOptions`

Options controlling a `Command` instance.

- **`canExecute?: (parameter: unknown) => boolean`**
  An optional gate checked before every execution. Returns `true` when
  execution is allowed.
- **`blockWhileExecuting?: boolean`**
  When `true`, the command reports `canExecute` as `false` while an execution
  is in progress (reentrancy blocking).

### `Command`

The default implementation of `ICommand`.

The constructor takes a callback that receives a frozen proxy of the
`ICommand` call bound to this instance - so callbacks can inspect the current
call data and even invoke the command again. The execution count is by
reference: overlapping async executions keep `isExecuting` at `true` until
all of them finish.

- **`constructor(executeCallback: (command: ICommand) => unknown, onError?: ((error: unknown) => void) | undefined, options?: CommandOptions)`**
  `executeCallback` - called for every execution with a frozen proxy of the
  `ICommand` call; may return a value or a promise - a promise keeps the
  command in the "executing" state until it settles.
  `onError` - an optional callback receiving rejected asynchronous executions;
  when omitted, rejections are rethrown on the returned promise.
  `options` - optional execution gating options.
- **`get commandData(): CommandData`**
  Call data of the newest (or pending) execution.
- **`get isExecuting(): boolean`**
  Whether at least one execution is currently in progress.
- **`subscribeExecutionState(listener: (isExecuting: boolean) => void): () => void`**
  Subscription to execution state changes. Returns a function that removes
  the subscription.
- **`canExecute(parameter?: unknown): boolean`**
  Checks whether the command can be executed with the given parameter. Returns
  `false` when `blockWhileExecuting` is set and an execution is in progress, or
  when the configured gate returns `false`.
- **`subscribeCanExecuteChanged(listener: () => void): () => void`**
  Subscription to `canExecute` state changes. Returns a function that removes
  the subscription.
- **`notifyCanExecuteChanged(): void`**
  Notifies subscribers that the `canExecute` state may have changed.
- **`execute(event: CommandActionEvent): void | Promise<void>`**
  Executes the command with the given call event. A no-op when `canExecute`
  rejects the call. Synchronous callback results finish immediately; promise
  results keep the "executing" state until they settle. Returns a settled
  promise chain for asynchronous executions.
  @throws Exceptions thrown synchronously by the callback propagate unchanged.

## commandActionEvent

Module's public content: the `ICommandActionEvent` interface, the
`CommandActionEvent` class.

### `ICommandActionEvent`

An event carrying the full context of a command action call: which command
was fired, by which object, from which DOM event, with which arguments and
parameter. Extends `Event`.

- **`commandName: string`** (readonly) - the name of the fired command.
- **`objectSender: object`** (readonly)
  The object that fired the command (usually the source element).
- **`args: string[]`** (readonly) - the raw text arguments of the binding fragment.
- **`parameter?: unknown`** (readonly) - an optional resolved command parameter.

### `CommandActionEvent`

The standard `ICommandActionEvent` implementation based on the DOM `Event`.

- **`commandName: string`** (readonly) - the name of the fired command.
- **`objectSender: object`** (readonly)
  The object that fired the command (usually the source element).
- **`sourceEvent: Event`** (readonly)
  The original DOM event that fired the command.
- **`args: string[]`** (readonly) - the raw text arguments of the binding fragment.
- **`parameter?: unknown`** (readonly) - an optional resolved command parameter.
- **`constructor(type: string, commandName: string, objectSender: object, sourceEvent: Event, args: string[], parameter?: unknown)`**
  `type` - the event type (conventionally `command-action`);
  `commandName` - the name of the fired command;
  `objectSender` - the object that fired the command;
  `sourceEvent` - the original DOM event that fired the command;
  `args` - the raw text arguments of the binding fragment;
  `parameter` - an optional resolved command parameter.

## commandActionEventTarget

Module's public content: the `ICommandActionEventTarget` interface, the
`CommandActionEventTarget` class.

### `ICommandActionEventTarget`

An `EventTarget` that can fire command action events.

- **`commandAction(commandName: string, objectSender: object, sourceEvent: Event, ...args: string[]): void`**
  Fires a `command-action` event for the given command call.
  `commandName` - the name of the fired command;
  `objectSender` - the object that fired the command;
  `sourceEvent` - the original DOM event that fired the command;
  `args` - the raw text arguments of the binding fragment.

### `CommandActionEventTarget`

The default `ICommandActionEventTarget` implementation built on the standard
`EventTarget`.

- **`commandAction(commandName: string, objectSender: object, sourceEvent: Event, ...args: string[]): void`**
  Fires a `CommandActionEvent` for the given command call. Arguments as in
  `ICommandActionEventTarget.commandAction`.

## commandBindingFactory

Module's public content: the `CommandBindingFactory` class (static methods
only) and the `CommandBindingCreate` type.

Creates command event bindings by name.

Registered types: `click`, `mouseInOut`, `change`, `input`, `focusout`,
`resize`, `animationend`, `enter`, `key`, `submit`, `dragover`, `dragleave`,
`drop`, `ready`, `mousedown`, `mouseup`, `mousemove`.

### `CommandBindingCreate`

`(element: HTMLElement, name: string, argList: string[], eventTarget: ICommandActionEventTarget) => IEventCommandBinding`

Factory of a registered command event binding type; `element` - the element to
listen on, `name` - the command name, `argList` - the raw `name:value`
arguments, `eventTarget` - the `command-action` event target (always provided).

- **`createCommandBinding(type: string, element: HTMLElement, name: string, argList: string[], eventTarget?: ICommandActionEventTarget): IEventCommandBinding`** (static)
  Creates a command event binding of the given type.
  `type` - the binding type (e.g. `click`, `input`, `key`);
  `element` - the DOM element to listen on;
  `name` - the command name to fire;
  `argList` - the raw `name:value` argument strings of the binding fragment;
  `eventTarget` - the target receiving `command-action` events; when omitted,
  a new target is created.
  Returns the created binding.
  @throws {Error} when the type is not registered.
- **`registerCommandBinding(name: string, create: CommandBindingCreate): void`** (static)
  Registers a new command event binding type. The registry is global (per
  package copy); register before creating views, once per name.
  @throws {Error} when the name is already taken (built-in type or an earlier
  registration).

## commandDecorators

Module's public content: the `DecoratedCommandOptions` interface and the
`command` and `autoRegisterCommands` decorators.

The decorators register commands declaratively on a ViewModel class. Commands
are registered per instance (in an initializer) when the class hierarchy is
marked with `@autoRegisterCommands`.

### `DecoratedCommandOptions`

Options for the `command` decorator; a generic interface - the `This` type
parameter (default `IViewModel`) restricts the ViewModel instance type the
decorator is applied to.

- **`canExecute?: (this: This, parameter: unknown) => boolean`**
  An optional gate checked before every execution, invoked with the ViewModel
  instance as `this`.
  `parameter` - the parameter the execution would start with.
  Returns `true` when execution is allowed.
- **`blockWhileExecuting?: boolean`**
  When `true`, the command reports `canExecute` as `false` while an execution
  is running (reentrancy blocking).

### `command`

A method decorator registering the decorated method as a ViewModel command.

```ts
function command(commandName: string, options?: DecoratedCommandOptions): ...
```

- `commandName` - the name the command is registered under.
- `options` - execution control options (`canExecute`, `blockWhileExecuting`).
- Returns a standard method decorator.
- @throws {Error} when applied to anything other than a method, or when a
  command is already declared under that name in the same class.

### `autoRegisterCommands`

A class decorator marking the class hierarchy for automatic registration of
decorated commands.

```ts
function autoRegisterCommands(): ...
```

- Returns a standard class decorator.
- @throws {Error} when applied to anything other than a class.

## compositeDisposable

`dispose()` logs teardown failures with `console.warn(message, error)` and continues cleanup. The original thrown value is included. Errors from immediate teardown execution in `add()` after disposal propagate to its caller.

Module's public content: the `CompositeDisposable` class.

Collects resource-release callbacks and `IDisposable` objects and releases
them all at once in the reverse order of registration.

Release is idempotent: after release, further `add()` calls run the given
teardown immediately instead of storing it.

- **`add(teardown: Teardown): void`**
  Registers a release callback that will run when this composite is released.
  When the composite is already released, the callback is executed
  immediately. `teardown` - a call releasing a single resource.
- **`addDisposable(disposable: IDisposable): void`**
  Registers another `IDisposable` object to be released together with this
  composite. `disposable` - the object to release when this composite is
  released.
- **`dispose(): void`**
  Runs all registered teardowns in the reverse order of registration and
  marks this composite as released. An error thrown by a single teardown is
  reported to the console and does not stop the remaining teardowns.

## disposable

Module's public content: the `IDisposable` interface, the `Teardown` type.

### `IDisposable`

A contract for objects that own resources and can release them
deterministically.

- **`dispose(): void`**
  Releases the resources owned by this object. Implementations must make this
  method idempotent, so repeated calls are no-ops.

### `Teardown`

A callback releasing a single resource (a subscription, a listener, ...).

```ts
type Teardown = () => void;
```

## eventCommandBinding

Module's public content: the `IEventCommandBinding` interface, the abstract
`EventCommandBinding` class.

### `IEventCommandBinding`

A contract for bindings that relay DOM element events to a command action
target. Implementations listen to a specific DOM event on the element and
fire `command-action` events.

- **`subscribe(functionEvent: (event: Event) => void): void`**
  Registers a `command-action` event listener.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Removes a previously registered listener.
- **`dispose(): void`** - releases the binding.

### `EventCommandBinding`

The base class of command bindings: stores `command-action` listeners, parses
the binding fragment's `name:value` argument pairs into `args` for concrete
implementations and tracks disposal.

- **`element: HTMLElement`** (protected) - the DOM element to listen on.
- **`commandName: string`** (protected) - the command name to fire.
- **`eventTarget: ICommandActionEventTarget`** (protected)
  The target receiving `command-action` events.
- **`args: { [argName: string]: string }`** (protected)
  Arguments parsed from the binding fragment.
- **`commandListeners: Set<(event: Event) => void>`** (protected, readonly)
  The registry of `command-action` listeners.
- **`disposed: boolean`** (protected) - whether the binding was released.
- **`constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget)`**
  `element` - the DOM element to listen on;
  `commandName` - the command name to fire;
  `argList` - the raw `name:value` argument strings of the binding fragment;
  `eventTarget` - the target receiving `command-action` events.
- **`subscribe(functionEvent: (event: Event) => void): void`**
  Registers a `command-action` listener on the underlying event target.
  `functionEvent` - the listener to register.
  @throws {Error} when called on a released binding.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Removes a previously registered `command-action` listener.
- **`dispose(): void`**
  Removes all listeners and marks the binding as released. Idempotent.

## propertyChangeEvent

Module's public content: the `IPropertyChangeEvent` interface, the
`PropertyChangeEvent` class.

### `IPropertyChangeEvent`

A change event carrying the name of the changed property and its new value.
Extends `Event`.

- **`propertyName: string`** - the name of the changed property.
- **`value: unknown`** - the property's new value.

### `PropertyChangeEvent`

The standard `IPropertyChangeEvent` implementation based on the DOM `Event`.

- **`propertyName: string`** (readonly) - the name of the changed property.
- **`value: unknown`** (readonly) - the property's new value.
- **`constructor(type: string, propertyName: string, value: unknown)`**
  `type` - the event type (conventionally `property-change`);
  `propertyName` - the name of the changed property;
  `value` - the property's new value.

## propertyChangeEventTarget

Module's public content: the `IPropertyChangeEventTarget` interface, the
`PropertyChangeEventTarget` class.

### `IPropertyChangeEventTarget`

An `EventTarget` that can fire property change notifications.
Extends `EventTarget`.

- **`notifyPropertyChanged<T>(propertyName: string, value: T): void`**
  Fires a `property-change` event carrying the property's new value.
  `propertyName` - the name of the changed property;
  `value` - the property's new value.

### `PropertyChangeEventTarget`

The default `IPropertyChangeEventTarget` implementation built on the standard
`EventTarget`.

- **`notifyPropertyChanged<T>(propertyName: string, value: T): void`**
  Fires a `PropertyChangeEvent` for the given property value.
  `propertyName` - the name of the changed property;
  `value` - the property's new value.

## propertyDecorators

Module's public content: the accessor decorators `validate`, `propertyChange`,
`propertyAlias`.

### `validate`

An accessor decorator registering a property with a validator (or an array of
validators). A validator may be an instance or a factory function. Stacking
`@validate` with `@propertyChange` on one accessor is supported.

```ts
function validate(input: ValidatorInput, callback?: string): ...
```

- `input` - a validator instance, a validator factory or an array of these.
- `callback` - an optional method name bound to the ViewModel instance.
  Runs after validation on writes with `callbackExecute = true`:
  `setPropertyValue` (by default), `setPropertyValueAndNotify` (explicitly)
  and `setPropertyValueFromView` for changed values.
  Plain accessor assignment and initialization do not invoke the callback.
  View writes skip `Object.is`-equal values; explicit write APIs do not.
- @throws {Error} when applied to anything other than a named accessor.

### `propertyChange`

An accessor decorator registering a reactive property on the ViewModel. Reads
go through the registered property store, and a write fires a
`property-change` notification.

```ts
function propertyChange(callback?: string): ...
```

- `callback` - an optional method name bound to the ViewModel instance.
  Runs after validation on writes with `callbackExecute = true`:
  `setPropertyValue` (by default), `setPropertyValueAndNotify` (explicitly)
  and `setPropertyValueFromView` for changed values.
  Plain accessor assignment and initialization do not invoke the callback.
  View writes skip `Object.is`-equal values; explicit write APIs do not.
- @throws {Error} when applied to anything other than a named accessor.
- @throws {TypeError} when the resolved callback is not a function.

### `propertyAlias`

An accessor decorator registering a reactive property under an alias. The
accessor's name differs from the property name exposed to bindings.

```ts
function propertyAlias(propertyName: string, callback?: string): ...
```

- `propertyName` - the property name exposed to the ViewModel and bindings.
- `callback` - an optional method name bound to the ViewModel instance.
  Runs after validation on writes with `callbackExecute = true`:
  `setPropertyValue` (by default), `setPropertyValueAndNotify` (explicitly)
  and `setPropertyValueFromView` for changed values.
  Plain accessor assignment and initialization do not invoke the callback.
  View writes skip `Object.is`-equal values; explicit write APIs do not.
- @throws {Error} when applied to anything other than a named accessor.

## validationErrorBinding

Module's public content: the `IValidationErrorBinding` interface, the abstract
`ValidationErrorBinding` class.

### `IValidationErrorBinding`

A contract for bindings that reflect a property's validation state in the DOM.
Implementations react to the `error-change` events published by
`IValidationStateChangeEventTarget`.

- **`subscribe(functionEvent: (event: Event) => void): void`**
  Registers an `error-change` listener on the underlying event target.
  @throws {Error} when called on a released binding.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Removes a previously registered `error-change` listener.
- **`dispose(): void`**
  Releases all subscriptions. Idempotent.
- **`setValid(isValid: boolean, message?: string): void`**
  Applies the validation result to the DOM element. `isValid` - whether the
  property value is valid; `message` - the error message when invalid.
- **`reset(): void`**
  Clears the validation presentation (the error state is removed).

### `ValidationErrorBinding`

The base class of validation error bindings: tracks validity, stores
`error-change` listeners and parses the `name:value` argument pairs into
`argsList` for concrete implementations.

- **`element: HTMLElement`** (protected) - the DOM element the binding renders
  its presentation to.
- **`propertyName: string`** (protected) - the name of the validated ViewModel
  property.
- **`eventTarget: IValidationStateChangeEventTarget`** (protected)
  The target publishing `error-change` events.
- **`errorListeners: Set<(event: Event) => void>`** (protected, readonly)
  The registry of `error-change` listeners.
- **`disposed: boolean`** (protected) - whether the binding was released.
- **`isValid: boolean`** (protected)
  The current validity flag; updated by `setValid` / `reset`.
- **`argsList: { [argName: string]: string }`** (protected)
  The `name:value` arguments parsed from the binding fragment.
- **`constructor(element: HTMLElement, propertyName: string, argList: string[], eventTarget: IValidationStateChangeEventTarget)`**
  `element` - the DOM element the binding renders to;
  `propertyName` - the name of the validated ViewModel property;
  `argList` - the raw `name:value` argument strings of the binding fragment;
  `eventTarget` - the target publishing `error-change` events.
- **`subscribe(functionEvent: (event: Event) => void): void`**
  Registers an `error-change` listener on the underlying event target.
  @throws {Error} when called on a released binding.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Removes a previously registered `error-change` listener.
- **`dispose(): void`**
  Removes all listeners and marks the binding as released. Idempotent.
- **`setValid(isValid: boolean, message?: string): void`**
  Stores the validation result without touching the DOM. Concrete
  implementations override this method to update the element as well.
- **`reset(): void`**
  Marks the property as valid again without touching the DOM.
- **`prepareArgs(argList: string[]): void`** (protected)
  Parses the raw `name:value` arguments into `argsList`.

## validationErrorBindingFactory

Module's public content: the `ValidationErrorBindingFactory` class (static
methods only) and the `ValidationErrorBindingCreate` type.

Creates validation error bindings by name.

Registered types: `class` (toggles CSS classes on the element), `message`
(renders the error message element) and `click` (an alias of `class`).

### `ValidationErrorBindingCreate`

`(element: HTMLElement, name: string, argList: string[], eventTarget: IValidationStateChangeEventTarget) => IValidationErrorBinding`

Factory of a registered validation error binding type; `element` - the host
element, `name` - the validated property name, `argList` - the raw
`name:value` arguments, `eventTarget` - the `error-change` event target
(always provided).

- **`createValidationErrorBinding(type: string, element: HTMLElement, name: string, argList: string[], eventTarget?: IValidationStateChangeEventTarget): IValidationErrorBinding`** (static)
  Creates a validation error binding of the given type.
  `type` - the binding type: `class`, `message` or `click` (an alias of `class`);
  `element` - the DOM element the binding renders to;
  `name` - the name of the validated ViewModel property;
  `argList` - the raw `name:value` argument strings of the binding fragment;
  `eventTarget` - the target publishing `error-change` events; when omitted,
  a new target is created.
  Returns the created binding.
  @throws {Error} when the type is not registered.
- **`registerValidationErrorBinding(name: string, create: ValidationErrorBindingCreate): void`** (static)
  Registers a new validation error binding type. The registry is global (per
  package copy); register before creating views, once per name.
  @throws {Error} when the name is already taken (a built-in type, the `click`
  alias or an earlier registration).

## validationStateEvent

Module's public content: the `IValidationStateChangeEvent`,
`IValidationStateResetEvent` interfaces; the `ValidationStateChangeEvent`,
`ValidationStateResetEvent` classes.

### `IValidationStateChangeEvent`

An event fired when a property's validation state changes. Extends `Event`.

- **`propertyName: string`** - the name of the validated property.
- **`isValid: boolean`** - whether the property value is valid.
- **`message?: string`** - the error message; present only when `isValid` is
  `false`.

### `ValidationStateChangeEvent`

The standard `IValidationStateChangeEvent` implementation based on the DOM
`Event`.

- **`propertyName: string`** (readonly) - the name of the validated property.
- **`isValid: boolean`** (readonly) - whether the property value is valid.
- **`message?: string`** (readonly) - the error message; present only when
  invalid.
- **`constructor(type: string, propertyName: string, isValid: boolean, message?: string)`**
  `type` - the event type (conventionally `error-change`);
  `propertyName` - the name of the validated property;
  `isValid` - whether the property value is valid;
  `message` - the error message, present only when invalid.

### `IValidationStateResetEvent`

An event fired when a property's stored validation state is reset.
Extends `Event`.

- **`propertyName: string`** - the name of the property whose validation state
  was reset.

### `ValidationStateResetEvent`

The standard `IValidationStateResetEvent` implementation based on the DOM
`Event`.

- **`propertyName: string`** (readonly) - the name of the property whose
  validation state was reset.
- **`constructor(type: string, propertyName: string)`**
  `type` - the event type (conventionally `error-reset`);
  `propertyName` - the name of the property whose validation state was reset.

## validationStateEventTarget

Module's public content: the `IValidationStateChangeEventTarget`,
`IValidationStateResetEventTarget` interfaces; the
`ValidationStateChangeEventTarget`, `ValidationStateResetEventTarget` classes.

### `IValidationStateChangeEventTarget`

An `EventTarget` that can fire validation `error-change` events.
Extends `EventTarget`.

- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Fires an `error-change` event for the given validation result.
  `propertyName` - the name of the validated property;
  `isValid` - whether the property value is valid;
  `message` - the error message, present only when invalid.

### `ValidationStateChangeEventTarget`

The default `IValidationStateChangeEventTarget` implementation built on the
standard `EventTarget`.

- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Fires a `ValidationStateChangeEvent` for the given validation result.
  Arguments as in the interface.

### `IValidationStateResetEventTarget`

An `EventTarget` that can fire validation `error-reset` events.
Extends `EventTarget`.

- **`notifyValidationStateReset(propertyName: string): void`**
  Fires an `error-reset` event for the given property.
  `propertyName` - the name of the property whose validation state was reset.

### `ValidationStateResetEventTarget`

The default `IValidationStateResetEventTarget` implementation built on the
standard `EventTarget`.

- **`notifyValidationStateReset(propertyName: string): void`**
  Fires a `ValidationStateResetEvent` for the given property.
  `propertyName` - the name of the property whose validation state was reset.

## valueConverter

Module's public content: the `IValueConverter` interface, the
`ConverterTargetProvider` interface, the `convert` decorator, and the
`registerConverter`, `unregisterConverter`, `getConverter`, `hasConverterFor`,
`getConverterMetadataFor`, `convertToView`, `convertToViewModel` functions.

### `IValueConverter`

A value converter between the ViewModel and the View.

The equivalent of `IValueConverter` in classic MVVM frameworks.

Converters are registered by name and attached to properties with the
`@convert` decorator.

- **`convert(value: unknown, parameter?: unknown): unknown`**
  Converts a value from the ViewModel to the View.
  `value` - the raw value read from the ViewModel;
  `parameter` - an optional parameter given in `@convert` (e.g. a CSS class
  name or an enum map).
  Returns the value to apply in the View.
- **`convertBack?(value: unknown, parameter?: unknown): unknown`**
  Converts a value from the View to the ViewModel.
  Applied only when the binding mode is `twoWay` or `oneWayToSource`.
  `value` - the raw value read from the DOM;
  `parameter` - the parameter given in `@convert`.
  Returns the value to store in the ViewModel.

### `ConverterTargetProvider`

An optional contract a ViewModel can implement to redirect a property's
converter lookup to a nested context (e.g. a child model).

- **`getConverterTarget(propertyName: string): { context: object; propertyName: string } | undefined`**
  Resolves the object that actually declares the converter for the given
  property.
  `propertyName` - the property to look up.
  Returns the lookup target `{ context, propertyName }` or `undefined` when
  the property has no converter.

### `convert`

An accessor decorator attaching a named value converter to a ViewModel
property.

```ts
function convert(converterName: string, parameter?: unknown): ...
```

- `converterName` - the name the converter is registered under in
  `registerConverter`.
- `parameter` - an optional parameter passed to `convert` / `convertBack`.
- @throws {Error} when applied to anything other than a named accessor, or
  when another converter is already declared for this property.

### `registerConverter`

```ts
function registerConverter(name: string, converter: IValueConverter): void;
```

Registers a value converter under a name so it can be referenced from the
`@convert` decorator.

- `name` - the registry key used by `@convert` and `getConverter`.
- `converter` - the converter instance to store.

### `unregisterConverter`

```ts
function unregisterConverter(name: string): void;
```

Removes a converter from the registry.

- `name` - the registry key previously given to `registerConverter`.

### `getConverter`

```ts
function getConverter(name: string): IValueConverter;
```

Returns the converter registered under the given name.

- `name` - the registry key.
- @throws {Error} when no converter is registered under the given name.

### `hasConverterFor`

```ts
function hasConverterFor(propertyName: string, vm: object): boolean;
```

Checks whether a ViewModel property has a converter attached through
`@convert`.

- `propertyName` - the property name as exposed to bindings.
- `vm` - the ViewModel instance (or object) to inspect.
- Returns `true` when the property has an attached converter.

### `getConverterMetadataFor`

```ts
function getConverterMetadataFor(propertyName: string, vm: object): ConverterMetadata | undefined;
```

Resolves the converter metadata of a ViewModel property, honoring
`ConverterTargetProvider` so nested contexts can declare their own converters.

- `propertyName` - the property name as exposed to bindings.
- `vm` - the ViewModel instance (or object) to inspect.
- Returns the converter metadata or `undefined` when the property has no
  converter.

The metadata is an object `{ propertyName: string; converterName: string; parameter?: unknown }`.

### `convertToView`

```ts
function convertToView(value: unknown, propertyName: string, vm: object): unknown;
```

Passes a value through the converter attached to the property (ViewModel →
View direction). Returns the value unchanged when the property has no
`@convert` decorator.

- `value` - the raw property value.
- `propertyName` - the property name as exposed to bindings.
- `vm` - the ViewModel instance (or object) that declares the converter.
- Returns the converted value or the input value when there is no applicable
  converter.

### `convertToViewModel`

```ts
function convertToViewModel(value: unknown, propertyName: string, vm: object): unknown;
```

Passes a value through the converter attached to the property (View →
ViewModel direction). Returns the value unchanged when the property has no
`@convert` decorator or when the converter does not implement `convertBack`.

- `value` - the raw value read from the DOM.
- `propertyName` - the property name as exposed to bindings.
- `vm` - the ViewModel instance (or object) that declares the converter.
- Returns the converted value or the input value when there is no applicable
  conversion.

## view

Module's public content: the `IView` interface, the `IViewOptions` interface,
the `View` class.

### `IView`

A rendered template instance: the DOM nodes it owns, the data context it is
bound to, and its lifecycle.

- **`id: number | null`** (readonly)
  A unique view id or `null` when unassigned.
- **`viewNodeList: ChildNode[]`** (readonly)
  All the view's DOM nodes, including mounted structural children.
- **`name: string`**
  The view's name (an empty string by default).
- **`ownsDataContext: boolean`**
  Whether the view owns (and releases on disposal) its data context.
- **`dataContext: IBindingContext | undefined`** (readonly)
  The bound data context, if any.
- **`detach(): void`**
  Removes all the view's nodes from the DOM (without releasing anything).
- **`dispose(): void`**
  Detaches the nodes, releases all bindings and - when it owns it - the data
  context.
- **`isDisposed: boolean`** (readonly) - whether the view was released.

### `IViewOptions`

Constructor options for `View`.

- **`ownsDataContext?: boolean`**
  Whether the view owns (and releases on disposal) the passed data context.
  Defaults to `true`, which preserves the default behaviour. For a shared
  model set `false` and clean up the model at its owner.

### `View`

The concrete `IView`: renders a template into DOM nodes and connects the
`data-bind`, `data-command` and `data-validate-error` declarations to the data
context.

The view subscribes to the data context's property and validation state
changes and updates the bound DOM; element changes propagate back (unless the
binding mode is one-way). Structural bindings (`if`, `collection`) mount and
unmount child views through `BindingFragment` fragments.

- **`id: number | null`** (readonly)
  A unique view id or `null` when unassigned.
- **`ownsDataContext: boolean`**
  Whether the view owns (and releases on disposal) its data context.
- **`dataContext: IBindingContext | undefined`** (readonly, getter)
  The bound data context, if any.
- **`viewNodeList: ChildNode[]`** (readonly, getter)
  All the view's DOM nodes, including mounted structural children.
- **`name: string`**
  The view's name (an empty string by default).
- **`isDisposed: boolean`** (readonly, getter) - whether the view was released.
- **`constructor(template: HTMLElement, context?: IBindingContext, id?: number, options?: IViewOptions)`**
  `template` - the template element (or any element whose content is used) to
  render;
  `context` - the data context to bind, if any;
  `id` - an optional unique view id;
  `options` - optional constructor options.
  @throws {TypeError} when `template` is not an `HTMLElement`.
- **`detach(): void`**
  Removes all the view's nodes from the DOM (without releasing anything).
- **`dispose(): void`**
  Detaches the nodes, releases all bindings, fragments and command
  coordinators and - when `ownsDataContext` - releases the data context.
  Idempotent.

## viewFactory

Module's public content: the `IViewFactory` interface, the `ViewFactory` class.

### `IViewFactory`

Creates `View`s from templates.

- **`getView(template: HTMLElement, dataContext?: IBindingContext, options?: IViewOptions): IView`**
  Creates a view from an explicit template element.
- **`getViewById(id: string, dataContext?: IBindingContext, options?: IViewOptions): IView`**
  Creates a view from the template with the given `id`.
- **`getTemplateById(id: string): HTMLElement`**
  Returns the template element with the given `id`.

### `ViewFactory`

The default `IViewFactory`: resolves templates by `id` from the document.

- **`getView(template: HTMLElement, dataContext?: IBindingContext, options?: IViewOptions): View`**
  Creates a view from an explicit template element.
  `template` - the template element to render;
  `dataContext` - the data context to bind, if any;
  `options` - optional constructor options.
  Returns the created view.
- **`getViewById(id: string, dataContext?: IBindingContext, options?: IViewOptions): View`**
  Creates a view from the template with the given `id`.
  `id` - the template element's `id` in the document;
  `dataContext` - the data context to bind, if any;
  `options` - optional constructor options.
  Returns the created view.
  @throws {Error} when no template with the `id` exists.
  @throws {TypeError} when the element with the `id` is not an `HTMLElement`.
- **`getTemplateById(id: string): HTMLElement`**
  Returns the template element with the given `id`.
  `id` - the template element's `id` in the document.
  Returns the template element.
  @throws {Error} when no element with the `id` exists.
  @throws {TypeError} when the element with the `id` is not an `HTMLElement`.

## viewListController

Module's public content: the `ViewListPlace` type, the `ViewListController`
class.

### `ViewListPlace`

The placement of the rendered list inside the host element.

```ts
type ViewListPlace = 'start' | 'end';
```

### `ViewListController`

A controller of a list of views/elements inside a host element.

Semantics: snapshot-based reconciliation. After every source change the
CURRENT snapshot of the collection is rendered, and the controller computes
the minimal number of insert/remove/move operations against the current DOM
(entry identity = reference identity).

Ownership rule: the controller borrows the views - it detaches the DOM but
does NOT destroy the views.

- **`place: ViewListPlace`**
  The list's place inside the host: `'start'` or `'end'`.
- **`constructor(host: HTMLElement, place?: ViewListPlace)`**
  `host` - the element that receives the rendered list entries;
  `place` - where the list is placed inside the host (default `'end'`).
- **`setSource(source: unknown[] | ArrayObserver<unknown> | undefined): void`**
  Attaches the source (a plain array or an `ArrayObserver`) and renders the
  current snapshot. Observation starts BEFORE rendering (safety against
  reentrant reads - a source change during rendering is not lost).
  `source` - the new source; `undefined` clears the list.
- **`refresh(): void`**
  Renders the current source snapshot again.
- **`dispose(): void`**
  Releases the source and detaches all elements from the host (the views are
  NOT destroyed - the ownership rule). Idempotent.
- **`static longestCommonSubsequence(a: unknown[], b: unknown[]): number[]`**
  The longest common subsequence (reference identity) - returns the indices
  of `a` entries that keep their relative order in `b`.
  `a` - the first list (the current DOM state);
  `b` - the second list (the desired state).
  Returns the indices of `a` forming the common subsequence, in order.

## viewModel

Module's public content: the `IBindingContext` interface, the `IViewModel`
interface, the `ViewModelDisposalError` class and the `ViewModel` class.

### `IBindingContext`

The binding-side contract that View uses to communicate with the ViewModel:
property access, change/validation subscriptions, commands and disposal.

- **`getPropertyValue(name: string): unknown`**
  Returns the value of a registered property.
  `name` - the property name; `undefined` for an unregistered one.
- **`setPropertyValue(name: string, value: unknown, callbackExecute?: boolean): void`**
  Sets the property value without firing `property-change`.
  Runs the registered validators first, then the change callback.
  `callbackExecute` - whether to run the change callback (default `true`).
- **`setPropertyValueFromView?(name: string, value: unknown): void`**
  A view-initiated value write used by two-way bindings.
  `name` - the property name; `value` - the new value read from the DOM.
  (Optional in the interface; the `ViewModel` class implements it.)
- **`subscribeProperties(eventCallback: (event: Event) => void): void`**
  Subscribes to `property-change` events.
- **`unsubscribeProperties(eventCallback: (event: Event) => void): void`**
  Removes a subscription registered by `subscribeProperties`.
- **`subscribeValidationState(eventCallback: (event: Event) => void): void`**
  Subscribes to validation `error-change` events.
- **`unsubscribeValidationState(eventCallback: (event: Event) => void): void`**
  Removes a subscription registered by `subscribeValidationState`.
- **`subscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Subscribes to validation `error-reset` events.
- **`unsubscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Removes a subscription registered by `subscribeValidationReset`.
- **`getCommand(name: string): ICommand | undefined`**
  Returns the command registered under the given name or `undefined`.
- **`subscribeCommands?(callback: (name: string) => void): () => void`**
  Subscribes to command registration changes; the callback is invoked on
  every command registration and unregistration.
  Returns a function removing this subscription.
- **`subscribeContextChanges?(callback: () => void): () => void`**
  Subscribes to context changes (View refreshes its bindings thanks to it).
  Returns a function removing this subscription.
- **`validateProperty(name: string): void`**
  Validates the property against its registered validators and publishes the
  resulting state. A no-op when the property has no validators.
- **`getPropertyValidationState?(name: string): PropertyValidationState`**
  Returns a snapshot of the property's validation state (see
  `PropertyValidationState` below).
- **`dispose(): void`**
  Releases the ViewModel's resources.

### `IViewModel`

The full ViewModel contract: everything from `IBindingContext` plus the
model-side registration, notification and validation API.

Besides the members inherited from `IBindingContext` it adds:

- **`notifyPropertyChanged(propertyName: string, value: unknown): void`**
  Fires a `property-change` event carrying the given value.
  The notification is suppressed while the property is being written from the
  view (a single notification is published once the write settles).
- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Updates the property's validation state and fires an `error-change` event.
  For valid states the error message is cleared.
- **`setPropertyValueAndNotify(name: string, value: unknown): void`**
  Sets the property value and fires a `property-change` event.
- **`registerProperty(name: string, value?: unknown, changeCallback?: (value: unknown) => void): void`**
  Registers a reactive property under a name.
  `changeCallback` - an optional callback invoked after validation on writes
  with `callbackExecute = true`, not during registration. View writes skip
  `Object.is`-equal values; `setPropertyValue` does not skip such writes.
  Plain decorated accessor assignment does not invoke the callback.
- **`unregisterProperty(name: string): void`**
  Removes the property from the registry. Validators and validation state
  registered for the property stay untouched.
- **`hasRegisteredProperty(name: string): boolean`**
  Returns `true` when the property is registered.
- **`registerCommand(name: string, command: ICommand): void`**
  Commits the registry change, notifies every listener in the snapshot, then rethrows the first original listener error. Nested notifications are synchronous; errors do not roll back the change.
  Registers a command and notifies command listeners.
- **`unregisterCommand(name: string): void`**
  Commits the registry change, notifies every listener in the snapshot, then rethrows the first original listener error. Nested notifications are synchronous; errors do not roll back the change.
  Unregisters a command and notifies command listeners.
- **`registerProperties(properties: { [propertyName: string]: unknown }): void`**
  Registers several properties from an object literal.
- **`hasPropertyValidator(name: string): boolean`**
  Returns `true` when the property has registered validators.
- **`registerPropertyValidator(name: string, validators: IViewModelValidator[]): void`**
  Registers the property's validators, merging with any already registered.
- **`unregisterPropertyValidator(name: string): void`**
  Removes all of the property's validators. When the property had been
  validated, its validation state is reset.
- **`setPropertyValidationState(name: string, isValid: boolean, message?: string): void`**
  Sets the property's validation state and fires an `error-change` event
  (an alias of `notifyValidationStateChanged`).
- **`resetPropertyValidationState(name: string): void`**
  Removes the property's stored validation state and fires an `error-reset`
  event.
- **`validate(): boolean`**
  Validates all properties that have registered validators.
  Returns `true` when all validated properties are valid.
- **`isPropertyValid(name: string): boolean`**
  Returns `true` when the property is currently valid (or was never
  validated).
- **`getPropertyValidationMessage(name: string): string | undefined`**
  Returns the property's last validation error message or `undefined` when
  the property is valid or was never validated.
- **`hasPropertyBeenValidated(name: string): boolean`**
  Returns `true` when the property has been validated at least once.
- **`getPropertyValidationState(name: string): PropertyValidationState`**
  Returns a snapshot of the property's validation state; when there is no
  stored state, returns the default state (valid, no message, unvalidated).

The interface also redeclares `validateProperty` and `dispose` from
`IBindingContext` with the same signatures.

### `PropertyValidationState` (internal type)

Not exported from the module; referenced structurally by the
`IBindingContext` and `IViewModel` signatures.

```ts
type PropertyValidationState = {
    isValid: boolean;
    message?: string;
    validated: boolean;
};
```

- `isValid` - whether the value is valid.
- `message` - the error message (for the invalid state).
- `validated` - whether the property has been validated at least once.

### `ViewModelDisposalError`

Thrown when one of the command listeners fails during `ViewModel.dispose`.
All resources are already released when the exception is thrown; the
individual listener errors are available in `errors`.

- **`errors: readonly unknown[]`** (readonly)
  Exceptions thrown by command listeners during disposal.
- **`constructor(errors: unknown[])`**

### `ViewModel`

The base ViewModel: a named property registry with change notifications,
validation states, a command registry and deterministic resource release.
Implements `IViewModel` and `IBindingContext`; the constructor takes no
arguments.

Protected members (for subclasses):

- **`propertyChange: IPropertyChangeEventTarget`**
  The event target firing `property-change` events.
- **`validationStateChanged: IValidationStateChangeEventTarget`**
  The event target firing validation `error-change` events.
- **`validationStateReset: IValidationStateResetEventTarget`**
  The event target firing validation `error-reset` events.
- **`properties: { [prop: string]: ViewModelProperty }`**
  The reactive property registry. `ViewModelProperty` is an internal type:
  `{ value: unknown; changeCallback?: (value: unknown, propertyKey: string) => void }`.
- **`commands: { [command: string]: ICommand }`**
  The registry of registered commands.
- **`validators: { [prop: string]: PropertyValidationEntry }`**
  The per-property validator registry. `PropertyValidationEntry` is an
  internal type: `{ validators: Set<IViewModelValidator> }`.
- **`validationStates: { [prop: string]: PropertyValidationState }`**
  The per-property validation state registry.

Methods:

- **`notifyPropertyChanged(propertyName: string, value: unknown): void`**
  Fires a `property-change` event carrying the given value.
- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Updates the property's validation state and fires an `error-change` event;
  for valid states the error message is cleared.
- **`setPropertyValue(name: string, value: unknown, callbackExecute?: boolean): boolean`**
  Sets the property value without firing `property-change`; runs the
  registered validators first, then the change callback.
  `callbackExecute` - whether to run the change callback (default `true`).
  Returns `true` when the property exists, otherwise `false`.
- **`setPropertyValueAndNotify(name: string, value: unknown, callbackExecute?: boolean): void`**
  Both notifying write methods publish the retained final value after a validator/callback throws, then rethrow the original error. View writes retain Object.is checks and nested-write coalescing. Completion is skipped after model disposal or property removal/re-registration. Silent setPropertyValue remains silent. See [property callbacks](guide.en.md#32-property-callback).
  Sets the property value and fires a `property-change` event.
  `callbackExecute` - whether to run the change callback (default `false`).
- **`setPropertyValueFromView(name: string, value: unknown): void`**
  A view-initiated value write used by two-way bindings.
  After the callbacks finish, a single `property-change` event with the final
  value is published; a no-op when the value did not change.
  @throws {Error} when the property is not registered.
- **`getPropertyValue(name: string): unknown`**
  Returns the property value or `undefined` when the property does not exist.
- **`subscribeProperties(eventCallback: (event: Event) => void): void`**
  Subscribes to `property-change` events.
- **`unsubscribeProperties(eventCallback: (event: Event) => void): void`**
  Removes a `property-change` event subscription.
- **`subscribeValidationState(eventCallback: (event: Event) => void): void`**
  Subscribes to validation `error-change` events.
- **`unsubscribeValidationState(eventCallback: (event: Event) => void): void`**
  Removes a validation `error-change` event subscription.
- **`subscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Subscribes to validation `error-reset` events.
- **`unsubscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Removes a validation `error-reset` event subscription.
- **`getCommand(name: string): ICommand | undefined`**
  Returns the command registered under the given name or `undefined`.
- **`subscribeCommands(callback: (name: string) => void): () => void`**
  Subscribes to command registration changes; the callback is invoked on
  every command registration and unregistration.
  Returns a function removing this subscription.
- **`registerProperty(name: string, value?: unknown, changeCallback?: (value: unknown) => void): void`**
  Registers a reactive property under a name.
  `changeCallback` - an optional callback invoked after validation on writes
  with `callbackExecute = true`, not during registration. View writes skip
  `Object.is`-equal values; `setPropertyValue` does not skip such writes.
  Plain decorated accessor assignment does not invoke the callback.
- **`hasRegisteredProperty(name: string): boolean`**
  Returns `true` when the property is registered.
- **`registerProperties(properties: { [propertyName: string]: unknown }): void`**
  Registers several properties from an object literal.
- **`unregisterProperty(name: string): void`**
  Removes the property from the registry; validators and validation state
  stay untouched.
- **`registerCommand(name: string, command: ICommand): void`**
  Commits the registry change, notifies every listener in the snapshot, then rethrows the first original listener error. Nested notifications are synchronous; errors do not roll back the change.
  Registers a command and notifies command listeners.
- **`unregisterCommand(name: string): void`**
  Commits the registry change, notifies every listener in the snapshot, then rethrows the first original listener error. Nested notifications are synchronous; errors do not roll back the change.
  Unregisters a command and notifies command listeners.
- **`hasPropertyValidator(name: string): boolean`**
  Returns `true` when the property has registered validators.
- **`registerPropertyValidator(name: string, validators: IViewModelValidator[]): void`**
  Registers the property's validators, merging with any already registered.
- **`unregisterPropertyValidator(name: string): void`**
  Removes all of the property's validators; when the property had been
  validated, its validation state is reset.
- **`validateProperty(name: string): void`**
  Validates the property against its registered validators and publishes the
  resulting state; a no-op when the property has no validators.
- **`setPropertyValidationState(name: string, isValid: boolean, message?: string): void`**
  Sets the property's validation state and fires an `error-change` event
  (an alias of `notifyValidationStateChanged`).
- **`resetPropertyValidationState(name: string): void`**
  Removes the property's stored validation state and fires an `error-reset`
  event.
- **`validate(): boolean`**
  Validates all properties that have registered validators.
  Returns `true` when all validated properties are valid.
- **`dispose(): void`**
  Releases all resources: properties, commands, validators, validation states
  and event targets are cleared, and command listeners are notified about
  every unregistered command. Idempotent.
  @throws {ViewModelDisposalError} when a command listener throws during
  disposal (the resources are already released).
- **`isPropertyValid(name: string): boolean`**
  Returns `true` when the property is currently valid; a not-yet-validated
  property is treated as valid.
- **`getPropertyValidationMessage(name: string): string | undefined`**
  Returns the property's last validation error message or `undefined` when
  the property is valid or was never validated.
- **`hasPropertyBeenValidated(name: string): boolean`**
  Returns `true` when the property has been validated at least once.
- **`getPropertyValidationState(name: string): PropertyValidationState`**
  Returns a snapshot of the property's validation state; when there is no
  stored state, returns the default state (valid, no message, unvalidated).

## viewModelFactoryBase

Module's public content: the `IViewModelFactoryBase` interface and the
abstract `ViewModelFactoryBase` class.

### `IViewModelFactoryBase`

A contract for a factory creating `IViewModel` instances by name.

- **`getViewModel(viewModelName: string, ...args: any[]): IViewModel`**
  Creates a ViewModel instance by name.
  `viewModelName` - the requested ViewModel's key in the handler map;
  `args` - arguments passed to the ViewModel constructor.
  Returns the created ViewModel instance.
  @throws {Error} when the name is not present in the handler map or when
  the constructor throws.

### `ViewModelFactoryBase`

The abstract base class of a name-based ViewModel factory. Subclasses supply
a name→constructor map through the `getViewModelHandler()` method.

- **`protected abstract getViewModelHandler(): ViewModelHandlerMap`**
  Returns the map of ViewModel names to constructors.
  `ViewModelHandlerMap` is an internal type: `Record<string, ViewModelConstructor>`,
  where `ViewModelConstructor` is `new (...args: any[]) => IViewModel`.
- **`getViewModel(viewModelName: string, ...args: any[]): IViewModel`**
  Creates a ViewModel instance by name, passing `args` to the constructor.
  @throws {Error} when the name is not present in the handler map or when
  the constructor throws (the original error is reported inside the
  exception message).

## viewModelValidator

Module's public content: the `IViewModelValidator` interface.

### `IViewModelValidator`

Validates a single ViewModel property value.

Validators are attached to properties with the `@validate` decorator.

- **`isValid(value: unknown): boolean`**
  Checks whether the value is valid. `value` - the value to validate.
  Returns `true` when the value is valid.
- **`getMessage?(value: unknown): string`**
  Optionally returns an error message for an invalid value; when absent, the
  validation state carries no message. `value` - the value that failed
  validation. Returns the error message.

## optionsBinding

Module's public content: the `IOptionValue` interface and the `OptionValue`
class.

Note: the module also contains the `OptionsBinding` class (the default
export; a `Binding` specialization binding a `select` element's options to an
array of `IOptionValue` values), but `src/index.ts` exports only
`IOptionValue` and `OptionValue` - the `OptionsBinding` class is an internal
implementation detail and is not part of the package's public interface.

### `IOptionValue`

The value, label and selection state of one `select` element option.

- **`value: string`** - the option's value.
- **`label: string`** - the option's label (displayed text).
- **`isSelected: boolean`** - whether the option is selected.

### `OptionValue`

The concrete implementation of the `IOptionValue` interface.

- **`constructor(value: string, label: string, isSelected: boolean)`**
  `value` - the option's value; `label` - the option's label; `isSelected` -
  the initial selection state.
- **`value: string`**, **`label: string`**, **`isSelected: boolean`**
  Properties as in `IOptionValue`.
