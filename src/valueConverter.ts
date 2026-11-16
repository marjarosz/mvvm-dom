import { getReactivePropertyMetadata } from './decoratorMetadata.js';

/**
 * Value converter between the ViewModel and the View.
 * Equivalent of `IValueConverter` in classic MVVM frameworks.
 * Converters are registered by name and attached to properties with the
 * `@convert` decorator.
 */
export interface IValueConverter {

    /**
     * Converts a value from the ViewModel to the View.
     *
     * @param value Raw value read from the ViewModel.
     * @param parameter Optional parameter supplied to `@convert` (for
     *   example a CSS class name or an enum map).
     * @returns The value to apply to the View.
     */
    convert(value: unknown, parameter?: unknown): unknown;

    /**
     * Converts a value from the View to the ViewModel.
     * Used only when the binding mode is `twoWay` or `oneWayToSource`.
     *
     * @param value Raw value read from the DOM.
     * @param parameter Parameter supplied to `@convert`.
     * @returns The value to write to the ViewModel.
     */
    convertBack?(value: unknown, parameter?: unknown): unknown;
}



type ConverterMetadata = {
    propertyName: string;          // nazwa właściwości ViewModel
    converterName: string;     // klucz w rejestrze (np. 'boolToClass')
    parameter?: unknown;       // parametr konwertera
};

const CONVERTER_META_KEY = Symbol('mvvm:converters');

type ConverterMetadataHolder = { [CONVERTER_META_KEY]?: Map<string, ConverterMetadata> };

/**
 * Optional contract a ViewModel can implement to redirect the converter
 * lookup for a property to a nested context (for example a child model).
 */
export interface ConverterTargetProvider {
    /**
     * Resolves the object that actually declares the converter for the given
     * property.
     *
     * @param propertyName Property to look up.
     * @returns The lookup target `{ context, propertyName }`, or
     *   `undefined` when the property has no converter.
     */
    getConverterTarget(propertyName: string): { context: object; propertyName: string } | undefined;
}

function getOwnConverterMeta(metadata: DecoratorMetadataObject | undefined): Map<string, ConverterMetadata> {

    if (!metadata) throw new Error('Standard decorator metadata is unavailable');
    const holder = metadata as ConverterMetadataHolder;

    if (!Object.prototype.hasOwnProperty.call(metadata, CONVERTER_META_KEY)) {
        Object.defineProperty(metadata, CONVERTER_META_KEY, { value: new Map() });
    }

    return holder[CONVERTER_META_KEY]!;
}

function getConverterMetaFromMetadata(
    metadata: DecoratorMetadataObject | undefined,
    propertyName: string
): ConverterMetadata | undefined {
    const visited = new Set<string>();

    for (let current = metadata; current; current = Object.getPrototypeOf(current)) {

        const holder = current as ConverterMetadataHolder;
        const ownMap = Object.prototype.hasOwnProperty.call(current, CONVERTER_META_KEY)
            ? holder[CONVERTER_META_KEY]
            : undefined;

        for (const [accessorName, item] of ownMap ?? []) {

            if (visited.has(accessorName)) continue;
            visited.add(accessorName);
            // Resolve the final reactive name at lookup time, after all decorators
            // have run, including aliases declared by a derived class.
            const exposedName = getReactivePropertyMetadata(metadata, accessorName)?.propertyName
                ?? accessorName;
            if (exposedName === propertyName) return { ...item, propertyName: exposedName };
        }
    }
    return undefined;
}

/**
 * Accessor decorator that attaches a named value converter to a ViewModel
 * property.
 *
 * Usage example:
 *   @propertyChange()
 *   @convert('boolToClass', 'dis_ctr_opc_act')
 *   accessor isActive: boolean = false;
 *
 * @param converterName Name under which the converter is registered with
 *   `registerConverter`.
 * @param parameter Optional parameter passed to `convert` / `convertBack`.
 * @returns The accessor decorator.
 * @throws {Error} When applied to anything other than a named accessor, or
 *   when another converter is already declared for that property.
 */
export function convert(converterName: string, parameter?: unknown) {
    return function <This, Value>(
        _value: ClassAccessorDecoratorTarget<This, Value>,
        context: ClassAccessorDecoratorContext<This, Value>
    ): void {

        if (context.kind !== 'accessor') {
            throw new Error('@convert can only decorate a named accessor');
        }

        if (typeof context.name !== 'string') {
            throw new Error('@convert requires a string property name');
        }

        const metadata = getOwnConverterMeta(context.metadata);

        if (metadata.has(context.name)) {
            throw new Error(`Converter already declared for ${context.name}`);
        }

        metadata.set(context.name, { propertyName: context.name, converterName, parameter });
    };
}

// ==================== REJESTR KONWERTERÓW ====================

const converters: { [name: string]: IValueConverter } = Object.create(null);

/**
 * Registers a value converter under a name so that it can be referenced from
 * the `@convert` decorator.
 *
 * @param name Registry key used by `@convert` and `getConverter`.
 * @param converter Converter instance to store.
 */
export function registerConverter(name: string, converter: IValueConverter): void {

    converters[name] = converter;
}

/**
 * Removes a converter from the registry.
 *
 * @param name Registry key previously passed to `registerConverter`.
 */
export function unregisterConverter(name: string): void {

    delete converters[name];
}

/**
 * Returns the converter registered under the given name.
 *
 * @param name Registry key.
 * @returns The registered converter.
 * @throws {Error} When no converter is registered under the given name.
 */
export function getConverter(name: string): IValueConverter {

    const c = converters[name];

    if (!c) {
        throw new Error('ValueConverter: "' + name + '" is not registered. Use registerConverter() first.');
    }

    return c;
}

// ==================== FUNKCJE POMOCNICZE (używane z view.ts) ====================

/**
 * Checks whether a ViewModel property has a converter attached with
 * `@convert`.
 *
 * @param propertyName Property name as exposed to bindings.
 * @param vm ViewModel instance (or object) to inspect.
 * @returns `true` when the property has a converter attached.
 */
export function hasConverterFor(propertyName: string, vm: object): boolean {

    return getConverterMetadataFor(propertyName, vm) !== undefined;
}

/**
 * Resolves the converter metadata of a ViewModel property, honoring
 * `ConverterTargetProvider` so nested contexts can declare their own
 * converters.
 *
 * @param propertyName Property name as exposed to bindings.
 * @param vm ViewModel instance (or object) to inspect.
 * @returns The converter metadata, or `undefined` when the property has no
 *   converter.
 */
export function getConverterMetadataFor(propertyName: string, vm: object): ConverterMetadata | undefined {

    if ('getConverterTarget' in vm && typeof vm.getConverterTarget === 'function') {

        const target = (vm as ConverterTargetProvider).getConverterTarget(propertyName);
        if (!target) return undefined;
        vm = target.context;
        propertyName = target.propertyName;
    }

    const metadataKey = (Symbol as typeof Symbol & { metadata: symbol }).metadata;

    // A record may have its own constructor field (or no prototype at all).
    // Only a constructor belonging to an actual prototype supplies class metadata.
    for (let prototype = Object.getPrototypeOf(vm); prototype; prototype = Object.getPrototypeOf(prototype)) {
        
        const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
        
        if (typeof constructor === 'function' && constructor.prototype === prototype) {
            const metadata = Reflect.get(constructor, metadataKey) as DecoratorMetadataObject | undefined;
            return getConverterMetaFromMetadata(metadata, propertyName);
        }
    }

    return undefined;
}

/**
 * Passes a value through the converter attached to a property (ViewModel ->
 * View direction). Returns the value unchanged when the property has no
 * `@convert` decorator.
 *
 * @param value Raw property value.
 * @param propertyName Property name as exposed to bindings.
 * @param vm ViewModel instance (or object) that declares the converter.
 * @returns The converted value, or the input when no converter applies.
 */
export function convertToView(value: unknown, propertyName: string, vm: object): unknown {
    
    const meta = getConverterMetadataFor(propertyName, vm);
    if (!meta) {
        return value;
    }

    return getConverter(meta.converterName).convert(value, meta.parameter);
}

/**
 * Passes a value through the converter attached to a property (View ->
 * ViewModel direction). Returns the value unchanged when the property has no
 * `@convert` decorator or when the converter does not implement
 * `convertBack`.
 *
 * @param value Raw value read from the DOM.
 * @param propertyName Property name as exposed to bindings.
 * @param vm ViewModel instance (or object) that declares the converter.
 * @returns The converted value, or the input when no conversion applies.
 */
export function convertToViewModel(value: unknown, propertyName: string, vm: object): unknown {
    
    const meta = getConverterMetadataFor(propertyName, vm);
    
    if (!meta) {
        return value;
    }

    const converter = getConverter(meta.converterName);
    if (converter.convertBack) {
        return converter.convertBack(value, meta.parameter);
    }
    
    return value;
}
