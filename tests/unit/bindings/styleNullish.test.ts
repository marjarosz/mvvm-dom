import { describe, expect, it } from 'vitest';
import StyleBinding from '@mvvm/bindings/styleBinding';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';

describe('style binding empty-value contract', () => {

  it.each([null, undefined, ''])('clears only the named property for %s and accepts subsequent values', empty => {

    const node = document.createElement('div');
    node.style.cssText = 'color: red; display: flex; opacity: 0.5';
    const binding = own(new StyleBinding(node, 'color', ['styleName: color']));
    binding.setValue('blue');
    expect(node.style.color).toBe('blue');
    binding.setValue(empty);
    expect(node.style.color).toBe('');
    expect(node.style.display).toBe('flex');
    expect(node.style.opacity).toBe('0.5');
    binding.setValue(empty);
    expect(node.style.color).toBe('');
    binding.setValue('green');
    expect(node.style.color).toBe('green');
    expect(node.style.display).toBe('flex');

  });

  it.each([null, undefined, ''])('clears the whole inline style for %s while retaining the attribute', empty => {

    const node = document.createElement('div');
    node.style.color = 'red';
    const binding = own(new StyleBinding(node, 'style', []));
    binding.setValue('display: flex; opacity: 0.5');
    expect(node.style.display).toBe('flex');
    binding.setValue(empty);
    expect(node.style.cssText).toBe('');
    expect(node.hasAttribute('style')).toBe(true);
    expect(node.getAttribute('style')).toBe('');
    binding.setValue(empty);
    expect(node.getAttribute('style')).toBe('');
    binding.setValue('color: blue');
    expect(node.style.color).toBe('blue');
    expect(node.style.display).toBe('');

  });

  it.each([null, undefined])('clears a CSS custom property for %s without changing other declarations', empty => {

    const node = document.createElement('div');
    node.style.color = 'red';
    const binding = own(new StyleBinding(node, 'gap', ['styleName: --gap']));
    binding.setValue('8px');
    binding.setValue(empty);
    expect(node.style.getPropertyValue('--gap')).toBe('');
    expect(node.style.color).toBe('red');

  });

  for (const named of [true, false]) {

    it.each([null, undefined])(`clears template inline styles on first render (named=${named}, value=%s)`, empty => {

      const model = own(new ViewModel());
      model.registerProperty('styleValue', empty);
      model.registerProperty('shown', true);
      const template = document.createElement('template');

      template.innerHTML = named
        ? '<div id="styled" style="color: red" data-bind="{display: shown, trueVal: flex}, {style: styleValue, styleName: color}"></div>'
        : '<div id="styled" style="color: red; display: flex" data-bind="{style: styleValue}"></div>';

      const view = own(new View(template, model));
      document.body.append(...view.viewNodeList);
      const node = document.getElementById('styled')!;
      expect(node.style.color).toBe('');
      expect(node.style.display).toBe(named ? 'flex' : '');

      if (!named) expect(node.getAttribute('style')).toBe('');
      
      model.setPropertyValueAndNotify('styleValue', named ? 'blue' : 'color: blue');
      expect(node.style.color).toBe('blue');
      model.setPropertyValueAndNotify('styleValue', empty);
      expect(node.style.color).toBe('');
      expect(node.style.display).toBe(named ? 'flex' : '');

    });
  }

  it.each([{ value: false }, { value: {} }, { value: ['color: blue'] }])('continues to ignore unsupported input $value', ({ value }) => {

    const node = document.createElement('div');
    const binding = own(new StyleBinding(node, 'color', ['styleName: color']));
    binding.setValue('red');
    binding.setValue(value);
    expect(node.style.color).toBe('red');

  });

});
