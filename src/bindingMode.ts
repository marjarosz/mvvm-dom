/**
 * Direction in which a binding flows between a ViewModel property and a DOM
 * element.
 */
export enum BindingMode {
    /** ViewModel -> View and View -> ViewModel. */
    TwoWay = 0,
    /** ViewModel -> View only. */
    OneWay = 1,
    /** View -> ViewModel only: the DOM writes back to the property. */
    OneWayToSource = 2,
}

/**
 * Parses the `mode` argument of a binding fragment into a {@link BindingMode}.
 *
 * @param value Raw mode string as written in the binding fragment; matching
 *   is case-sensitive (`twoWay`, `oneWay`, `oneWayToSource`).
 * @returns The matching mode, or `undefined` when the value is not
 *   recognized.
 */
export function parseBindingMode(value: string): BindingMode | undefined {

    switch (value) {
        case 'twoWay': return BindingMode.TwoWay;

        case 'oneWay': return BindingMode.OneWay;

        case 'oneWayToSource': return BindingMode.OneWayToSource;
        
        default: return undefined;
    }
}
