import { describe, expect, it, vi } from 'vitest';
import { Command } from '@mvvm/command';
import { propertyChange, validate } from '@mvvm/propertyDecorators';
import { ViewModel } from '@mvvm/viewModel';
import { ValidationErrorBindingFactory } from '@mvvm/validationErrorBindingFactory';
import { own } from '../helpers/resources';
import { mounted } from '../helpers/views';

describe('validation presentation', () => {

  it.each(['validate-first', 'propertyChange-first'])('writes and validates once per edit (%s)', order => {

    const rule = vi.fn((value: unknown) => value !== '');
    const validator = { isValid: rule, getMessage: () => 'Required' };

    class ValidateFirst extends ViewModel {
      @validate(validator) @propertyChange() accessor name = '';
    }

    class PropChangeFirst extends ViewModel {
      @propertyChange() @validate(validator) accessor name = '';
    }

    const model = own(order === 'validate-first' ? new ValidateFirst() : new PropChangeFirst());
    expect(rule.mock.calls).toEqual([['']]);
    const write = vi.spyOn(model, 'setPropertyValue');
    model.name = 'Jan';
    model.registerProperty('show', true);
    const read = vi.fn(() => model.name);
    model.registerCommand('edited', new Command(read));
    const { host } = mounted('<section data-bind="{if: show}"><input data-bind="{value: name, mode: twoWay, triggerType: input}" data-command="{input: edited}"><span data-validate-error="{message: name}"></span></section>', model);
    const input = host.querySelector('input')!;
    expect(input.value).toBe('Jan');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(read).toHaveReturnedWith('');
    expect(model.getPropertyValue('name')).toBe('');
    expect(write.mock.calls.map(([name, value]) => [name, value])).toEqual([['name', 'Jan'], ['name', '']]);
    model.setPropertyValueAndNotify('show', false);
    model.setPropertyValueAndNotify('show', true);
    expect(host.querySelector('span')!.innerText).toBe('Required');
    const replacement = host.querySelector('input')!;
    replacement.value = 'Ada';
    replacement.dispatchEvent(new Event('input'));
    expect(read).toHaveReturnedWith('Ada');
    expect(host.querySelector('span')!.innerText).toBe('');
    expect(rule.mock.calls).toEqual([[''], ['Jan'], [''], ['Ada']]);

  });

  it('renders a message as text, supports a fallback and clears it on reset', () => {

    const node = document.createElement('span');
    const binding = own(ValidationErrorBindingFactory.createValidationErrorBinding('message', node, 'name', ['defaultMessage: Required', 'showClass: shown', 'hideClass: hidden']));
    binding.setValid(false); expect(node.innerText).toBe('Required'); expect(node.classList.contains('shown')).toBe(true);
    binding.setValid(false, '<b>Invalid</b>'); expect(node.innerText).toBe('<b>Invalid</b>'); expect(node.querySelector('b')).toBeNull();
    binding.setValid(true); expect(node.innerText).toBe(''); expect(node.classList.contains('hidden')).toBe(true);
    binding.setValid(false, 'Again'); binding.reset();
    expect(node.innerText).toBe(''); expect(node.classList.contains('shown')).toBe(false);

  });

  it('clears stale error classes on reset without marking an untouched field valid', () => {

    const node = document.createElement('input'); node.className = 'static';
    const binding = own(ValidationErrorBindingFactory.createValidationErrorBinding('class', node, 'name', ['errorClass: invalid', 'noErrorClass: valid']));
    binding.setValid(false); expect(node.classList.contains('invalid')).toBe(true);
    binding.setValid(true); expect(node.classList.contains('valid')).toBe(true);
    binding.setValid(false); binding.reset();
    expect(node.className).toBe('static');

  });

  it('keeps model state, class and message in sync through invalid, valid and reset states', () => {

    const model = own(new ViewModel()); model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: value => value !== '', getMessage: () => 'Required' }]);
    const { host } = mounted('<input data-bind="{value: name, mode: twoWay, triggerType: input}" data-validate-error="{class: name, errorClass: invalid}"><span data-validate-error="{message: name}"></span>', model);
    const input = host.querySelector('input')!, message = host.querySelector('span')!;
    model.validate(); expect(input.classList.contains('invalid')).toBe(true); expect(message.innerText).toBe('Required');
    input.value = 'Anna'; input.dispatchEvent(new Event('input'));
    expect(model.isPropertyValid('name')).toBe(true); expect(input.classList.contains('invalid')).toBe(false); expect(message.innerText).toBe('');
    model.setPropertyValidationState('name', false, 'Server error'); expect(message.innerText).toBe('Server error');
    model.resetPropertyValidationState('name'); expect(input.classList.contains('invalid')).toBe(false); expect(message.innerText).toBe('');
  
  });
  
});
