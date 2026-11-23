import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import { own } from '../helpers/resources';
import { mounted } from '../helpers/views';

describe('failure and lifecycle boundaries', () => {

  it.each(['register', 'unregister'] as const)('%s does not reconnect a view disposed by an earlier registry listener', operation => {

    const model = own(new ViewModel());
    const command = new Command(() => {});
    if (operation === 'unregister') model.registerCommand('save', command);
    let disposeView = () => {};
    const stop = model.subscribeCommands(() => disposeView());
    const { view, host } = mounted('<button data-command="{click: save}">Save</button>', model);

    disposeView = () => view.dispose();
    const survivor = mounted('<button data-command="{click: save}">Save</button>', model);
    const subscribe = vi.spyOn(command, 'subscribeCanExecuteChanged');

    if (operation === 'register') model.registerCommand('save', command);
    else model.unregisterCommand('save');

    expect(view.isDisposed).toBe(true);
    expect(host.childNodes).toHaveLength(0);
    expect(subscribe).toHaveBeenCalledTimes(operation === 'register' ? 1 : 0);
    expect(survivor.host.querySelector('button')!.disabled).toBe(operation === 'unregister');
    view.dispose();
    stop();

  });

  it('disposes the model during registry notification without enabling its view again', () => {

    const model = own(new ViewModel());
    model.subscribeCommands(() => model.dispose());

    const { host } = mounted('<button data-command="{click: save}">Save</button>', model);
    const execute = vi.fn();
    model.registerCommand('save', new Command(execute));
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(true);
    button.dispatchEvent(new Event('click'));
    expect(execute).not.toHaveBeenCalled();
    expect(model.getCommand('save')).toBeUndefined();
    expect(() => model.dispose()).not.toThrow();

  });

  it('normalizes a real input after a callback failure and accepts subsequent edits', () => {
    const model = own(new ViewModel());
    const failure = new Error('input callback');

    model.registerProperty('name', 'initial', value => {
      model.setPropertyValue('name', String(value).trim(), false);
      if (String(value).includes('fail')) throw failure;
    });

    const a = mounted('<input data-bind="{value: name, mode: twoWay, triggerType: input}">', model);
    const b = mounted('<input data-bind="{value: name}">', model);
    const input = a.host.querySelector('input')!;
    const errors: unknown[] = [];

    const onError = (event: ErrorEvent) => {

      if (event.error === failure) { errors.push(event.error); event.preventDefault(); }
    };
    window.addEventListener('error', onError);

    try {

      input.value = ' fail ';
      input.dispatchEvent(new Event('input'));
      expect(errors).toEqual([failure]);
      expect(input.value).toBe('fail');
      expect(b.host.querySelector('input')!.value).toBe('fail');
      input.value = ' next ';
      input.dispatchEvent(new Event('input'));
      expect(input.value).toBe('next');
      expect(b.host.querySelector('input')!.value).toBe('next');
      model.setPropertyValueAndNotify('name', 'server');
      expect(input.value).toBe('server');

    } finally { 
      window.removeEventListener('error', onError); 
    }

  });

  it('does not update or listen through a view disposed inside an input callback', () => {

    const model = own(new ViewModel());
    let disposeView = () => {};
    const callback = vi.fn(() => disposeView());
    model.registerProperty('name', 'old', callback);
    const a = mounted('<input data-bind="{value: name, mode: twoWay, triggerType: input}">', model);
    const b = mounted('<input data-bind="{value: name}">', model);
    disposeView = () => a.view.dispose();
    const input = a.host.querySelector('input')!;
    input.value = 'new'; input.dispatchEvent(new Event('input'));
    expect(a.host.childNodes).toHaveLength(0);
    expect(b.host.querySelector('input')!.value).toBe('new');
    input.value = 'detached'; input.dispatchEvent(new Event('input'));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(model.getPropertyValue('name')).toBe('new');
    model.setPropertyValueAndNotify('name', 'server');
    expect(input.value).toBe('detached');
    expect(b.host.querySelector('input')!.value).toBe('server');

  });
  
});
