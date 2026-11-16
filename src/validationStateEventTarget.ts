import { ValidationStateChangeEvent, ValidationStateResetEvent } from './validationStateEvent.js';


/**
 * An {@link EventTarget} that can raise validation `error-change` events.
 */
export interface IValidationStateChangeEventTarget extends EventTarget {

    /**
     * Raises an `error-change` event for the given validation result.
     *
     * @param propertyName Name of the validated property.
     * @param isValid Whether the property value is valid.
     * @param message Error message, present only when invalid.
     */
    notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void;
}

/**
 * Default {@link IValidationStateChangeEventTarget} implementation built on
 * the standard `EventTarget`.
 */
export class ValidationStateChangeEventTarget extends EventTarget implements IValidationStateChangeEventTarget {

    /**
     * Raises an `error-change` {@link ValidationStateChangeEvent} for the
     * given validation result.
     *
     * @param propertyName Name of the validated property.
     * @param isValid Whether the property value is valid.
     * @param message Error message, present only when invalid.
     */
    notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void {
        
        this.dispatchEvent(new ValidationStateChangeEvent('error-change', propertyName, isValid, message));
    }

}

/**
 * An {@link EventTarget} that can raise validation `error-reset` events.
 */
export interface IValidationStateResetEventTarget extends EventTarget {

    /**
     * Raises an `error-reset` event for the given property.
     *
     * @param propertyName Name of the property whose validation state was reset.
     */
    notifyValidationStateReset(propertyName: string): void;
}

/**
 * Default {@link IValidationStateResetEventTarget} implementation built on
 * the standard `EventTarget`.
 */
export class ValidationStateResetEventTarget extends EventTarget implements IValidationStateResetEventTarget {

    /**
     * Raises an `error-reset` {@link ValidationStateResetEvent} for the
     * given property.
     *
     * @param propertyName Name of the property whose validation state was reset.
     */
    notifyValidationStateReset(propertyName: string): void {

        this.dispatchEvent(new ValidationStateResetEvent('error-reset', propertyName));
    }

}
