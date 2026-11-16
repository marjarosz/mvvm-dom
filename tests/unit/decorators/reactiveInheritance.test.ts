import { describe, expect, it } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { propertyChange, propertyAlias, validate } from '@mvvm/propertyDecorators';

describe('reactive accessor inheritance', () => {

  it('keeps the base value available in the base constructor before initializing the child', () => {

    const seen: unknown[] = [];

    class Base extends ViewModel {

      @propertyChange() accessor name = 'base';
      constructor() {
        super();
        seen.push(this.name);
        this.setPropertyValueAndNotify('name', 'base-constructor');
        seen.push(this.name);
      }

    }

    class Child extends Base { @propertyChange() accessor name = 'child'; }
    const model = new Child();
    expect(seen).toEqual(['base', 'base-constructor']);
    expect(model.name).toBe('child');
    model.dispose();

  });

  it('initializes each declaration once and replaces the validator in the derived class', () => {

    const validations: string[] = [];

    class Base extends ViewModel {
      @propertyChange()
      @validate({ isValid: value => { validations.push(`base:${value}`); return value === 'base'; } })
      accessor name = 'base';
    }

    class Child extends Base {
      @validate({ isValid: value => { validations.push(`child:${value}`); return value === 'child'; } })
      @propertyChange()
      accessor name = 'child';
    }

    const model = new Child();
    expect(model.name).toBe('child');
    expect(model.getPropertyValue('name')).toBe('child');
    expect(model.isPropertyValid('name')).toBe(true);
    expect(validations).toEqual(['base:base', 'child:child']);
    validations.length = 0;
    let notifications = 0;

    model.subscribeProperties(() => notifications++);
    model.name = 'next';
    expect(model.getPropertyValue('name')).toBe('next');
    expect(model.isPropertyValid('name')).toBe(false);
    expect(validations).toEqual(['child:next']);
    expect(notifications).toBe(1);
    validations.length = 0;

    model.setPropertyValueFromView('name', 'child');
    expect(model.name).toBe('child');
    expect(validations).toEqual(['child:child']);
    expect(model.isPropertyValid('name')).toBe(true);
    model.dispose();

  });

  it('keeps base, sibling and instance state isolated across three declarations', () => {

    class Base extends ViewModel {
      @validate({ isValid: value => value === 'base' }) @propertyChange() accessor name = 'base';
    }

    class Child extends Base {
      @propertyChange() @validate({ isValid: value => value === 'child' }) accessor name = 'child';
    }

    class Grandchild extends Child {
      @validate({ isValid: value => value === 'grandchild' }) @propertyChange() accessor name = 'grandchild';
    }

    class Sibling extends Base {}

    class Inherited extends Child {}

    const models = [new Base(), new Child(), new Grandchild(), new Sibling(), new Inherited(), new Child()];
    expect(models.map(model => model.name)).toEqual(['base', 'child', 'grandchild', 'base', 'child', 'child']);
    expect(models.map(model => model.validate())).toEqual([true, true, true, true, true, true]);
    models[1].name = 'changed';
    expect(models[5].name).toBe('child');
    expect(models[5].validate()).toBe(true);
    models.forEach(model => model.dispose());

  });

  it('removes inherited validation when a new declaration has no validator', () => {

    class Base extends ViewModel {
      @validate({ isValid: () => false }) accessor name = 'base';
    }

    class Child extends Base { @propertyChange() accessor name = 'child'; }

    const model = new Child();
    expect(model.name).toBe('child');
    expect(model.hasPropertyValidator('name')).toBe(false);
    expect(model.hasPropertyBeenValidated('name')).toBe(false);
    expect(model.validate()).toBe(true);
    model.dispose();

  });

  it('replaces a callback without invoking it before subclass private fields are initialized', () => {

    let baseCalls = 0;

    class Base extends ViewModel {
      @propertyChange('baseChanged') accessor name = 'base';
      baseChanged() { baseCalls++; }
    }

    class Child extends Base {
      @propertyChange('childChanged') accessor name = 'child';
      #values: string[] = [];
      childChanged(value: string) { this.#values.push(value); }
      get values() { return this.#values; }
    }

    const model = new Child();
    expect(baseCalls).toBe(0);
    expect(model.values).toEqual([]);
    model.setPropertyValueFromView('name', 'next');
    expect(baseCalls).toBe(0);
    expect(model.values).toEqual(['next']);
    model.dispose();

  });

  it('does not retain a base callback when the derived declaration omits it', () => {

    let calls = 0;
    class Base extends ViewModel {
      @propertyChange('changed') accessor name = 'base';
      changed() { calls++; }
    }

    class Child extends Base { @propertyChange() accessor name = 'child'; }
    const model = new Child();
    model.setPropertyValueFromView('name', 'next');
    expect(calls).toBe(0);
    model.dispose();

  });

  it('overrides an aliased accessor and uses only its current validation for binding writes', () => {

    let childValidations = 0;

    class Base extends ViewModel {
      @propertyAlias('canonical') @validate({ isValid: value => value === 'base' }) accessor label = 'base';
    }

    class Child extends Base {
      @validate({ isValid: value => { childValidations++; return value === 'child'; } })
      @propertyAlias('canonical') accessor label = 'child';
    }

    const model = new Child();
    expect(model.label).toBe('child');
    expect(model.getPropertyValue('canonical')).toBe('child');
    expect(childValidations).toBe(1);
    model.setPropertyValueFromView('canonical', 'invalid');
    expect(model.label).toBe('invalid');
    expect(model.isPropertyValid('canonical')).toBe(false);
    expect(childValidations).toBe(2);
    model.dispose();
  });
  
});
