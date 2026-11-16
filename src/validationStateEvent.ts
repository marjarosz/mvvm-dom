/**
 * Event raised when the validation state of a property changes.
 */
export interface IValidationStateChangeEvent extends Event{

    /** Name of the validated property. */
    propertyName: string;

    /** Whether the property value is valid. */
    isValid: boolean;

    /** Error message, present only when `isValid` is `false`. */
    message?: string;
}

/**
 * Standard DOM `Event` implementation of {@link IValidationStateChangeEvent}.
 */
export class ValidationStateChangeEvent extends Event implements IValidationStateChangeEvent{
    /**
     * @param type Event type (conventionally `error-change`).
     * @param propertyName Name of the validated property.
     * @param isValid Whether the property value is valid.
     * @param message Error message, present only when invalid.
     */
    constructor(type: string, public readonly propertyName: string, public readonly isValid: boolean, public readonly message?: string){
        
        super(type);
    }
}

/**
 * Event raised when the recorded validation state of a property is reset.
 */
export interface IValidationStateResetEvent extends Event{

    /** Name of the property whose validation state was reset. */
    propertyName: string;
}

/**
 * Standard DOM `Event` implementation of {@link IValidationStateResetEvent}.
 */
export class ValidationStateResetEvent extends Event implements IValidationStateResetEvent{

    /**
     * @param type Event type (conventionally `error-reset`).
     * @param propertyName Name of the property whose validation state was reset.
     */
    constructor(type: string, public readonly propertyName: string){
        super(type);
    }
    
}
