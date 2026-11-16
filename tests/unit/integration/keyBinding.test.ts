import { describe, expect, it, vi } from 'vitest';
import { CommandBindingFactory } from '@mvvm/commandBindingFactory';
import { Command } from '@mvvm/command';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { ViewModel } from '@mvvm/viewModel';
import { View } from '@mvvm/view';
import { own } from '../helpers/resources';
import { mounted, template } from '../helpers/views';

describe('keyboard command binding', () => {

  it('matches exact modifiers, alternatives and case; preserves sender, source and propagation', () => {

    const root = document.createElement('div');
    const child = document.createElement('input'); root.append(child);
    const binding = own(CommandBindingFactory.createCommandBinding('key', root, 'save', ['keys: Ctrl+S | Enter | ctrl+s']));
    const receive = vi.fn(); const other = vi.fn();
    binding.subscribe(receive); root.addEventListener('keydown', other);
    
    const send = (options: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options });
      child.dispatchEvent(event); return event;
    };

    const save = send({ key: 's', ctrlKey: true });
    expect(save.defaultPrevented).toBe(true);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive.mock.calls[0][0]).toMatchObject({ objectSender: root, sourceEvent: save, args: ['s', 'Ctrl'] });
    expect(save.target).toBe(child);
    expect(send({ key: 'S', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(send({ key: 's', metaKey: true }).defaultPrevented).toBe(false);
    expect(send({ key: 'enter' }).defaultPrevented).toBe(false);
    expect(send({ key: 'Enter' }).defaultPrevented).toBe(true);
    expect(receive).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledTimes(5);
    binding.dispose(); send({ key: 'Enter' });
    expect(receive).toHaveBeenCalledTimes(2);

  });

  it('passes modifiers in canonical order and supports Plus, Pipe and Space keys', () => {

    const node = document.createElement('div');

    const binding = own(CommandBindingFactory.createCommandBinding('key', node, 'save',
      ['keys: Meta+Shift+Alt+Ctrl+Plus | Pipe | Space']));

    const receive = vi.fn(); binding.subscribe(receive);
    node.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true }));
    node.dispatchEvent(new KeyboardEvent('keydown', { key: '|' }));
    node.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(receive.mock.calls.map(([event]) => event.args)).toEqual([['+', 'Ctrl', 'Alt', 'Shift', 'Meta'], ['|'], [' ']]);
  
  });

  it('matches non-ASCII letters without case sensitivity', () => {

    const node = document.createElement('div');
    const binding = own(CommandBindingFactory.createCommandBinding('key', node, 'save', ['keys: Ctrl+ą']));
    const receive = vi.fn(); binding.subscribe(receive);
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Ą', ctrlKey: true }));
    expect(receive.mock.calls[0][0].args).toEqual(['Ą', 'Ctrl']);

  });

  it('ignores repeat and composition by default, with explicit opt-ins and prevention control', () => {

    const node = document.createElement('div');
    const normal = own(CommandBindingFactory.createCommandBinding('key', node, 'a', ['keys: Enter']));
    const compatible = own(CommandBindingFactory.createCommandBinding('key', node, 'b',
      ['keys: Enter', 'allowRepeat: true', 'allowComposition: true', 'allowExtraModifiers: true', 'preventDefault: false']));
    const a = vi.fn(), b = vi.fn(); normal.subscribe(a); compatible.subscribe(b);
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, repeat: true, isComposing: true, cancelable: true });
    node.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); expect(a).not.toHaveBeenCalled();
    expect(b.mock.calls[0][0].args).toEqual(['Enter', 'Ctrl']);
    const repeat = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, cancelable: true });
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
    node.dispatchEvent(repeat); node.dispatchEvent(composing);
    expect(repeat.defaultPrevented).toBe(false); expect(composing.defaultPrevented).toBe(false);
    expect(a).not.toHaveBeenCalled(); expect(b).toHaveBeenCalledTimes(3);

  });

  it('keeps legacy enter behavior including IME, repeat, modifiers and empty args', () => {

    const node = document.createElement('div'), child = document.createElement('input'); node.append(child);
    const binding = own(CommandBindingFactory.createCommandBinding('enter', node, 'save', []));
    const receive = vi.fn(); binding.subscribe(receive);
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, repeat: true, isComposing: true, bubbles: true, cancelable: true });
    child.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(receive.mock.calls[0][0]).toMatchObject({ args: [], objectSender: node, sourceEvent: event });
    binding.dispose(); child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(receive).toHaveBeenCalledTimes(1);

  });

  it.each([
    [], ['keys:'], ['keys: Enter |'], ['keys: Ctrl++S'], ['keys: Ctrl+Ctrl+S'],
    ['keys: Ctrl'], ['keys: A+B'], ['keys: Enter', 'allowRepeat: yes'],
    ['keys: Enter', 'unknown: true']
  ])('rejects invalid configuration without installing listeners: %s', (...args: string[]) => {

    const node = document.createElement('div');
    const add = vi.spyOn(node, 'addEventListener');
    expect(() => CommandBindingFactory.createCommandBinding('key', node, 'save', args)).toThrow(/Key binding/);
    expect(add).not.toHaveBeenCalled();

  });

  it('preserves independent nested binding propagation', () => {

    const parent = document.createElement('div'), child = document.createElement('input'); parent.append(child);
    const outer = own(CommandBindingFactory.createCommandBinding('key', parent, 'outer', ['keys: Enter']));
    const inner = own(CommandBindingFactory.createCommandBinding('key', child, 'inner', ['keys: Enter']));
    const receive = vi.fn(); outer.subscribe(receive); inner.subscribe(receive);
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(receive.mock.calls.map(([event]) => event.commandName)).toEqual(['inner', 'outer']);

  });

  it('integrates live collection parameters, canExecute, multiple views and unmount', () => {

    const items = new CollectionObserver({ id: 1 });
    const model = own(new ViewModel()); model.registerProperties({ items, show: true });
    const received = vi.fn();
    model.registerCommand('select', new Command(cmd => received(cmd.commandData), undefined, { canExecute: id => id === 2 }));
    const html = '<section data-bind="{if: show}"><div data-bind="{collection: items}">' +
      '<input data-command="{key: select, keys: Ctrl+S, parameter: object.id}"></div></section>';
    const first = mounted(html, model), second = mounted(html, model);
    const input = first.host.querySelector('input')!;

    const fire = (target: HTMLElement) => {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
      target.dispatchEvent(event); return event;
    };

    expect(input.disabled).toBe(true);
    expect(fire(input).defaultPrevented).toBe(true); expect(received).not.toHaveBeenCalled();
    items[0].id = 2;
    expect(input.disabled).toBe(false);
    fire(input); fire(second.host.querySelector('input')!);
    expect(received.mock.calls.map(([data]) => [data.parameter, data.args])).toEqual([[2, ['s', 'Ctrl']], [2, ['s', 'Ctrl']]]);
    expect(Object.isFrozen(received.mock.calls[0][0].args)).toBe(true);
    model.setPropertyValueAndNotify('show', false); fire(input);
    expect(received).toHaveBeenCalledTimes(2);
    model.setPropertyValueAndNotify('show', true);
    model.setPropertyValueAndNotify('items', new CollectionObserver({ id: 2 }));
    fire(first.host.querySelector('input')!);
    expect(received).toHaveBeenCalledTimes(3);
    first.view.dispose(); second.view.dispose();

  });

  it('prevents matching shortcuts even without a command and rolls back on invalid configuration', () => {

    const model = own(new ViewModel());
    const { host } = mounted('<div data-command="{key: missing, keys: Enter}"></div>', model);
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    host.querySelector('div')!.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    expect(() => new View(template('<div data-command="{key: missing, keys: Enter |}"></div>'), model)).toThrow(/Key binding/);
  
  });

  it('handles command replacement and snapshots overlapping async key invocations', async () => {

    const model = own(new ViewModel());
    const received: Array<readonly string[]> = [];
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const first = new Command(async cmd => { await wait; received.push(cmd.commandData.args); });
    model.registerCommand('save', first);
    const { host } = mounted('<div data-command="{key: save, keys: Ctrl+S | Enter}"></div>', model);
    const node = host.querySelector('div')!;
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const replacement = vi.fn();
    model.registerCommand('save', new Command(replacement));
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(replacement).toHaveBeenCalledTimes(1);
    release(); await wait; await Promise.resolve();
    expect(received).toEqual([['s', 'Ctrl'], ['Enter']]);
    model.unregisterCommand('save');
    const missing = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }); node.dispatchEvent(missing);
    expect(missing.defaultPrevented).toBe(true);
    expect(replacement).toHaveBeenCalledTimes(1);

  });
  
});
