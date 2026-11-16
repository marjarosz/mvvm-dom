import { describe, expect, it } from 'vitest';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { View } from '@mvvm/view';
import Renderer from '@mvvm/bindings/htmlBinding';
import { own } from '../helpers/resources';
import { template, item } from '../helpers/views';

function viewList(...views: View[]): ArrayObserver<View> {

  const list = new ArrayObserver<View>();
  list.push(...views);
  return list;

}

describe('renderer content transitions', () => {

  it('replaces HTML, element, view and plain arrays without retaining previous content', () => {

    const host = document.createElement('div'); const binding = own(new Renderer(host, 'content', []));
    binding.setValue('<b>HTML</b>'); expect(host.querySelector('b')!.textContent).toBe('HTML');
    const element = document.createElement('span'); binding.setValue(element); expect([...host.childNodes]).toEqual([element]);
    const child = item('view'); binding.setValue(child.view); expect([...host.childNodes]).toEqual([child.node]);
    const other = item('other'); binding.setValue([other.view]); expect([...host.childNodes]).toEqual([other.node]);
    binding.setValue(''); expect(host.childNodes).toHaveLength(0);

  });

  it('moves and removes all roots of each view as one item', () => {

    const a = own(new View(template('<i>A1</i><i>A2</i>'))), b = own(new View(template('<b>B1</b><b>B2</b>')));
    const host = document.createElement('div'); const binding = own(new Renderer(host, 'items', []));
    const list = viewList(a); binding.setValue(list); list.splice(1, 0, b);
    expect([...host.childNodes]).toEqual([...a.viewNodeList, ...b.viewNodeList]);
    list.reverse(); expect([...host.childNodes]).toEqual([...b.viewNodeList, ...a.viewNodeList]);
    list.shift(); expect([...host.childNodes]).toEqual(a.viewNodeList);

  });

  it('preserves node identity and order through sort and fill of one slot', () => {

    const a = item('A'), b = item('B'), c = item('C');
    const list = viewList(b.view, a.view);
    const host = document.createElement('div'); const binding = own(new Renderer(host, 'items', [])); binding.setValue(list);
    list.sort((left: View, right: View) => String(left.dataContext!.getPropertyValue('label')).localeCompare(String(right.dataContext!.getPropertyValue('label'))));
    expect([...host.childNodes]).toEqual([a.node, b.node]);
    list.fill(c.view, 0, 1); expect([...host.childNodes]).toEqual([c.node, b.node]);
    expect(a.view.viewNodeList[0]).toBe(a.node);

  });

  it('does not duplicate subscriptions or nodes when the same observable is assigned twice', () => {

    const a = item('A'), b = item('B');     const list = viewList(a.view);
    const host = document.createElement('div'); const binding = own(new Renderer(host, 'items', []));
    binding.setValue(list); binding.setValue(list); list.push(b.view);
    expect([...host.childNodes]).toEqual([a.node, b.node]);

  });
  
});
