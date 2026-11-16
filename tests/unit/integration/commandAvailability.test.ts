import { describe, expect, it, vi } from 'vitest';
import { Command } from '@mvvm/command';
import { CommandActionEvent } from '@mvvm/commandActionEvent';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { ViewModel } from '@mvvm/viewModel';
import { View } from '@mvvm/view';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import { own } from '../helpers/resources';
import { mounted, template } from '../helpers/views';

describe('command availability and parameters', () => {

  it('passes current row parameters and updates each row independently', () => {

    const items = new CollectionObserver({ id: 1 }, { id: 2 });
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const received: unknown[] = [];
    let threshold = 1;

    const action = new Command(cmd => received.push(cmd.commandData.parameter), undefined, {
      canExecute: value => typeof value === 'number' && value > threshold
    });

    model.registerCommand('select', action);
    const { host } = mounted('<button data-bind="{collection: items}" data-command="{click: select, parameter: object.id}">{{object.id}}</button>', model);
    const buttons = host.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    buttons[1].click();
    items[0].id = 3;
    expect(buttons[0].disabled).toBe(false);
    buttons[0].click();
    threshold = 3;
    action.notifyCanExecuteChanged();
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
    expect(received).toEqual([2, 3]);

  });

  it('combines disabled binding, multiple commands, and registry replacement', () => {

    const model = own(new ViewModel());
    model.registerProperty('blocked', false);
    let allowed = true;
    const first = new Command(() => {}, undefined, { canExecute: () => allowed });
    model.registerCommand('a', first);
    const { host, view } = mounted('<button disabled data-bind="{disabled: blocked}" data-command="{click: a}, {input: b}"></button>', model);
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(true);
    model.registerCommand('b', new Command(() => {}));
    expect(button.disabled).toBe(false);
    model.setPropertyValueAndNotify('blocked', true);
    expect(button.disabled).toBe(true);
    allowed = false;
    first.notifyCanExecuteChanged();
    model.setPropertyValueAndNotify('blocked', false);
    expect(button.disabled).toBe(true);
    model.registerCommand('a', new Command(() => {}));
    expect(button.disabled).toBe(false);
    first.notifyCanExecuteChanged();
    expect(button.disabled).toBe(false);
    model.unregisterCommand('a');
    expect(button.disabled).toBe(true);
    view.dispose();

  });

  it('blocks direct and reentrant calls during opt-in async execution', async () => {

    const changed: boolean[] = [];
    let finish!: () => void;
    let calls = 0;
    const event = new CommandActionEvent('command-action', 'save', {}, new Event('click'), [], 'id');
    const action = new Command(() => {
      calls++;
      action.execute(event);
      return new Promise<void>(resolve => { finish = resolve; });
    }, undefined, { blockWhileExecuting: true });
    action.subscribeCanExecuteChanged(() => changed.push(action.canExecute()));
    const pending = action.execute(event);
    expect(calls).toBe(1);
    expect(action.canExecute()).toBe(false);
    finish();
    await pending;
    expect(changed).toEqual([false, true]);
    expect(action.commandData.parameter).toBe('id');

  });

  it('supports decorated predicates with instance private state', () => {

    @autoRegisterCommands()
    class Model extends ViewModel {
      #allowed = false;
      @command<Model>('run', { canExecute(this: Model) { return this.#allowed; } })
      run() {}
      enable() { this.#allowed = true; this.getCommand('run')!.notifyCanExecuteChanged?.(); }
    }

    const model = own(new Model());
    const { host } = mounted('<button data-command="{click: run}"></button>', model);
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(true);
    model.enable();
    expect(button.disabled).toBe(false);

  });

  it('rejects expression parameters and preserves native submit prevention', () => {

    const model = own(new ViewModel());
    expect(() => new View(template('<button data-command="{click: run, parameter: object.id()}"></button>'), model)).toThrow(/parameter/);
    const run = vi.fn();
    model.registerCommand('run', new Command(run, undefined, { canExecute: () => false }));
    const { host } = mounted('<form data-command="{submit: run}"></form>', model);
    const event = new Event('submit', { cancelable: true });
    host.querySelector('form')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(run).not.toHaveBeenCalled();

  });

  it('updates parent scope parameters and stops reacting after unmount', () => {

    const items = new CollectionObserver({ id: 1, children: new CollectionObserver({ id: 8 }) });
    const model = own(new ViewModel());
    model.registerProperties({ items, show: true });
    const received = vi.fn();

    const action = new Command(cmd => received(cmd.commandData.parameter), undefined, {
      canExecute: parameter => parameter === 2
    });

    model.registerCommand('select', action);
    const { host } = mounted('<section data-bind="{if: show}"><div data-bind="{collection: items}">' +
      '<button data-bind="{collection: object.children}" data-command="{click: select, parameter: parent.id}"></button>' +
      '</div></section>', model);
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(true);
    items[0].id = 2;
    expect(button.disabled).toBe(false);
    button.click();
    expect(received).toHaveBeenCalledWith(2);
    model.setPropertyValueAndNotify('show', false);
    items[0].id = 1;
    button.click();
    expect(received).toHaveBeenCalledTimes(1);
    model.setPropertyValueAndNotify('show', true);
    expect(host.querySelector('button')!.disabled).toBe(true);

  });

  it('takes a shallow invocation snapshot through overlapping async callbacks', async () => {

    const result: unknown[] = [];
    const action = new Command(async cmd => {
      await Promise.resolve();
      result.push(cmd.commandData.parameter);
    });

    const first = { id: 1 };
    const a = action.execute(new CommandActionEvent('command-action', 'run', {}, new Event('click'), [], first));
    const b = action.execute(new CommandActionEvent('command-action', 'run', {}, new Event('click'), [], 2));
    await Promise.all([a, b]);
    expect(result).toEqual([first, 2]);
    expect(Object.isFrozen(first)).toBe(false);

  });

  it('refreshes predicates depending on whole object parameters', () => {

    const items = new CollectionObserver({ enabled: false });
    const model = own(new ViewModel());
    model.registerProperty('items', items);

    model.registerCommand('run', new Command(() => {}, undefined, {
      canExecute: value => !!value && typeof value === 'object' && 'enabled' in value && value.enabled === true
    }));

    const { host } = mounted('<button data-bind="{collection: items}" data-command="{click: run, parameter: object}"></button>', model);
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(true);
    items[0].enabled = true;
    expect(button.disabled).toBe(false);

  });

  it('refreshes object-valued nested parameters when their contents change', () => {

    const items = new CollectionObserver({ child: { enabled: false } });
    const model = own(new ViewModel());
    model.registerProperty('items', items);

    model.registerCommand('run', new Command(() => {}, undefined, {
      canExecute: value => !!value && typeof value === 'object' && 'enabled' in value && value.enabled === true
    }));

    const { host } = mounted('<button data-bind="{collection: items}" data-command="{click: run, parameter: object.child}"></button>', model);
    expect(host.querySelector('button')!.disabled).toBe(true);
    items[0].child.enabled = true;
    expect(host.querySelector('button')!.disabled).toBe(false);

  });

  it('updates the parameter before executing an input command', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', 'old');
    const received = vi.fn();
    model.registerCommand('changed', new Command(cmd => received(cmd.commandData.parameter)));
    const { host } = mounted('<input data-bind="{value: name, mode: twoWay, triggerType: input}" ' +
      'data-command="{input: changed, parameter: name}">', model);
    const input = host.querySelector('input')!;
    input.value = 'new';
    input.dispatchEvent(new Event('input'));
    expect(received).toHaveBeenCalledWith('new');

  });

  it('restores availability after async failure and preserves static disabled', async () => {
    const model = own(new ViewModel());
    const failure = new Error('failure');
    let reject!: (error: Error) => void;

    const action = new Command(() => new Promise<void>((_, fail) => { reject = fail; }), () => {}, {
      blockWhileExecuting: true
    });

    model.registerCommand('run', action);
    const { host } = mounted('<button data-command="{click: run}"></button>' +
      '<button disabled data-command="{click: run}"></button>', model);
    const [active, fixed] = host.querySelectorAll('button');
    active.click();
    expect(active.disabled).toBe(true);
    expect(fixed.disabled).toBe(true);
    reject(failure);
    await vi.waitFor(() => expect(active.disabled).toBe(false));
    expect(fixed.disabled).toBe(true);

  });

  it('surfaces a predicate failure for direct execution', () => {

    const error = new Error('predicate');
    const action = new Command(() => {}, undefined, { canExecute: () => { throw error; } });
    expect(() => action.execute(new CommandActionEvent('command-action', 'run', {}, new Event('click'), []))).toThrow(error);
    expect(action.isExecuting).toBe(false);

  });

  it('keeps mouse event args independent of the model parameter', () => {

    const model = own(new ViewModel());
    model.registerProperty('id', 42);
    const seen = vi.fn();
    model.registerCommand('hover', new Command(cmd => seen(cmd.commandData.args, cmd.commandData.parameter)));
    const { host } = mounted('<div data-command="{mouseInOut: hover, parameter: id}"></div>', model);
    const element = host.querySelector('div')!;
    element.dispatchEvent(new Event('mouseenter'));
    element.dispatchEvent(new Event('mouseleave'));
    expect(seen.mock.calls).toEqual([[['mouseIn'], 42], [['mouseOut'], 42]]);

  });

  it('releases command subscriptions after dispose', () => {

    const model = own(new ViewModel());
    const action = new Command(() => {});
    const off = vi.fn();
    const subscribe = vi.spyOn(action, 'subscribeCanExecuteChanged').mockImplementation(() => off);
    model.registerCommand('run', action);
    const { view } = mounted('<button data-command="{click: run}"></button>', model);
    expect(subscribe).toHaveBeenCalledTimes(1);
    view.dispose();
    expect(off).toHaveBeenCalledTimes(1);
    model.registerCommand('run', new Command(() => {}));
    expect(subscribe).toHaveBeenCalledTimes(1);

  });
  
});
