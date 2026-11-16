import { describe, expect, it, vi } from 'vitest';
import { Command } from '@mvvm/command';
import { ViewModel } from '@mvvm/viewModel';
import { convert, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import { cleanup, own } from '../helpers/resources';
import { mounted } from '../helpers/views';

describe('View - end-to-end data directions', () => {

  it('keeps tokens inside model values literal while initializing multiple interpolations', () => {

    const model = own(new ViewModel());
    model.registerProperties({ first: '{{second}}', second: 'B' });
    const { host } = mounted('<span data-bind="{interpolate: first}{interpolate: second}">{{first}} / {{second}}</span>', model);
    expect(host.textContent).toBe('{{second}} / B');
    model.setPropertyValueAndNotify('second', 'C');
    expect(host.textContent).toBe('{{second}} / C');
    model.setPropertyValueAndNotify('first', 'A');
    expect(host.textContent).toBe('A / C');

  });

  it.each(['oneWay', 'oneWayToSource', 'twoWay'])('respects %s for initialization and subsequent changes', direction => {

    const model = own(new ViewModel());
    model.registerProperty('name', 'model');
    const { host } = mounted(`<input value="template" data-bind="{value: name, mode: ${direction}, triggerType: input}">`, model);
    const input = host.querySelector('input')!;
    expect(input.value).toBe(direction === 'oneWayToSource' ? 'template' : 'model');
    model.setPropertyValueAndNotify('name', 'server');
    expect(input.value).toBe(direction === 'oneWayToSource' ? 'template' : 'server');
    input.value = 'user'; input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(model.getPropertyValue('name')).toBe(direction === 'oneWay' ? 'server' : 'user');

  });

  it('updates all recipients, including another View, after a user edit', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', 'initial');
    const validate = vi.fn(() => true);
    model.registerPropertyValidator('name', [{ isValid: validate }]);
    const write = vi.spyOn(model, 'setPropertyValue');
    const changed = vi.fn();
    model.subscribeProperties(changed);
    const a = mounted('<input data-bind="{value: name, mode: twoWay, triggerType: input}"><input data-bind="{value: name}">', model);
    const b = mounted('<input data-bind="{value: name}"><span data-bind="{text: name}"></span>', model);
    const fields = a.host.querySelectorAll('input');
    fields[0].focus();
    fields[0].value = 'changed';
    fields[0].setSelectionRange(2, 4);
    fields[0].dispatchEvent(new Event('input', { bubbles: true }));
    fields[0].dispatchEvent(new Event('input'));
    expect(document.activeElement).toBe(fields[0]);
    expect([fields[0].selectionStart, fields[0].selectionEnd]).toEqual([2, 4]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(b.host.querySelector('span')!.innerText).toBe('changed');
    expect(model.getPropertyValue('name')).toBe('changed');
    expect(fields[1].value).toBe('changed');
    expect(b.host.querySelector('input')!.value).toBe('changed');

  });

  it('publishes the final normalized value once, including to the originating input', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', '', value => model.setPropertyValueAndNotify('name', String(value).trim()));
    const changed = vi.fn();
    model.subscribeProperties(changed);
    const { host } = mounted('<input data-bind="{value: name, mode: twoWay, triggerType: input}"><span data-bind="{text: name}"></span>', model);
    const input = host.querySelector('input')!;
    input.value = ' Ada ';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('Ada');
    expect(host.querySelector('span')!.innerText).toBe('Ada');
    expect(changed).toHaveBeenCalledTimes(1);

  });

  it('ignores model-written attributes and mutations on descendants', async () => {

    const model = own(new ViewModel());
    model.registerProperty('flag', true);
    const changed = vi.fn();
    model.subscribeProperties(changed);
    const { host } = mounted('<section data-bind="{attribute: flag, attributeName: hidden, mode: twoWay}"><b></b></section>', model);
    host.querySelector('b')!.setAttribute('hidden', '');
    await Promise.resolve();
    expect(model.getPropertyValue('flag')).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    host.querySelector('section')!.removeAttribute('hidden');
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(model.getPropertyValue('flag')).toBeNull();

  });

  it.each(['input', 'change'])('updates the model before the %s command, without blocking other listeners', eventType => {

    const model = own(new ViewModel());
    model.registerProperty('name', 'old');
    const seen: unknown[] = [];
    model.registerCommand('save', new Command(() => seen.push(model.getPropertyValue('name'))));
    const { host } = mounted(`<input data-command="{${eventType}: save}" data-bind="{value: name, mode: twoWay, triggerType: ${eventType}}">`, model);
    const input = host.querySelector('input')!;
    const additional = vi.fn();
    input.addEventListener(eventType, additional);
    input.value = 'new'; input.dispatchEvent(new Event(eventType, { bubbles: true }));
    expect(seen).toEqual(['new']);
    expect(model.getPropertyValue('name')).toBe('new');
    expect(additional).toHaveBeenCalledTimes(1);

  });

  it('updates checked before a click command', () => {

    const model = own(new ViewModel());
    model.registerProperty('enabled', false);
    const seen: unknown[] = [];
    model.registerCommand('changed', new Command(() => seen.push(model.getPropertyValue('enabled'))));
    const { host } = mounted('<input type="checkbox" data-bind="{checked: enabled, mode: twoWay}" data-command="{click: changed}">', model);
    host.querySelector('input')!.click();
    expect(seen).toEqual([true]);

  });

  it('applies forward and backward conversion without corrupting raw model state', () => {

    registerConverter('test-percent', { convert: value => `${value}%`, convertBack: value => Number(String(value).replace('%', '')) });
    cleanup(() => unregisterConverter('test-percent'));
    class Model extends ViewModel { @convert('test-percent') accessor percent!: number; }
    const model = own(new Model());
    model.registerProperty('percent', 10);
    const { host } = mounted('<input data-bind="{value: percent, mode: twoWay, triggerType: input}"><input data-bind="{value: percent}">', model);
    const fields = host.querySelectorAll('input');
    expect(fields[0].value).toBe('10%');
    fields[0].value = '25%'; fields[0].dispatchEvent(new Event('input'));
    expect(model.getPropertyValue('percent')).toBe(25);
    expect(fields[1].value).toBe('25%');

  });

  it('prevents native submit while executing the registered command once', () => {

    const model = own(new ViewModel());
    const execute = vi.fn();
    model.registerCommand('save', new Command(execute));
    const { host } = mounted('<form data-command="{submit: save}"></form>', model);
    const event = new Event('submit', { cancelable: true, bubbles: true });
    host.querySelector('form')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);

  });

  it('reports rejected asynchronous commands dispatched by a view', async () => {

    const model = own(new ViewModel());
    const failure = new Error('save failed');
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    model.registerCommand('save', new Command(async () => { throw failure; }));
    const { host, view } = mounted('<button data-command="{click: save}"></button>', model);

    try {
      host.querySelector('button')!.click();
      await vi.waitFor(() => {
        expect(report).toHaveBeenCalledWith("Command 'save' failed", failure);
      });
    } finally {
      view.dispose();
      report.mockRestore();
    }
  });

  it('delivers resize to both active views', () => {
    const model = own(new ViewModel());
    const a = vi.fn(), b = vi.fn();
    model.registerCommand('a', new Command(a)); model.registerCommand('b', new Command(b));
    mounted('<div data-command="{resize: a}"></div>', model);
    mounted('<div data-command="{resize: b}"></div>', model);
    window.dispatchEvent(new Event('resize'));
    expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
  });

  it('restores existing validation state when a new view is created', () => {
    const model = own(new ViewModel());
    model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: () => false, getMessage: () => 'Required' }]);
    model.validateProperty('name');
    const { host } = mounted('<input data-validate-error="{class: name, errorClass: invalid}">', model);
    expect(host.querySelector('input')!.classList.contains('invalid')).toBe(true);
  });
  
});
