import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { validate } from '@mvvm/propertyDecorators';
import type { IViewModelValidator } from '@mvvm/validation/viewModelValidator';
import { own } from '../helpers/resources';

describe('validation - result, stored state and notifications agree', () => {

  it('accepts a user-defined rule without a base class through both registration APIs', () => {

    class NotEmpty implements IViewModelValidator {

      isValid(value: unknown): boolean {
        return typeof value === 'string' && value.trim().length > 0;
      }

      getMessage(): string {
        return 'Pole jest wymagane';
      }

    }

    class FormViewModel extends ViewModel {
      @validate(() => new NotEmpty())
      accessor label = '';
    }

    const model = own(new FormViewModel());
    expect(model.hasPropertyValidator('label')).toBe(true);

    expect(model.getPropertyValidationState('label')).toMatchObject({
      isValid: false, validated: true, message: 'Pole jest wymagane'
    });

    model.label = '  Ada  ';
    expect(model.validate()).toBe(true);
    model.label = '   ';
    expect(model.isPropertyValid('label')).toBe(false);

    model.registerProperty('other', '');
    model.registerPropertyValidator('other', [{ isValid: value => value === 'ok' }]);
    model.validateProperty('other');

    expect(model.getPropertyValidationState('other')).toMatchObject({
      isValid: false, validated: true, message: undefined
    });

    model.setPropertyValueAndNotify('other', 'ok');
    expect(model.isPropertyValid('other')).toBe(true);

  });

  it('stores and publishes invalid and later valid results from validate()', () => {

    const model = own(new ViewModel());
    let allowed = false;
    model.registerProperty('name', 'Anna');
    model.registerPropertyValidator('name', [{ isValid: () => allowed, getMessage: () => 'Rejected' }]);
    const errors = vi.fn();
    model.subscribeValidationState(errors);

    expect(model.validate()).toBe(false);

    expect(model.getPropertyValidationState('name')).toMatchObject({
      isValid: false, validated: true, message: 'Rejected',
    });

    expect(errors.mock.calls[errors.mock.calls.length - 1]?.[0]).toMatchObject({ isValid: false, message: 'Rejected' });

    allowed = true; // External rule changes: no setter can hide a validate() bug.
    expect(model.validate()).toBe(true);
    expect(model.isPropertyValid('name')).toBe(true);
    expect(model.hasPropertyBeenValidated('name')).toBe(true);
    expect(errors.mock.calls[errors.mock.calls.length - 1]?.[0]).toMatchObject({ isValid: true });

  });

  it('validates all fields even after a previous field fails', () => {

    const model = own(new ViewModel());
    const first = vi.fn(() => false), second = vi.fn(() => false);
    model.registerProperties({ a: '', b: '' });
    model.registerPropertyValidator('a', [{ isValid: first }]);
    model.registerPropertyValidator('b', [{ isValid: second }]);
    expect(model.validate()).toBe(false);
    expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);

  });

  it('uses the first failing rule message and does not evaluate later rules for that field', () => {

    const model = own(new ViewModel());
    const later = vi.fn(() => false);

    model.registerProperty('name', '');

    model.registerPropertyValidator('name', [
      { isValid: () => false, getMessage: () => 'Required' },
      { isValid: later, getMessage: () => 'Too short' },
    ]);

    model.validateProperty('name');
    expect(model.getPropertyValidationMessage('name')).toBe('Required');
    expect(later).not.toHaveBeenCalled();

  });

  it('distinguishes reset from a successfully validated value', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: () => false }]);
    model.validateProperty('name');
    model.resetPropertyValidationState('name');
    expect(model.getPropertyValidationState('name')).toEqual({ isValid: true, validated: false, message: undefined });

  });

  it('stores manually reported server validation errors', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', 'Anna');
    model.setPropertyValidationState('name', false, 'Already taken');
    expect(model.getPropertyValidationState('name')).toEqual({ isValid: false, validated: true, message: 'Already taken' });

  });

  it('does not allow consumers to mutate the stored state through a returned snapshot', () => {
    
    const model = own(new ViewModel());
    model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: () => false }]);
    model.validateProperty('name');
    const snapshot = model.getPropertyValidationState('name');
    snapshot.isValid = true;
    expect(model.isPropertyValid('name')).toBe(false);

  });

  it('clears validation state when its validators are unregistered', () => {
    
    const model = own(new ViewModel());
    model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: () => false }]);
    model.validateProperty('name');
    model.unregisterPropertyValidator('name');
    expect(model.getPropertyValidationState('name')).toMatchObject({ isValid: true, validated: false });

  });

  it('releases obsolete validation state on model disposal', () => {
    
    const model = new ViewModel();
    model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: () => false, getMessage: () => 'Old' }]);
    model.validateProperty('name');
    model.dispose();
    expect(model.getPropertyValidationMessage('name')).toBeUndefined();
    expect(model.hasPropertyBeenValidated('name')).toBe(false);
    
  });
});
