import { describe, expect, it, vi } from 'vitest';
import Value from '@mvvm/bindings/valueBinding';
import Options, { OptionValue } from '@mvvm/bindings/optionsBinding';
import Attribute from '@mvvm/bindings/attributeBinding';
import Width from '@mvvm/bindings/widthBinding';
import { installResizeObserver } from '../helpers/resizeObserver';
import { own } from '../helpers/resources';

describe('value binding', () => {

  it.each([[null, ''], [undefined, ''], [0, '0'], [false, 'false'], ['text', 'text']] as const)
    ('renders %s without losing meaningful falsy values', (value, expected) => {
      const input = document.createElement('input');
      own(new Value(input, 'value', [])).setValue(value);
      expect(input.value).toBe(expected);
    });

  it('publishes the current input value and stops publishing after dispose', () => {

    const input = document.createElement('input');
    const binding = own(new Value(input, 'value', ['mode: twoWay', 'triggerType: input']));
    const listener = vi.fn();
    binding.subscribe(listener);
    input.value = 'A'; input.dispatchEvent(new Event('input'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ propertyName: 'value', value: 'A' });
    binding.dispose();
    input.value = 'B'; input.dispatchEvent(new Event('input'));
    expect(listener).toHaveBeenCalledTimes(1);

  });

  it('unsubscribes the requested consumer rather than the last one', () => {

    const input = document.createElement('input');
    const binding = own(new Value(input, 'value', ['mode: twoWay', 'triggerType: input']));
    const a = vi.fn(), b = vi.fn();
    binding.subscribe(a); binding.subscribe(b); binding.unsubscribe(a);
    input.dispatchEvent(new Event('input'));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

  });
});

describe('select options', () => {

  it('selects and publishes multiple options without mutating input records', () => {

    const select = document.createElement('select');
    select.multiple = true;
    const binding = own(new Options(select, 'options', ['mode: twoWay']));

    const input = [
      { value: '', label: 'Empty', isSelected: true },
      { value: 'b', label: 'B', isSelected: false },
      { value: 'b', label: 'Second B', isSelected: true },
    ];

    const listener = vi.fn();
    binding.subscribe(listener);
    binding.setValue(input);
    expect([...select.options].map(option => option.selected)).toEqual([true, false, true]);
    select.options[0].selected = false;
    select.options[1].selected = true;
    select.dispatchEvent(new Event('change'));
    expect(listener).toHaveBeenCalledTimes(1);

    expect(listener.mock.calls[0][0].value).toEqual([
      { value: '', label: 'Empty', isSelected: false },
      { value: 'b', label: 'B', isSelected: true },
      { value: 'b', label: 'Second B', isSelected: true },
    ]);

    expect(input.map(option => option.isSelected)).toEqual([true, false, true]);

  });

  it('publishes the current DOM options in multiple oneWayToSource mode', () => {

    const select = document.createElement('select');
    select.multiple = true;

    select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    const binding = own(new Options(select, 'options', ['mode: oneWayToSource']));
    const listener = vi.fn();
    binding.subscribe(listener);
    select.options[1].selected = true;
    select.dispatchEvent(new Event('change'));

    expect(listener.mock.calls[0][0].value).toEqual([
      { value: 'a', label: 'A', isSelected: false },
      { value: 'b', label: 'B', isSelected: true },
    ]);

  });

  it('clears old options when the new collection is empty', () => {

    const select = document.createElement('select');
    const binding = own(new Options(select, 'options', []));
    binding.setValue([new OptionValue('a', 'A', true)]);
    expect(select.options).toHaveLength(1);
    binding.setValue([]);
    expect(select.options).toHaveLength(0);

  });

  it('selects an explicitly selected empty-string value', () => {

    const select = document.createElement('select');

    own(new Options(select, 'options', [])).setValue([
      new OptionValue('a', 'A', false), new OptionValue('', 'Choose', true),
    ]);

    expect(select.value).toBe('');
    expect(select.selectedIndex).toBe(1);

  });

  it('accepts structurally valid data without requiring a class constructor', () => {

    const select = document.createElement('select');
    own(new Options(select, 'options', [])).setValue([{ value: 'a', label: 'A', isSelected: true }]);
    expect(select.options).toHaveLength(1);
    expect(select.value).toBe('a');

  });

  it('does not mutate caller data for a model-to-view binding', () => {

    const select = document.createElement('select');
    const data = [new OptionValue('a', 'A', true), new OptionValue('b', 'B', false)];

    own(new Options(select, 'options', ['mode: oneWay'])).setValue(data);
    select.value = 'b'; select.dispatchEvent(new Event('change'));
    expect(data.map(option => option.isSelected)).toEqual([true, false]);

  });

  it('rejects invalid option records without replacing existing DOM options', () => {

    const select = document.createElement('select');
    const binding = own(new Options(select, 'options', []));
    binding.setValue([new OptionValue('a', 'A', true)]);

    expect(() => binding.setValue([{ value: 'b', label: 'B', isSelected: 'yes' }])).toThrow(TypeError);
    expect([...select.options].map(option => option.value)).toEqual(['a']);

  });
});

describe('DOM observers and attributes', () => {

  it.each(['https://example.test/image.png', '/image.png', 'image.png', 'blob:http://localhost/id', 'data:image/png;base64,AA=='])
    ('preserves the supplied src attribute %s', value => {

      const image = document.createElement('img');
      own(new Attribute(image, 'src', ['attributeName: src'])).setValue(value);
      expect(image.getAttribute('src')).toBe(value);
    });

  it('disconnects ResizeObserver and prevents further updates after disposal', () => {

    const observers = installResizeObserver();
    const element = document.createElement('div');
    const binding = own(new Width(element, 'width', ['mode: twoWay']));
    const listener = vi.fn();

    binding.subscribe(listener);
    expect(observers).toHaveLength(1);
    observers[0].emit(element, 100, 50);
    expect(listener.mock.calls[0][0]).toMatchObject({ value: 100 });
    binding.dispose();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    observers[0].emit(element, 200, 50);
    expect(listener).toHaveBeenCalledTimes(1);

  });

  it('disconnects MutationObserver on disposal', () => {

    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const binding = own(new Attribute(document.createElement('div'), 'title', ['attributeName: title', 'mode: twoWay']));
    binding.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);

  });

  it('publishes real attribute changes using the environment MutationObserver', async () => {

    const element = document.createElement('div');
    const binding = own(new Attribute(element, 'title', ['attributeName: title', 'mode: twoWay']));
    const listener = vi.fn();
    
    binding.subscribe(listener);
    element.setAttribute('title', 'updated');
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(listener.mock.calls[0][0]).toMatchObject({ propertyName: 'title', value: 'updated' });

  });
});
