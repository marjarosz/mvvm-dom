import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';

describe('ViewModel - explicit public state API', () => {

  it('registers and updates falsy values without replacing them with defaults', () => {

    const model = own(new ViewModel());
    model.registerProperty('value', false);

    for (const value of [false, 0, '', null, undefined]) {
      model.setPropertyValue('value', value);
      expect(model.getPropertyValue('value')).toBe(value);
    }

  });

  it('distinguishes silent assignment from an explicit published change', () => {

    const model = own(new ViewModel());
    const changes = vi.fn();
    model.registerProperty('name', 'Anna');
    model.subscribeProperties(changes);
    model.setPropertyValue('name', 'Jan');
    expect(model.getPropertyValue('name')).toBe('Jan');
    expect(changes).not.toHaveBeenCalled();
    model.setPropertyValueAndNotify('name', 'Maria');
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0]).toMatchObject({ propertyName: 'name', value: 'Maria' });

  });

  it('runs the registered callback with the current value when explicitly enabled', () => {

    const model = own(new ViewModel());
    const callback = vi.fn();
    model.registerProperty('name', '', callback);
    model.setPropertyValueAndNotify('name', 'Jan', true);
    expect(callback).toHaveBeenCalledExactlyOnceWith('Jan', 'name');
    model.setPropertyValue('name', 'Maria', false);
    expect(callback).toHaveBeenCalledTimes(1);

  });

  it('publishes the final value after a callback normalizes an assignment', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', '', value => {
      model.setPropertyValue('name', String(value).trim(), false);
    });

    const changes = vi.fn();
    model.subscribeProperties(changes);
    model.setPropertyValueAndNotify('name', ' Anna ', true);
    expect(model.getPropertyValue('name')).toBe('Anna');
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0]).toMatchObject({ propertyName: 'name', value: 'Anna' });

  });

  it('unsubscribes only the requested listener', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', '');
    const first = vi.fn(), second = vi.fn();
    model.subscribeProperties(first);
    model.subscribeProperties(second);
    model.unsubscribeProperties(first);
    model.setPropertyValueAndNotify('name', 'Jan');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

  });

  it.each(['toString', 'constructor', '__proto__'])('treats %s as an ordinary property name', name => {

    const model = own(new ViewModel());
    expect(model.hasRegisteredProperty(name)).toBe(false);
    model.registerProperty(name, 1);
    model.setPropertyValue(name, 2);
    expect(model.getPropertyValue(name)).toBe(2);
    model.unregisterProperty(name);
    expect(model.hasRegisteredProperty(name)).toBe(false);

  });

  it('unregisters a property without affecting another', () => {

    const model = own(new ViewModel());
    model.registerProperties({ first: 1, second: 2 });
    model.unregisterProperty('first');
    expect(model.getPropertyValue('first')).toBeUndefined();
    expect(model.getPropertyValue('second')).toBe(2);

  });
  
});
