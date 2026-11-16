import { BindingMode } from '../bindingMode.js';

interface OptionBinding {
    readonly mode: BindingMode;
}

interface SelectionBinding {
    readonly mode: BindingMode;
    optionsChanged(): void;
}

interface SelectBindings {
    options: Set<OptionBinding>;
    selected?: SelectionBinding;
}

const bindings = new WeakMap<HTMLElement, SelectBindings>();

function getBindings(element: HTMLElement): SelectBindings {

    let entry = bindings.get(element);

    if (!entry) {
        entry = { options: new Set() };
        bindings.set(element, entry);
    }

    return entry;
}

function validateOptions(options: Set<OptionBinding>): void {

    if (options.size > 1) {
        throw new Error('Only one option binding can be combined with selectedValues');
    }

    for (const option of options) {

        if (option.mode !== BindingMode.OneWay) {
            throw new Error('option binding must use oneWay when combined with selectedValues');
        }
    }
}

/** Registers an option binding on the select, validating compatibility with a `selectedValues` binding. */
export function registerOption(element: HTMLElement, option: OptionBinding): void {

    const entry = getBindings(element);

    if (entry.selected) {
        const options = new Set(entry.options);
        options.add(option);
        validateOptions(options);
    }

    entry.options.add(option);
}

/** Removes a previously registered option binding. */
export function unregisterOption(element: HTMLElement, option: OptionBinding): void {

    const entry = bindings.get(element);

    if (!entry) return;
    entry.options.delete(option);

    if (!entry.options.size && !entry.selected) bindings.delete(element);
}

/**
 * Registers the `selectedValues` binding of a select - only one is allowed
 * per element.
 */
export function registerSelection(element: HTMLElement, selected: SelectionBinding): void {

    const entry = getBindings(element);

    if (entry.selected) throw new Error('Only one selectedValues binding is allowed per select');
    validateOptions(entry.options);
    entry.selected = selected;
}

/** Removes a previously registered `selectedValues` binding. */
export function unregisterSelection(element: HTMLElement, selected: SelectionBinding): void {

    const entry = bindings.get(element);
    if (!entry || entry.selected !== selected) return;
    entry.selected = undefined;
    if (!entry.options.size) bindings.delete(element);
}

/** Returns the `selectedValues` binding controlling the select, or `undefined` when there is none (or it is oneWayToSource). */
export function controlledSelection(element: HTMLElement): SelectionBinding | undefined {
    
    const selected = bindings.get(element)?.selected;
    return selected?.mode === BindingMode.OneWayToSource ? undefined : selected;
}
