import { describe, expect, it, vi } from 'vitest';
import { Command } from '@mvvm/command';
import { View } from '@mvvm/view';
import { BindingFactory } from '@mvvm/bindingFactory';
import { convert } from '@mvvm/valueConverter';
import { ViewModel } from '@mvvm/viewModel';
import { own } from '../helpers/resources';
import { mounted, template } from '../helpers/views';

describe('if - conditional rendering', () => {

  it('supports independently registered structural bindings on roots and nested templates', () => {

    const disposed = vi.fn();

    BindingFactory.registerStructuralBinding('testStatus', (fragment, property, args) => {
      expect(property).toBe('status');
      expect(args.map(arg => arg.trim())).toEqual(['active: active']);
      return {
        setValue(status) {
          if (status === 'active') fragment.mount();
          else fragment.unmount();
        },
        dispose: disposed
      };
    });

    class Model extends ViewModel {
      @convert('unregistered-test-converter') accessor status = '';
    }

    // A structural binding must never look up this presentation converter.
    const model = own(new Model());
    model.registerProperties({ status: 'inactive', visible: true });
    const { host, view } = mounted(
      '<button data-bind="{testStatus: status, active: active}"><b data-bind="{if: visible}"></b></button>', model);
    expect(host.querySelector('button')).toBeNull();
    model.setPropertyValueAndNotify('status', 'active');
    expect(host.querySelector('button b')).toBeTruthy();
    model.setPropertyValueAndNotify('status', 'inactive');
    expect(host.querySelector('button')).toBeNull();
    view.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(host.childNodes).toHaveLength(0);

  });

  it('mounts current data and releases commands on every unmount', () => {

    const model = own(new ViewModel());
    model.registerProperties({ show: false, label: 'old' });
    const clicked = vi.fn();
    model.registerCommand('run', new Command(clicked));
    const { host, view } = mounted(
      '<section><button data-bind="{if: show}" data-command="{click: run}">' +
      '<span data-bind="{text: label}"></span></button></section>', model);
    expect(host.querySelector('button')).toBeNull();
    model.setPropertyValueAndNotify('label', 'new');
    for (let cycle = 1; cycle <= 3; cycle++) {
      model.setPropertyValueAndNotify('show', true);
      const button = host.querySelector('button')!;
      expect(button.querySelector('span')!.innerText).toBe('new');
      model.setPropertyValueAndNotify('show', true);
      expect(host.querySelector('button')).toBe(button);
      button.click();
      model.setPropertyValueAndNotify('show', false);
      expect(host.querySelector('button')).toBeNull();
      button.click();
      expect(clicked).toHaveBeenCalledTimes(cycle);
    }
    view.dispose();
    model.setPropertyValueAndNotify('show', true);
    expect(host.childNodes).toHaveLength(0);

  });

  it('preserves root order and resolves nested conditions when remounted', () => {

    const model = own(new ViewModel());
    model.registerProperties({ outer: true, inner: false, label: 'ok' });
    const { host, view } = mounted(
      '<i></i><section data-bind="{if: outer}"><b data-bind="{if: inner}, {text: label}"></b></section><hr>', model);
    const first = host.firstElementChild, last = host.lastElementChild;
    expect(host.querySelector('section')).toBeTruthy();
    expect(host.querySelector('b')).toBeNull();
    view.detach();
    model.setPropertyValueAndNotify('outer', false);
    model.setPropertyValueAndNotify('inner', true);
    model.setPropertyValueAndNotify('outer', true);
    host.append(...view.viewNodeList);
    expect(host.querySelector('b')!.innerText).toBe('ok');
    expect(host.firstElementChild).toBe(first);
    expect(host.lastElementChild).toBe(last);
    expect(host.children).toHaveLength(3);
    view.dispose();
    expect(host.childNodes).toHaveLength(0);

  });

  it('restores validation and binds edited inputs before invoking their commands', () => {

    const model = own(new ViewModel());
    model.registerProperties({ show: false, name: '' });
    model.registerPropertyValidator('name', [{ isValid: v => v !== '', getMessage: () => 'Required' }]);
    const received: unknown[] = [];
    model.registerCommand('edited', new Command(() => received.push(model.getPropertyValue('name'))));
    const { host } = mounted('<section data-bind="{if: show}">' +
      '<input data-bind="{value: name, mode: twoWay, triggerType: input}" data-command="{input: edited}">' +
      '<span data-validate-error="{message: name}"></span></section>', model);
    model.validateProperty('name');
    model.setPropertyValueAndNotify('show', true);
    expect(host.querySelector('span')!.innerText).toBe('Required');
    const input = host.querySelector('input')!;
    input.value = 'Ada';
    input.dispatchEvent(new Event('input'));
    expect(received).toEqual(['Ada']);
    expect(host.querySelector('span')!.innerText).toBe('');

  });

  it('rejects duplicate conditions, binding arguments and non-boolean values', () => {

    const model = own(new ViewModel());
    model.registerProperty('show', 'false');

    for (const declaration of ['{if: show}', '{if: show, trueVal: flex}', '{if: show}{if: show}']) {
      expect(() => new View(template(`<div data-bind="${declaration}"></div>`), model)).toThrow(/if/);
    }

  });
  
});
