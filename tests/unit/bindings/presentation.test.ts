import { describe, expect, it, vi } from 'vitest';
import Class from '@mvvm/bindings/classBinding';
import Style from '@mvvm/bindings/styleBinding';
import Display from '@mvvm/bindings/displayBinding';
import Visibility from '@mvvm/bindings/visibilityBinding';
import BooleanAttribute from '@mvvm/bindings/booleanAttributeBinding';
import Radio from '@mvvm/bindings/radioBinding';
import ScrollTop from '@mvvm/bindings/scrollTopBinding';
import ScrollLeft from '@mvvm/bindings/scrollLeftBinding';
import Height from '@mvvm/bindings/heightBinding';
import Size from '@mvvm/bindings/sizeBinding';
import { own } from '../helpers/resources';
import { installResizeObserver } from '../helpers/resizeObserver';

describe('presentation bindings', () => {

  it('replaces only dynamic classes, tolerates whitespace and clears empty values', () => {

    const node = document.createElement('div'); node.className = 'static';
    const binding = own(new Class(node, 'state', []));

    binding.setValue(' active   highlighted ');
    expect([...node.classList].sort()).toEqual(['active', 'highlighted', 'static']);
    binding.setValue('disabled');
    expect([...node.classList].sort()).toEqual(['disabled', 'static']);
    binding.setValue(''); expect(node.className).toBe('static');

  });

  it('does not remove a preexisting static class when a dynamic value overlaps it', () => {

    const node = document.createElement('div'); node.className = 'static';
    const binding = own(new Class(node, 'state', []));

    binding.setValue('static active'); binding.setValue('');
    expect(node.className).toBe('static');

  });

  it('sets one style without overwriting unrelated styles and accepts zero', () => {

    const node = document.createElement('div'); node.style.color = 'red';
    const binding = own(new Style(node, 'opacity', ['styleName: opacity']));

    binding.setValue(0); expect(node.style.opacity).toBe('0');
    expect(node.style.color).toBe('red');
    binding.setValue(''); expect(node.style.opacity).toBe('');

  });

  it('replaces the whole inline style when styleName is omitted', () => {

    const node = document.createElement('div'); node.style.color = 'red';

    own(new Style(node, 'style', [])).setValue('display: flex; opacity: 0.5');
    expect(node.style.color).toBe(''); expect(node.style.display).toBe('flex');
    expect(node.style.opacity).toBe('0.5');

  });

  it('maps display booleans using configured values and accepts literal CSS', () => {

    const node = document.createElement('div');
    const binding = own(new Display(node, 'shown', ['trueVal: flex', 'falseVal: none']));

    binding.setValue(true); expect(node.style.display).toBe('flex');
    binding.setValue(false); expect(node.style.display).toBe('none');
    binding.setValue('grid'); expect(node.style.display).toBe('grid');
  });

  it('toggles visibility without changing display', () => {
    const node = document.createElement('div'); node.style.display = 'flex';
    const binding = own(new Visibility(node, 'shown', []));

    binding.setValue(false); expect(node.style.visibility).toBe('hidden');
    binding.setValue(true); expect(node.style.visibility).toBe('visible');

    expect(node.style.display).toBe('flex');
  });

  it.each(['disabled', 'readonly'])('uses presence semantics for boolean attribute %s', attribute => {

    const node = document.createElement('input');
    const binding = own(new BooleanAttribute(node, 'flag', [], attribute));

    binding.setValue(true); expect(node.hasAttribute(attribute)).toBe(true);

    for (const value of [false, null, undefined, 'false', 0]) {

      binding.setValue(value); expect(node.hasAttribute(attribute)).toBe(false);

    }

  });

});

describe('radio and scroll input contracts', () => {

  it('publishes only checked radio choices and stops after disposal', () => {

    const node = document.createElement('input'); node.type = 'radio'; node.value = 'choice';
    const binding = own(new Radio(node, 'choice', ['mode: twoWay']));
    const changed = vi.fn(); binding.subscribe(changed);

    binding.setValue('other'); expect(node.checked).toBe(false);
    node.dispatchEvent(new Event('change')); expect(changed).not.toHaveBeenCalled();
    binding.setValue('choice'); expect(node.checked).toBe(true);
    node.dispatchEvent(new Event('change'));
    expect(changed.mock.calls[0][0]).toMatchObject({ value: 'choice' });
    binding.dispose(); node.dispatchEvent(new Event('change'));
    expect(changed).toHaveBeenCalledTimes(1);

  });

  it('does not publish radio changes in oneWay mode', () => {

    const node = document.createElement('input'); node.type = 'radio'; node.checked = true;
    const binding = own(new Radio(node, 'choice', ['mode: oneWay']));
    const changed = vi.fn(); binding.subscribe(changed);
    node.dispatchEvent(new Event('change')); expect(changed).not.toHaveBeenCalled();

  });

  it.each([{ axis: 'scrollTop' as const, Binding: ScrollTop }, { axis: 'scrollLeft' as const, Binding: ScrollLeft }])
    ('$axis writes zero, publishes current position and removes its listener', ({ axis, Binding }) => {

      const node = document.createElement('div');
      const binding = own(new Binding(node, 'position', ['mode: twoWay']));
      binding.setValue(30); expect(node[axis]).toBe(30);
      binding.setValue(0); expect(node[axis]).toBe(0);
      const changed = vi.fn(); binding.subscribe(changed);
      node[axis] = 42; node.dispatchEvent(new Event('scroll'));
      expect(changed.mock.calls[0][0]).toMatchObject({ value: 42 });
      binding.dispose(); node.dispatchEvent(new Event('scroll'));
      expect(changed).toHaveBeenCalledTimes(1);

    });

});

describe('dimension bindings', () => {

  it('sets height with units, accepts CSS and clears an absent value', () => {

    const node = document.createElement('div');
    const binding = own(new Height(node, 'height', ['unit: rem']));
    binding.setValue(2); expect(node.style.height).toBe('2rem');
    binding.setValue('50%'); expect(node.style.height).toBe('50%');
    binding.setValue(null); expect(node.style.height).toBe('');

  });

  it('publishes height and disconnects the observer', () => {

    const observers = installResizeObserver(); const node = document.createElement('div');
    const binding = own(new Height(node, 'height', ['mode: twoWay']));
    const changed = vi.fn(); binding.subscribe(changed);

    observers[0].emit(node, 120, 60);
    expect(changed.mock.calls[0][0]).toMatchObject({ value: 60 });
    binding.dispose(); expect(observers[0].disconnect).toHaveBeenCalledTimes(1);

  });

  it('defines size as [width, height] in both directions', () => {

    const observers = installResizeObserver(); const node = document.createElement('div');
    const binding = own(new Size(node, 'size', ['mode: twoWay']));
    binding.setValue([120, 60]);
    expect([node.style.width, node.style.height]).toEqual(['120px', '60px']);

    const changed = vi.fn(); binding.subscribe(changed);
    observers[0].emit(node, 80, 40);
    expect(changed.mock.calls[0][0]).toMatchObject({ value: [80, 40] });
    binding.dispose(); expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    
  });
});
