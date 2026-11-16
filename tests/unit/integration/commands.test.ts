import { describe, expect, it, vi } from 'vitest';
import { CommandBindingFactory } from '@mvvm/commandBindingFactory';
import type { CommandActionEvent } from '@mvvm/commandActionEvent';
import { own } from '../helpers/resources';

describe('DOM command contracts', () => {

  it.each(['click', 'change', 'input', 'focusout', 'animationend', 'mousedown', 'mouseup', 'mousemove', 'ready', 'dragleave', 'dragover', 'drop', 'submit'])
    ('delivers %s with its source event, preserves other listeners and tears down', type => {

      const node = document.createElement('div'); document.body.append(node);
      const binding = own(CommandBindingFactory.createCommandBinding(type, node, 'action', []));
      const receive = vi.fn(); binding.subscribe(receive);
      const other = vi.fn(); node.addEventListener(type, other);
      const event = new Event(type, { bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      expect(receive).toHaveBeenCalledTimes(1);
      expect(receive.mock.calls[0][0]).toMatchObject({ commandName: 'action', sourceEvent: event, objectSender: node });
      expect(other).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(['dragover', 'drop', 'submit'].includes(type));
      binding.dispose(); node.dispatchEvent(new Event(type));
      expect(receive).toHaveBeenCalledTimes(1);

    });

  it('uses the bound element as sender while preserving the clicked child as target', () => {

    const button = document.createElement('button'); const icon = document.createElement('span'); button.append(icon);
    const binding = own(CommandBindingFactory.createCommandBinding('click', button, 'save', []));
    const events: CommandActionEvent[] = []; binding.subscribe(event => events.push(event as CommandActionEvent));
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(events[0].objectSender).toBe(button); expect(events[0].sourceEvent.target).toBe(icon);

  });

  it('executes Enter once, ignores other keys and removes the key listener', () => {

    const node = document.createElement('input');
    const binding = own(CommandBindingFactory.createCommandBinding('enter', node, 'save', []));
    const receive = vi.fn(); binding.subscribe(receive);
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(receive).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }); node.dispatchEvent(enter);
    expect(receive).toHaveBeenCalledTimes(1); expect(enter.defaultPrevented).toBe(true);
    binding.dispose(); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(receive).toHaveBeenCalledTimes(1);

  });

  it.each(['mouseIn', 'mouseOut', 'both'])('respects mouseInOut trigger %s', trigger => {

    const node = document.createElement('div');
    const binding = own(CommandBindingFactory.createCommandBinding('mouseInOut', node, 'hover', [`trigger: ${trigger}`]));
    const receive = vi.fn(); binding.subscribe(receive);
    node.dispatchEvent(new MouseEvent('mouseenter')); node.dispatchEvent(new MouseEvent('mouseleave'));
    const expected = trigger === 'both' ? ['mouseIn', 'mouseOut'] : [trigger];
    expect(receive.mock.calls.map(([event]) => event.args[0])).toEqual(expected);
    binding.dispose(); node.dispatchEvent(new MouseEvent('mouseenter')); node.dispatchEvent(new MouseEvent('mouseleave'));
    expect(receive).toHaveBeenCalledTimes(expected.length);

  });

  it('preserves the drop payload on the original source event', () => {

    const node = document.createElement('div');
    const binding = own(CommandBindingFactory.createCommandBinding('drop', node, 'upload', []));
    const receive = vi.fn(); binding.subscribe(receive);
    // jsdom tests forwarding only; native DataTransfer is tested in Chromium.
    const payload = { files: [new File(['content'], 'sample.txt')] };
    const event = new Event('drop', { cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: payload }); node.dispatchEvent(event);
    expect(receive.mock.calls[0][0].sourceEvent.dataTransfer).toBe(payload);

  });
  
});
