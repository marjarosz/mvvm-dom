import { describe, expect, it } from 'vitest';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { propertyChange } from '@mvvm/propertyDecorators';
import { convert, convertToView, convertToViewModel, hasConverterFor,
  registerConverter, unregisterConverter } from '@mvvm/valueConverter';

describe('converter targets with ordinary record data', () => {

  const records: [string, () => object][] = [

    ['ordinary object', () => ({ name: 'x' })],
    ['null prototype', () => Object.assign(Object.create(null), { name: 'x' })],
    ['string constructor', () => ({ name: 'x', constructor: 'part' })],
    ['null constructor', () => ({ name: 'x', constructor: null })],
    ['undefined constructor', () => ({ name: 'x', constructor: undefined })],
    ['numeric constructor', () => ({ name: 'x', constructor: 42 })],
    ['object constructor', () => ({ name: 'x', constructor: {} })],
    ['throwing constructor getter', () => Object.defineProperty({ name: 'x' }, 'constructor', {
      get() { throw new Error('Record constructor must not be read'); },
    })],

  ];

  for (const [name, create] of records) {

    it(`passes values through and renders a collection containing a ${name}`, () => {

      const record = create();
      const value = { unchanged: true };

      expect(hasConverterFor('name', record)).toBe(false);
      expect(convertToView(value, 'name', record)).toBe(value);
      expect(convertToViewModel(value, 'name', record)).toBe(value);

      const model = new ViewModel();
      model.registerProperty('items', [record]);
      const template = document.createElement('template');
      template.innerHTML = '<section><div data-bind="{collection: items}">{{object.name}}</div></section>';
      let view: View | undefined;

      try {

        view = new View(template, model);
        expect(view.viewNodeList[0].textContent).toBe('x');

      } finally { 
        view?.dispose(); 
        model.dispose(); 
      }

    });

  }

  it('does not borrow converters from a class stored in a data field named constructor', () => {

    class Decorated { @convert('not-registered-on-purpose') accessor name = 'x'; }
    const record = { name: 'x', constructor: Decorated };
    expect(hasConverterFor('name', record)).toBe(false);
    expect(convertToView('x', 'name', record)).toBe('x');
    expect(convertToViewModel('x', 'name', record)).toBe('x');

  });

  it('preserves inherited model converters and collection conversion despite an own constructor field', () => {

    registerConverter('target-test', {
      convert: value => `converted:${value}`,
      convertBack: value => String(value).slice('converted:'.length),
    });

    class Base extends ViewModel {
      @convert('target-test') @propertyChange() accessor name = 'x';
    }

    class Child extends Base {}

    const item = new Child(), model = new ViewModel();

    const items = new CollectionObserver(item);

    Object.defineProperty(item, 'constructor', { value: 'data' });

    let view: View | undefined;

    try {

      expect(hasConverterFor('name', item)).toBe(true);
      expect(convertToView('x', 'name', item)).toBe('converted:x');
      expect(convertToViewModel('converted:y', 'name', item)).toBe('y');
      model.registerProperty('items', items);
      const template = document.createElement('template');
      template.innerHTML = '<section><div data-bind="{collection: items}">{{object.name}}</div></section>';
      view = new View(template, model);
      expect(view.viewNodeList[0].textContent).toBe('converted:x');
      item.name = 'y';
      expect(view.viewNodeList[0].textContent).toBe('converted:y');
      
    } finally {

      view?.dispose(); 
      items.clear(); 
      model.dispose(); 
      item.dispose(); 
      unregisterConverter('target-test');

    }
  });
});
