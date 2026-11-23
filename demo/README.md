# mvvm-dom playground

Run `npm run demo:dev` for development or `npm run test:demo` to check the built
GitHub Pages artifact. See `docs/testing.en.md` for browser installation.

Browser tests use two workers when `CI` is set and four locally. The workspace
filter/reset and create/delete flows have separate test budgets; the latter
still checks that both dialogs close and the background Reset button works.
Retries remain disabled and the test timeout remains 30 seconds. A successful
local run does not replace verification on the GitHub runner. Retain
`test-results/` from a failed CI run to inspect its Playwright trace.

The main workspace and each example have independent models and a reset action
that disposes the old views before creating new ones. Source panels embed the
actual HTML templates and TypeScript files at build time. `main.ts` is also
shown where mounting, shared ownership or DOM-backed arrays are part of the
example. Native `dragstart` supplies DataTransfer; the library handles drop.

## Feature map

| Feature | Example |
| --- | --- |
| View, ViewModel, reactive properties, command registration | Workspace and every example |
| Standard property/command decorators | Forms, text, collections, commands |
| Property aliases | Binding & event lab |
| value, checked, readonly, radio, options, selectedValues | Form controls |
| disabled, validation messages/classes, asynchronous commands | Workspace, commands, validation |
| text, interpolate, innerHTML strings and child views | Text & conditional views |
| if, display, visibility, class, style, attribute | Text, workspace, converters, lab |
| collection, nested paths, parent scope, parameterized commands | Collections and workspace |
| ArrayObserver push/splice and DOM reconciliation | Tags in Collections |
| ArrayObserver<View>, independent models, reverse, explicit disposal | Work panels in Collections |
| CollectionObserver item observation and reordering | Collections |
| canExecute, blockWhileExecuting, execution state | Commands, workspace |
| click, change, input, submit, key, enter, focusout | Forms, commands, lab |
| mouseInOut, mousedown, mouseup, mousemove | Commands, lab |
| resize (window), animationend, ready | Lab, text child view |
| dragover, dragleave, drop | Drag & drop, with keyboard/touch alternative |
| width, height, size / ResizeObserver | Binding & event lab |
| scrollTop, scrollLeft on one two-axis panel | Binding & event lab |
| oneWay, twoWay, oneWayToSource | Binding & event lab |
| Value converters and convertBack | Converters |
| Custom property and structural bindings | Custom bindings |
| ViewFactory, detach, reattach, dispose, shared context | Lifecycle |
| Accessible tabs, modal editor, nested delete confirmation | Workspace, custom bindings in `workspaceBindings.ts` |

The workspace has Tasks, Overview and Activity tabs. Arrow keys and Home/End
switch tabs. Its native `<dialog>` editor keeps focus inside the modal, restores
focus on close, and supports Escape and backdrop dismissal. Closing is disabled
during saving; successful saves close the modal and update the activity feed.
Cancel discards the draft. Deletion opens a second confirmation dialog.

Collections also contains a workspace of independent Views, each with a note
and counter. `ArrayObserver<View>` feeds `innerHTML`; reversing preserves the
same DOM nodes and model state. Removing a panel first splices the array, then
explicitly disposes the View and its owned model. The disposal counter is
updated by actual child-model cleanup. Reset releases all remaining panels.
The source panel includes `viewPanelsDemo.ts` with the complete ownership code.

Examples are illustrative, not a backend: saves are simulated and task data is
not persisted. The theme preference is optional localStorage state. All assets
are local or embedded, with no font CDN or UI framework dependency.

## Task order

Drag a task by its grip and drop on the upper/lower half of another row to
insert before/after it. The arrow buttons also work on touch screens; focus
the grip and press Alt+Up/Down for keyboard reordering. Escape, dropping
outside the list and reset cancel the gesture. Clicking the grip does not
open the editor. External drops and self-drops do not change task order.

With search or status filtering, moves are relative to the visible target in
the full task list. Hidden tasks preserve their relative order. Boundary
arrow actions are no-ops. Moves update the notice and Activity for this session.

The demo-only demoTaskReorder command binding is registered through the public
CommandBindingFactory API in taskReorderBinding.ts. It owns browser events,
DataTransfer and markers; the ViewModel receives the task ID and gesture
intent. One splice publishes the final canonical order, followed by refresh
of visibleTasks using the same task objects. The collection binding alone
moves DOM nodes; no View changes or external sorting library are required.
The source panel includes the gesture extension. dispose removes all listeners
and releases an active gesture during remount.
