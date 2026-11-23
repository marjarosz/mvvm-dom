import { describe, expect, it } from 'vitest';
import Display from '@mvvm/bindings/displayBinding';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';

describe('display nullish contract', () => {

  it.each([null, undefined])('uses falseVal for %s and preserves unrelated styles', empty => {

    for (const args of [[], ['trueVal: flex', 'falseVal: inline-flex'], ['falseVal: ']]) {

      const node = document.createElement('div');
      node.style.opacity = '0.5';
      const binding = own(new Display(node, 'shown', args));
      binding.setValue(true);
      expect(node.style.display).toBe(args.length === 2 ? 'flex' : 'block');
      binding.setValue(empty);
      const expected = args.length === 2 ? 'inline-flex' : args.length ? '' : 'none';
      expect(node.style.display).toBe(expected);
      expect(node.style.opacity).toBe('0.5');
      binding.setValue(empty);
      expect(node.style.display).toBe(expected);
      binding.setValue('');
      expect(node.style.display).toBe('');
      binding.setValue('grid');
      expect(node.style.display).toBe('grid');
      binding.setValue(empty);
      expect(node.style.display).toBe(expected);
      binding.setValue(true);
      expect(node.style.display).toBe(args.length === 2 ? 'flex' : 'block');

    }

  });

  it.each([null, undefined])('applies falseVal on the first View render for %s', empty => {

    const model = own(new ViewModel());
    model.registerProperties({ shown: empty, opacity: 0.35 });
    const template = document.createElement('template');
    template.innerHTML = '<div id="panel" style="display: flex; color: red" data-bind="{style: opacity, styleName: opacity}, {display: shown}"></div>';
    const view = own(new View(template, model));
    document.body.append(...view.viewNodeList);
    const node = document.getElementById('panel')!;
    expect(node.style.display).toBe('none');
    expect(node.style.color).toBe('red');
    expect(node.style.opacity).toBe('0.35');
    model.setPropertyValueAndNotify('shown', true);
    expect(node.style.display).toBe('block');
    model.setPropertyValueAndNotify('shown', empty);
    expect(node.style.display).toBe('none');
    expect(node.style.opacity).toBe('0.35');

  });

  it.each([{ value: 0 }, { value: 1 }, { value: {} }, { value: ['none'] }])('continues ignoring unsupported input $value', ({ value }) => {

    const node = document.createElement('div');
    const binding = own(new Display(node, 'shown', []));
    binding.setValue('flex');
    binding.setValue(value);
    expect(node.style.display).toBe('flex');

  });
  
});
