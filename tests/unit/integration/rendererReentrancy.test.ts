import { describe, expect, it } from 'vitest';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { View } from '@mvvm/view';
import Renderer from '@mvvm/bindings/htmlBinding';
import { own } from '../helpers/resources';
import { item, template } from '../helpers/views';

// Inwariant całego pliku: reenkacyjne wywołania setValue()/dispose() z
// handlerów 'ready' muszą dawać stan końcowy ostatniego żądania - bez
// powtórek, bez częściowo podpiętych widoków i bez przecieków subskrypcji.
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

describe('renderer - reentrancy and transitions', () => {

  it('applies the last ready request after an incremental push and never replays it', () => {

    const { host, binding } = renderer();
    const list = viewList();
    const a = item('A'), b = item('B');
    binding.setValue(list);
    // Zmiana źródła w trakcie przetwarzania 'ready' - liczy się tylko
    // ostatnie żądanie ([] po [b]), wcześniejsze nie może być odtworzone.
    a.node.addEventListener('ready', () => {
      binding.setValue([]);
      binding.setValue([b.view]);
    });
    list.push(a.view);
    expect(Array.from(host.children)).toEqual([b.node]);
    binding.setValue([]);
    expect(host.childNodes).toHaveLength(0);

  });

  it('keeps the observable list live after rejecting the host as a single item', () => {

    const { host, binding } = renderer();
    const a = item('A'), b = item('B');
    const list = viewList(a.view);
    binding.setValue(list);
    expect(() => binding.setValue(host)).toThrow();
    list.push(b.view);
    expect(Array.from(host.children)).toEqual([a.node, b.node]);
    binding.setValue(b.view);
    list.clear();
    expect(Array.from(host.children)).toEqual([b.node]);

  });

  it.each(['full', 'push'])('stops descendant and sibling ready events after disposal during %s', mode => {

    const { host, binding } = renderer();
    const root = document.createElement('div');
    const child = document.createElement('span');
    const sibling = document.createElement('i');
    root.append(child);
    const seen: Element[] = [];
    // dispose() w handlerze gotowości korzenia: ani potomne, ani rodzeństwo
    // nie może już dostać wydarzenia 'ready'.
    root.addEventListener('ready', () => {
      seen.push(root);
      binding.dispose();
    });

    for (const el of [child, sibling]) el.addEventListener('ready', () => seen.push(el));

    const list = new ArrayObserver<HTMLElement>();
    binding.setValue(list);
    if (mode === 'push') list.push(root, sibling);
    else binding.setValue([root, sibling]);
    expect(seen).toEqual([root]);
    expect(host.childNodes).toHaveLength(0);

  });

  it('- applies a nested setSource requested during ready', () => {

    const a = own(new View(template('<b>A</b>')));
    const b = item('B');
    const { host, binding } = renderer();
    const staticNode = document.createElement('hr');

    host.append(staticNode);
    a.viewNodeList[0].addEventListener('ready', () => {
      binding.setValue([b.view]);
    });
    binding.setValue(a);
    // Po gotowości A źródło przełączone na B; A usunięte, statyczny węzeł zostaje.
    expect(Array.from(host.children)).toEqual([staticNode, b.node]);
    expect(a.viewNodeList[0].isConnected).toBe(false);
    // B, a następnie [] - host zawiera tylko węzły statyczne.
    binding.setValue([b.view]);
    expect(Array.from(host.children)).toEqual([staticNode, b.node]);
    binding.setValue([]);
    expect(Array.from(host.children)).toEqual([staticNode]);

  });

  it('- dispose in the ready callback ends processing cleanly', () => {

    const a = own(new View(template('<b>A</b>')));
    const { host, binding } = renderer();
    a.viewNodeList[0].addEventListener('ready', () => {
      binding.setValue([item('B').view]);
      binding.dispose();
    });
    expect(() => binding.setValue(a)).not.toThrow();
    expect(host.childNodes).toHaveLength(0);

  });

  it('- rejects an invalid source and keeps the current one active', () => {

    const a = item('A');
    const b = item('B');
    const list = viewList(a.view);
    const { host, binding } = renderer();
    binding.setValue(list);
    expect(Array.from(host.children)).toEqual([a.node]);
    // B z powtórzonym widokiem - odrzucone, zanim przełączono subskrypcję.
    expect(() => binding.setValue([b.view, b.view])).toThrow();
    // A nadal widać; zmiana A aktualizuje DOM.
    expect(Array.from(host.children)).toEqual([a.node]);
    a.model.setPropertyValueAndNotify('label', 'A2');
    expect(a.node.value).toBe('A2');
    // Zmiana odrzuconego B go nie dotyka.
    b.model.setPropertyValueAndNotify('label', 'B2');
    expect(b.node.value).toBe('B2');
    expect(host.contains(b.node)).toBe(false);
    // Po udanej zmianie źródła obowiązuje odwrotna zależność.
    binding.setValue(viewList(b.view));
    expect(Array.from(host.children)).toEqual([b.node]);
    a.model.setPropertyValueAndNotify('label', 'A3');
    b.model.setPropertyValueAndNotify('label', 'B3');
    expect(a.node.value).toBe('A3');
    expect(b.node.value).toBe('B3');
    expect(host.contains(b.node)).toBe(true);

  });

  it('- removes previous trusted HTML when transitioning to a list', () => {

    const b = item('B');
    const { host, binding } = renderer();
    binding.setValue('<b>HTML</b>');
    expect(host.querySelector('b')!.textContent).toBe('HTML');
    // HTML → [B]
    binding.setValue([b.view]);
    expect(Array.from(host.children)).toEqual([b.node]);
    expect(host.querySelector('b')).toBeNull();
    // HTML → []
    binding.setValue('<b>HTML2</b>');
    expect(host.querySelector('b')!.textContent).toBe('HTML2');
    binding.setValue([]);
    expect(host.childNodes).toHaveLength(0);

  });

  it('- keeps static host children across list→view and dispose', () => {

    const a = item('A');
    const b = item('B');
    const { host, binding } = renderer();
    const staticNode = document.createElement('hr');
    host.append(staticNode);
    binding.setValue([a.view]);
    expect(Array.from(host.children)).toEqual([staticNode, a.node]);
    // lista → widok: statyczny <hr> zostaje, poprzedni korzeń odpinany.
    binding.setValue(b.view);
    expect(Array.from(host.children)).toEqual([staticNode, b.node]);
    expect(a.node.isConnected).toBe(false);
    expect(host.contains(staticNode)).toBe(true);
    // dispose: statyczny <hr> zostaje, korzenie renderera odłączone.
    binding.dispose();
    expect(Array.from(host.children)).toEqual([staticNode]);
    expect(b.node.isConnected).toBe(false);

  });
  
});
