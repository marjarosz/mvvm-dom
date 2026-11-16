import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { propertyChange, propertyAlias, validate } from '@mvvm/propertyDecorators';
import { convert, convertToView, convertToViewModel, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import { CommandActionEvent } from '@mvvm/commandActionEvent';
import { cleanup, own } from '../helpers/resources';

describe('decorators - observable public behavior', () => {

  it('registers initial values and publishes assignment using real decorator syntax', () => {

    class Model extends ViewModel { @propertyChange() accessor name = 'Anna'; }

    const model = own(new Model());

    const listener = vi.fn();
    expect(model.getPropertyValue('name')).toBe('Anna');
    model.subscribeProperties(listener);
    model.name = 'Jan';
    expect(model.getPropertyValue('name')).toBe('Jan');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ propertyName: 'name', value: 'Jan' });

  });

  it('keeps values isolated between instances of the same decorated class', () => {

    class Model extends ViewModel { @propertyChange() accessor name = ''; }
    const a = own(new Model()), b = own(new Model());
    a.name = 'A'; b.name = 'B';
    expect(a.name).toBe('A'); expect(b.name).toBe('B');

  });

  it('publishes an alias under its declared model property name', () => {

    class Model extends ViewModel { @propertyAlias('canonical') accessor alias = ''; }
    const model = own(new Model());
    const listener = vi.fn();

    model.subscribeProperties(listener);
    model.alias = 'value';
    expect(model.getPropertyValue('canonical')).toBe('value');
    expect(listener.mock.calls[0][0].propertyName).toBe('canonical');

  });

  it('validates each logical assignment exactly once', () => {

    const rule = vi.fn(() => true);

    class Model extends ViewModel {
      @validate(() => ({ isValid: rule })) accessor name = '';
    }

    const model = own(new Model());
    expect(rule).toHaveBeenCalledTimes(1);
    rule.mockClear();
    model.name = 'Jan';
    expect(rule).toHaveBeenCalledExactlyOnceWith('Jan');

  });

  it('creates separate validator instances when the provider requests them', () => {

    const rules: ReturnType<typeof vi.fn>[] = [];

    class Model extends ViewModel {
      @validate(() => {
        const isValid = vi.fn(() => true);
        rules.push(isValid);
        return { isValid };
      }) accessor name = '';
    }

    const a = own(new Model());

    own(new Model());
    expect(rules).toHaveLength(2);
    rules.forEach(rule => rule.mockClear());
    a.name = 'A';
    expect(rules[0]).toHaveBeenCalled();
    expect(rules[1]).not.toHaveBeenCalled();

  });
});

describe('converter inheritance and directions', () => {

  function register(name: string, prefix: string): void {
    registerConverter(name, {
      convert: value => `${prefix}${value}`,
      convertBack: value => String(value).slice(prefix.length),
    });
    cleanup(() => unregisterConverter(name));
  }

  it('uses the derived override without modifying base and sibling behavior', () => {

    register('test-base', 'B:'); register('test-child', 'C:');

    class Base {
      @convert('test-base') accessor value = '';
      @convert('test-base') accessor other = '';
    }

    class Child extends Base { @convert('test-child') accessor value = ''; }

    class Grandchild extends Child {}

    class Sibling extends Base {}

    expect(convertToView('x', 'value', new Child())).toBe('C:x');
    expect(convertToView('x', 'value', new Base())).toBe('B:x');
    expect(convertToView('x', 'value', new Sibling())).toBe('B:x');
    expect(convertToView('x', 'value', new Grandchild())).toBe('C:x');
    expect(convertToView('x', 'other', new Grandchild())).toBe('B:x');
    expect(convertToViewModel('C:x', 'value', new Child())).toBe('x');

  });

  it('rejects duplicate converters on a property and symbol property names', () => {

    expect(() => {
      class Model { @convert('first') @convert('second') accessor value = ''; }
      return Model;
    }).toThrow(/already declared.*value/i);

    const symbol = Symbol('value');

    expect(() => {

      class Model {
        @convert('first') accessor [symbol] = '';
      }

      return Model;

    }).toThrow(/string property name/i);
  });

  it('passes undeclared properties through without coercing their value', () => {

    const value = { nested: true };
    expect(convertToView(value, 'other', {})).toBe(value);
    expect(convertToViewModel(value, 'other', {})).toBe(value);

  });

  it('passes the declared parameter to the converter', () => {

    const forward = vi.fn((value: unknown, parameter?: unknown) => `${parameter}:${value}`);
    registerConverter('test-param', { convert: forward });
    cleanup(() => unregisterConverter('test-param'));

    class Model { @convert('test-param', 'USD') accessor amount = 1; }
    expect(convertToView(5, 'amount', new Model())).toBe('USD:5');
    expect(forward).toHaveBeenCalledWith(5, 'USD');
    expect(convertToViewModel(5, 'amount', new Model())).toBe(5);

  });

});

describe('command metadata inheritance', () => {

  it('maps a derived command to its new method while leaving its sibling unchanged', () => {

    class Base extends ViewModel {
      calls: string[] = [];
      @command('save') baseSave() { this.calls.push('base'); }
      @command('reset') reset() { this.calls.push('reset'); }
    }

    @autoRegisterCommands()
    class Child extends Base {
      @command('save') childSave() { this.calls.push('child'); }
    }

    class Grandchild extends Child {
      reset() { this.calls.push('grandchild reset'); }
    }

    @autoRegisterCommands()
    class Sibling extends Base {}

    const child = own(new Child()), sibling = own(new Sibling());
    const event = new CommandActionEvent('command-action', 'save', {}, new Event('click'), []);
    expect(child.getCommand('save')).toBeDefined();
    child.getCommand('save')!.execute(event);
    sibling.getCommand('save')!.execute(event);
    expect(child.calls).toEqual(['child']);
    expect(sibling.calls).toEqual(['base']);
    const grandchild = own(new Grandchild());
    grandchild.getCommand('save')!.execute(event);
    grandchild.getCommand('reset')!.execute(new CommandActionEvent('command-action', 'reset', {}, new Event('click'), []));
    expect(grandchild.calls).toEqual(['child', 'grandchild reset']);
    
  });

  it('rejects two methods mapped to the same command on one class', () => {
    expect(() => {
      class Model extends ViewModel {
        @command('save') save() {}
        @command('save') saveAgain() {}
      }
      return Model;
    }).toThrow(/already declared.*save/i);
  });
});
