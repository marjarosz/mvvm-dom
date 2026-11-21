
import type { ICommand } from './command.js';
import { type IPropertyChangeEventTarget, PropertyChangeEventTarget } from './propertyChangeEventTarget.js'
import type { IViewModelValidator } from './validation/viewModelValidator.js';
import { type IValidationStateChangeEventTarget, type IValidationStateResetEventTarget, ValidationStateChangeEventTarget, ValidationStateResetEventTarget } from './validationStateEventTarget.js';

/**
 * Snapshot of the validation state recorded for a ViewModel property.
 */
type PropertyValidationState = {
    /** Whether the recorded value passed validation. */
    isValid: boolean;
    /** Error message present when `isValid` is `false`. */
    message?: string;
    /** Whether the property has been validated at least once. */
    validated: boolean;
}

/**
 * The binding-side contract a View uses to communicate with a ViewModel:
 * property access, change/validation subscriptions, commands, and disposal.
 *
 * Only the members declared here are available from the View side; the
 * model-side API lives in {@link IViewModel}. Implementations include
 * {@link ViewModel} and the read-only scopes created for nested
 * `collection` bindings.
 */
export interface IBindingContext {
    //Tylko dla widoku


    /**
     * Returns the value of a registered property.
     *
     * @param name Name of the property.
     * @returns The property value, or `undefined` when the property is not
     *   registered.
     */
    getPropertyValue(name: string): unknown

    /**
     * Sets a property value without raising a `property-change` event.
     * Registered validators run first, then the change callback.
     *
     * @param name Name of the property.
     * @param value New value of the property.
     * @param callbackExecute When `true` (default) the change callback runs.
     */
    setPropertyValue(name: string, value: unknown, callbackExecute?: boolean): void

    /**
     * View-originated property write used by two-way bindings; a single
     * `property-change` event is published with the final value.
     * Optional: when missing, the View falls back to `setPropertyValue`.
     *
     * @param name Name of the property.
     * @param value New value read from the DOM.
     * @throws {Error} When the property is not registered.
     */
    setPropertyValueFromView?(name: string, value: unknown): void;

    /**
     * Subscribes to `property-change` events.
     *
     * @param eventCallback Callback invoked with the change event.
     */
    subscribeProperties(eventCallback: (event: Event)=>void): void;

    /**
     * Removes a `property-change` subscription registered by
     * `subscribeProperties`.
     *
     * @param eventCallback Callback previously passed to `subscribeProperties`.
     */
    unsubscribeProperties(eventCallback: (event: Event)=>void): void

    /**
     * Subscribes to validation `error-change` events.
     *
     * @param eventCallback Callback invoked with the event.
     */
    subscribeValidationState(eventCallback: (event: Event)=>void): void;

    /**
     * Removes a validation `error-change` subscription registered by
     * `subscribeValidationState`.
     *
     * @param eventCallback Callback previously passed to
     *   `subscribeValidationState`.
     */
    unsubscribeValidationState(eventCallback: (event: Event)=>void): void;

    /**
     * Subscribes to validation `error-reset` events.
     *
     * @param eventCallback Callback invoked with the event.
     */
    subscribeValidationReset(eventCallback: (event: Event)=>void): void;

    /**
     * Removes a validation `error-reset` subscription registered by
     * `subscribeValidationReset`.
     *
     * @param eventCallback Callback previously passed to
     *   `subscribeValidationReset`.
     */
    unsubscribeValidationReset(eventCallback: (event: Event)=>void): void;

    /**
     * Returns the command registered under the given name.
     *
     * @param name Command name.
     * @returns The registered command, or `undefined` when not found.
     */
    getCommand(name: string): ICommand | undefined;

    /**
     * Subscribes to command registration changes. The callback is invoked
     * whenever a command is registered or unregistered.
     *
     * @param callback Callback receiving the affected command name.
     * @returns A function that removes this subscription.
     */
    subscribeCommands?(callback: (name: string) => void): () => void;

    /**
     * Subscribes to context changes, raised when the context itself is
     * refreshed rather than one of its properties, for example when the item
     * object of a nested `collection` scope or its parent context changes.
     * Bindings re-evaluate themselves in response.
     *
     * @param callback Callback invoked on every context change.
     * @returns A function that removes this subscription.
     */
    subscribeContextChanges?(callback: () => void): () => void;

    /**
     * Validates a property against its registered validators and publishes
     * the resulting state. No-op when the property has no validators.
     *
     * @param name Name of the property.
     */
    validateProperty(name: string): void;

    /**
     * Returns a snapshot of the validation state of a property.
     *
     * @param name Name of the property.
     * @returns The recorded state, or a default state when nothing is
     *   recorded.
     */
    getPropertyValidationState?(name: string): PropertyValidationState;

    /**
     * Releases the resources held by the context.
     */
    dispose():void;
}

/**
 * The full ViewModel contract: everything in {@link IBindingContext} plus the
 * model-side registration, notification and validation API.
 */
export interface IViewModel extends IBindingContext{

    /**
     * Raises a `property-change` event carrying the given value.
     * The notification is suppressed while the property is being written by
     * the view; a single notification is published after the write settles.
     *
     * @param propertyName Name of the property that changed.
     * @param value New value of the property.
     */
    notifyPropertyChanged(propertyName: string, value: unknown): void;

    /**
     * Updates the validation state of a property and raises an
     * `error-change` event. The error message is cleared for valid states.
     *
     * @param propertyName Name of the validated property.
     * @param isValid Whether the property value is valid.
     * @param message Error message when `isValid` is `false`.
     */
    notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void;

    /**
     * Sets a property value and raises a `property-change` event.
     *
     * @param name Name of the property.
     * @param value New value of the property.
     */
    setPropertyValueAndNotify(name: string, value: unknown): void

    /**
     * Registers a reactive property under a name, replacing any previous
     * registration.
     *
     * @param name Name of the property.
     * @param value Initial value of the property.
     * @param changeCallback Optional callback invoked after validation on writes
     *   with callbackExecute = true, not during registration. setPropertyValue
     *   defaults to true; setPropertyValueAndNotify defaults to false. View
     *   writes enable it but skip Object.is-equal values; explicit writes do not.
     *   Plain decorated accessor assignment does not invoke it.
     */
    registerProperty(name: string, value?: unknown, changeCallback?: (value: unknown)=>void): void

    /**
     * Removes a property from the registry. Validators and validation state
     * registered for the property are left untouched.
     *
     * @param name Name of the property.
     */
    unregisterProperty(name: string):void

    /**
     * Checks whether a property is registered.
     *
     * @param name Name of the property.
     * @returns `true` when the property is registered.
     */
    hasRegisteredProperty(name: string): boolean;

    /**
     * Registers a command and notifies command listeners.
     *
     * @param name Command name.
     * @param command Command instance.
     */
    registerCommand(name: string, command: ICommand): void

    /**
     * Unregisters a command and notifies command listeners.
     *
     * @param name Command name.
     */
    unregisterCommand(name: string): void

    /**
     * Registers multiple properties from an object literal.
     *
     * @param properties Map of property names to initial values.
     */
    registerProperties(properties: {[propertyName: string]: unknown}): void

    /**
     * Checks whether the property has any registered validators.
     *
     * @param name Name of the property.
     * @returns `true` when validators are registered.
     */
    hasPropertyValidator(name: string): boolean;

    /**
     * Registers validators for a property, merging with any already
     * registered ones.
     *
     * @param name Name of the property.
     * @param validators Validators to register.
     */
    registerPropertyValidator(name: string, validators: IViewModelValidator[]): void

    /**
     * Removes all validators of a property. When the property had been
     * validated, its validation state is reset.
     *
     * @param name Name of the property.
     */
    unregisterPropertyValidator(name: string):void;

    /**
     * Validates a property against its registered validators and publishes
     * the resulting state. No-op when the property has no validators.
     *
     * @param name Name of the property.
     */
    validateProperty(name: string): void

    /**
     * Sets the validation state of a property and raises an `error-change`
     * event (alias of `notifyValidationStateChanged`).
     *
     * @param name Name of the property.
     * @param isValid Whether the property value is valid.
     * @param message Error message when `isValid` is `false`.
     */
    setPropertyValidationState(name: string, isValid: boolean, message?: string): void;

    /**
     * Removes the recorded validation state of a property and raises an
     * `error-reset` event.
     *
     * @param name Name of the property.
     */
    resetPropertyValidationState(name: string): void;

    /**
     * Validates every property that has registered validators.
     *
     * @returns `true` when all validated properties are valid.
     */
    validate(): boolean;

    /**
     * Checks whether the property is currently valid. A property that has not
     * been validated yet is considered valid.
     *
     * @param name Name of the property.
     * @returns `true` when valid (or never validated).
     */
    isPropertyValid(name: string): boolean;

    /**
     * Returns the last validation error message of a property.
     *
     * @param name Name of the property.
     * @returns The message, or `undefined` when valid or never validated.
     */
    getPropertyValidationMessage(name: string): string | undefined;

    /**
     * Checks whether the property has been validated at least once.
     *
     * @param name Name of the property.
     * @returns `true` when a validation state is recorded.
     */
    hasPropertyBeenValidated(name: string): boolean;

    /**
     * Returns a snapshot of the validation state of a property.
     *
     * @param name Name of the property.
     * @returns The recorded state, or the default state (valid, no message,
     *   not validated) when nothing is recorded.
     */
    getPropertyValidationState(name: string): PropertyValidationState;

    /**
     * Releases the ViewModel resources: properties, commands, validators,
     * validation state and event subscriptions. Must be idempotent.
     *
     * @throws {ViewModelDisposalError} When a command listener throws during
     *   disposal (resources are already released).
     */
    dispose():void;
}


/**
 * Internal descriptor of a registered ViewModel property.
 */
type ViewModelProperty = {

    value: unknown
    changeCallback?: (value: unknown, propertyKey: string)=>void
}


interface PropertyValidationEntry {

    /** Validators registered for the property. */
    validators: Set<IViewModelValidator>
}

/**
 * Thrown when command listeners fail during {@link ViewModel.dispose}.
 * All resources have already been released when this error is thrown; the
 * individual listener failures are available on `errors`.
 */
export class ViewModelDisposalError extends Error {

    /** Errors thrown by command listeners during disposal. */
    readonly errors: readonly unknown[];

    constructor(errors: unknown[]) {
        super('ViewModel disposal notifications failed');
        this.name = 'ViewModelDisposalError';
        this.errors = Object.freeze([...errors]);
    }
}

/**
 * Base ViewModel: a named property registry with change notifications,
 * validation state, a command registry, and deterministic resource disposal.
 */
export class ViewModel implements IViewModel, IBindingContext{


    /**
     * Event target that raises `property-change` events.
     */
    protected propertyChange: IPropertyChangeEventTarget = new PropertyChangeEventTarget();

    /**
     * Event target that raises validation `error-change` events.
     */
    protected validationStateChanged: IValidationStateChangeEventTarget = new ValidationStateChangeEventTarget();


    /**
     * Event target that raises validation `error-reset` events.
     */
    protected validationStateReset: IValidationStateResetEventTarget = new ValidationStateResetEventTarget();

    /**
     * Registry of reactive properties.
     */
    protected properties: { [prop: string] : ViewModelProperty} = Object.create(null);


    /**
     * Registry of registered commands.
     */
    protected commands: {[command: string] : ICommand} = Object.create(null)

    private readonly commandListeners = new Set<(name: string) => void>();

    /**
     * Registry of validators per property.
     */
    protected validators: {[prop: string] : PropertyValidationEntry} = Object.create(null);

    private disposed = false;

    private readonly pendingViewWrites = new Set<string>();

    protected validationStates: { [prop: string]: PropertyValidationState } = Object.create(null);

    /**
     * Raises a `property-change` event carrying the given value.
     * The notification is suppressed while the property is being written by
     * the view (a single notification is published after the write settles).
     *
     * @param propertyName Name of the property that changed.
     * @param value New value of the property.
     */
    public notifyPropertyChanged(propertyName: string, value: unknown){

        // The outer DOM write publishes the final value after callbacks finish.
        if (this.pendingViewWrites.has(propertyName)) return;
        this.propertyChange.notifyPropertyChanged(propertyName, value);
    }

    /**
     * Updates the validation state of a property and raises an
     * `error-change` event. The error message is cleared for valid states.
     *
     * @param propertyName Name of the validated property.
     * @param isValid Whether the property value is valid.
     * @param message Error message when `isValid` is `false`.
     */
    public notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string){

        message = isValid ? undefined : message;
        this.validationStates[propertyName] = { isValid, message, validated: true };
        this.validationStateChanged.notifyValidationStateChanged(propertyName, isValid, message);
    }

    /**
     * Sets a property value without raising a `property-change` event.
     * Runs registered validators first, then the change callback.
     *
     * @param name Name of the property.
     * @param value New value of the property.
     * @param callbackExecute When `true` (default) the change callback runs.
     * @returns `true` when the property exists, `false` otherwise.
     */
    public setPropertyValue(name: string, value: unknown, callbackExecute: boolean = true){

        if(name in this.properties){

            const prop = this.properties[name];

            prop.value = value;

            /**
             * Validacja
             */
            if(this.hasPropertyValidator(name)){
                this.validateProperty(name);
            }

            /**
             * Callback -> wykonanie po validacji
             */
            if(prop.changeCallback && callbackExecute){
                prop.changeCallback(prop.value, name);
            }

            return true;
        }
        return false;
    }

    /**
     * Sets a property value and raises a `property-change` event.
     *
     * @param name Name of the property.
     * @param value New value of the property.
     * @param callbackExecute When `true` the change callback runs
     *   (default `false`).
     * @throws The original validator/callback error, after publishing retained
     *   state. Disposed models and removed/re-registered properties are skipped.
     */
    public setPropertyValueAndNotify(name: string, value: unknown, callbackExecute: boolean = false){
        this.writeAndNotify(name, value, callbackExecute, false);
    }

    /**
     * View-originated property write used by two-way bindings.
     * A single `property-change` event is published with the final value
     * after callbacks finish; no-op when the value has not changed.
     * Retained state is also published if validation or the callback throws,
     * before rethrowing the original error. Disposal/removal cancels completion.
     *
     * @param name Name of the property.
     * @param value New value read from the DOM.
     * @throws {Error} When the property is not registered.
     */
    public setPropertyValueFromView(name: string, value: unknown): void {

        if (!this.hasRegisteredProperty(name)) throw new Error(`Property is not registered: ${name}`);

        if (Object.is(this.getPropertyValue(name), value)) return;

        this.writeAndNotify(name, value, true, true);
    }

    /** Complete an accepted write even if its validator or callback throws. */
    private writeAndNotify(name: string, value: unknown, callbackExecute: boolean, fromView: boolean): void {
        const property = this.properties[name];
        const nested = fromView && this.pendingViewWrites.has(name);
        if (fromView) this.pendingViewWrites.add(name);
        let updated = false;
        let failed = false;
        let failure: unknown;

        try {
            updated = this.setPropertyValue(name, value, callbackExecute);
        } catch (error) {
            failed = true;
            failure = error;
        } finally {
            if (fromView && !nested) this.pendingViewWrites.delete(name);
        }

        // No completion event for a removed/replaced property or disposed model.
        // Explicit writes nested inside a view write still use its suppression.
        if (!nested && property && this.properties[name] === property && !this.disposed && (updated || failed)) {
            try {
                this.notifyPropertyChanged(name, this.getPropertyValue(name));
            } catch (error) {
                // A secondary notification failure must not replace the write error.
                if (!failed) throw error;
            }
        }
        if (failed) throw failure;
    }

    /**
     * Returns the value of a property if it exists.
     *
     * @param name Name of the property.
     * @returns The property value, or `undefined` when the property does not
     *   exist.
     */
    public getPropertyValue(name: string){

        return (name in this.properties) ? this.properties[name].value : undefined;
    }

    /**
     * Subscribes to `property-change` events.
     *
     * @param eventCallback Callback invoked with the change event.
     */
    public subscribeProperties(eventCallback: (event: Event)=>void){

        this.propertyChange.addEventListener('property-change', eventCallback)
    }


    /**
     * Removes a `property-change` event subscription.
     *
     * @param eventCallback Callback previously passed to
     *   `subscribeProperties`.
     */
    public unsubscribeProperties(eventCallback: (event: Event)=>void){

        this.propertyChange.removeEventListener('property-change', eventCallback);
    }


    /**
     * Subscribes to validation `error-change` events.
     *
     * @param eventCallback Callback invoked with the event.
     */
    public subscribeValidationState(eventCallback: (event: Event)=>void){

        this.validationStateChanged.addEventListener('error-change', eventCallback);
    }

    /**
     * Removes a validation `error-change` event subscription.
     *
     * @param eventCallback Callback previously passed to
     *   `subscribeValidationState`.
     */
    public unsubscribeValidationState(eventCallback: (event: Event)=>void){

        this.validationStateChanged.removeEventListener('error-change', eventCallback);
    }

    /**
     * Subscribes to validation `error-reset` events.
     *
     * @param eventCallback Callback invoked with the event.
     */
    public subscribeValidationReset(eventCallback: (event: Event)=>void){

        this.validationStateReset.addEventListener('error-reset', eventCallback);
    }

    /**
     * Removes a validation `error-reset` event subscription.
     *
     * @param eventCallback Callback previously passed to
     *   `subscribeValidationReset`.
     */
    unsubscribeValidationReset(eventCallback: (event: Event)=>void){

        this.validationStateReset.removeEventListener('error-reset', eventCallback);
    }

    /**
     * Returns the command registered under the given name.
     *
     * @param name Command name.
     * @returns The registered command, or `undefined`.
     */
    getCommand(name: string): ICommand | undefined{

        return this.commands[name];
    }

    /**
     * Subscribes to command registration changes. The callback is invoked
     * whenever a command is registered or unregistered.
     *
     * @param callback Callback receiving the affected command name.
     * @returns A function that removes this subscription.
     */
    subscribeCommands(callback: (name: string) => void): () => void {

        this.commandListeners.add(callback);
        return () => this.commandListeners.delete(callback);
    }

    /**
     * Registers a reactive property under a name.
     *
     * @param name Name of the property.
     * @param value Initial value of the property.
     * @param changeCallback Optional callback invoked after validation on writes
     *   with callbackExecute = true, not during registration. setPropertyValue
     *   defaults to true; setPropertyValueAndNotify defaults to false. View
     *   writes enable it but skip Object.is-equal values; explicit writes do not.
     *   Plain decorated accessor assignment does not invoke it.
     */
    public registerProperty(name: string, value?: unknown, changeCallback?: (value: unknown)=>void){

        this.properties[name] = {value: value, changeCallback: changeCallback};
    }

    /**
     * Checks whether a property is registered.
     *
     * @param name Name of the property.
     * @returns `true` when the property is registered.
     */
    public hasRegisteredProperty(name: string){

        return name in this.properties;
    }

    /**
     * Registers multiple properties from an object literal.
     *
     * @param properties Map of property names to initial values.
     */
    public registerProperties(properties: {[propertyName: string]: unknown}){

        for(const propertyName of Object.keys(properties)){
            this.registerProperty(propertyName, properties[propertyName]);
        }
    }

    /**
     * Removes a property from the registry. Validators and validation state
     * registered for the property are left untouched.
     *
     * @param name Name of the property.
     */
    public unregisterProperty(name: string){

        delete this.properties[name];
    }

    /**
     * Registers a command and notifies command listeners.
     *
     * @param name Command name.
     * @param command Command instance.
     */
    public registerCommand(name: string, command: ICommand){

        this.commands[name] = command;
        for (const listener of [...this.commandListeners]) listener(name);
    }

    /**
     * Unregisters a command and notifies command listeners.
     *
     * @param name Command name.
     */
    public unregisterCommand(name: string){

        delete this.commands[name];
        for (const listener of [...this.commandListeners]) listener(name);
    }

    /**
     * Checks whether the property has any registered validators.
     *
     * @param name Name of the property.
     * @returns `true` when validators are registered.
     */
    public hasPropertyValidator(name: string){

        return name in this.validators;
    }



    /**
     * Registers validators for a property, merging with any already
     * registered ones.
     *
     * @param name Name of the property.
     * @param validators Validators to register.
     */
    public registerPropertyValidator(name: string, validators: IViewModelValidator[]){

        if(this.hasPropertyValidator(name)){

            for(const validator of validators){
                this.validators[name].validators.add(validator);
            }

        } else {
            const vals = new Set<IViewModelValidator>();

            for(const validator of validators){
                vals.add(validator);
            }
            this.validators[name] = {
                validators: vals
            }
        }
    }

    /**
     * Removes all validators of a property. When the property had been
     * validated, its validation state is reset.
     *
     * @param name Name of the property.
     */
    public unregisterPropertyValidator(name: string){

        delete this.validators[name];
        if (this.hasPropertyBeenValidated(name)) this.resetPropertyValidationState(name);
    }

    /**
     * Validates a property against its registered validators and publishes
     * the resulting state. No-op when the property has no validators.
     *
     * @param name Name of the property.
     */
    public validateProperty(name: string){

        if (this.hasPropertyValidator(name)) this.validateAndPublish(name);

    }

    /**
     * Sets the validation state of a property and publishes an
     * `error-change` event (alias of `notifyValidationStateChanged`).
     *
     * @param name Name of the property.
     * @param isValid Whether the property value is valid.
     * @param message Error message when `isValid` is `false`.
     */
    setPropertyValidationState(name: string, isValid: boolean, message?: string){

        this.notifyValidationStateChanged(name, isValid, message);
    }

    /**
     * Removes the recorded validation state of a property and publishes an
     * `error-reset` event.
     *
     * @param name Name of the property.
     */
    resetPropertyValidationState(name: string){

        delete this.validationStates[name];

        this.validationStateReset.notifyValidationStateReset(name);
    }

    private validateAndPublish(name: string): boolean {

        const value = this.getPropertyValue(name);
        for(const val of this.validators[name].validators){
            if (!val.isValid(value)) {
                this.notifyValidationStateChanged(name, false, val.getMessage?.(value));
                return false;
            }
        }
        this.notifyValidationStateChanged(name, true);

        return true;

    }

    /**
     * Validates every property that has registered validators.
     *
     * @returns `true` when all validated properties are valid.
     */
    public validate(){

        let isValid = true;

        for(const propertyName in this.validators){
            if (!this.validateAndPublish(propertyName)) {
                isValid = false;
            }

        }
        return isValid;
    }

    /**
     * Releases all resources: properties, commands, validators, validation
     * state, and event targets are cleared and command listeners are
     * notified about every unregistered command. Idempotent.
     *
     * @throws {ViewModelDisposalError} When a command listener throws during
     *   disposal (resources are already released).
     */
    public dispose(): void {

        if(this.disposed){
            return;
        }

        this.disposed = true;

        const commandNames = Object.keys(this.commands);
        const commandListeners = [...this.commandListeners];

        this.properties = Object.create(null);
        this.commands = Object.create(null);
        this.commandListeners.clear();
        this.validators = Object.create(null);
        this.validationStates = Object.create(null);
        this.pendingViewWrites.clear();

        this.propertyChange = new PropertyChangeEventTarget();
        this.validationStateChanged = new ValidationStateChangeEventTarget();
        this.validationStateReset = new ValidationStateResetEventTarget();

        const errors: unknown[] = [];

        for (const name of commandNames) {
            for (const listener of commandListeners) {
                try { listener(name); } catch (error) { errors.push(error); }
            }
        }

        if (errors.length) throw new ViewModelDisposalError(errors);
    }

    /**
     * Checks whether the property is currently valid. A property that has
     * not been validated yet is considered valid.
     *
     * @param name Name of the property.
     * @returns `true` when valid (or never validated).
     */
    public isPropertyValid(name: string): boolean {

        return this.validationStates[name]?.isValid ?? true;
    }

    /**
     * Returns the last validation error message of a property.
     *
     * @param name Name of the property.
     * @returns The message, or `undefined` when valid or never validated.
     */
    public getPropertyValidationMessage(name: string): string | undefined {

        return this.validationStates[name]?.message;
    }

    /**
     * Checks whether the property has been validated at least once.
     *
     * @param name Name of the property.
     * @returns `true` when a validation state is recorded.
     */
    public hasPropertyBeenValidated(name: string): boolean {

        return this.validationStates[name]?.validated ?? false;
    }

    /**
     * Returns a snapshot of the validation state of a property.
     *
     * @param name Name of the property.
     * @returns The recorded state, or the default state (valid, no message,
     *   not validated) when nothing is recorded.
     */
    public getPropertyValidationState(name: string): PropertyValidationState {

        const state = this.validationStates[name];
        
        return state ? { ...state } : {
            isValid: true,
            message: undefined,
            validated: false
        };
    }




}
