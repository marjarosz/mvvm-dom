import { describe, expect, it, vi } from 'vitest';
import { BindingMode } from '@mvvm/bindingMode';
import { parseBindings } from '@mvvm/bindingParser';
import { Binding } from '@mvvm/binding';
import { BindingFactory } from '@mvvm/bindingFactory';
import Value from '@mvvm/bindings/valueBinding';
import { View } from '@mvvm/view';
import { own } from '../helpers/resources';
import { template } from '../helpers/views';

class CustomBinding extends Binding {

  setValue(_value: unknown): void {}

}

describe('mode validation', () => {

  it.each([
    [undefined, BindingMode.OneWay],
    ['oneWay', BindingMode.OneWay],
    ['oneWayToSource', BindingMode.OneWayToSource],
    ['twoWay', BindingMode.TwoWay],
    [' twoWay ', BindingMode.TwoWay],
  ] as const)('accepts %s when directly constructed or created by the factory', (value, expected) => {

    const args = value === undefined ? [] : [`mode: ${value}`];
    const input = document.createElement('input');

    const bindings = [
      own(new Value(input, 'name', args)),
      own(new CustomBinding(input, 'name', args)),
      own(BindingFactory.createBinding('value', input, 'name', args))
    ];

    for (const binding of bindings) expect(binding.mode).toBe(expected);
    const declaration = value === undefined ? '{value: name}' : `{value: name, mode: ${value}}`;
    expect(() => parseBindings(declaration, 'data-bind', true)).not.toThrow();
    expect(() => own(new View(template(`<input data-bind="${declaration}">`)))).not.toThrow();

  });

  it.each(['', ' ', 'typo', 'Both', 'MV-V', 'both extra'])('rejects invalid explicit value %j in all paths', value => {

    const args = [`mode: ${value}`];
    const input = document.createElement('input');
    const add = vi.spyOn(input, 'addEventListener');

    for (const create of [
      () => new Value(input, 'name', args),
      () => new CustomBinding(input, 'name', args),
      () => BindingFactory.createBinding('value', input, 'name', args)
    ]) {
      expect(create).toThrow(SyntaxError);
      expect(create).toThrow(/mode.*name/);
    }

    expect(add).not.toHaveBeenCalled();
    const source = template(`<input data-bind="{value: name, mode: ${value}}">`);
    source.id = 'form';
    expect(() => new View(source)).toThrow(/#form data-bind at position \d+: unknown mode/);

  });

  it('only validates mode in the configured parser context', () => {

    const declaration = '{custom: action, mode: typo}';
    expect(() => parseBindings(declaration, 'data-bind', true)).toThrow(/unknown mode 'typo'/);
    expect(parseBindings(declaration, 'data-command')).toHaveLength(1);
    expect(parseBindings(declaration, 'data-validate-error')).toHaveLength(1);

  });

  it('does not hide an invalid direct argument behind a later valid value', () => {

    expect(() => new Value(document.createElement('input'), 'name', ['mode: typo', 'mode: twoWay']))
      .toThrow(/unknown mode 'typo'/);
  });
  
});
