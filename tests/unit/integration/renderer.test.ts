import { describe, expect, it, vi } from 'vitest';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { View } from '@mvvm/view';
import Renderer from '@mvvm/bindings/htmlBinding';
import { own } from '../helpers/resources';
import { item, template } from '../helpers/views';

function renderer(args: string[] = []) {

  const host = document.createElement('section');
  document.body.append(host);
  return { host, binding: own(new Renderer(host, 'children', args)) };

}

function viewList(...views: View[]): ArrayObserver<View> {

  const list = new ArrayObserver<View>();
  list.push(...views);
  return list;

}

describe('renderer - replacement, ordering and borrowed views', () => {

  it('replaces a single view rather than accumulating its predecessors', () => {

    const a = item('A'), b = item('B');
    const { host, binding } = renderer();
    binding.setValue(a.view); binding.setValue(b.view);
    expect(Array.from(host.children)).toEqual([b.node]);
    expect(a.node.isConnected).toBe(false);

  });

  it.each(['start', 'end'])('preserves collection order with place: %s', place => {

    const a = item('A'), b = item('B'), c = item('C');
    const { host, binding } = renderer([`place: ${place}`]);
    const staticNode = document.createElement('hr');
    host.append(staticNode);
    binding.setValue([a.view, b.view, c.view]);

    expect(Array.from(host.children)).toEqual(place === 'start'
      ? [a.node, b.node, c.node, staticNode]
      : [staticNode, a.node, b.node, c.node]);

  });

  it('stops consuming the previous observable collection after replacement', () => {

    const a = item('A'), b = item('B'), stale = item('stale');
    const list = viewList(a.view);
    const { host, binding } = renderer();
    binding.setValue(list); binding.setValue(b.view);
    list.push(stale.view);
    expect(Array.from(host.children)).toEqual([b.node]);

  });

  it('keeps DOM order and existing node identity through collection mutations', () => {

    const a = item('A'), b = item('B'), c = item('C'), d = item('D');
    const list = viewList(a.view, b.view);
    const { host, binding } = renderer();
    binding.setValue(list);
    list.unshift(c.view); list.splice(1, 1, d.view);
    expect(Array.from(host.children)).toEqual([c.node, d.node, b.node]);
    list.reverse();
    expect(Array.from(host.children)).toEqual([b.node, d.node, c.node]);
    list.clear();
    expect(host.childNodes).toHaveLength(0);

  });

  it('does not destroy borrowed views when switching collections', () => {

    const a = item('A');
    const { host, binding } = renderer();
    binding.setValue(viewList(a.view));
    binding.setValue([]);
    a.model.setPropertyValueAndNotify('label', 'still alive');
    expect(a.node.value).toBe('still alive');
    binding.setValue([a.view]);
    expect(host.firstChild).toBe(a.node);

  });

  it('does not consume changes after disposal and leaves borrowed views usable', () => {

    const a = item('A'), b = item('B');
    const list = viewList(a.view);
    const { host, binding } = renderer();
    binding.setValue(list); binding.dispose();
    list.push(b.view);
    expect(host.childNodes).toHaveLength(0);
    a.model.setPropertyValueAndNotify('label', 'alive');
    expect(a.node.value).toBe('alive');

  });

  it('supports inserting DOM elements into an initially empty observable collection', () => {

    const list = new ArrayObserver<HTMLElement>();
    const { host, binding } = renderer();
    binding.setValue(list);
    const node = document.createElement('span');
    list.push(node);
    expect(host.firstChild).toBe(node);
    list.pop();
    expect(host.childNodes).toHaveLength(0);

  });

  it('delivers one ready event to a root listener for each insertion, including splice', () => {

    const a = own(new View(template('<div><span>child</span></div>')));
    const b = own(new View(template('<div><span>child</span></div>')));
    const onA = vi.fn(), onAChild = vi.fn(), onB = vi.fn(), onHost = vi.fn();
    const rootA = a.viewNodeList[0];
    if (!(rootA instanceof HTMLElement)) throw new Error('Expected an HTML root');
    rootA.addEventListener('ready', onA);
    rootA.querySelector('span')!.addEventListener('ready', onAChild);
    b.viewNodeList[0].addEventListener('ready', onB);
    const list = viewList(a);
    const { host, binding } = renderer();
    host.addEventListener('ready', onHost);
    binding.setValue(list); list.splice(1, 0, b);
    list.shift(); list.push(a);
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onAChild).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onHost).not.toHaveBeenCalled();

  });
  
});
