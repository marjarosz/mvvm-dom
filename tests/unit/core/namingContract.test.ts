import { describe, expect, it } from 'vitest';
import { BindingFactory } from '@mvvm/bindingFactory';
import { BindingMode, parseBindingMode } from '@mvvm/bindingMode';
import { parseBindings } from '@mvvm/bindingParser';
import { ViewModel } from '@mvvm/viewModel';
import { View } from '@mvvm/view';
import { propertyChange } from '@mvvm/propertyDecorators';

function rejects(action: () => unknown): boolean {

  try { action(); return false; } catch { return true; }

}

describe('canonical MVVM naming without compatibility aliases', () => {

  it('accepts only canonical direction values', () => {

    expect(parseBindingMode('oneWay')).toBe(BindingMode.OneWay);
    expect(parseBindingMode('oneWayToSource')).toBe(BindingMode.OneWayToSource);
    expect(parseBindingMode('twoWay')).toBe(BindingMode.TwoWay);

    for (const old of ['both', 'mv-v', 'v-mv']) {
      expect(parseBindingMode(old)).toBe(undefined);
      expect(rejects(() => parseBindings(`{value: name, mode: ${old}}`, 'data-bind', true))).toBe(true);
    }

  });

  it('rejects the old direction argument in parser and direct binding construction', () => {
    expect(rejects(() => parseBindings('{value: name, bindWay: both}', 'data-bind', true))).toBe(true);
    expect(rejects(() => BindingFactory.createBinding('value', document.createElement('input'), 'name', ['bindWay: both']))).toBe(true);
  });

  it('exposes canonical bindings and rejects old aliases', () => {

    for (const old of ['innerText', 'option', 'attr']) {
      expect(rejects(() => BindingFactory.createBinding(old, document.createElement('div'), 'name', []))).toBe(true);
    }

    for (const [name, tag, args] of [
      ['text', 'span', []], ['attribute', 'div', ['attributeName: title']], ['options', 'select', []],
    ] as const) {
      const binding = BindingFactory.createBinding(name, document.createElement(tag), 'name', [...args]);
      expect(binding.mode).toBe(BindingMode.OneWay);
      binding.dispose();
    }

  });

  it('uses the new decorator and model API through a real twoWay binding', () => {

    class Model extends ViewModel { @propertyChange() accessor name = 'initial'; }
    const model = new Model(), template = document.createElement('template');
    template.innerHTML = '<input data-bind="{value: name, mode: twoWay}"><span data-bind="{text: name}"></span>';
    const view = new View(template, model, undefined, { ownsDataContext: false });

    try {
      const input = view.viewNodeList[0] as HTMLInputElement;
      expect(model.hasRegisteredProperty('name')).toBe(true);
      expect('hasRegistredProperty' in model).toBe(false);
      expect('removeFromParentNodeList' in view).toBe(false);
      input.value = 'edited'; input.dispatchEvent(new Event('change'));
      expect(model.name).toBe('edited');
      model.setPropertyValueAndNotify('name', 'server');
      expect(input.value).toBe('server');

    } finally { 
      view.dispose(); 
      model.dispose(); 
    }

  });
  
});
