import { describe, expect, it } from 'vitest';
import { convert, convertToView, convertToViewModel, registerConverter, unregisterConverter } from '@mvvm/valueConverter';
import { cleanup } from '../helpers/resources';

describe('converter failures and recovery', () => {

  it('does not swallow a forward conversion error and permits later successful conversion', () => {

    registerConverter('test-forward-error', { convert: value => { if (value === 'invalid') throw new Error('Invalid amount'); return Number(value); } });
    cleanup(() => unregisterConverter('test-forward-error'));

    class Model { @convert('test-forward-error') accessor amount = ''; }
    const model = new Model();

    expect(() => convertToView('invalid', 'amount', model)).toThrow('Invalid amount');
    expect(convertToView('12', 'amount', model)).toBe(12);

  });

  it('preserves the backward conversion error and does not change the input object', () => {

    const failure = new Error('Invalid edit');
    registerConverter('test-back-error', { convert: value => value, convertBack: () => { throw failure; } });
    cleanup(() => unregisterConverter('test-back-error'));
    class Model { @convert('test-back-error') accessor amount = ''; }
    
    const input = Object.freeze({ value: 'invalid' });
    expect(() => convertToViewModel(input, 'amount', new Model())).toThrow(failure);
    expect(input).toEqual({ value: 'invalid' });

  });

});
