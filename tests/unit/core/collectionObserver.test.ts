import { describe, expect, it, vi } from 'vitest';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { ViewModel } from '@mvvm/viewModel';
import { propertyChange, validate } from '@mvvm/propertyDecorators';
import { own } from '../helpers/resources';

describe('CollectionObserver', () => {

  it('restores nested model subscriptions for cached proxies after the last listener leaves', () => {

    class Model extends ViewModel {
      @propertyChange() accessor name = 'initial';
      rename(value: string) { this.name = value; }
    }
    const model = own(new Model());
    const items = new CollectionObserver({ child: model });
    const changed = vi.fn();
    // Discover the nested model before subscribing; no fresh lookup is required later.
    const cached = items[0].child;

    for (let cycle = 0; cycle < 3; cycle++) {
      items.subscribeItemChanges(changed);
      cached.rename(`active-${cycle}`);
      expect(changed).toHaveBeenCalledTimes(cycle + 1);
      items.unsubscribeItemChanges(changed);
      cached.rename(`inactive-${cycle}`);
      expect(changed).toHaveBeenCalledTimes(cycle + 1);
    }

  });

  it('restores shared models once across cycles and does not restore removed branches', () => {

    class Model extends ViewModel {
      @propertyChange() accessor name = 'initial';
      rename(value: string) { this.name = value; }
    }

    const retained = own(new Model());
    const removed = own(new Model());
    const root: { child: Model; self?: unknown } = { child: retained };
    root.self = root;
    const items = new CollectionObserver(root, { child: retained }, { child: removed });
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    const cached = items[0].child;
    expect(items[0].self).toBe(items[0]);
    void items[1].child;
    const removedProxy = items[2].child;
    items.unsubscribeItemChanges(changed);
    items.pop();
    items.subscribeItemChanges(changed);
    cached.rename('resumed');
    expect(changed).toHaveBeenCalledTimes(1);
    removedProxy.rename('no longer reachable');
    expect(changed).toHaveBeenCalledTimes(1);
    items.unsubscribeItemChanges(changed);
    cached.rename('released');
    expect(changed).toHaveBeenCalledTimes(1);
    
  });

  it('observes nested writes through stable proxies but not original references', () => {

    const raw = { name: 'first', nested: { value: 1 } };
    const items = new CollectionObserver(raw);
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    expect(items[0]).toBe(items[0]);
    expect(items[0].nested).toBe(items[0].nested);
    items[0].nested.value = 2;
    expect(changed).toHaveBeenCalledTimes(1);
    raw.name = 'outside';
    expect(changed).toHaveBeenCalledTimes(1);
    items[0].name = 'inside';
    expect(changed).toHaveBeenCalledTimes(2);
    items.unsubscribeItemChanges(changed);

  });

  it('preserves ArrayObserver mutation semantics and stable proxy identities', () => {

    const raw = { name: 'a' };
    const items = new CollectionObserver(raw);
    const changes = vi.fn();
    items.subscribeChanges(changes);
    items.push(raw);
    expect(items[0]).toBe(items[1]);
    expect(changes).toHaveBeenCalledTimes(1);
    items[0] = { name: 'b' };
    expect(changes).toHaveBeenCalledTimes(2);
    items.length = 0;
    expect(changes).toHaveBeenCalledTimes(3);

  });

  it('supports branded accessors and existing reactive ViewModel events', () => {

    class Model extends ViewModel {
      #prefix = 'p';
      @propertyChange() accessor name = 'a';
      get label() { return this.#prefix + this.name; }
      update() { this.name = 'b'; }
    }

    const model = own(new Model());
    const items = new CollectionObserver(model);
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    expect(items[0].label).toBe('pa');
    items[0].update();
    expect(items[0].label).toBe('pb');
    expect(changed).toHaveBeenCalledTimes(1);
    items[0].name = 'c';
    expect(changed).toHaveBeenCalledTimes(2);
    items.unsubscribeItemChanges(changed);

  });

  it('detaches removed models and supports cyclic object graphs', () => {

    class Model extends ViewModel {
      @propertyChange() accessor name = 'a';
    }

    const model = own(new Model());
    const items = new CollectionObserver(model);
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    items.pop();
    model.name = 'b';
    expect(changed).not.toHaveBeenCalled();
    items.unsubscribeItemChanges(changed);

    const item: { self?: unknown; value: number } = { value: 1 };
    item.self = item;
    const cyclic = new CollectionObserver(item);
    const cycleChanged = vi.fn();
    cyclic.subscribeItemChanges(cycleChanged);
    expect(cyclic[0].self).toBe(cyclic[0]);
    cyclic[0].value = 2;
    expect(cycleChanged).toHaveBeenCalledTimes(1);
    cyclic.unsubscribeItemChanges(cycleChanged);

  });

  it('detaches replaced branches but keeps shared models and live subscriptions across list changes', () => {

    class Model extends ViewModel {
      @propertyChange() accessor name = 'a';
    }

    const old = own(new Model());
    const replacement = own(new Model());
    const items = new CollectionObserver({ child: old }, { child: old });
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    const oldProxy = items[0].child;
    void items[1].child;
    items[0].child = replacement;
    changed.mockClear();
    old.name = 'shared';
    expect(changed).toHaveBeenCalledTimes(1);
    items[1].child = replacement;
    changed.mockClear();
    old.name = 'detached';
    oldProxy.name = 'also detached';
    expect(changed).not.toHaveBeenCalled();
    void items[0].child;
    items.push({ child: replacement });
    changed.mockClear();
    replacement.name = 'live';
    expect(changed).toHaveBeenCalledTimes(1);
    items.unsubscribeItemChanges(changed);

  });

  it('does not publish changes from detached plain object proxies', () => {

    const items = new CollectionObserver({ child: { value: 1 } });
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    const old = items[0].child;
    items[0].child = { value: 2 };
    changed.mockClear();
    old.value = 3;
    expect(changed).not.toHaveBeenCalled();
    items[0].child.value = 4;
    expect(changed).toHaveBeenCalledTimes(1);
    items.unsubscribeItemChanges(changed);

  });

  it('handles validated private accessors without duplicate change notifications', () => {

    class Model extends ViewModel {
      @propertyChange() @validate(() => ({ isValid: value => value !== '' })) accessor name = 'ok';
    }

    const model = own(new Model());
    const items = new CollectionObserver(model);
    const changed = vi.fn();
    items.subscribeItemChanges(changed);
    items[0].name = '';
    expect(changed).toHaveBeenCalledTimes(1);
    expect(model.isPropertyValid('name')).toBe(false);
    items.unsubscribeItemChanges(changed);

  });

  it('retains the array mutation protocol and rejects holes', () => {

    const items = new CollectionObserver({ value: 1 }, { value: 2 }, { value: 3 });
    const changes = vi.fn();
    items.subscribeChanges(changes);
    items.reverse();
    items.sort((a, b) => a.value - b.value);
    items.fill({ value: 4 }, 0, 1);
    items.copyWithin(1, 0, 1);
    items.splice(1, 1);
    items.unshift({ value: 5 });
    items.shift();
    items.pop();

    expect(changes.mock.calls.map(([change]) => change.type)).toEqual([
      'reset', 'reset', 'reset', 'reset', 'splice', 'splice', 'splice', 'splice'
    ]);

    expect(() => { items[8] = { value: 8 }; }).toThrow();
    expect(() => { items.length = 10; }).toThrow();
    expect(items).toHaveLength(1);

  });

  it('honors proxy invariants for non-configurable read-only properties', () => {

    const nested = { value: 1 };
    const item = Object.defineProperty({}, 'nested', { value: nested, configurable: false, writable: false }) as { nested: typeof nested };
    const items = new CollectionObserver(item);

    expect(items[0].nested).toBe(nested);
    expect(() => { items[0].nested = { value: 2 }; }).toThrow();
  });

  it('queues reentrant item notifications until all subscribers receive the current change', () => {

    const items = new CollectionObserver({ value: 0 });
    const calls: string[] = [];
    let updated = false;

    const first = () => {
      calls.push('first');
      if (!updated) {
        updated = true;
        items[0].value = 2;
      }
    };

    const second = () => calls.push('second');
    items.subscribeItemChanges(first);
    items.subscribeItemChanges(second);

    items[0].value = 1;
    expect(calls).toEqual(['first', 'second', 'first', 'second']);

    items.unsubscribeItemChanges(first);
    items.unsubscribeItemChanges(second);
  });

  it('can remove an inserted item by its original or observed reference', () => {

    const raw = { value: 1 };
    const items = new CollectionObserver(raw, raw);

    expect(items.deleteItem(raw)).toBe(0);
    expect(items.deleteItem(items[0])).toBe(0);
    expect(items).toHaveLength(0);

  });
  
});
