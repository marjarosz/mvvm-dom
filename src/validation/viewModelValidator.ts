/**
 * Validates a single ViewModel property value.
 * Validators are attached to properties with the `@validate` decorator.
 */
export interface IViewModelValidator {
    /**
     * Checks whether a value is valid.
     *
     * @param value Value to validate.
     * @returns `true` when the value is valid.
     */
    isValid(value: unknown): boolean;
    /**
     * Returns the error message for an invalid value. Optional; when
     * missing, the validation state carries no message.
     *
     * @param value Value that failed validation.
     * @returns The error message.
     */
    getMessage?(value: unknown): string;
}
