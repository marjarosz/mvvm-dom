import { describe, expect, it } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { View } from '@mvvm/view';
import { propertyAlias } from '@mvvm/propertyDecorators';
import { convert, convertToView, convertToViewModel, getConverterMetadataFor, hasConverterFor,
  registerConverter, unregisterConverter } from '@mvvm/valueConverter';

function withConverter(run: () => void): void {

  registerConverter('alias-test', {
    convert: (value, parameter) => `${parameter}:${value}`,
    convertBack: (value, parameter) => String(value).slice(String(parameter).length + 1),
  });

  try { 
    run(); 
  } finally { 
    unregisterConverter('alias-test'); 
  }

}

describe('converter aliases', () => {

  it('uses the public property name in both directions for either decorator order', () => withConverter(() => {

    class First extends ViewModel {
      @propertyAlias('canonical') @convert('alias-test', 'P') accessor label = 'hello';
    }

    class Second extends ViewModel {
      @convert('alias-test', 'P') @propertyAlias('canonical') accessor label = 'hello';
    }

    for (const model of [new First(), new Second()]) {

      try {

        expect(hasConverterFor('canonical', model)).toBe(true);
        expect(getConverterMetadataFor('canonical', model)?.propertyName).toBe('canonical');
        expect(convertToView('hello', 'canonical', model)).toBe('P:hello');
        expect(convertToViewModel('P:next', 'canonical', model)).toBe('next');
        expect(convertToView('raw', 'label', model)).toBe('raw');

      } finally {
         model.dispose(); 
      }
    }

  }));

  it('converts a real both binding and exposes the written value immediately through the accessor', () => withConverter(() => {
    
    class Model extends ViewModel {
      @convert('alias-test', 'P') @propertyAlias('canonical') accessor label = 'hello';
    }

    const model = new Model();
    const template = document.createElement('template');
    template.innerHTML = '<input data-bind="{value: canonical, mode: twoWay}">';
    const view = new View(template, model);
    
    try {

      const input = view.viewNodeList[0] as HTMLInputElement;
      expect(input.value).toBe('P:hello');
      input.value = 'P:next';
      input.dispatchEvent(new Event('change'));
      expect(model.label).toBe('next');
      expect(model.getPropertyValue('canonical')).toBe('next');
      model.label = 'last';
      expect(input.value).toBe('P:last');

    } finally { 
      view.dispose(); 
      model.dispose(); 
    }

  }));

  it('keeps base and sibling metadata intact when a derived converter overrides an alias', () => withConverter(() => {
   
    class Base extends ViewModel {
      @propertyAlias('canonical') @convert('alias-test', 'B') accessor label = 'base';
    }
    
    class Child extends Base {
      @convert('alias-test', 'C') @propertyAlias('canonical') accessor label = 'child';
    }
    
    class Grandchild extends Child {}
    
    class Sibling extends Base {}
    
    const models = [new Base(), new Child(), new Grandchild(), new Sibling()];
    
    try {
      expect(models.map(model => convertToView('x', 'canonical', model))).toEqual(['B:x', 'C:x', 'C:x', 'B:x']);
      expect(models.map(model => convertToViewModel('P:x', 'canonical', model))).toEqual(['x', 'x', 'x', 'x']);

    } finally { 
      models.forEach(model => model.dispose()); 
    }

  }));

  it('resolves an inherited converter against the derived alias without changing the base alias', () => withConverter(() => {
    
    class Base extends ViewModel {
      @convert('alias-test', 'P') @propertyAlias('baseName') accessor label = 'base';
    }

    class Child extends Base {
      @propertyAlias('childName') accessor label = 'child';
    }

    const base = new Base(), child = new Child();

    try {

      expect(convertToView('x', 'childName', child)).toBe('P:x');
      expect(convertToViewModel('P:x', 'childName', child)).toBe('x');
      expect(hasConverterFor('baseName', child)).toBe(false);
      expect(convertToView('x', 'baseName', base)).toBe('P:x');

    } finally { 
      child.dispose(); 
      base.dispose(); 
    }

  }));

  it('does not confuse an accessor name with another property exposed under that name', () => withConverter(() => {
    
    class Model extends ViewModel {
      @convert('alias-test', 'A') @propertyAlias('canonical') accessor label = 'first';
      @convert('alias-test', 'B') @propertyAlias('label') accessor other = 'second';
    }

    const model = new Model();

    try {

      expect(convertToView('x', 'canonical', model)).toBe('A:x');
      expect(convertToView('x', 'label', model)).toBe('B:x');
      expect(convertToView('x', 'missing', model)).toBe('x');

    } finally { 
      model.dispose(); 
    }

  }));
  
});
