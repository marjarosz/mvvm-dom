/**
 * A single logical change to a collection.
 */
export type CollectionChange<T> =
    | { readonly type: 'splice'; readonly index: number; readonly removed: readonly T[]; readonly added: readonly T[] }
    | { readonly type: 'reset'; readonly previous: readonly T[]; readonly current: readonly T[] };

function getArrayIndex(property: PropertyKey): number | undefined {

    if (typeof property !== 'string') {
        return undefined;
    }
    const index = Number(property);
    return Number.isInteger(index) && index >= 0 && index < 0xFFFFFFFF && String(index) === property
        ? index
        : undefined;

}

/**
 * An `Array` subclass that notifies subscribers about its mutations
 * (`push` / `unshift` / `pop` / `shift` / `splice` / `clear` / `sort` /
 * `reverse` / `fill` / `copyWithin` / `deleteItem`, as well as index and
 * `length` writes).
 *
 * Subscribers receive one index-based record per logical mutation.
 */
export class ArrayObserver<T> extends Array<T>
{
    /**
     * Holds the pending changes and their associated subscribers before they are notified.
     */
    private readonly pending: Array<{
        change: CollectionChange<T>;
        subscribers: Array<(change: CollectionChange<T>) => void>;
    }> = [];

    /**
     * Indicates whether the observer is currently notifying subscribers about changes.
     */
    private notifying = false;

    /**
     * Indicates whether direct notifications to subscribers are currently suppressed.
     */
    private directNotificationsSuppressed = 0;

    /**
     * Holds the set of callbacks that are invoked whenever a change occurs.
     */
    private readonly changeCallbacks = new Set<(change: CollectionChange<T>) => void>();

    /**
     * @param items Initial items, or a single number acting as the initial
     *   length (same as `Array`).
     */
    constructor(...items: T[]) {

        super();

        if (items.length === 1 && typeof items[0] === 'number') {
            this.length = items[0];
        } else {
            Array.prototype.push.apply(this, items);
        }

        return new Proxy(this, {

            // Intercept property sets to track array mutations and notify subscribers accordingly.
            set: (target, property, value) => {
                if (target.directNotificationsSuppressed > 0) {
                    return Reflect.set(target, property, value, target);
                }

                if (property === 'length') {
                    const previousLength = target.length;
                    const nextLength = +(value as number);

                    if (!Number.isInteger(nextLength) || nextLength < 0 || nextLength > 0xFFFFFFFF) {
                        throw new RangeError('ArrayObserver.length must be an unsigned 32-bit integer');
                    }

                    if (nextLength > previousLength) {
                        throw new RangeError('ArrayObserver.length cannot be increased; append items instead');
                    }

                    const removed = nextLength < previousLength
                        ? Array.prototype.slice.call(target, nextLength) as T[]
                        : [];
                    const updated = Reflect.set(target, property, nextLength, target);

                    if (updated && nextLength < previousLength) {
                        target.notify({ type: 'splice', index: nextLength, removed, added: [] });
                    }
                    return updated;
                }

                const index = getArrayIndex(property);

                if (index === undefined) {
                    return Reflect.set(target, property, value, target);
                }

                if (index > target.length) {
                    throw new RangeError('ArrayObserver cannot create sparse array gaps; append items instead');
                }

                const existed = Object.prototype.hasOwnProperty.call(target, property);
                const previousValue = target[index];
                const updated = Reflect.set(target, property, value, target);

                if (updated && (!existed || !Object.is(previousValue, value))) {

                    target.notify({
                        type: 'splice',
                        index,
                        removed: existed ? [previousValue as T] : [],
                        added: [value as T]
                    });

                }

                return updated;
            },

            // Intercept property deletions to prevent direct deletion of array indices and notify subscribers accordingly.
            deleteProperty: (target, property) => {

                if (target.directNotificationsSuppressed > 0) {
                    return Reflect.deleteProperty(target, property);
                }

                const index = getArrayIndex(property);
                
                if (index !== undefined && Object.prototype.hasOwnProperty.call(target, property)) {
                    throw new TypeError('ArrayObserver does not allow deleting indices; use splice or deleteItem');
                }
                return Reflect.deleteProperty(target, property);
            }
        });
    }

    /**
     * Subscribes a callback to collection changes.
     *
     * @param callback Invoked for each logical mutation with a change
     *   record (a copy, never mutated by later changes).
     */
    public subscribeChanges(callback: (change: CollectionChange<T>) => void): void {

        this.changeCallbacks.add(callback);

    }

    /**
     * Removes a previously subscribed change callback.
     *
     * @param callback Callback to remove.
     */
    public unsubscribeChanges(callback: (change: CollectionChange<T>) => void): void {

        this.changeCallbacks.delete(callback);

    }

    private withDirectNotificationsSuppressed<R>(operation: () => R): R {

        this.directNotificationsSuppressed++;

        try {
            return operation();
        } finally {
            this.directNotificationsSuppressed--;
        }
    }

    private copyChange(change: CollectionChange<T>): CollectionChange<T> {

        return change.type === 'splice'
            ? { type: 'splice', index: change.index, removed: [...change.removed], added: [...change.added] }
            : { type: 'reset', previous: [...change.previous], current: [...change.current] };

    }

    /**
     * Callback failures are isolated; reentrant changes are queued until every
     * subscriber has received the current record.
     */
    private notify(change: CollectionChange<T>): void {

        const subscribers = [...this.changeCallbacks];
        if (subscribers.length === 0) return;

        this.pending.push({ change: this.copyChange(change), subscribers });
        if (this.notifying) return;
        this.notifying = true;

        try {
            for (let index = 0; index < this.pending.length; index++) {

                const pending = this.pending[index];
                for (const callback of pending.subscribers) {
                    try {
                        callback(this.copyChange(pending.change));
                    } catch (error) {
                        console.error('ArrayObserver: subscriber callback error', error);
                    }
                }

            }
        } finally {

            this.pending.length = 0;
            this.notifying = false;

        }
    }

    /**
     * Converts an index argument to an integer according to ECMAScript
     * ToInteger: NaN -> 0, ±Infinity stays unchanged, other values -> Math.trunc.
     */
    private toInteger(value: number): number {

        if (isNaN(value)) {
            return 0;
        }

        if (!isFinite(value)) {
            return value;
        }

        return Math.trunc(value);

    }

    /**
     * Normalizes an index to the range [0, length] (negative indices count
     * from the end).
     */
    private normalizeIndex(index: number): number {

        const len = this.length;
        const i = this.toInteger(index);

        if (i < 0) {
            return Math.max(len + i, 0);
        }

        return Math.min(i, len);

    }

    // ------------------------------------------------------------------
    //  Dodawanie
    // ------------------------------------------------------------------

    /** Appends items and notifies with a single `splice` record. */
    push(...items: T[]): number {

        if (items.length === 0) {
            return this.length;
        }

        const index = this.length;
        const length = this.withDirectNotificationsSuppressed(() => super.push(...items));

        this.notify({ type: 'splice', index, removed: [], added: items });

        return length;
    }

    /** Prepends items and notifies with a single `splice` record. */
    unshift(...items: T[]): number {

        if (items.length === 0) {
            return this.length;
        }

        const length = this.withDirectNotificationsSuppressed(() => super.unshift(...items));

        this.notify({ type: 'splice', index: 0, removed: [], added: items });
        return length;

    }

    // ------------------------------------------------------------------
    //  Usuwane
    // ------------------------------------------------------------------

    /** Removes the last item and notifies with a `splice` record. */
    pop(): T | undefined {

        if (this.length === 0) {
            return undefined;
        }

        const index = this.length - 1;
        const removed = this.withDirectNotificationsSuppressed(() => super.pop()) as T | undefined;
        this.notify({ type: 'splice', index, removed: [removed as T], added: [] });

        return removed;

    }

    /** Removes the first item and notifies with a `splice` record. */
    shift(): T | undefined {

        if (this.length === 0) {
            return undefined;
        }

        const removed = this.withDirectNotificationsSuppressed(() => super.shift()) as T | undefined;
        this.notify({ type: 'splice', index: 0, removed: [removed as T], added: [] });
        
        return removed;
    }

    // ------------------------------------------------------------------
    //  splice
    // ------------------------------------------------------------------

    /**
     * Native `Array.splice` semantics, notifying with a single `splice`
     * record when the mutation is non-empty.
     */
    splice(): T[];

    /** Removes items from `start` to the end and notifies accordingly. */
    splice(start: number): T[];

    /** Removes `deleteCount` items at `start` and inserts `items`. */
    splice(start: number, deleteCount: number | undefined, ...items: T[]): T[];

    splice(...args: [start?: number, deleteCount?: number, ...items: T[]]): T[] {

        // Zgodnie z natywnym Array: splice() bez argumentow to no-op.
        if (args.length === 0) {
            return [];
        }

        const [start = 0, deleteCount, ...items] = args;
        const len = this.length;
        const normalizedStart = this.normalizeIndex(start);

        // deleteCount zgodnie z natywnym Array:
        //   - pominiety argument (splice(start)) -> len - start (usn do konca)
        //   - jawny undefined / NaN              -> ToInteger -> 0 (nic nie usuwa)
        //   - ujemne                             -> 0
        //   - wieksze niz len - start            -> len - start
        // Dyskryminatorem jest liczba argumentow, nie wartosc deleteCount.
        const delCount = args.length === 1
            ? len - normalizedStart
            : Math.min(Math.max(this.toInteger(deleteCount as number), 0), len - normalizedStart);

        const removed = this.withDirectNotificationsSuppressed(
            () => super.splice(normalizedStart, delCount, ...items)
        );

        if (removed.length > 0 || items.length > 0) {
            this.notify({ type: 'splice', index: normalizedStart, removed, added: items });
        }

        return removed;

    }

    // ------------------------------------------------------------------
    //  insertAfter / clear / deleteItem
    // ------------------------------------------------------------------

    /**
     * Inserts items after the given index (`index` = -1 means at the beginning).
     *
     * Contract: `index` must be an integer in the range -1 .. length - 1,
     * otherwise a `RangeError` is thrown (no silent clamping).
     * An empty item list is a no-op (no exception).
     *
     * @param index The index of the item to insert after.
     * @param item Items to insert.
     * @throws {RangeError} When `index` is not an integer in -1 .. length - 1.
     */
    insertAfter(index: number, ...item: T[]): void {

        if (item.length === 0) {
            return;
        }

        if (!Number.isInteger(index) || index < -1 || index >= this.length) {
            throw new RangeError(
                `ArrayObserver.insertAfter: index ${index} outside of -1..${this.length - 1} (length ${this.length})`
            );
        }

        this.splice(index + 1, 0, ...item);

    }

    /**
     * Removes all items and notifies with a single `splice` record.
     *
     * @returns The removed items.
     */
    clear(): T[] {

        if (this.length === 0) {
            return [];
        }

        // Zbiory stan przed mutacja - for...of na klonie, aby
        // zmiana rozmiaru nie zaklocila iteracji.

        const snapshot = [...this];
        this.withDirectNotificationsSuppressed(() => { this.length = 0; });
        this.notify({ type: 'splice', index: 0, removed: snapshot, added: [] });

        return snapshot;
    }

    /**
     * Removes the first item equal to `item` (compared like
     * `Array.prototype.indexOf`) and notifies with a `splice` record.
     *
     * @param item The item to remove.
     * @returns The index of the removed item, or -1 when not found.
     */
    deleteItem(item: T): number {

        const idx = this.indexOf(item);
        if (idx > -1) {
            this.splice(idx, 1);
        }

        return idx;
    }

    // ------------------------------------------------------------------
    //  Metody zmieniajace kolejnosc / zawartosc (bez zmian rozmiaru)
    // ------------------------------------------------------------------

    /** Sorts in place and notifies with a single `reset` record when the order changed. */
    sort(compareFn?: (a: T, b: T) => number): this {

        const previous = [...this];
        this.withDirectNotificationsSuppressed(() => super.sort(compareFn));
        if (!this.sameItems(previous)) this.notify({ type: 'reset', previous, current: [...this] });

        return this;
        
    }

    /** Reverses in place and notifies with a single `reset` record. */
    reverse(): this {

        const previous = [...this];
        this.withDirectNotificationsSuppressed(() => super.reverse());
        if (!this.sameItems(previous)) this.notify({ type: 'reset', previous, current: [...this] });

        return this;

    }

    /** Fills the range with a value and notifies with a single `reset` record. */
    fill(value: T, start?: number, end?: number): this {

        // Reset carries snapshots from both sides of the mutation.
        const previous = [...this];
        this.withDirectNotificationsSuppressed(() => super.fill(value, start, end));
        if (!this.sameItems(previous)) this.notify({ type: 'reset', previous, current: [...this] });
        return this;

    }

    /** Copies a range in place and notifies with a single `reset` record. */
    copyWithin(target: number, start: number, end?: number): this {

        const previous = [...this];
        this.withDirectNotificationsSuppressed(() => super.copyWithin(target, start, end));
        if (!this.sameItems(previous)) this.notify({ type: 'reset', previous, current: [...this] });
        return this;

    }

    private sameItems(previous: readonly T[]): boolean {

        return previous.length === this.length && previous.every((item, index) => Object.is(item, this[index]));

    }

}
