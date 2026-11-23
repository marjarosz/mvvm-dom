import { describe, expect, it, vi } from 'vitest';
import Radio from '@mvvm/bindings/radioBinding';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';

describe('radio nullish contract', () => {

  it.each([null, undefined])('distinguishes %s from an empty string without publishing a DOM change', empty => {

    const node = document.createElement('input');
    node.type = 'radio'; node.value = '';
    const binding = own(new Radio(node, 'choice', ['mode: twoWay']));
    const changes = vi.fn(); binding.subscribe(changes);
    binding.setValue(''); expect(node.checked).toBe(true);
    binding.setValue(empty); expect(node.checked).toBe(false);
    binding.setValue(empty); expect(node.checked).toBe(false);
    binding.setValue(''); expect(node.checked).toBe(true);
    expect(changes).not.toHaveBeenCalled();

  });

  it.each([{ value: 0, text: '0' }, { value: false, text: 'false' }, { value: 'other', text: 'other' }])('preserves non-null conversion for $text', ({ value, text }) => {

    const node = document.createElement('input'); node.type = 'radio'; node.value = text;
    const binding = own(new Radio(node, 'choice', []));
    binding.setValue(value); expect(node.checked).toBe(true);
    binding.setValue(null); expect(node.checked).toBe(false);
    binding.setValue(value); expect(node.checked).toBe(true);

  });

  it.each([null, undefined])('initializes and clears a group for %s while preserving two-way selection', empty => {

    const model = own(new ViewModel()); model.registerProperty('choice', empty);
    const template = document.createElement('template');
    template.innerHTML = '<input id="empty-radio" type="radio" name="choice" value="" checked data-bind="{radio: choice, mode: twoWay}">' +
      '<input id="other-radio" type="radio" name="choice" value="other" data-bind="{radio: choice, mode: twoWay}">' +
      '<span id="selected" data-bind="{text: choice}"></span>';
    const view = own(new View(template, model)); document.body.append(...view.viewNodeList);
    const blank = document.getElementById('empty-radio') as HTMLInputElement;
    const other = document.getElementById('other-radio') as HTMLInputElement;
    expect([blank.checked, other.checked]).toEqual([false, false]);
    expect(model.getPropertyValue('choice')).toBe(empty);
    const changes = vi.fn(); model.subscribeProperties(changes);
    blank.click();
    expect(model.getPropertyValue('choice')).toBe('');
    expect([blank.checked, other.checked]).toEqual([true, false]);
    expect(changes).toHaveBeenCalledTimes(1);
    other.click();
    expect(model.getPropertyValue('choice')).toBe('other');
    expect(document.getElementById('selected')!.innerText).toBe('other');
    expect([blank.checked, other.checked]).toEqual([false, true]);
    expect(changes).toHaveBeenCalledTimes(2);
    model.setPropertyValueAndNotify('choice', empty);
    expect([blank.checked, other.checked]).toEqual([false, false]);
    model.setPropertyValueAndNotify('choice', '');
    expect([blank.checked, other.checked]).toEqual([true, false]);

  });
  
});
