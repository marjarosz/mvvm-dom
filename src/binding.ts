import {BindingMode, parseBindingMode} from './bindingMode.js'
import { PropertyChangeEvent } from './propertyChangeEvent.js';
import { type IPropertyChangeEventTarget, PropertyChangeEventTarget } from './propertyChangeEventTarget.js'
import { splitFirstTopLevel } from './bindingParser.js';

/**
 * A connection between a view element property and a data-context property.
 *
 * Implementations are created by {@link BindingFactory} (or a custom
 * binding registration) and owned by a {@link View}.
 */
export interface IBinding{

    /** The binding direction resolved from the `mode` argument (defaults to OneWay). */
    readonly mode: BindingMode;

    /** Optional lifecycle around initial values and subscriptions for all bindings in a view. */
    beginInitialization?(): void;
    
    endInitialization?(): void;

    /**
     * Sets the bound value on the view element.
     *
     * @param value The value to bind (already converted for the view).
     */
    setValue(value: unknown):void;

    /**
     * Subscribes a listener to the binding's `property-change` events.
     *
     * @param propertyChangeEvent Callback invoked for each change.
     */
    subscribe(propertyChangeEvent: (event: Event)=>void): void;

    /**
     * Removes a previously subscribed `property-change` listener.
     *
     * @param propertyChangeEvent Callback to remove.
     */
    unsubscribe(propertyChangeEvent: (event: Event)=>void): void

    /** Releases the binding and all of its subscriptions. Idempotent. */
    dispose(): void
}

/**
 * Base class for all bindings.
 *
 * Parses the `mode` argument and the remaining `name: value` arguments
 * from the binding declaration. Property changes are dispatched as
 * `property-change` {@link PropertyChangeEvent}s; the {@link View} wires
 * the initial value and the back propagation to the data context.
 */
export abstract class Binding {


    /** Optional callback invoked with the value that was set on the binding. */
    public valueChangeCallback: (value: any)=>void = (value: any)=>{};

    protected args: {[argName: string]: string} = Object.create(null);

    /** The binding direction resolved from the `mode` argument (defaults to OneWay). */
    public readonly mode: BindingMode;

    protected propertyChange: IPropertyChangeEventTarget = new PropertyChangeEventTarget();

    protected readonly propertyListeners = new Set<(event: Event) => void>();

    protected disposed = false;

    

    /**
     * @param element The host element the binding is attached to.
     * @param propertyName The data-context property being bound.
     * @param argList Raw `name: value` arguments of the binding declaration.
     * @throws {SyntaxError} When an argument uses the unsupported `bindWay`
     *   name or the `mode` argument is not a known {@link BindingMode}.
     */
    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]){
     
        let mode: BindingMode | undefined;

        for (const arg of argList){
            const argArray = splitFirstTopLevel(arg, ':');

            if(argArray){

                const argsName = argArray[0].trim();

                if (argsName === 'bindWay') {
                    throw new SyntaxError('Binding: unsupported argument bindWay; use mode');
                }

                if(argsName != 'mode'){
                    this.args[argsName] = argArray[1].trim();
                } else {
                    const value = argArray[1].trim();
                    mode = parseBindingMode(value);
                    if (mode === undefined) {
                        throw new SyntaxError(`Binding: unknown mode '${value}' for property '${propertyName}'`);
                    }
                }
              
            }
        }

        this.mode = mode === undefined ? BindingMode.OneWay : mode;

    }

    /** Converts a value for the DOM: `null`/`undefined` become an empty string. */
    protected prepareValue(value: unknown): string {

        return value == null ? '' : String(value);

    }



    /** Emits a `property-change` event carrying `value` for `propertyName`. */
    protected dispatchEvent(value: unknown){
        
        this.propertyChange.dispatchEvent(new PropertyChangeEvent('property-change', this.propertyName, value));       
    }

    /**
     * Subscribes a listener to the binding's `property-change` events.
     *
     * @param propertyChangeEvent Callback invoked for each change.
     * @throws {Error} When the binding has already been disposed.
     */
    public subscribe(propertyChangeEvent: (event: Event)=>void){

        if(this.disposed){
            throw new Error('Cannot subscribe to a disposed Binding');
        }

        this.propertyListeners.add(propertyChangeEvent);
        this.propertyChange.addEventListener('property-change', propertyChangeEvent);
    }

    /**
     * Removes a previously subscribed `property-change` listener.
     *
     * @param propertyChangeEvent Callback to remove.
     */
    public unsubscribe(propertyChangeEvent: (event: Event)=>void){

        this.propertyListeners.delete(propertyChangeEvent);
        this.propertyChange.removeEventListener('property-change', propertyChangeEvent);

    }

    /** Removes all `property-change` listeners. Idempotent. */
    public dispose(): void {

        if(this.disposed){
            return;
        }

        this.disposed = true;

        for(const listener of this.propertyListeners){
            this.propertyChange.removeEventListener('property-change', listener);
        }
        this.propertyListeners.clear();
        
    }

    

}
