 
import { type IValidationStateChangeEventTarget, ValidationStateChangeEventTarget } from './validationStateEventTarget.js';
import type { IValidationErrorBinding } from './validationErrorBinding.js';
import { ClassValidationErrorBinding } from './validation/classValidationErrorBinding.js';
import { MessageValidationErrorBinding } from './validation/messageValidationErrorBinding.js';

/**
 * Creates a validation error binding for a registered type. The factory is
 * invoked with the element, the validated property name, the raw
 * `name:value` argument strings and the event target; the target is always
 * provided.
 */
export type ValidationErrorBindingCreate =
    (element: HTMLElement, name: string, argList: string[], eventTarget: IValidationStateChangeEventTarget) => IValidationErrorBinding;

/**
 * Creates validation error bindings by name.
 *
 * Registered types: `class` (toggles CSS classes on the element),
 * `message` (renders an error message element), and `click` (alias of
 * `class`). New types can be added with
 * {@link ValidationErrorBindingFactory.registerValidationErrorBinding}.
 */
export class ValidationErrorBindingFactory {

    private static readonly validationErrorFactories = new Map<string, ValidationErrorBindingCreate>([

        ['class', (element, name, argList, eventTarget) => new ClassValidationErrorBinding(element, name, argList, eventTarget)],
        ['message', (element, name, argList, eventTarget) => new MessageValidationErrorBinding(element, name, argList, eventTarget)],
        ['click', (element, name, argList, eventTarget) => new ClassValidationErrorBinding(element, name, argList, eventTarget)],
    ])

    /**
     * Creates a validation error binding of the given type.
     *
     * @param type Binding type: `class`, `message`, or `click` (alias of
     *   `class`).
     * @param element DOM element the binding renders into.
     * @param name Name of the validated ViewModel property.
     * @param argList Raw `name:value` argument strings of the binding
     *   fragment.
     * @param eventTarget Target that publishes `error-change` events. A new
     *   target is created when omitted.
     * @returns The created binding.
     * @throws {Error} When the type is not registered.
     */
    static createValidationErrorBinding(type: string, element: HTMLElement, name:string, argList: string[], eventTarget?:IValidationStateChangeEventTarget){

        const evTarget = (eventTarget) ? eventTarget : new ValidationStateChangeEventTarget();

        const create = this.validationErrorFactories.get(type);

        if (create) return create(element, name, argList, evTarget);

        throw new Error(
            `ValidationErrorBindingFactory: unknown type '${type}' ` +
            `for property '${name}'`
        );

    }

    /**
     * Registers a new validation error binding type.
     *
     * @param name The validation error binding type name.
     * @param create The factory invoked with the element, property name,
     *   raw arguments and the event target.
     * @throws {Error} When the name is already registered.
     */
    static registerValidationErrorBinding(name: string, create: ValidationErrorBindingCreate): void {

        this.checkAvailable(name);
        this.validationErrorFactories.set(name, create);
    }

    /** Rejects names that are already taken by a validation error binding type. */
    private static checkAvailable(name: string): void {
        
        if(this.validationErrorFactories.has(name)){
            throw new Error(`ValidationErrorBindingFactory: validation error binding '${name}' is already registered`);
        }
    }

}
