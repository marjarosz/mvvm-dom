/**
 * Change event carrying the name of the changed property and its new value.
 */
export interface IPropertyChangeEvent extends Event{

    /** Name of the property that changed. */
    propertyName: string;
    
    /** New value of the property. */
    value: unknown;
}

/**
 * Standard DOM `Event` implementation of {@link IPropertyChangeEvent}.
 */
export class PropertyChangeEvent extends Event implements IPropertyChangeEvent{
    
    /**
     * @param type Event type (conventionally `property-change`).
     * @param propertyName Name of the property that changed.
     * @param value New value of the property.
     */
    constructor(type: string, public readonly propertyName: string, public readonly value: unknown){

        super(type);
    }

}
