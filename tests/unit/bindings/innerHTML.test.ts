import { describe, expect, it, vi } from 'vitest';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { cleanup, own } from '../helpers/resources';
import { mounted, template } from '../helpers/views';

describe('innerHTML binding - scope contract', () => {

  it('borrows a view: binding disposal removes nodes without disposing the view model', () => {

    const childModel = new ViewModel();
    const childDispose = vi.spyOn(childModel, 'dispose');
    const child = own(new View(template('<b>child</b>'), childModel));
    child.ownsDataContext = false;
    const model = own(new ViewModel());
    model.registerProperty('content', child);
    const { host, view } = mounted('<div data-bind="{innerHTML: content}"></div>', model);
    const slot = host.querySelector('div')!;
    expect(slot.childNodes).toHaveLength(1);
    view.dispose();
    expect(slot.childNodes).toHaveLength(0);
    expect(childDispose).not.toHaveBeenCalled();

  });

  it('detaches views on array reset without disposing their models', () => {

    const childModel = new ViewModel();
    const childDispose = vi.spyOn(childModel, 'dispose');
    const child = own(new View(template('<b>item</b>'), childModel));
    child.ownsDataContext = false;
    const model = own(new ViewModel());
    const items = new ArrayObserver<View>();
    items.push(child);
    model.registerProperty('items', items);
    const { host, view } = mounted('<div data-bind="{innerHTML: items}"></div>', model);
    const slot = host.querySelector('div')!;
    expect(slot.childNodes).toHaveLength(1);
    items.clear();
    expect(slot.childNodes).toHaveLength(0);
    expect(childDispose).not.toHaveBeenCalled();
    view.dispose();
    expect(childDispose).not.toHaveBeenCalled();

  });

  it('keeps a detached view re-insertable and alive', () => {

    const childModel = new ViewModel();
    childModel.registerProperty('label', 'A');
    const child = own(new View(template('<input data-bind="{value: label}">'), childModel));
    child.ownsDataContext = false;
    const model = own(new ViewModel());
    const items = new ArrayObserver<View>();
    items.push(child);
    model.registerProperty('items', items);
    const { host, view } = mounted('<div data-bind="{innerHTML: items}"></div>', model);
    const slot = host.querySelector('div')!;
    const input = slot.querySelector('input')!;
    items.clear();
    expect(slot.childNodes).toHaveLength(0);
    items.push(child);
    expect(slot.querySelector('input')).toBe(input);
    childModel.setPropertyValueAndNotify('label', 'B');
    expect(slot.querySelector('input')!.value).toBe('B');
    view.dispose();

  });

  it('lets the owner dispose borrowed views while the binding is still alive', () => {

    const childModel = new ViewModel();
    const childDispose = vi.spyOn(childModel, 'dispose');
    const child = new View(template('<b>item</b>'), childModel);
    const model = own(new ViewModel());
    const items = new ArrayObserver<View>();
    items.push(child);
    model.registerProperty('items', items);
    const { host, view } = mounted('<div data-bind="{innerHTML: items}"></div>', model);
    const slot = host.querySelector('div')!;
    child.dispose();
    expect(childDispose).toHaveBeenCalledTimes(1);
    expect(slot.childNodes).toHaveLength(0);
    view.dispose();
    expect(childDispose).toHaveBeenCalledTimes(1);

  });

  it('survives one borrowing view disposal when the model is shared (ownsDataContext: false)', () => {

    const shared = own(new ViewModel());
    shared.registerProperty('name', 'A');

    const first = new View(template('<input data-bind="{value: name}">'), shared, undefined, { ownsDataContext: false });

    const second = new View(template('<input data-bind="{value: name}">'), shared, undefined, { ownsDataContext: false });

    const host = document.createElement('section');
    document.body.append(host);
    cleanup(() => { first.detach(); first.dispose(); second.detach(); second.dispose(); host.remove(); });
    host.append(...first.viewNodeList, ...second.viewNodeList);
    first.dispose();
    shared.setPropertyValueAndNotify('name', 'B');
    expect(host.querySelector('input')!.value).toBe('B');
    second.dispose();
    expect(shared.getPropertyValue('name')).toBe('B');

  });

  it('still disposes an owned model exactly once by default', () => {

    const model = new ViewModel();
    const dispose = vi.spyOn(model, 'dispose');
    const view = new View(template('<div></div>'), model, undefined, { ownsDataContext: true });
    view.dispose();
    view.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);

  });
  
});
