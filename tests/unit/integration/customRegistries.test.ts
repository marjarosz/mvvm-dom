import { describe, expect, it, vi } from 'vitest';
import { CommandBindingFactory } from '@mvvm/commandBindingFactory';
import { ValidationErrorBindingFactory } from '@mvvm/validationErrorBindingFactory';
import { EventCommandBinding } from '@mvvm/eventCommandBinding';
import { ValidationErrorBinding } from '@mvvm/validationErrorBinding';
import type { ICommandActionEventTarget } from '@mvvm/commandActionEventTarget';
import type { IValidationStateChangeEventTarget } from '@mvvm/validationStateEventTarget';
import { Command } from '@mvvm/command';
import { ViewModel } from '@mvvm/viewModel';
import { mounted } from '../helpers/views';
import { own } from '../helpers/resources';

// Custom command binding type, registered once for this file's process.
class DblClickCommandBinding extends EventCommandBinding {
  private dblClickCallback = this.dblClickElement.bind(this);

  constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget) {

    super(element, commandName, argList, eventTarget);
    this.element.addEventListener('dblclick', this.dblClickCallback);

  }

  private dblClickElement(event: Event): void {

    this.eventTarget.commandAction(this.commandName, this.element, event);

  }

  public override dispose(): void {

    this.element.removeEventListener('dblclick', this.dblClickCallback);
    super.dispose();

  }
}

CommandBindingFactory.registerCommandBinding('testDblClick',
  (element, name, argList, eventTarget) => new DblClickCommandBinding(element, name, argList, eventTarget));

// Custom validation error binding type: a data-error flag plus message text.
class BannerErrorBinding extends ValidationErrorBinding {

  public override setValid(isValid: boolean, message?: string): void {

    super.setValid(isValid, message);

    if (isValid) {
      this.element.removeAttribute('data-error');
      this.element.textContent = '';
    } else {
      this.element.setAttribute('data-error', message ?? '');
      this.element.textContent = message ?? '';
    }
  }

  public override reset(): void {
    super.reset();
    this.element.removeAttribute('data-error');
    this.element.textContent = '';
  }
}

ValidationErrorBindingFactory.registerValidationErrorBinding('testBanner',
  (element, name, argList, eventTarget) => new BannerErrorBinding(element, name, argList, eventTarget));

describe('registered custom command binding through View', () => {

  it('runs the ViewModel command on dblclick and ignores a single click', () => {
    const execute = vi.fn();
    const model = own(new ViewModel());
    model.registerCommand('save', new Command(execute));
    const { host } = mounted('<button data-command="{testDblClick: save}"></button>', model);
    const button = host.querySelector('button')!;

    button.click();
    expect(execute).not.toHaveBeenCalled();
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    expect(execute).toHaveBeenCalledTimes(1);

  });

  it('releases the custom binding when the view is disposed', () => {

    const execute = vi.fn();
    const model = own(new ViewModel());
    model.registerCommand('save', new Command(execute));
    const { view, host } = mounted('<button data-command="{testDblClick: save}"></button>', model);
    const button = host.querySelector('button')!;

    view.dispose();
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    expect(execute).not.toHaveBeenCalled();

  });

});

describe('registered custom validation error binding through View', () => {

  it('applies the initial validated state at mount and reacts to later changes', () => {

    const model = own(new ViewModel());
    model.registerProperty('name', '');
    model.registerPropertyValidator('name', [{ isValid: (value: unknown) => value !== '', getMessage: () => 'Required' }]);
    model.validateProperty('name');
    const { host } = mounted('<span data-validate-error="{testBanner: name}"></span>', model);
    const banner = host.querySelector('span')!;

    // The state was validated before mounting: the initial state applies.
    expect(banner.textContent).toBe('Required');
    expect(banner.getAttribute('data-error')).toBe('Required');

    model.setPropertyValueAndNotify('name', 'abc');
    model.validateProperty('name');
    expect(banner.textContent).toBe('');
    expect(banner.hasAttribute('data-error')).toBe(false);

  });
  
});
