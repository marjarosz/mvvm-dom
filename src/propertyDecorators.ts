import type { IViewModelValidator } from './validation/viewModelValidator.js';
import type { IViewModel } from './viewModel.js';
import {
    getOrCreateReactivePropertyMetadata,
    type ReactivePropertyMetadata
} from './decoratorMetadata.js';

type ValidatorProvider = IViewModelValidator | (() => IViewModelValidator);
type ValidatorInput = ValidatorProvider | ValidatorProvider[];

// Track declarations per instance: stacked decorators share one declaration,
// while a derived accessor has its own initializer and metadata.
const initializedAccessors = new WeakMap<object, Map<string, ReactivePropertyMetadata>>();

function resolveValidator(provider: ValidatorProvider): IViewModelValidator {
    return typeof provider === 'function' ? provider() : provider;
}

function asViewModel(instance: unknown): IViewModel {

    const candidate = instance as Partial<IViewModel>;

    if (typeof candidate.registerProperty !== 'function' ||
        typeof candidate.setPropertyValueAndNotify !== 'function') {
        throw new TypeError('Reactive decorators require a ViewModel instance');
    }

    return candidate as IViewModel;
}

function registerProperty(
    instance: object,
    accessorName: string,
    metadata: ReactivePropertyMetadata,
    value: unknown
): void {

    const viewModel = asViewModel(instance);
    const propertyName = metadata.propertyName;
    let declarations = initializedAccessors.get(instance);

    if (!declarations) {
        declarations = new Map();
        initializedAccessors.set(instance, declarations);
    }

    const previous = declarations.get(accessorName);
    const overridesDeclaration = previous !== undefined && previous !== metadata &&
        previous.propertyName === propertyName;

    if (overridesDeclaration) {

        viewModel.unregisterPropertyValidator(propertyName);
    }

    if (metadata.validatorInput && !viewModel.hasPropertyValidator(propertyName)) {

        const providers = Array.isArray(metadata.validatorInput)
            ? metadata.validatorInput
            : [metadata.validatorInput as ValidatorProvider];
        viewModel.registerPropertyValidator(propertyName, providers.map(resolveValidator));
    }

    if (overridesDeclaration || !viewModel.hasRegisteredProperty(propertyName)) {

        const callback = metadata.callback
            ? (instance as Record<string, unknown>)[metadata.callback]
            : undefined;
        if (callback !== undefined && typeof callback !== 'function') {
            throw new TypeError(`Property callback is not a function: ${metadata.callback}`);
        }
        viewModel.registerProperty(
            propertyName,
            value,
            typeof callback === 'function' ? callback.bind(instance) : undefined
        );

        if (metadata.validatorInput) viewModel.validateProperty(propertyName);
    }

    declarations.set(accessorName, metadata);
}

function decorateReactiveAccessor<This extends IViewModel, Value>(
    value: ClassAccessorDecoratorTarget<This, Value>,
    context: ClassAccessorDecoratorContext<This, Value>
): ClassAccessorDecoratorResult<This, Value> | void {

    if (context.kind !== 'accessor' || typeof context.name !== 'string') {
        throw new Error('Reactive property decorators can only decorate named accessors');
    }

    const metadata = getOrCreateReactivePropertyMetadata(context.metadata, context.name);

    if (metadata.reactive) return;
    metadata.reactive = true;
    const accessorName = context.name;

    return {

        init(initialValue) {
            registerProperty(this, accessorName, metadata, initialValue);
            return initialValue;
        },
        get() {
            const viewModel = asViewModel(this);
            return viewModel.getPropertyValue(metadata.propertyName) as Value;
        },
        set(nextValue) {
            const viewModel = asViewModel(this);
            viewModel.setPropertyValueAndNotify(metadata.propertyName, nextValue);
            value.set.call(this, nextValue);
        }

    };
}

/**
 * Accessor decorator that registers a property with a validator (or an array
 * of validators). The validator may be an instance or a factory function.
 * Stacking `@validate` and `@propertyChange` on one accessor is supported.
 *
 * @param input Validator instance, validator factory, or an array of either.
 * @param callback Optional name of a method invoked when the property value
 *   changes.
 * @returns The accessor decorator.
 * @throws {Error} When applied to anything other than a named accessor.
 */
export function validate(input: ValidatorInput, callback?: string) {
    return function <This extends IViewModel, Value>(
        value: ClassAccessorDecoratorTarget<This, Value>,
        context: ClassAccessorDecoratorContext<This, Value>
    ): ClassAccessorDecoratorResult<This, Value> | void {

        if (context.kind !== 'accessor' || typeof context.name !== 'string') {
            throw new Error('@validate can only decorate a named accessor');
        }

        const metadata = getOrCreateReactivePropertyMetadata(context.metadata, context.name);
        metadata.validatorInput = input;

        if (callback && !metadata.callback) metadata.callback = callback;

        return decorateReactiveAccessor(value, context);
    };
}

/**
 * Accessor decorator that registers a reactive property on a ViewModel.
 * Reading goes through the registered property store, and writing raises a
 * `property-change` notification.
 *
 * @param callback Optional name of a method invoked when the property value
 *   changes (bound to the ViewModel instance).
 * @returns The accessor decorator.
 * @throws {Error} When applied to anything other than a named accessor.
 * @throws {TypeError} When the resolved callback is not a function.
 */
export function propertyChange(callback?: string) {
    return function <This extends IViewModel, Value>(
        value: ClassAccessorDecoratorTarget<This, Value>,
        context: ClassAccessorDecoratorContext<This, Value>
    ): ClassAccessorDecoratorResult<This, Value> | void {

        if (context.kind !== 'accessor' || typeof context.name !== 'string') {
            throw new Error('@propertyChange can only decorate a named accessor');
        }

        const metadata = getOrCreateReactivePropertyMetadata(context.metadata, context.name);

        if (callback) metadata.callback = callback;

        return decorateReactiveAccessor(value, context);
    };
}

/**
 * Accessor decorator that registers a reactive property under an alias.
 * The accessor name differs from the property name exposed to bindings.
 *
 * @param propertyName Property name exposed to the ViewModel and bindings.
 * @param callback Optional name of a method invoked when the property value
 *   changes (bound to the ViewModel instance).
 * @returns The accessor decorator.
 * @throws {Error} When applied to anything other than a named accessor.
 */
export function propertyAlias(propertyName: string, callback?: string) {
    return function <This extends IViewModel, Value>(
        value: ClassAccessorDecoratorTarget<This, Value>,
        context: ClassAccessorDecoratorContext<This, Value>
    ): ClassAccessorDecoratorResult<This, Value> | void {

        if (context.kind !== 'accessor' || typeof context.name !== 'string') {
            throw new Error('@propertyAlias can only decorate a named accessor');
        }

        const metadata = getOrCreateReactivePropertyMetadata(context.metadata, context.name);
        metadata.propertyName = propertyName;

        if (callback) metadata.callback = callback;
        
        return decorateReactiveAccessor(value, context);
    };
}
