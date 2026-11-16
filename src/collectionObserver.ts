import { ArrayObserver } from './arrayObserver.js';
import { ViewModel } from './viewModel.js';
import type { IPropertyChangeEvent } from './propertyChangeEvent.js';

type ItemChangeListener = () => void;

/** Internal item-level observation engine backing {@link CollectionObserver}. */
class ObservableItems {

    private readonly proxies = new WeakMap<object, object>();

    private readonly originals = new WeakMap<object, object>();

    private readonly listeners = new Set<ItemChangeListener>();

    private readonly models = new Map<ViewModel, (event: Event) => void>();

    private readonly eventVersions = new WeakMap<object, Map<PropertyKey, number>>();

    private readonly links = new WeakMap<object, Map<PropertyKey, object | undefined>>();

    private readonly pending: ItemChangeListener[][] = [];

    private notifying = false;

    private roots = new Set<object>();

    private trackable(value: unknown): object | undefined {

        if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

        const target = this.originals.get(value) ?? value;
        const prototype = Object.getPrototypeOf(target);

        return prototype === null || prototype === Object.prototype || target instanceof ViewModel ? target : undefined;
    }

    private link(object: object, key: PropertyKey, value: unknown): void {

        let links = this.links.get(object);

        if (!links) {
            links = new Map();
            this.links.set(object, links);
        }

        links.set(key, this.trackable(value));
    }

    private reachable(): Set<object> {

        const reachable = new Set<object>();
        const pending = [...this.roots];

        while (pending.length) {

            const object = pending.pop()!;

            if (reachable.has(object)) continue;
            reachable.add(object);

            for (const child of this.links.get(object)?.values() ?? []) {
                if (child) pending.push(child);
            }
        }

        return reachable;
    }

    private pruneModels(reachable = this.reachable()): void {

        for (const [model, callback] of this.models) {

            if (!reachable.has(model)) {
                model.unsubscribeProperties(callback);
                this.models.delete(model);
            }
        }
    }

    setRoots(items: Iterable<unknown>): void {

        this.roots = new Set(Array.from(items, item => this.trackable(item)).filter((item): item is object => item !== undefined));
        const reachable = this.reachable();
        this.pruneModels(reachable);

        // The last listener detaches every model, including nested ones.
        // Restore the discovered reachable graph, not just its roots: callers
        // may keep a nested proxy without reading through the collection again.
        if (this.listeners.size) for (const object of reachable) this.observe(object);

    }

    original<T>(value: T): T {

        return typeof value === 'object' && value !== null
            ? (this.originals.get(value) ?? value) as T
            : value;

    }

    observe<T>(value: T): T {

        if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;

        const target = this.originals.get(value) ?? value;
        const prototype = Object.getPrototypeOf(target);

        if (prototype !== null && prototype !== Object.prototype && !(target instanceof ViewModel)) return value;

        let proxy = this.proxies.get(target);

        if (!proxy) {
            proxy = new Proxy(target, {

                get: (object, key) => {
                    const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
                    const result = Reflect.get(object, key, object instanceof ViewModel ? object : this.proxies.get(object));
                    
                    if (descriptor && !descriptor.configurable && 'value' in descriptor && !descriptor.writable) return result;
                    
                    if (object instanceof ViewModel && key !== 'constructor' && typeof result === 'function') return result.bind(object);
                    
                    this.link(object, key, result);
                    return this.observe(result);

                },
                
                set: (object, key, next) => {
                    const previous = Reflect.get(object, key, object);
                    const version = this.eventVersions.get(object)?.get(key) ?? 0;
                    const success = Reflect.set(object, key, this.originals.get(next) ?? next, object);
                   
                    if (success) {

                        const current = Reflect.get(object, key, object);

                        if (this.links.get(object)?.has(key)) this.link(object, key, current);

                        const reachable = this.reachable();
                        this.pruneModels(reachable);

                        if (reachable.has(object) && !Object.is(previous, current) &&
                            version === (this.eventVersions.get(object)?.get(key) ?? 0)) this.notify();
                    }

                    return success;
                },

                deleteProperty: (object, key) => {
                    const existed = Object.prototype.hasOwnProperty.call(object, key);
                    const success = Reflect.deleteProperty(object, key);

                    if (success && existed) {

                        this.links.get(object)?.delete(key);
                        const reachable = this.reachable();
                        this.pruneModels(reachable);
                        if (reachable.has(object)) this.notify();
                    }

                    return success;

                }
            });

            this.proxies.set(target, proxy);
            this.originals.set(proxy, target);
        }
        if (target instanceof ViewModel && this.listeners.size && !this.models.has(target)) {

            const callback = (event: Event) => {

                const property = (event as IPropertyChangeEvent).propertyName;
                let versions = this.eventVersions.get(target);

                if (!versions) {

                    versions = new Map();
                    this.eventVersions.set(target, versions);
                }

                versions.set(property, (versions.get(property) ?? 0) + 1);

                if (this.links.get(target)?.has(property)) this.link(target, property, Reflect.get(target, property, target));
                
                this.pruneModels();
                this.notify();
            };

            target.subscribeProperties(callback);
            this.models.set(target, callback);
        }
        return proxy as T;
    }

    subscribe(callback: ItemChangeListener): void {

        this.listeners.add(callback);

    }

    unsubscribe(callback: ItemChangeListener): void {

        this.listeners.delete(callback);
        if (!this.listeners.size) this.detachModels();

    }

    detachModels(): void {

        for (const [model, callback] of this.models) model.unsubscribeProperties(callback);
        this.models.clear();

    }

    private notify(): void {

        if (!this.listeners.size) return;
        
        this.pending.push([...this.listeners]);
        if (this.notifying) return;
        
        this.notifying = true;
        try {

            for (let index = 0; index < this.pending.length; index++) {
                for (const callback of this.pending[index]) {
                    try {
                        callback();
                    } catch (error) {
                        console.error('CollectionObserver: subscriber callback error', error);
                    }
                }
            }
        } finally {

            this.pending.length = 0;
            this.notifying = false;

        }
    }
}

/**
 * An {@link ArrayObserver} that additionally observes the items themselves.
 *
 * Index reads return item proxies: mutating a proxied plain object or
 * `ViewModel` item - including `ViewModel` property changes - notifies all
 * item-change subscribers.
 *
 * `Symbol.species` is `Array`, so derived array methods (e.g. `slice`,
 * `filter`) return plain arrays.
 */
export class CollectionObserver<T> extends ArrayObserver<T> {

    private readonly itemObserver = new ObservableItems();

    /** The species constructor: plain `Array`. */
    static get [Symbol.species](): ArrayConstructor {
        return Array;
    }

    /**
     * @param items Initial items, pushed (and observed) when provided.
     */
    constructor(...items: T[]) {

        super();
        const observer = this.itemObserver;

        const result = new Proxy(this, {
            get: (target, key, receiver) => {
                const value = Reflect.get(target, key, receiver);
                return typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) ? observer.observe(value) : value;
            }
        });

        result.subscribeChanges(() => {
            observer.setRoots(result);
        });

        if (items.length) result.push(...items);

        return result;
    }

    /**
     * Subscribes a callback to changes inside items (property writes on
     * proxied items, including `ViewModel` property changes).
     *
     * @param callback Invoked with no arguments for each logical item change.
     */
    subscribeItemChanges(callback: ItemChangeListener): void {

        this.itemObserver.subscribe(callback);
        this.itemObserver.setRoots(this);

    }

    /**
     * Removes a previously subscribed item-change callback. When no
     * subscribers remain, observation of `ViewModel` items is released.
     *
     * @param callback Callback to remove.
     */
    unsubscribeItemChanges(callback: ItemChangeListener): void {

        this.itemObserver.unsubscribe(callback);

    }

    /**
     * Removes the first item matching `item` - comparing proxies against
     * their originals - and notifies with a `splice` record.
     *
     * @param item The item (or one of its proxies) to remove.
     * @returns The index of the removed item, or -1 when not found.
     */
    deleteItem(item: T): number {

        const target = this.itemObserver.original(item);
        const index = this.findIndex(value => this.itemObserver.original(value) === target);

        if (index >= 0) this.splice(index, 1);
        
        return index;
    }
}
