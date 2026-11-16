/**
 * Metadata recorded in the standard decorator metadata of a ViewModel class
 * by the reactive property decorators (`@propertyChange`, `@validate`,
 * `@propertyAlias`). One entry exists per decorated accessor.
 */
export type ReactivePropertyMetadata = {
    /**
     * Property name exposed to the ViewModel and to bindings. May differ
     * from the accessor name when `@propertyAlias` renames it.
     */
    propertyName: string;

    /**
     * Optional name of a method on the ViewModel instance that is bound and
     * invoked whenever the property value changes.
     */
    callback?: string;

    /**
     * Raw validator input passed to `@validate`: a single validator or an
     * array of validators, each a validator instance or a factory function.
     */
    validatorInput?: unknown;

    /** Set to `true` once the accessor has been wired as reactive. */
    reactive?: boolean;

};

const REACTIVE_PROPERTY_METADATA = Symbol('mvvm:reactive-properties');

type MetadataWithReactiveProperties = {
    [REACTIVE_PROPERTY_METADATA]?: Map<string, ReactivePropertyMetadata>;
};

const symbolConstructor = Symbol as typeof Symbol & { metadata?: symbol };

if (!symbolConstructor.metadata) {
    Object.defineProperty(Symbol, 'metadata', { value: Symbol.for('Symbol.metadata') });
}

/**
 * Returns the own reactive-property metadata map stored in the standard
 * decorator metadata, creating it when it does not exist yet.
 *
 * @param metadata The decorator metadata object provided by the runtime.
 * @returns The own map of accessor names to their metadata.
 * @throws {Error} When the standard decorator metadata is unavailable.
 */
export function getOwnReactivePropertyMetadata(
    metadata: DecoratorMetadataObject | undefined
): Map<string, ReactivePropertyMetadata> {

    if (!metadata) throw new Error('Standard decorator metadata is unavailable');
    
    const holder = metadata as MetadataWithReactiveProperties;

    if (!Object.prototype.hasOwnProperty.call(metadata, REACTIVE_PROPERTY_METADATA)) {
        Object.defineProperty(metadata, REACTIVE_PROPERTY_METADATA, { value: new Map() });
    }

    return holder[REACTIVE_PROPERTY_METADATA]!;

}

/**
 * Resolves the reactive property metadata for a named accessor, walking the
 * metadata prototype chain so that properties declared in base classes are
 * found as well.
 *
 * @param metadata The decorator metadata object provided by the runtime.
 * @param propertyName The accessor name to look up.
 * @returns The matching metadata, or `undefined` when the accessor was not
 *   decorated.
 */
export function getReactivePropertyMetadata(
    metadata: DecoratorMetadataObject | undefined,
    propertyName: string
): ReactivePropertyMetadata | undefined {

    for (let current = metadata; current; current = Object.getPrototypeOf(current)) {

        const holder = current as MetadataWithReactiveProperties;
        const ownMap = Object.prototype.hasOwnProperty.call(current, REACTIVE_PROPERTY_METADATA)
            ? holder[REACTIVE_PROPERTY_METADATA]
            : undefined;
        const item = ownMap?.get(propertyName);
        if (item) return item;
    }

    return undefined;
}

/**
 * Returns the reactive property metadata for a named accessor, creating a
 * default entry when none exists yet.
 *
 * @param metadata The decorator metadata object provided by the runtime.
 * @param propertyName The accessor name.
 * @returns The existing or newly created metadata entry.
 * @throws {Error} When the standard decorator metadata is unavailable.
 */
export function getOrCreateReactivePropertyMetadata(
    metadata: DecoratorMetadataObject | undefined,
    propertyName: string
): ReactivePropertyMetadata {

    const ownMap = getOwnReactivePropertyMetadata(metadata);
    let item = ownMap.get(propertyName);
    
    if (!item) {
        item = { propertyName };
        ownMap.set(propertyName, item);
    }

    return item;
}
