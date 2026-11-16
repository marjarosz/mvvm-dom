type Entry = { initial: boolean; bindings: Map<object, boolean>; commands: Map<object, boolean> };
const entries = new WeakMap<HTMLElement, Entry>();

function entryFor(element: HTMLElement): Entry {

    let entry = entries.get(element);

    if (!entry) {
        entry = { initial: element.hasAttribute('disabled'), bindings: new Map(), commands: new Map() };
        entries.set(element, entry);
    }

    return entry;
}

function update(element: HTMLElement, entry: Entry): void {

    const disabled = (entry.bindings.size ? [...entry.bindings.values()].some(Boolean) : entry.initial) ||
        [...entry.commands.values()].some(Boolean);

    if (disabled) element.setAttribute('disabled', 'disabled');
    else element.removeAttribute('disabled');
}

/**
 * Registers or updates an owner's contribution to an element's disabled
 * state and re-applies the `disabled` attribute. The element is disabled
 * when any binding or command contribution disables it (or, when no
 * binding contributions exist, when the element started disabled).
 *
 * @param element The element to update.
 * @param owner The binding or coordinator owning the contribution.
 * @param kind Whether the contribution comes from bindings or commands.
 * @param value Whether the owner currently disables the element.
 */
export function setDisabledContribution(element: HTMLElement, owner: object, kind: 'bindings' | 'commands', value: boolean): void {
    
    const entry = entryFor(element);

    entry[kind].set(owner, value);
    update(element, entry);
}

/**
 * Removes an owner's disabled-state contribution and re-applies the
 * `disabled` attribute. Cleans up the element entry when no contributions
 * remain.
 *
 * @param element The element to update.
 * @param owner The binding or coordinator owning the contribution.
 * @param kind Whether the contribution comes from bindings or commands.
 */
export function removeDisabledContribution(element: HTMLElement, owner: object, kind: 'bindings' | 'commands'): void {
    
    const entry = entries.get(element);

    if (!entry) return;

    entry[kind].delete(owner);

    if (!entry.bindings.size && !entry.commands.size) {
        entries.delete(element);
    } else  {
        update(element, entry);
    }
}
