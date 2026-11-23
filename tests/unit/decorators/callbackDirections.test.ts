import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { View } from '@mvvm/view';
import { propertyChange, propertyAlias, validate } from '@mvvm/propertyDecorators';
import { own } from '../helpers/resources';

describe.each(['propertyChange', 'propertyAlias', 'validate', 'validate-first', 'propertyChange-first'])('%s callback contract', kind => {
  function fixture() {
    const order: string[] = [];
    const rule = vi.fn((value: unknown) => { order.push('validate'); return value !== 'invalid'; });

    const callback = vi.fn(function (this: ViewModel, value: unknown, name: string) {
      order.push('callback'); expect(this.getPropertyValue(name)).toBe(value);
    });

    class Base extends ViewModel { changed = callback; }
   
    class Reactive extends Base { @propertyChange('changed') accessor value = 'initial'; }
    
    class Alias extends Base { @propertyAlias('canonical', 'changed') accessor value = 'initial'; }
    
    class Validated extends Base { @validate(() => ({ isValid: rule }), 'changed') accessor value = 'initial'; }
    
    class ValidateFirst extends Base {
      @validate(() => ({ isValid: rule })) @propertyChange('changed') accessor value = 'initial';
    }
    class ChangeFirst extends Base {
      @propertyChange('changed') @validate(() => ({ isValid: rule })) accessor value = 'initial';
    }
    
    const Constructor = kind === 'propertyChange' ? Reactive : kind === 'propertyAlias' ? Alias
      : kind === 'validate' ? Validated : kind === 'validate-first' ? ValidateFirst : ChangeFirst;

    const model = own(new Constructor());

    const name = kind === 'propertyAlias' ? 'canonical' : 'value';
    const validated = kind !== 'propertyChange' && kind !== 'propertyAlias';

    expect(callback).not.toHaveBeenCalled();
    expect(rule).toHaveBeenCalledTimes(validated ? 1 : 0);
    const notify = vi.fn(); model.subscribeProperties(notify);
    const reset = () => { callback.mockClear(); rule.mockClear(); notify.mockClear(); order.length = 0; };
    reset();
    return { model, name, rule, callback, notify, reset, validated, order };
  }

  const operations = [
    { label: 'accessor assignment', callback: false, notify: true, write: (m: ViewModel & { value: string }, n: string, v: string) => { m.value = v; } },
    { label: 'setPropertyValue default', callback: true, notify: false, write: (m: ViewModel, n: string, v: string) => m.setPropertyValue(n, v) },
    { label: 'setPropertyValue disabled callback', callback: false, notify: false, write: (m: ViewModel, n: string, v: string) => m.setPropertyValue(n, v, false) },
    { label: 'setPropertyValueAndNotify default', callback: false, notify: true, write: (m: ViewModel, n: string, v: string) => m.setPropertyValueAndNotify(n, v) },
    { label: 'setPropertyValueAndNotify enabled callback', callback: true, notify: true, write: (m: ViewModel, n: string, v: string) => m.setPropertyValueAndNotify(n, v, true) },
    { label: 'setPropertyValueFromView', callback: true, notify: true, write: (m: ViewModel, n: string, v: string) => m.setPropertyValueFromView(n, v) },
  ];

  it.each(operations)('$label applies one logical write with documented effects', operation => {

    const f = fixture();

    for (const value of ['next', 'next']) {

      const sameViewValue = value === f.model.value && operation.label === 'setPropertyValueFromView';
      f.reset(); operation.write(f.model, f.name, value);
      expect(f.model.value).toBe(value); expect(f.model.getPropertyValue(f.name)).toBe(value);
      expect(f.rule).toHaveBeenCalledTimes(f.validated && !sameViewValue ? 1 : 0);
      expect(f.callback).toHaveBeenCalledTimes(operation.callback && !sameViewValue ? 1 : 0);
      expect(f.notify).toHaveBeenCalledTimes(operation.notify && !sameViewValue ? 1 : 0);

      if (operation.callback && !sameViewValue) {
        expect(f.callback).toHaveBeenCalledWith(value, f.name);
        expect(f.callback.mock.contexts[0]).toBe(f.model);
        expect(f.order).toEqual(f.validated ? ['validate', 'callback'] : ['callback']);
      }

    }

  });

  it('a real input write updates the accessor immediately and ignores identical repeated input', () => {

    const f = fixture();
    const template = document.createElement('template');
    template.innerHTML = `<input data-bind="{value: ${f.name}, mode: twoWay, triggerType: input}"><span data-bind="{text: ${f.name}}"></span>`;
    const view = own(new View(template, f.model)); document.body.append(...view.viewNodeList);
    const input = document.querySelector('input')!;
    expect(input.value).toBe('initial'); expect(f.callback).not.toHaveBeenCalled();
    f.reset(); input.value = 'from input'; input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(f.model.value).toBe('from input');
    expect(document.querySelector('span')!.innerText).toBe('from input');
    expect(f.callback).toHaveBeenCalledExactlyOnceWith('from input', f.name);
    expect(f.rule).toHaveBeenCalledTimes(f.validated ? 1 : 0); expect(f.notify).toHaveBeenCalledTimes(1);
    f.reset(); input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(f.callback).not.toHaveBeenCalled(); expect(f.rule).not.toHaveBeenCalled(); expect(f.notify).not.toHaveBeenCalled();

  });
  
});
