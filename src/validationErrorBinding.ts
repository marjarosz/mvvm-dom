import type { IValidationStateChangeEventTarget } from './validationStateEventTarget.js';
import { splitFirstTopLevel } from './bindingParser.js';

/**
 * Contract for bindings that reflect property validation state in the DOM.
 * Implementations react to `error-change` events published by a
 * {@link IValidationStateChangeEventTarget}.
 */
export interface IValidationErrorBinding {

    /**
     * Subscribes an `error-change` listener to the backing event target.
     *
     * @param functionEvent Listener to subscribe.
     * @throws {Error} When called on a disposed binding.
     */
    subscribe(functionEvent: (event: Event)=>void):void;

    /**
     * Removes a previously subscribed `error-change` listener.
     *
     * @param functionEvent Listener to remove.
     */
    unsubscribe(functionEvent: (event: Event)=>void):void;

    /** Releases all subscriptions. Idempotent. */
    dispose(): void;

    /**
     * Applies a validation result to the DOM element.
     *
     * @param isValid Whether the property value is valid.
     * @param message Error message when invalid.
     */
    setValid(isValid: boolean, message?: string):void;

    /** Clears the validation presentation (error state removed). */
    reset():void;
}

/**
 * Base class for validation error bindings: tracks validity, keeps the
 * `error-change` listeners, and parses the `name:value` argument pairs into
 * `argsList` for the concrete implementations.
 */
export abstract class ValidationErrorBinding implements IValidationErrorBinding{

    protected readonly errorListeners = new Set<(event: Event) => void>();

    protected disposed = false;

    /** Current validity flag; updated by `setValid` / `reset`. */
    protected isValid: boolean = false;

    /** Parsed `name:value` arguments of the binding fragment. */
    protected argsList: {[argName: string]: string} = Object.create(null);

    /**
     * @param element DOM element the binding renders into.
     * @param propertyName Name of the validated ViewModel property.
     * @param argList Raw `name:value` argument strings of the binding fragment.
     * @param eventTarget Target that publishes `error-change` events.
     */
    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[], protected eventTarget: IValidationStateChangeEventTarget){
        
        this.prepareArgs(argList)
    }

    /**
     * Subscribes an `error-change` listener to the backing event target.
     *
     * @param functionEvent Listener to subscribe.
     * @throws {Error} When called on a disposed binding.
     */
    subscribe(functionEvent: (event: Event)=>void):void {

        if(this.disposed){
            throw new Error('Cannot subscribe to a disposed ValidationErrorBinding');
        }

        this.errorListeners.add(functionEvent);
        this.eventTarget.addEventListener('error-change', functionEvent)
    }

    /**
     * Removes a previously subscribed `error-change` listener.
     *
     * @param functionEvent Listener to remove.
     */
    unsubscribe(functionEvent: (event: Event)=>void):void {

        this.errorListeners.delete(functionEvent);
        this.eventTarget.removeEventListener('error-change', functionEvent)
    }

    /**
     * Unsubscribes all listeners and marks the binding as disposed.
     * Idempotent.
     */
    public dispose(): void {

        if(this.disposed){
            return;
        }
        this.disposed = true;
        for(const listener of this.errorListeners){
            this.eventTarget.removeEventListener('error-change', listener);
        }

        this.errorListeners.clear();
    }

    /**
     * Records the validation result without touching the DOM. Concrete
     * implementations override this to update the element as well.
     *
     * @param isValid Whether the property value is valid.
     * @param message Error message when invalid.
     */
    setValid(isValid: boolean, message?: string): void {

        this.isValid = isValid;
    }

    /** Marks the property as valid again without touching the DOM. */
    reset(): void {

        this.isValid = true;
    }

    protected prepareArgs(argList: string[]){
        
        for(const arg of argList){
            const argArray = splitFirstTopLevel(arg, ":");
            if(argArray){
                this.argsList[argArray[0].trim()] = argArray[1].trim();
            }
        }
    }
}
