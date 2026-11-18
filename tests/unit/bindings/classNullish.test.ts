import { describe, expect, it } from 'vitest';
import ClassBinding from '@mvvm/bindings/classBinding';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';

describe('class binding empty-value contract', () => {

  it.each([null, undefined, ''])('clears dynamic classes for %s and accepts subsequent updates', empty => {

    const node = document.createElement('div');
    node.className = 'static shared';
    const binding = own(new ClassBinding(node, 'state', []));
    
    binding.setValue(' shared active selected active ');
    expect([...node.classList].sort()).toEqual(['active', 'selected', 'shared', 'static']);

    node.classList.add('external');
    binding.setValue(empty);
    expect([...node.classList].sort()).toEqual(['external', 'shared', 'static']);

    binding.setValue(empty);
    expect([...node.classList].sort()).toEqual(['external', 'shared', 'static']);

    binding.setValue('ready');
    expect([...node.classList].sort()).toEqual(['external', 'ready', 'shared', 'static']);

  });

  it.each([{ value: 0 }, { value: false }, { value: {} }, { value: ['other'] }])('ignores unsupported input $value without losing the previous dynamic classes', ({ value }) => {

    const node = document.createElement('div');
    node.className = 'static';
    const binding = own(new ClassBinding(node, 'state', []));

    binding.setValue('active');
    binding.setValue(value);

    expect([...node.classList].sort()).toEqual(['active', 'static']);
    binding.setValue(null);
    expect(node.className).toBe('static');

  });

  it.each([null, undefined])('preserves template classes on first render with %s and updates through ViewModel', empty => {

    const model = own(new ViewModel());
    model.registerProperty('state', empty);

    const template = document.createElement('template');
    template.innerHTML = '<div class="static" data-bind="{class: state}"></div>';
    const view = own(new View(template, model));

    document.body.append(...view.viewNodeList);
    const node = document.body.querySelector('div.static')!;
    expect(node.className).toBe('static');

    model.setPropertyValueAndNotify('state', 'active');
    expect([...node.classList].sort()).toEqual(['active', 'static']);
    model.setPropertyValueAndNotify('state', empty);
    expect(node.className).toBe('static');
    model.setPropertyValueAndNotify('state', 'ready');
    expect([...node.classList].sort()).toEqual(['ready', 'static']);

  });
  
});
