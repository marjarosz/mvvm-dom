import { describe, expect, it, vi } from 'vitest';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { convert, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import CollectionBinding from '@mvvm/bindings/collectionBinding';
import { Command } from '@mvvm/command';
import { own } from '../helpers/resources';
import { mounted, template } from '../helpers/views';
import { View } from '@mvvm/view';

describe('collection binding', () => {

  it('renders automatic interpolation and updates nested paths without replacing nodes', () => {

    const items = new CollectionObserver(
      { name: 'A', test: { value: 'one' } },
      { name: 'B', test: { value: 'two' } }
    );

    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const { host } = mounted('<ul><li data-bind="{collection: items}">' +
      '<span>{{object.name}}</span><b>{{object.test.value}}</b></li></ul>', model);
    const rows = [...host.querySelectorAll('li')];
    expect(rows.map(row => row.textContent)).toEqual(['Aone', 'Btwo']);
    items[0].name = 'C';
    items[0].test.value = 'three';
    expect(rows[0].textContent).toBe('Cthree');
    expect(host.querySelectorAll('li')[0]).toBe(rows[0]);
    items[0].test = { value: 'new' };
    expect(rows[0].textContent).toBe('Cnew');
    items.reverse();
    expect([...host.querySelectorAll('li')]).toEqual([rows[1], rows[0]]);

  });

  it('renders duplicates independently and disposes removed rows', () => {

    const item = { name: 'A' };
    const items = new CollectionObserver(item, item);
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const { host, view } = mounted('<ul><li data-bind="{collection: items}">{{object.name}}</li></ul>', model);
    const rows = [...host.querySelectorAll('li')];
    expect(rows).toHaveLength(2);
    items[0].name = 'B';
    expect(rows.map(row => row.textContent)).toEqual(['B', 'B']);
    items.shift();
    expect(host.querySelectorAll('li')).toHaveLength(1);
    view.dispose();
    items[0].name = 'C';
    expect(host.querySelectorAll('li')).toHaveLength(0);

  });

  it('renders nested collection scopes and handles parent mutations', () => {

    const children = new CollectionObserver({ name: 'child' });
    const items = new CollectionObserver({ name: 'parent', children });
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const { host } = mounted('<div data-bind="{collection: items}"><h2>{{object.name}}</h2>' +
      '<p data-bind="{collection: object.children}">{{parent.name}}/{{object.name}}</p></div>', model);
    expect(host.querySelector('p')!.textContent).toBe('parent/child');
    items[0].name = 'changed';
    children[0].name = 'new';
    expect(host.querySelector('p')!.textContent).toBe('changed/new');

  });

  it('supports existing ViewModel methods and rejects writable row bindings', () => {

    class Item extends ViewModel {
      #prefix = '!';
      @propertyChange() accessor name = 'a';
      get label() { return this.#prefix + this.name; }
      update() { this.name = 'b'; }
    }

    const item = own(new Item());
    const items = new CollectionObserver(item);
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const { host } = mounted('<p data-bind="{collection: items}">{{object.label}}</p>', model);
    items[0].update();
    expect(host.querySelector('p')!.textContent).toBe('!b');
    expect(() => new View(template('<input data-bind="{collection: items}, {value: object.name, mode: twoWay}">'), model))
      .toThrow(/read-only/);
  });

  it.each(['typo', '', 'twoWay', 'oneWayToSource'])('rejects invalid or writable row mode %j', direction => {

    const model = own(new ViewModel());
    model.registerProperty('items', new CollectionObserver({ name: 'A' }));
    const source = template('<section data-bind="{collection: items}">' +
      `<span data-bind="{text: object.name, mode: ${direction}}"></span></section>`);
    expect(() => new View(source, model, undefined, { ownsDataContext: false }))
      .toThrow(direction === 'twoWay' || direction === 'oneWayToSource' ? /read-only/ : /unknown mode/);
    source.content.querySelector('span')!.setAttribute('data-bind', '{text: object.name, mode: oneWay}');
    const retry = own(new View(source, model, undefined, { ownsDataContext: false }));
    const host = document.createElement('div'); host.append(...retry.viewNodeList);
    expect(host.querySelector('span')!.innerText).toBe('A');

  });

  it('updates snapshot data when the model republishes the same plain array', () => {

    const items = [{ name: 'before' }];
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const { host } = mounted('<p data-bind="{collection: items}">{{object.name}}</p>', model);
    const row = host.querySelector('p')!;
    items[0].name = 'after';
    expect(row.textContent).toBe('before');
    model.setPropertyValueAndNotify('items', items);
    expect(row.textContent).toBe('after');

  });

  it('updates normal bindings and parent model values inside nested rows', () => {

    const items = new CollectionObserver({ children: new CollectionObserver({ name: 'A' }) });
    const model = own(new ViewModel());
    model.registerProperties({ items, title: 'old' });
    const { host } = mounted('<div data-bind="{collection: items}">' +
      '<span data-bind="{collection: object.children}"><b data-bind="{text: title}"></b>' +
      '<i data-bind="{text: object.name}"></i></span></div>', model);
    expect(host.querySelector('b')!.innerText).toBe('old');
    model.setPropertyValueAndNotify('title', 'new');
    expect(host.querySelector('b')!.innerText).toBe('new');
    items[0].children[0].name = 'B';
    expect(host.querySelector('i')!.innerText).toBe('B');

  });

  it('uses the original ViewModel converters for item and parent bindings', () => {

    class Item extends ViewModel {
      @propertyChange() @convert('collection-uppercase') accessor name = 'item';
    }

    class Model extends ViewModel {
      @propertyChange() @convert('collection-uppercase') accessor title = 'parent';
    }

    registerConverter('collection-uppercase', { convert: value => String(value).toUpperCase() });

    try {

      const item = own(new Item());
      const model = own(new Model());
      const items = new CollectionObserver(item);
      model.registerProperty('items', items);
      const { host } = mounted('<div data-bind="{collection: items}">' +
        '<b data-bind="{text: object.name}"></b><i data-bind="{text: title}"></i></div>', model);
      expect(host.querySelector('b')!.innerText).toBe('ITEM');
      expect(host.querySelector('i')!.innerText).toBe('PARENT');
      items[0].name = 'next';
      model.title = 'updated';
      expect(host.querySelector('b')!.innerText).toBe('NEXT');
      expect(host.querySelector('i')!.innerText).toBe('UPDATED');

    } finally {
      unregisterConverter('collection-uppercase');
    }
  });

  it('renders missing paths safely and switches observed branches', () => {

    const items = new CollectionObserver<{ child?: { name: string } | null }>({ child: { name: '<img>' } });
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const { host } = mounted('<p data-bind="{collection: items}">{{object.child.name}} / {{object.child.name}}</p>', model);
    const p = host.querySelector('p')!;
    const old = items[0].child!;
    expect(p.textContent).toBe('<img> / <img>');
    expect(p.querySelector('img')).toBeNull();
    items[0].child = null;
    expect(p.textContent).toBe(' / ');
    old.name = 'stale';
    expect(p.textContent).toBe(' / ');
    items[0].child = { name: 'new' };
    expect(p.textContent).toBe('new / new');
    delete items[0].child;
    expect(p.textContent).toBe(' / ');

  });

  it('composes with if and inherited commands, disposing removed rows', () => {

    const items = new CollectionObserver({ name: 'A', show: true });
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    let clicks = 0;
    model.registerCommand('run', new Command(() => { clicks++; }));
    const { host, view } = mounted('<section data-bind="{collection: items}">' +
      '<button data-bind="{if: object.show}" data-command="{click: run}">{{object.name}}</button></section>', model);
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe('A');
    button.click();
    items[0].show = false;
    expect(host.querySelector('button')).toBeNull();
    button.click();
    expect(clicks).toBe(1);
    items[0].name = 'B';
    items[0].show = true;
    expect(host.querySelector('button')!.textContent).toBe('B');
    view.dispose();
    items.push({ name: 'C', show: true });
    expect(host.childNodes).toHaveLength(0);

  });

  it('rejects invalid sources before disturbing the current children', () => {

    const children: object[][] = [];
    const binding = new CollectionBinding({
      nodes: [], mount() {}, unmount() {},
      createChild() { return { viewNodeList: [], dispose() {} }; },
      setChildren(value) { children.push([...value]); }
    }, 'items', []);
    binding.setValue([{ name: 'A' }]);
    expect(() => binding.setValue({ bad: true })).toThrow(/expects an array/);
    expect(children).toHaveLength(1);
    expect(children[0]).toHaveLength(1);
    binding.dispose();

  });

  it('renders structural changes triggered while a row is being created', () => {

    class Item extends ViewModel {
      @propertyChange() @convert('collection-reentrant') accessor name = 'A';
    }

    const items = new CollectionObserver(own(new Item()));
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    let updated = false;

    registerConverter('collection-reentrant', {
      convert(value) {
        if (!updated) {
          updated = true;
          const next = own(new Item());
          next.name = 'B';
          items.unshift(next);
        }
        return value;
      }
    });

    try {
      const { host } = mounted('<p data-bind="{collection: items}"><span data-bind="{text: object.name}"></span></p>', model);
      expect(Array.from(host.querySelectorAll('span'), node => node.innerText)).toEqual(['B', 'A']);
    } finally {
      unregisterConverter('collection-reentrant');
    }

  });

  it('updates independent views and cleans up subscriptions when they are disposed', () => {

    const items = new CollectionObserver({ name: 'A' });
    const unsubscribe = vi.spyOn(items, 'unsubscribeItemChanges');
    const model = own(new ViewModel());
    model.registerProperty('items', items);
    const first = mounted('<p data-bind="{collection: items}">{{object.name}}</p>', model);
    const second = mounted('<p data-bind="{collection: items}">{{object.name}}</p>', model);
    items[0].name = 'B';
    expect(first.host.textContent).toBe('B');
    expect(second.host.textContent).toBe('B');
    first.view.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    items[0].name = 'C';
    expect(first.host.textContent).toBe('');
    expect(second.host.textContent).toBe('C');
    second.view.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(2);

  });

  it('rolls back newly created children when row creation fails', () => {

    let attempts = 0;
    const dispose = vi.fn();
    const states: object[][] = [];
    const binding = new CollectionBinding({
      nodes: [], mount() {}, unmount() {},
      createChild() {
        attempts++;
        if (attempts === 3) throw new Error('row creation failed');
        return { viewNodeList: [], dispose };
      },
      setChildren(value) { states.push([...value]); }
    }, 'items', []);
    binding.setValue([{ name: 'old' }]);
    expect(() => binding.setValue([{ name: 'new' }, { name: 'bad' }])).toThrow('row creation failed');
    expect(states).toHaveLength(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    binding.dispose();

  });

  it('unmounts and remounts a collection inside an if using the latest data', () => {

    const items = new CollectionObserver({ name: 'A' });
    const model = own(new ViewModel());
    model.registerProperties({ items, show: true });
    const { host } = mounted('<div data-bind="{if: show}"><p data-bind="{collection: items}">{{object.name}}</p></div>', model);
    expect(host.querySelector('p')!.textContent).toBe('A');
    model.setPropertyValueAndNotify('show', false);
    items[0].name = 'B';
    items.push({ name: 'C' });
    expect(host.querySelector('p')).toBeNull();
    model.setPropertyValueAndNotify('show', true);
    expect(Array.from(host.querySelectorAll('p'), node => node.textContent)).toEqual(['B', 'C']);
    
  });
});
