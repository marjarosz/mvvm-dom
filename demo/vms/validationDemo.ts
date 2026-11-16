import { ViewModel } from '@mvvm/viewModel';
import { propertyChange, validate } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import type { IViewModelValidator } from '@mvvm/validation/viewModelValidator';
import type { ICommand } from '@mvvm/command';

class NotEmptyValidator implements IViewModelValidator {

    isValid(value: unknown): boolean {
        return typeof value === 'string' && value.trim().length > 0;
    }

    getMessage(): string {
        return 'Field is required';
    }
}

class EmailValidator implements IViewModelValidator {

    isValid(value: unknown): boolean {
        return typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    }

    getMessage(): string {
        return 'Invalid email address';
    }
}

class MinLengthValidator implements IViewModelValidator {

    constructor(private readonly min: number) {}

    isValid(value: unknown): boolean {
        return typeof value === 'string' && value.length >= this.min;
    }

    getMessage(): string {
        return `Password must have at least ${this.min} characters`;
    }
}

/** Validation: @validate rules, data-validate-error class/message bindings. */
@autoRegisterCommands()
export class ValidationDemoModel extends ViewModel {

    @propertyChange()
    @validate(() => new NotEmptyValidator())
    accessor login = '';

    @propertyChange()
    @validate([() => new NotEmptyValidator(), () => new EmailValidator()])
    accessor email = 'not-an-email';

    @propertyChange()
    @validate(() => new MinLengthValidator(8))
    accessor password = 'short';

    @propertyChange()
    accessor formState = 'untouched';

    @command<ValidationDemoModel>('submitValidated')
    private submitValidated(_command: ICommand): void {

        this.formState = this.validate() ? 'submitted: whole model is valid' : 'blocked: validation errors present';
    }

    @command<ValidationDemoModel>('resetValidation')
    private resetValidation(_command: ICommand): void {
        
        this.resetPropertyValidationState('login');
        this.resetPropertyValidationState('email');
        this.resetPropertyValidationState('password');
        this.formState = 'validation states reset';
    }
}
