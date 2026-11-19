import { describe, expect, it } from 'vitest';
import { BindingFactory } from '@mvvm/bindingFactory';
import { BindingFragment } from '@mvvm/bindingFragment';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { cleanup, own } from '../helpers/resources';

// C1-C4 have dedicated class/style/display/radio nullish suites. This matrix
// covers the remaining contracts, including recovery after an empty value.
describe.each([null, undefined, ''])('remaining binding empty-value contracts: %s', empty => {

  it.each(['text', 'value', 'innerHTML', 'interpolate'])('%s clears stale text and renders the next value', type => {

    const node = type === 'value' ? document.createElement('input') : document.createElement('div');
    if (type === 'interpolate') node.textContent = '{{value}}';
    const binding = own(BindingFactory.createBinding(type, node, 'value', []));
    const read = () => type === 'value' ? (node as HTMLInputElement).value
      : type === 'text' ? node.innerText : node.textContent;
    binding.setValue('before'); expect(read()).toBe('before');
    binding.setValue(empty); expect(read()).toBe('');
    binding.setValue(empty); expect(read()).toBe('');
    binding.setValue('after'); expect(read()).toBe('after');

  });

  it('attribute distinguishes absence from a present empty value', () => {

    const node = document.createElement('div');
    node.setAttribute('data-unrelated', 'keep');
    const binding = own(BindingFactory.createBinding('attribute', node, 'value', ['attributeName: title']));
    binding.setValue('before'); expect(node.getAttribute('title')).toBe('before');
    binding.setValue(empty);
    expect(node.getAttribute('title')).toBe(empty === '' ? '' : null);
    expect(node.getAttribute('data-unrelated')).toBe('keep');
    binding.setValue('after'); expect(node.getAttribute('title')).toBe('after');

  });

  it.each(['height', 'width', 'size'])('%s clears only its dimensions', type => {

    const node = document.createElement('div'); node.style.color = 'red';
    const binding = own(BindingFactory.createBinding(type, node, 'value', ['mode: oneWay']));
    const dimensions = type === 'size' ? ['width', 'height'] : [type];
    binding.setValue(type === 'size' ? [24, 24] : 24);
    for (const name of dimensions) expect(node.style.getPropertyValue(name)).toBe('24px');
    binding.setValue(empty);
    for (const name of dimensions) expect(node.style.getPropertyValue(name)).toBe('');
    expect(node.style.color).toBe('red');
    binding.setValue(type === 'size' ? [48, 48] : 48);
    for (const name of dimensions) expect(node.style.getPropertyValue(name)).toBe('48px');

  });

  it.each(['scrollTop', 'scrollLeft'] as const)('%s preserves position until a number is supplied', type => {

    const node = document.createElement('div');
    const binding = own(BindingFactory.createBinding(type, node, 'value', ['mode: oneWay']));
    binding.setValue(37); expect(node[type]).toBe(37);
    binding.setValue(empty); expect(node[type]).toBe(37);
    binding.setValue(0); expect(node[type]).toBe(0);

  });

  it.each(['visibility', 'checked', 'readonly', 'disabled'])('%s resets its own boolean state', type => {

    const node = document.createElement('input'); node.type = 'checkbox';
    const binding = own(BindingFactory.createBinding(type, node, 'value', []));
    const read = () => type === 'visibility' ? node.style.visibility === 'visible'
      : type === 'checked' ? node.checked : node.hasAttribute(type);
    binding.setValue(true); expect(read()).toBe(true);
    binding.setValue(empty); expect(read()).toBe(false);
    binding.setValue(true); expect(read()).toBe(true);

  });

  it.each(['options', 'selectedValues'])('%s rejects invalid empty input without losing options or selection', type => {

    const node = document.createElement('select'); node.multiple = true;
    node.innerHTML = '<option value="">Empty</option><option value="a" selected>A</option>';
    const binding = own(BindingFactory.createBinding(type, node, 'value', ['mode: oneWay']));
    const options = Array.from(node.options);
    expect(() => binding.setValue(empty)).toThrow(TypeError);
    expect(Array.from(node.options)).toEqual(options);
    expect(Array.from(node.selectedOptions, option => option.value)).toEqual(['a']);
    binding.setValue(type === 'options' ? [{ value: '', label: 'Empty', isSelected: true }] : ['']);
    expect(Array.from(node.selectedOptions, option => option.value)).toEqual(['']);
    binding.setValue([]);
    expect(node.selectedOptions).toHaveLength(0);
    expect(node.options).toHaveLength(type === 'options' ? 0 : 2);

  });

  it.each(['if', 'collection'])('%s clears fragments for nullish but rejects empty strings atomically', type => {

    const host = document.createElement('div');
    const anchor = document.createComment('rows'); host.append(anchor);
    let disposed = 0;
    const fragment = own(new BindingFragment(anchor, () => {
      const row = document.createElement('span'); row.textContent = 'row';
      return { viewNodeList: [row], dispose() { disposed++; row.remove(); } };
    }, undefined));
    const binding = BindingFactory.getStructuralBindingFactory(type)!(fragment, 'value', []);
    cleanup(() => binding.dispose?.());
    const populated = type === 'if' ? true : [{ id: 1 }];
    binding.setValue(populated); expect(host.querySelectorAll('span')).toHaveLength(1);
    const original = host.querySelector('span');

    if (empty === '') {

      expect(() => binding.setValue(empty)).toThrow(TypeError);
      expect(host.querySelector('span')).toBe(original); expect(disposed).toBe(0);

    } else {

      binding.setValue(empty); expect(host.querySelectorAll('span')).toHaveLength(0);
      expect(disposed).toBe(1);
      binding.setValue(empty); expect(disposed).toBe(1);
      binding.setValue(populated); expect(host.querySelectorAll('span')).toHaveLength(1);
      expect(host.querySelector('span')).not.toBe(original);

    }

  });

});

it.each([null, undefined])('structural View first render with %s can later render bound content', empty => {

  const model = own(new ViewModel()); model.registerProperties({ shown: empty, rows: empty, title: 'Ready' });
  const template = document.createElement('template');
  template.innerHTML = '<section><b data-bind="{if: shown}, {text: title}"></b><i data-bind="{collection: rows}">{{object.name}}</i></section>';
  const view = own(new View(template, model)); document.body.append(...view.viewNodeList);
  expect(document.querySelector('b')).toBeNull(); expect(document.querySelector('i')).toBeNull();
  model.setPropertyValueAndNotify('shown', true);
  model.setPropertyValueAndNotify('rows', [{ name: 'Row' }]);
  expect(document.querySelector('b')!.innerText).toBe('Ready');
  expect(document.querySelector('i')!.textContent).toBe('Row');
  model.setPropertyValueAndNotify('shown', empty); model.setPropertyValueAndNotify('rows', empty);
  expect(document.querySelector('b')).toBeNull(); expect(document.querySelector('i')).toBeNull();
  
});
