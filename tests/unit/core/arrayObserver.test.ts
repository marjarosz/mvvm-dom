import { describe, expect, it, vi } from 'vitest';
import { ArrayObserver, type CollectionChange } from '@mvvm/arrayObserver';

function observed<T>(values: T[]): ArrayObserver<T> {

  const result = new ArrayObserver<T>();
  result.push(...values);
  return result;

}

const operations: Array<{ name: string; run: (array: string[]) => unknown }> = [

  { name: 'splice without arguments', run: a => Reflect.apply(a.splice, a, []) },
  { name: 'push', run: a => a.push('x', 'y') },
  { name: 'unshift', run: a => a.unshift('x', 'y') },
  { name: 'pop', run: a => a.pop() },
  { name: 'shift', run: a => a.shift() },
  { name: 'splice with negative start', run: a => a.splice(-2, 1, 'x') },
  { name: 'splice without deleteCount', run: a => a.splice(1) },
  { name: 'splice with fractional start', run: a => a.splice(1.9, 1, 'x') },
  { name: 'splice with NaN', run: a => a.splice(NaN, 1, 'x') },
  { name: 'splice with Infinity', run: a => a.splice(Infinity, 0, 'x') },
  { name: 'sort', run: a => a.sort() },
  { name: 'reverse', run: a => a.reverse() },
  { name: 'fill', run: a => a.fill('x', 1, 2) },
  { name: 'copyWithin', run: a => a.copyWithin(0, 1) },

];

describe('ArrayObserver - collection contract', () => {

  it('accepts explicit undefined as a zero delete count', () => {
    const list = observed(['a', 'b']);
    expect([...list.splice(1, undefined, 'x')]).toEqual([]);
    expect([...list]).toEqual(['a', 'x', 'b']);
  });

  it.each(['push', 'unshift'] as const)('%s returns its own length and delivers nested changes in order', method => {

    const list = observed<string>([]);
    const first: string[] = [], second: string[] = [];

    list.subscribeChanges(change => {
      const item = change.type === 'splice' ? change.added[0] : undefined;
      if (item) first.push(item);
      if (item === 'A') list[method]('B');
    });

    list.subscribeChanges(change => {
      if (change.type === 'splice' && change.added[0]) second.push(change.added[0]);
    });

    expect(list[method]('A')).toBe(1);
    expect(first).toEqual(['A', 'B']);
    expect(second).toEqual(first);

  });

  it('delivers both halves of a replacement before a nested mutation', () => {

    const list = observed(['old']);
    const received: CollectionChange<string>[] = [];

    list.subscribeChanges(change => {
      received.push(change);
      if (change.type === 'splice' && change.removed[0] === 'old') list.push('nested');
    });

    list.splice(0, 1, 'replacement');

    expect(received).toEqual([
      { type: 'splice', index: 0, removed: ['old'], added: ['replacement'] },
      { type: 'splice', index: 1, removed: [], added: ['nested'] }
    ]);

  });

  it.each(operations)('$name agrees with native Array contents and return value', ({ run }) => {

    const reference = ['c', 'a', 'b'];
    const actual = observed(reference);
    const expectedReturn = run(reference);
    const actualReturn = run(actual);

    expect([...actual]).toEqual(reference);
    expect(Array.isArray(actualReturn) ? [...actualReturn] : actualReturn)
      .toEqual(Array.isArray(expectedReturn) ? [...expectedReturn] : expectedReturn);

  });

  it.each([undefined, null, false, 0, ''])('reports deletion of an existing %s value', value => {

    for (const method of ['pop', 'shift'] as const) {

      const array = observed([value]);
      const listener = vi.fn();

      array.subscribeChanges(listener);
      array[method]();

      expect(listener).toHaveBeenCalledTimes(1);

      expect(listener.mock.calls[0][0]).toEqual({
        type: 'splice',
        index: 0,
        removed: [value],
        added: []
      });

    }

  });

  it('does not announce deletion from an empty collection', () => {

    const array = observed<string>([]);
    const listener = vi.fn();

    array.subscribeChanges(listener);
    array.pop(); array.shift(); array.clear();
    expect(listener).not.toHaveBeenCalled();

  });

  it('inserts before the first item for insertAfter(-1)', () => {

    const array = observed(['a', 'b']);
    array.insertAfter(-1, 'x');
    expect([...array]).toEqual(['x', 'a', 'b']);

  });

  it.each([NaN, Infinity, -Infinity, -2, 2.5, 0.5])('insertAfter(%s) throws RangeError and keeps contents', index => {

    const array = observed(['a', 'b']);
    expect(() => array.insertAfter(index, 'x')).toThrow(RangeError);
    expect([...array]).toEqual(['a', 'b']);

  });

  it('insertAfter(length) throws RangeError even though it looks adjacent', () => {

    const array = observed(['a', 'b']);
    expect(() => array.insertAfter(array.length, 'x')).toThrow(RangeError);
    expect([...array]).toEqual(['a', 'b']);

  });

  it('insertAfter with no items is a no-op and does not throw', () => {

    const array = observed(['a', 'b']);
    expect(() => array.insertAfter(0)).not.toThrow();
    expect(() => array.insertAfter(99)).not.toThrow();
    expect([...array]).toEqual(['a', 'b']);

  });

  it('splice(-Infinity, ...) treats -Infinity as index 0', () => {

    const reference = ['c', 'a', 'b'];
    const actual = observed(reference);
    const expectedReturn = reference.splice(-Infinity, 0, 'x');
    const actualReturn = actual.splice(-Infinity, 0, 'x');

    expect([...actual]).toEqual(reference);
    expect([...actualReturn]).toEqual([...expectedReturn]);

  });

  it('splice() without arguments is a no-op and notifies nothing', () => {

    const array = observed(['a', 'b']);
    const listener = vi.fn();
    array.subscribeChanges(listener);
    const removed = array.splice();

    expect(removed).toEqual([]);
    expect([...array]).toEqual(['a', 'b']);
    expect(listener).not.toHaveBeenCalled();

  });

  it.each(['fill', 'copyWithin'] as const)('%s on an empty array notifies nothing', method => {

    const array = observed<string>([]);
    const listener = vi.fn();
    array.subscribeChanges(listener);

    if (method === 'fill') expect(array.fill('x')).toBe(array);
    else expect(array.copyWithin(0, 0)).toBe(array);

    expect([...array]).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports the normalized index for a fractional splice index', () => {

    const array = observed(['a', 'b']);
    const listener = vi.fn();

    array.subscribeChanges(listener);
    array.splice(1.9, 0, 'x');

    expect(listener).toHaveBeenCalledExactlyOnceWith({
      type: 'splice', index: 1, removed: [], added: ['x']
    });

  });

  it.each(['fill', 'copyWithin'] as const)('%s reports the replaced items, not just the new state', method => {

    const a = { id: 'a' }, b = { id: 'b' }, x = { id: 'x' };
    const array = observed([a, b]);
    const changes: CollectionChange<typeof a>[] = [];

    array.subscribeChanges(change => changes.push(change));

    if (method === 'fill') array.fill(x, 0, 1);
    else array.copyWithin(0, 1, 2);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: 'reset',
      previous: [a, b],
      current: method === 'fill' ? [x, b] : [b, b]
    });

  });

  it('keeps subscribers independent and ignores duplicate subscriptions', () => {

    const array = observed<string>([]);
    const a = vi.fn(), b = vi.fn();

    array.subscribeChanges(a); array.subscribeChanges(a); array.subscribeChanges(b);
    array.push('first');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    array.unsubscribeChanges(a); array.push('second');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('isolates event snapshots between subscribers and snapshots subscribers per mutation', () => {

    const array = observed<string>([]);
    const first = vi.fn((change: CollectionChange<string>) => {

      if (change.type === 'splice') {
        (change.added as string[]).push('tampered');
        array.unsubscribeChanges(second);
        array.subscribeChanges(late);
        if (change.added[0] === 'x') array.push('nested');
      }

    });

    const second = vi.fn();
    const late = vi.fn();

    array.subscribeChanges(first);
    array.subscribeChanges(second);

    array.push('x');

    expect([...array]).toEqual(['x', 'nested']);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0][0]).toEqual({
      type: 'splice', index: 0, removed: [], added: ['x']
    });

    expect(late).toHaveBeenCalledTimes(1);
    expect(late.mock.calls[0][0]).toEqual({
      type: 'splice', index: 1, removed: [], added: ['nested']
    });

  });

  it('commits a mutation and notifies remaining subscribers after a subscriber throws', () => {

    const array = observed<string>([]);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const listener = vi.fn();

    array.subscribeChanges(() => { throw new Error('consumer failed'); });
    array.subscribeChanges(listener);

    expect(() => array.push('x')).not.toThrow();
    expect([...array]).toEqual(['x']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();

  });

  it('observes direct index replacement, append, and length truncation once each', () => {

    const array = observed(['a', 'b']);
    const listener = vi.fn();
    array.subscribeChanges(listener);

    array[0] = 'x';
    array[array.length] = 'c';
    array.length = 1;

    expect([...array]).toEqual(['x']);
    expect(listener).toHaveBeenCalledTimes(3);

    expect(listener.mock.calls.map(([change]) => change)).toEqual([
      { type: 'splice', index: 0, removed: ['a'], added: ['x'] },
      { type: 'splice', index: 2, removed: [], added: ['c'] },
      { type: 'splice', index: 1, removed: ['b', 'c'], added: [] }
    ]);

  });

  it('does not emit for mutations that leave the collection unchanged', () => {

    const array = observed(['a', 'b']);
    const listener = vi.fn();
    array.subscribeChanges(listener);

    array.sort();
    array.fill('x', 0, 0);
    array.copyWithin(0, 0, 0);
    array.splice(1, 0);
    array[0] = 'a';

    expect(listener).not.toHaveBeenCalled();

  });

  it('rejects sparse writes, length growth, and deleting an existing index without mutation', () => {

    const array = observed(['a', 'b']);
    const listener = vi.fn();
    array.subscribeChanges(listener);

    expect(() => { array[4] = 'x'; }).toThrow(RangeError);
    expect(() => { array.length = 3; }).toThrow(RangeError);
    expect(() => { delete array[0]; }).toThrow(TypeError);

    expect([...array]).toEqual(['a', 'b']);
    expect(array.length).toBe(2);
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    ['push', (array: ArrayObserver<string>) => array.push('c')],
    ['unshift', (array: ArrayObserver<string>) => array.unshift('c')],
    ['pop', (array: ArrayObserver<string>) => array.pop()],
    ['shift', (array: ArrayObserver<string>) => array.shift()],
    ['splice', (array: ArrayObserver<string>) => array.splice(1, 1, 'c')],
    ['clear', (array: ArrayObserver<string>) => array.clear()],
    ['sort', (array: ArrayObserver<string>) => array.sort()],
    ['reverse', (array: ArrayObserver<string>) => array.reverse()],
    ['fill', (array: ArrayObserver<string>) => array.fill('c')],
    ['copyWithin', (array: ArrayObserver<string>) => array.copyWithin(0, 1)]
  ])('%s emits one atomic change, without proxy duplicates', (name, run) => {

    const array = observed(['b', 'a']);
    const listener = vi.fn();
    array.subscribeChanges(listener);

    run(array);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe(
      ['sort', 'reverse', 'fill', 'copyWithin'].includes(name) ? 'reset' : 'splice'
    );

  });
  
});
