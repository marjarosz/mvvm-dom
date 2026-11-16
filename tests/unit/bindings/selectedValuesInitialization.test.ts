import { describe, expect, it } from 'vitest';
import SelectedValuesBinding from '@mvvm/bindings/selectedValuesBinding';
import { controlledSelection, registerOption, unregisterOption } from '@mvvm/bindings/selectBindingCoordinator';
import { BindingMode } from '@mvvm/bindingMode';

function capture(action: () => void): unknown {

  try { action(); } catch (error) { return error; }
  return undefined;

}

describe('selectedValues initialization rollback', () => {
  // Fault injection: each stage of initialization (MutationObserver ctor,
  // addEventListener, observe, disconnect) is made to throw once. Contract:
  // a failed constructor must roll back every acquired resource (listener,
  // observer, coordinator registration) and leave the select reusable for a
  // retry - the second construction below is the actual regression check.
  for (const stage of ['constructor', 'listener', 'observe', 'disconnect'] as const) {

    it(`allows retry and releases resources after failure at ${stage}`, () => {

      const select = document.createElement('select'); select.multiple = true;
      const originalObserver = globalThis.MutationObserver;
      const originalAdd = select.addEventListener;
      const originalRemove = select.removeEventListener;
      const listeners = new Set<EventListenerOrEventListenerObject>();
      
      let disconnected = 0;
      const failure = new Error(stage);
      let binding: SelectedValuesBinding | undefined;

      class Observer {
        constructor() { if (stage === 'constructor') throw failure; }
        observe() { if (stage === 'observe' || stage === 'disconnect') throw failure; }
        disconnect() { disconnected++; if (stage === 'disconnect') throw new Error('cleanup'); }
      }

      globalThis.MutationObserver = Observer as unknown as typeof MutationObserver;

      select.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        if (listener) listeners.add(listener);
        if (listener) originalAdd.call(this, type, listener, options);
        if (stage === 'listener') throw failure; // Includes a partially completed registration.
      };

      select.removeEventListener = function(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
        if (listener) listeners.delete(listener);
        if (listener) originalRemove.call(this, type, listener, options);
      };

      try {

        expect(capture(() => { new SelectedValuesBinding(select, 'values', ['mode: twoWay']); })).toBe(failure);
        expect(controlledSelection(select)).toBe(undefined);
        expect(listeners.size).toBe(0);
        expect(disconnected).toBe(stage === 'constructor' ? 0 : 1);

        globalThis.MutationObserver = originalObserver;
        select.addEventListener = originalAdd;
        binding = new SelectedValuesBinding(select, 'values', ['mode: twoWay']);
        select.innerHTML = '<option value="a">A</option>';
        binding.setValue(['a']);
        expect(select.options[0].selected).toBe(true);
      } finally {

        globalThis.MutationObserver = originalObserver;
        select.addEventListener = originalAdd;
        binding?.dispose(); select.removeEventListener = originalRemove;
      }

    });
  }

  it('keeps an existing selection owner functional after a conflicting registration', () => {

    const select = document.createElement('select'); select.multiple = true;
    select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    const owner = new SelectedValuesBinding(select, 'values', ['mode: twoWay']);
    const original = globalThis.MutationObserver;
    let disconnected = 0;

    globalThis.MutationObserver = class {
      observe() { throw new Error('must not reach observe'); }
      disconnect() { disconnected++; }
    } as unknown as typeof MutationObserver;

    try {

      expect(capture(() => { new SelectedValuesBinding(select, 'other', []); }) instanceof Error).toBe(true);
      expect(disconnected).toBe(1);
      expect(controlledSelection(select)).toBe(owner);
      owner.setValue(['b']);
      expect(select.options[1].selected).toBe(true);
      let notifications = 0; owner.subscribe(() => notifications++);
      select.dispatchEvent(new Event('change'));
      expect(notifications).toBe(1);

    } finally { 

      globalThis.MutationObserver = original; owner.dispose(); 

    }
  });

  it('preserves options registration when selection registration is rejected', () => {
    // A select may already have an options-binding registration; a rejected
    // SelectedValuesBinding must not tear it down and must stay unregistered
    // itself, so a later construction can still succeed.
    const select = document.createElement('select'); select.multiple = true;
    const options = { mode: BindingMode.TwoWay };
    registerOption(select, options);
    try {

      for (let attempt = 0; attempt < 2; attempt++) {
        expect(capture(() => { new SelectedValuesBinding(select, 'values', []); }) instanceof Error).toBe(true);
        expect(controlledSelection(select)).toBe(undefined);
      }

    } finally { 

      unregisterOption(select, options); 
      
    }

    const binding = new SelectedValuesBinding(select, 'values', []);
    binding.dispose();
  });
});
