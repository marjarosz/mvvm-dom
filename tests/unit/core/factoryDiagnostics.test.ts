import { describe, expect, it } from 'vitest';
import { BindingFactory } from '@mvvm/bindingFactory';
import { CommandBindingFactory } from '@mvvm/commandBindingFactory';
import { ValidationErrorBindingFactory } from '@mvvm/validationErrorBindingFactory';
import type { IEventCommandBinding } from '@mvvm/eventCommandBinding';
import type { ICommandActionEventTarget } from '@mvvm/commandActionEventTarget';
import type { IValidationErrorBinding } from '@mvvm/validationErrorBinding';
import type { IValidationStateChangeEventTarget } from '@mvvm/validationStateEventTarget';
import { ViewModel } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import { getConverter, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import { mounted } from '../helpers/views';
import { own } from '../helpers/resources';

describe('factory diagnostics', () => {

  const factories = [
    { name: 'binding', create: (type: string) => BindingFactory.createBinding(type, document.createElement('div'), 'field', []) },
    { name: 'command', create: (type: string) => CommandBindingFactory.createCommandBinding(type, document.createElement('div'), 'field', []) },
    { name: 'validation', create: (type: string) => ValidationErrorBindingFactory.createValidationErrorBinding(type, document.createElement('div'), 'field', []) },
  ];

  it.each(factories)('$name identifies both the unknown type and the affected field', ({ create }) => {
    expect(() => create('unknown-test-type')).toThrow(/unknown-test-type/);
    expect(() => create('unknown-test-type')).toThrow(/field/);
  });

  it.each(factories)('$name treats inherited object keys as unknown types', ({ create }) => {

    for (const key of ['constructor', 'toString', '__proto__']) {
      expect(() => create(key)).toThrow(/field/);
    }

  });

});

describe('command and validation error registration', () => {

  class MarkerCommandBinding implements IEventCommandBinding {

    constructor(readonly element: HTMLElement, readonly eventTarget: ICommandActionEventTarget) {}
    subscribe(): void {}
    unsubscribe(): void {}
    dispose(): void {}

  }

  class MarkerValidationErrorBinding implements IValidationErrorBinding {

    constructor(readonly element: HTMLElement, readonly eventTarget: IValidationStateChangeEventTarget) {}
    subscribe(): void {}
    unsubscribe(): void {}
    dispose(): void {}
    setValid(): void {}
    reset(): void {}

  }

  it('creates a registered command binding type and always provides its event target', () => {

    let seenTarget: ICommandActionEventTarget | undefined;

    CommandBindingFactory.registerCommandBinding('testRegCommand', (element, _name, _args, eventTarget) => {
      seenTarget = eventTarget;
      return new MarkerCommandBinding(element, eventTarget);
    });

    const node = document.createElement('div');
    const binding = CommandBindingFactory.createCommandBinding('testRegCommand', node, 'field', []);

    expect(binding).toBeInstanceOf(MarkerCommandBinding);
    expect((binding as MarkerCommandBinding).element).toBe(node);
    expect(seenTarget).toBeDefined();
    expect(typeof seenTarget!.commandAction).toBe('function');

  });

  it('creates a registered validation error binding type and always provides its event target', () => {

    let seenTarget: IValidationStateChangeEventTarget | undefined;

    ValidationErrorBindingFactory.registerValidationErrorBinding('testRegValidation', (element, _name, _args, eventTarget) => {
      seenTarget = eventTarget;
      return new MarkerValidationErrorBinding(element, eventTarget);
    });

    const node = document.createElement('div');
    const binding = ValidationErrorBindingFactory.createValidationErrorBinding('testRegValidation', node, 'field', []);

    expect(binding).toBeInstanceOf(MarkerValidationErrorBinding);
    expect((binding as MarkerValidationErrorBinding).element).toBe(node);
    expect(seenTarget).toBeDefined();

  });

  it.each(['click', 'ready', 'testRegCommand'])('rejects the command type %s already in use', name => {
    expect(() => CommandBindingFactory.registerCommandBinding(name, () => new MarkerCommandBinding(document.createElement('div'), {} as ICommandActionEventTarget)))
      .toThrow(new RegExp(`command '${name}' is already registered`));
  });

  it.each(['class', 'message', 'click', 'testRegValidation'])('rejects the validation error type %s already in use', name => {
    expect(() => ValidationErrorBindingFactory.registerValidationErrorBinding(name, () => new MarkerValidationErrorBinding(document.createElement('div'), {} as IValidationStateChangeEventTarget)))
      .toThrow(new RegExp(`validation error binding '${name}' is already registered`));
  });

  it('keeps the original factory when a duplicate registration is rejected', () => {
    expect(() => CommandBindingFactory.registerCommandBinding('testRegCommand', () => { throw new Error('must not run'); })).toThrow(/already registered/);
    expect(CommandBindingFactory.createCommandBinding('testRegCommand', document.createElement('div'), 'field', [])).toBeInstanceOf(MarkerCommandBinding);
  });

  it.each(['constructor', 'toString', '__proto__'])('registers and resolves the command type %s', name => {
    // Map-backed registries must not inherit or shadow Object.prototype keys.
    CommandBindingFactory.registerCommandBinding(name, (element, _n, _a, target) => new MarkerCommandBinding(element, target));
    expect(CommandBindingFactory.createCommandBinding(name, document.createElement('div'), 'field', [])).toBeInstanceOf(MarkerCommandBinding);
    expect(() => CommandBindingFactory.registerCommandBinding(name, () => { throw new Error('must not run'); })).toThrow(/already registered/);
  });

  it.each(['constructor', 'toString', '__proto__'])('registers and resolves the validation error type %s', name => {
    ValidationErrorBindingFactory.registerValidationErrorBinding(name, (element, _n, _a, target) => new MarkerValidationErrorBinding(element, target));
    expect(ValidationErrorBindingFactory.createValidationErrorBinding(name, document.createElement('div'), 'field', [])).toBeInstanceOf(MarkerValidationErrorBinding);
  });

});

describe('named MVVM registries', () => {

  it.each(['constructor', 'toString', '__proto__'])('supports %s across binding, command and validation', name => {

    const model = own(new ViewModel());

    function expectEmpty() {
      expect(model.hasRegisteredProperty(name)).toBe(false);
      expect(model.getCommand(name)).toBeUndefined();
      expect(model.hasPropertyValidator(name)).toBe(false);
      expect(model.getPropertyValidationState(name)).toMatchObject({ validated: false });
    }

    expectEmpty();

    model.registerProperty(name, 'A');
    model.registerCommand(name, new Command(() => model.setPropertyValueAndNotify(name, 'B')));
    model.registerPropertyValidator(name, [{ isValid: () => false }]);
    const { host, view } = mounted(`<input data-bind="{value: ${name}}"><button data-command="{click: ${name}}"></button>`, model);
    expect(host.querySelector('input')!.value).toBe('A');
    host.querySelector('button')!.click();
    expect(host.querySelector('input')!.value).toBe('B');
    model.validateProperty(name);
    expect(model.getPropertyValidationState(name)).toMatchObject({ validated: true, isValid: false });
    view.dispose();
    model.dispose();
    expectEmpty();

  });

  it.each(['constructor', 'toString', '__proto__'])('looks up converter %s only while registered', name => {

    const converter = { convert: (value: unknown) => value };
    expect(() => getConverter(name)).toThrow(/not registered/);
    registerConverter(name, converter);

    try {
      expect(getConverter(name)).toBe(converter);

    } finally {

      unregisterConverter(name);

    }
    expect(() => getConverter(name)).toThrow(/not registered/);
  });

  it('registers only the input object’s own properties in bulk', () => {

    const model = own(new ViewModel());
    const fields = Object.assign(Object.create({ inherited: 1 }), { local: 2 });
    model.registerProperties(fields);
    expect(model.getPropertyValue('local')).toBe(2);
    expect(model.hasRegisteredProperty('inherited')).toBe(false);

  });
  
});
