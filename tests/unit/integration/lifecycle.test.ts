import { describe, expect, it, vi } from 'vitest';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import { convert, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import { cleanup, own } from '../helpers/resources';
import { mounted, template } from '../helpers/views';
import { installResizeObserver } from '../helpers/resizeObserver';

describe('View lifecycle and templates', () => {

  it.each([false, true])('respects ownsDataContext=%s from construction', ownsDataContext => {
    const model = own(new ViewModel());
    model.registerProperty('name', 'A');
    const dispose = vi.spyOn(model, 'dispose');
    const view = own(new View(template('<input data-bind="{value: name}">'), model, undefined, { ownsDataContext }));
    expect(view.ownsDataContext).toBe(ownsDataContext);
    view.dispose(); view.dispose();
    expect(dispose).toHaveBeenCalledTimes(ownsDataContext ? 1 : 0);

    if (!ownsDataContext) {
      model.setPropertyValueAndNotify('name', 'B');
      expect(model.getPropertyValue('name')).toBe('B');
    }

  });

  it('can detach, receive changes and remount the same nodes', () => {

    const model = own(new ViewModel()); model.registerProperty('name', 'A');
    const { host, view } = mounted('<input data-bind="{value: name}">', model);
    const node = host.firstChild as HTMLInputElement;
    view.detach();
    expect(host.childNodes).toHaveLength(0);
    model.setPropertyValueAndNotify('name', 'B');
    host.append(...view.viewNodeList);
    expect(host.firstChild).toBe(node); expect(node.value).toBe('B');

  });

  it('removes mounted nodes on disposal and tolerates repeated disposal', () => {

    const model = own(new ViewModel());
    const { host, view } = mounted('<div>content</div>', model);
    view.dispose(); view.dispose();
    expect(host.childNodes).toHaveLength(0);

  });

  it('keeps a shared model usable after a borrowing view is disposed', () => {

    const model = own(new ViewModel()); model.registerProperty('name', 'A');
    const first = mounted('<input data-bind="{value: name}">', model);
    const second = mounted('<input data-bind="{value: name}">', model);
    first.view.dispose(); model.setPropertyValueAndNotify('name', 'B');
    expect(second.host.querySelector('input')!.value).toBe('B');

  });

  it('disposes an explicitly owned model exactly once', () => {

    const model = new ViewModel();
    const dispose = vi.spyOn(model, 'dispose');
    const view = own(new View(template('<div></div>'), model));
    view.ownsDataContext = true;
    view.dispose(); view.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);

  });

  it('removes DOM and window command listeners', () => {

    const model = own(new ViewModel()); const execute = vi.fn();
    model.registerCommand('run', new Command(execute));
    const { host, view } = mounted('<button data-command="{click: run}{resize: run}">Go</button>', model);
    const button = host.querySelector('button')!;
    view.dispose(); button.click(); window.dispatchEvent(new Event('resize'));
    expect(execute).not.toHaveBeenCalled();

  });

  it('clones an HTMLElement template without removing the original', () => {

    const original = document.createElement('div'); original.textContent = 'template';
    document.body.append(original);
    const view = own(new View(original));
    expect(original.parentElement).toBe(document.body);
    expect(view.viewNodeList[0]).not.toBe(original);
    expect(view.viewNodeList[0].textContent).toBe('template');

  });

  it('preserves top-level text and comment nodes in a template', () => {

    const view = own(new View(template('before<span>middle</span><!--note-->after')));
    expect(view.viewNodeList.map(node => node.nodeType)).toEqual([Node.TEXT_NODE, Node.ELEMENT_NODE, Node.COMMENT_NODE, Node.TEXT_NODE]);
    expect(view.viewNodeList.map(node => node.textContent).join('')).toBe('beforemiddlenoteafter');

  });

  it('rejects a string source without subscribing to or disposing the model', () => {

    const model = own(new ViewModel());
    const pairs = [
      [vi.spyOn(model, 'subscribeProperties'), vi.spyOn(model, 'unsubscribeProperties')],
      [vi.spyOn(model, 'subscribeValidationState'), vi.spyOn(model, 'unsubscribeValidationState')],
      [vi.spyOn(model, 'subscribeValidationReset'), vi.spyOn(model, 'unsubscribeValidationReset')],
    ] as const;
    const dispose = vi.spyOn(model, 'dispose');
    // @ts-expect-error View sources must be DOM elements.
    expect(() => new View('missing-test-template', model)).toThrow(/HTMLElement/);

    for (const [subscribe, unsubscribe] of pairs) {
      for (const [callback] of subscribe.mock.calls) expect(unsubscribe).toHaveBeenCalledWith(callback);
      expect(unsubscribe.mock.calls.length).toBe(subscribe.mock.calls.length);
    }

    expect(dispose).not.toHaveBeenCalled();
    expect(model.getPropertyValue('anything')).toBeUndefined();

  });

  it('unsubscribes even when a context throws immediately after attaching a listener', () => {

    const model = own(new ViewModel());
    const original = model.subscribeValidationState.bind(model);
    const failure = new Error('subscription interrupted');
    const properties = vi.spyOn(model, 'subscribeProperties');
    const offProperties = vi.spyOn(model, 'unsubscribeProperties');
    const offValidation = vi.spyOn(model, 'unsubscribeValidationState');

    const validation = vi.spyOn(model, 'subscribeValidationState').mockImplementationOnce(callback => {
      original(callback);
      throw failure;
    });

    const dispose = vi.spyOn(model, 'dispose');
    expect(() => new View(template('<div></div>'), model)).toThrow(failure);
    expect(offProperties).toHaveBeenCalledWith(properties.mock.calls[0][0]);
    expect(offValidation).toHaveBeenCalledWith(validation.mock.calls[0][0]);
    expect(dispose).not.toHaveBeenCalled();

  });

  it('can retry a failed if branch without leaking its parent command or disturbing another view', () => {

    const model = own(new ViewModel());
    model.registerProperty('show', true);
    model.registerProperty('name', 'A');
    model.registerProperty('files', 'invalid FileList');
    const execute = vi.fn();
    model.registerCommand('run', new Command(execute));
    const sibling = mounted('<input data-bind="{value: name}">', model);
    const source = template('<div data-command="{resize: run}"><section data-bind="{if: show}"><input type="file" data-bind="{value: files}"><button data-command="{click: run}"></button></section></div>');
    expect(() => new View(source, model)).toThrow();
    window.dispatchEvent(new Event('resize'));
    expect(execute).not.toHaveBeenCalled();
    model.setPropertyValueAndNotify('name', 'B');
    expect(sibling.host.querySelector('input')!.value).toBe('B');
    model.setPropertyValue('files', null);
    const retry = own(new View(source, model, undefined, { ownsDataContext: false }));
    (retry.viewNodeList[0] as HTMLElement).querySelector('button')!.click();
    expect(execute).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    expect(execute).toHaveBeenCalledTimes(2);

  });

  it('rolls back already created bindings after a later factory error', () => {

    const observers = installResizeObserver();
    const model = own(new ViewModel()); model.registerProperty('width', 1);
    const execute = vi.fn(); model.registerCommand('run', new Command(execute));
    const source = template('<div data-command="{resize: run}" data-bind="{width: width, mode: twoWay}"></div><div data-bind="{missing-test-binding: width}"></div>');
    expect(() => new View(source, model)).toThrow(/missing-test-binding/);
    expect(observers).toHaveLength(1);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    expect(execute).not.toHaveBeenCalled();

  });

  it('rolls back resources when an active if branch contains invalid mode', () => {

    const observers = installResizeObserver();
    const model = own(new ViewModel());
    model.registerProperties({ width: 1, show: true, name: 'A' });
    const sibling = mounted('<input data-bind="{value: name}">', model);
    const source = template('<div data-bind="{width: width, mode: twoWay}"></div>' +
      '<section data-bind="{if: show}"><input data-bind="{value: name, mode: typo}"></section>');
    expect(() => new View(source, model, undefined, { ownsDataContext: false })).toThrow(/unknown mode 'typo'/);
    expect(observers).toHaveLength(1);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    model.setPropertyValueAndNotify('name', 'B');
    expect(sibling.host.querySelector('input')!.value).toBe('B');
    source.content.querySelector('input')!.setAttribute('data-bind', '{value: name, mode: twoWay}');
    const retry = own(new View(source, model, undefined, { ownsDataContext: false }));
    const host = document.createElement('div'); host.append(...retry.viewNodeList);
    expect(host.querySelector('input')!.value).toBe('B');

  });

  it('disconnects an observer if setup fails inside the binding constructor', () => {

    const failure = new Error('observe failed');
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      observe() { throw failure; }
      disconnect = disconnect;
    });
    expect(() => new View(template('<div data-bind="{width: width, mode: twoWay}"></div>'))).toThrow(failure);
    expect(disconnect).toHaveBeenCalledTimes(1);

  });

  it('disposes a binding whose initial conversion fails before initialization finishes', () => {

    const observers = installResizeObserver();
    const failure = new Error('conversion failed');
    registerConverter('test-throw-initial', { convert: () => { throw failure; } });
    cleanup(() => unregisterConverter('test-throw-initial'));
    class Model extends ViewModel { @convert('test-throw-initial') accessor width!: number; }
    const model = own(new Model()); model.registerProperty('width', 1);
    expect(() => new View(template('<div data-bind="{width: width, mode: twoWay}"></div>'), model)).toThrow(failure);
    expect(observers).toHaveLength(1);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);

  });
  
});
