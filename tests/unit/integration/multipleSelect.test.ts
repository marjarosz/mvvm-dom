import { describe, expect, it, vi } from 'vitest';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';
import { cleanup } from '../helpers/resources';
import { template } from '../helpers/views';
import { mounted } from '../helpers/views';
import { convert, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import SelectedValues from '@mvvm/bindings/selectedValuesBinding';
import Options from '@mvvm/bindings/optionsBinding';
import { Binding } from '@mvvm/binding';
import { BindingFactory } from '@mvvm/bindingFactory';

const options = [

  { value: 'a', label: 'A', isSelected: false },
  { value: '', label: 'Empty', isSelected: true },
  { value: 'a', label: 'A2', isSelected: false },
  { value: 'b', label: 'B', isSelected: true },

];

function setup(bindings: string, selected: unknown = ['a', 'missing', 'a', '']) {

  const model = own(new ViewModel());
  model.registerProperties({ options, selected });
  const view = own(new View(template(`<select multiple data-bind="${bindings}"></select>`), model));
  const select = view.viewNodeList[0] as HTMLSelectElement;
  return { model, view, select };

}

describe('multiple select integration', () => {

  it('runs generic initialization hooks after all bindings are subscribed', () => {

    const calls: string[] = [];
    class LifecycleBinding extends Binding {
      beginInitialization() { calls.push(`begin:${this.propertyName}`); }
      setValue() { calls.push(`value:${this.propertyName}`); }

      subscribe(callback: (event: Event) => void) {
        calls.push(`subscribe:${this.propertyName}`);
        super.subscribe(callback);
      }
      endInitialization() { calls.push(`end:${this.propertyName}`); }
    }

    BindingFactory.registerBinding('testMultipleLifecycle',
      (element, name, args) => new LifecycleBinding(element, name, args));
    const model = own(new ViewModel());
    model.registerProperties({ first: 'x', second: 'y' });
    own(new View(template('<div data-bind="{testMultipleLifecycle: first, mode: twoWay}, ' +
      '{testMultipleLifecycle: second, mode: twoWay}"></div>'), model));
    expect(calls).toEqual(['begin:first', 'begin:second', 'value:first', 'subscribe:first',
      'value:second', 'subscribe:second', 'end:first', 'end:second']);

  });

  it.each(['option-first', 'selection-first'])('coordinates independently of View: %s', order => {

    const select = document.createElement('select');
    select.multiple = true;
    let optionBinding: Options;
    let selectedBinding: SelectedValues;

    if (order === 'option-first') {

      optionBinding = own(new Options(select, 'options', []));
      selectedBinding = own(new SelectedValues(select, 'selected', ['mode: twoWay']));

    } else {

      selectedBinding = own(new SelectedValues(select, 'selected', ['mode: twoWay']));
      optionBinding = own(new Options(select, 'options', []));

    }

    optionBinding.setValue(options);
    selectedBinding.setValue(['a']);
    expect([...select.options].map(option => option.selected)).toEqual([true, false, true, false]);
    optionBinding.setValue([{ value: 'a', label: 'New', isSelected: false }]);
    expect(select.options[0].selected).toBe(true);
    selectedBinding.dispose();
    optionBinding.setValue([{ value: 'b', label: 'B', isSelected: true }]);
    expect(select.options[0].selected).toBe(true);
    const replacement = own(new SelectedValues(select, 'selected', []));
    replacement.setValue(['b']);
    expect(select.options[0].selected).toBe(true);

  });

  it.each(['option-first', 'selection-first'])('rejects incompatible bindings and releases registration: %s', order => {
   
    const select = document.createElement('select');
    select.multiple = true;

    if (order === 'option-first') {

      const option = own(new Options(select, 'options', ['mode: twoWay']));
      expect(() => new SelectedValues(select, 'selected', [])).toThrow(/option.*oneWay/i);
      option.dispose();
      own(new SelectedValues(select, 'selected', []));

    } else {

      const selected = own(new SelectedValues(select, 'selected', []));
      expect(() => new Options(select, 'options', ['mode: twoWay'])).toThrow(/option.*oneWay/i);
      expect(() => new SelectedValues(select, 'other', [])).toThrow(/only one selectedValues/i);
      selected.dispose();
      own(new Options(select, 'options', ['mode: twoWay']));

    }

  });

  it('rejects duplicate option bindings only when combined with selectedValues', () => {

    const select = document.createElement('select');
    select.multiple = true;
    const first = own(new Options(select, 'first', []));
    const second = own(new Options(select, 'second', []));
    expect(() => new SelectedValues(select, 'selected', [])).toThrow(/only one option/i);
    second.dispose();
    const selected = own(new SelectedValues(select, 'selected', []));
    expect(() => new Options(select, 'third', [])).toThrow(/only one option/i);
    selected.dispose();
    first.dispose();
    own(new Options(select, 'fresh', []));

  });

  it('recreates coordinated bindings inside structural views after unmounting', () => {

    const model = own(new ViewModel());
    model.registerProperties({ show: true, options, selected: ['a'] });
    const { host } = mounted(
      '<section data-bind="{if: show}"><select multiple data-bind="' +
      '{selectedValues: selected, mode: twoWay}, {options: options}"></select></section>', model);
    const first = host.querySelector('select')!;
    expect([...first.options].map(option => option.selected)).toEqual([true, false, true, false]);
    model.setPropertyValueAndNotify('show', false);
    model.setPropertyValueAndNotify('selected', ['b']);
    model.setPropertyValueAndNotify('show', true);
    const second = host.querySelector('select')!;
    expect(second).not.toBe(first);
    expect([...second.options].map(option => option.selected)).toEqual([false, false, false, true]);

  });

  it.each([
    '{options: options}, {selectedValues: selected, mode: twoWay}',
    '{selectedValues: selected, mode: twoWay}, {options: options}',
  ])('coordinates initialization and replacement independently of binding order: %s', bindings => {
    const { model, select } = setup(bindings);
    expect(model.getPropertyValue('selected')).toEqual(['a', '']);
    expect([...select.options].map(option => option.selected)).toEqual([true, true, true, false]);
    const listener = vi.fn();
    model.subscribeProperties(listener);

    model.setPropertyValueAndNotify('options', [
      { value: 'b', label: 'B', isSelected: true },
      { value: 'a', label: 'A', isSelected: false },
    ]);

    expect(model.getPropertyValue('selected')).toEqual(['a']);
    expect([...select.options].map(option => option.selected)).toEqual([false, true]);
    expect(listener.mock.calls.filter(([event]) => event.propertyName === 'selected')).toHaveLength(1);

  });

  it('publishes unique selected values and selects all duplicates after user interaction', () => {

    const { model, select } = setup('{options: options}, {selectedValues: selected, mode: twoWay}', []);
    select.options[0].selected = true;
    select.options[3].selected = true;
    select.dispatchEvent(new Event('change'));
    expect(model.getPropertyValue('selected')).toEqual(['a', 'b']);
    expect([...select.options].map(option => option.selected)).toEqual([true, false, true, true]);

  });

  it('does not write to model in oneWay mode', () => {

    const initial = ['missing', 'a'];
    const { model, select } = setup('{options: options}, {selectedValues: selected, mode: oneWay}', initial);
    expect(model.getPropertyValue('selected')).toBe(initial);
    expect([...select.options].map(option => option.selected)).toEqual([true, false, true, false]);
    select.options[0].selected = false;
    select.dispatchEvent(new Event('change'));
    expect(model.getPropertyValue('selected')).toBe(initial);

  });

  it('rejects conflicting writable option binding', () => {
    expect(() => setup('{options: options, mode: twoWay}, {selectedValues: selected, mode: twoWay}'))
      .toThrow(/option.*oneWay/i);
  });

  it('reconciles external option changes and stops after disposal', async () => {

    const { model, select, view } = setup('{options: options}, {selectedValues: selected, mode: twoWay}', ['a', 'b']);
    select.querySelectorAll('option[value="a"]').forEach(option => option.remove());
    await vi.waitFor(() => expect(model.getPropertyValue('selected')).toEqual(['b']));
    view.ownsDataContext = false;
    view.dispose();
    select.options[0].remove();
    await Promise.resolve();
    expect(model.getPropertyValue('selected')).toEqual(['b']);

  });

  it('reconciles option values, text and additions from the DOM once per change', async () => {

    const model = own(new ViewModel());
    model.registerProperty('selected', ['a', 'text']);
    const view = own(new View(template(
      '<select multiple data-bind="{selectedValues: selected, mode: twoWay}">' +
      '<option value="a">A</option><option>text</option></select>'
    ), model));

    const select = view.viewNodeList[0] as HTMLSelectElement;
    const listener = vi.fn();
    model.subscribeProperties(listener);
    select.options[0].value = 'changed';
    await vi.waitFor(() => expect(model.getPropertyValue('selected')).toEqual(['text']));
    select.options[1].firstChild!.textContent = 'other';
    await vi.waitFor(() => expect(model.getPropertyValue('selected')).toEqual([]));
    const added = document.createElement('option');
    added.value = 'new';
    select.append(added);
    model.setPropertyValueAndNotify('selected', ['new']);
    await Promise.resolve();
    expect(added.selected).toBe(true);
    expect(listener.mock.calls.filter(([event]) => event.propertyName === 'selected')).toHaveLength(3);

  });

  it('retains missing model values in oneWay and selects them when options appear', async () => {

    const { model, select } = setup('{options: options}, {selectedValues: selected, mode: oneWay}', ['later']);
    const added = document.createElement('option');
    added.value = 'later';
    select.append(added);
    await vi.waitFor(() => expect(added.selected).toBe(true));
    expect(model.getPropertyValue('selected')).toEqual(['later']);

  });

  it('clears selection and normalizes to an empty array when options are removed', () => {

    const { model, select } = setup('{options: options}, {selectedValues: selected, mode: twoWay}', ['a']);
    model.setPropertyValueAndNotify('options', []);
    expect(select.options).toHaveLength(0);
    expect(model.getPropertyValue('selected')).toEqual([]);
    model.setPropertyValueAndNotify('options', options);
    expect([...select.options].every(option => !option.selected)).toBe(true);

  });

  it('updates from static options in oneWayToSource mode without applying model values', () => {

    const model = own(new ViewModel());
    model.registerProperty('selected', ['b']);
    const view = own(new View(template(
      '<select multiple data-bind="{selectedValues: selected, mode: oneWayToSource}">' +
      '<option value="a" selected>A</option><option value="b">B</option></select>'
    ), model));
    const select = view.viewNodeList[0] as HTMLSelectElement;
    expect([...select.options].map(option => option.selected)).toEqual([true, false]);
    select.options[1].selected = true;
    select.dispatchEvent(new Event('change'));
    expect(model.getPropertyValue('selected')).toEqual(['a', 'b']);
    model.setPropertyValueAndNotify('selected', []);
    expect([...select.options].map(option => option.selected)).toEqual([true, true]);

  });

  it('uses option flags as initial DOM state when selectedValues is oneWayToSource', () => {

    const { select, model } = setup('{options: options}, {selectedValues: selected, mode: oneWayToSource}', ['a']);
    expect([...select.options].map(option => option.selected)).toEqual([false, true, false, true]);
    select.dispatchEvent(new Event('change'));
    expect(model.getPropertyValue('selected')).toEqual(['', 'b']);

  });

  it('rejects invalid values and elements without changing existing options', () => {

    const { model, select } = setup('{options: options}, {selectedValues: selected, mode: twoWay}', ['a']);
    const binding = own(new SelectedValues(select.cloneNode(true) as HTMLSelectElement, 'other', []));
    const previous = [...select.options].map(option => option.selected);
    expect(() => binding.setValue(['b', 42])).toThrow(/array of strings/);
    expect([...select.options].map(option => option.selected)).toEqual(previous);
    expect(() => new View(template('<select data-bind="{selectedValues: selected}"></select>'), model))
      .toThrow(/select multiple/);
    expect(() => new View(template('<input data-bind="{selectedValues: selected}">'), model))
      .toThrow(/select multiple/);

  });

  it('syncs model changes with another view and does not emit duplicate normalization events', async () => {

    const { model, select } = setup('{options: options}, {selectedValues: selected, mode: twoWay}', ['a']);
    const second = own(new View(template(
      '<select multiple data-bind="{options: options}, {selectedValues: selected, mode: twoWay}"></select>'
    ), model, undefined, { ownsDataContext: false }));
    const other = second.viewNodeList[0] as HTMLSelectElement;
    const listener = vi.fn();
    model.subscribeProperties(listener);
    select.options[0].selected = false;
    select.options[2].selected = false;
    select.options[3].selected = true;
    select.dispatchEvent(new Event('change'));
    expect(model.getPropertyValue('selected')).toEqual(['b']);
    expect([...other.options].map(option => option.selected)).toEqual([false, false, false, true]);
    await Promise.resolve();
    expect(listener.mock.calls.filter(([event]) => event.propertyName === 'selected')).toHaveLength(1);

  });

  it('normalizes through converters without a feedback loop', () => {

    registerConverter('select-test', {
      convert: value => String(value).split(','),
      convertBack: value => (value as string[]).join(',')
    });

    cleanup(() => unregisterConverter('select-test'));

    class Model extends ViewModel {
      @convert('select-test') accessor selected = '';
    }

    const model = own(new Model());
    model.registerProperty('selected', 'missing,a');
    model.registerProperty('options', options);
    const listener = vi.fn();
    model.subscribeProperties(listener);
    const view = own(new View(template(
      '<select multiple data-bind="{options: options}, {selectedValues: selected, mode: twoWay}"></select>'
    ), model));
    expect(model.getPropertyValue('selected')).toBe('a');
    expect((view.viewNodeList[0] as HTMLSelectElement).options[0].selected).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

  });

  it('disconnects its observer when construction fails', () => {

    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    expect(() => setup('{selectedValues: selected, mode: twoWay}, {options: options, mode: twoWay}'))
      .toThrow(/option.*oneWay/i);
    expect(disconnect).toHaveBeenCalled();
    
  });

});
