import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';
import { mounted } from '../helpers/views';

const writers = {
  view: (model: ViewModel, value: unknown) => model.setPropertyValueFromView('name', value),
  explicit: (model: ViewModel, value: unknown) => model.setPropertyValueAndNotify('name', value, true),
};
function capture(action: () => void) {
  try { action(); return { thrown: false, error: undefined }; }
  catch (error) { return { thrown: true, error }; }
}

describe('property writes that fail after storing a value', () => {
  for (const [kind, write] of Object.entries(writers)) {
    it.each([new Error('callback'), undefined])(`${kind}: publishes normalized state to both views and preserves the thrown value %s`, failure => {
      const model = own(new ViewModel());
      model.registerProperty('name', 'initial', value => {
        model.setPropertyValue('name', String(value).trim(), false);
        throw failure;
      });
      const a = mounted('<input data-bind="{value: name}">', model);
      const b = mounted('<input data-bind="{value: name}">', model);
      const changed = vi.fn();
      model.subscribeProperties(changed);
      expect(capture(() => write(model, ' final '))).toEqual({ thrown: true, error: failure });
      expect(model.getPropertyValue('name')).toBe('final');
      expect(a.host.querySelector('input')!.value).toBe('final');
      expect(b.host.querySelector('input')!.value).toBe('final');
      expect(changed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ value: 'final' }));
    });

    it(`${kind}: publishes stored data when validation throws, without executing the callback`, () => {
      const model = own(new ViewModel()), callback = vi.fn(), changed = vi.fn();
      const failure = new Error('validator');
      model.registerProperty('name', 'old', callback);
      model.registerPropertyValidator('name', [{ isValid: () => { throw failure; } }]);
      model.subscribeProperties(changed);
      expect(capture(() => write(model, 'new')).error).toBe(failure);
      expect(callback).not.toHaveBeenCalled();
      expect(changed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ value: 'new' }));
    });

    it.each(['unregister', 'dispose'])(`${kind}: does not notify after %s during a callback`, action => {
      const model = own(new ViewModel()), changed = vi.fn();
      const notify = vi.spyOn(model, 'notifyPropertyChanged');
      const failure = new Error('ended');
      model.registerProperty('name', 'old', () => {
        if (action === 'dispose') model.dispose(); else model.unregisterProperty('name');
        throw failure;
      });
      model.subscribeProperties(changed);
      expect(capture(() => write(model, 'new')).error).toBe(failure);
      expect(notify).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });
  }

  it('coalesces nested view writes after an exception and releases suppression for the next write', () => {
    const model = own(new ViewModel()), changed = vi.fn();
    const failure = new Error('nested');
    model.registerProperty('name', 'old', value => {
      if (value === 'outer') model.setPropertyValueFromView('name', 'inner');
      if (value === 'inner') throw failure;
    });
    model.subscribeProperties(changed);
    expect(capture(() => model.setPropertyValueFromView('name', 'outer')).error).toBe(failure);
    expect(changed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ value: 'inner' }));
    model.setPropertyValueFromView('name', 'next');
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('keeps Object.is equality for view writes and silent writes silent', () => {
    const model = own(new ViewModel()), changed = vi.fn(), callback = vi.fn(() => { throw new Error('callback'); });
    model.registerProperty('name', NaN, callback);
    model.subscribeProperties(changed);
    model.setPropertyValueFromView('name', NaN);
    expect(callback).not.toHaveBeenCalled();
    expect(capture(() => model.setPropertyValue('name', 'new')).thrown).toBe(true);
    expect(changed).not.toHaveBeenCalled();
  });

  it('preserves explicit nested notification counts rather than batching programmatic writes', () => {
    const model = own(new ViewModel()), changed = vi.fn();
    const failure = new Error('outer');
    model.registerProperty('name', 'old', () => {
      model.setPropertyValueAndNotify('name', 'inner');
      throw failure;
    });
    model.subscribeProperties(changed);
    expect(capture(() => model.setPropertyValueAndNotify('name', 'outer', true)).error).toBe(failure);
    expect(changed.mock.calls.map(([event]) => event.value)).toEqual(['inner', 'inner']);
  });

  it('does not replace the original exception with a notification exception', () => {
    const model = own(new ViewModel());
    const original = new Error('write'), secondary = new Error('notification');
    model.registerProperty('name', 'old', () => { throw original; });
    vi.spyOn(model, 'notifyPropertyChanged').mockImplementation(() => { throw secondary; });
    expect(capture(() => model.setPropertyValueFromView('name', 'new')).error).toBe(original);
  });

  it.each(Object.entries(writers))('%s: does not complete a removed and re-registered property', (_kind, write) => {
    const model = own(new ViewModel()), changed = vi.fn();
    model.registerProperty('name', 'old', () => {
      model.unregisterProperty('name');
      model.registerProperty('name', 'replacement');
    });
    model.subscribeProperties(changed);
    write(model, 'new');
    expect(model.getPropertyValue('name')).toBe('replacement');
    expect(changed).not.toHaveBeenCalled();
  });
});
