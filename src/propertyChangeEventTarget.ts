import {PropertyChangeEvent} from './propertyChangeEvent.js'

/**
 * An {@link EventTarget} that can raise property change notifications.
 */
export interface IPropertyChangeEventTarget extends EventTarget {
    
    /**
     * Raises a `property-change` event carrying the new property value.
     *
     * @param propertyName Name of the property that changed.
     * @param value New value of the property.
     */
    notifyPropertyChanged<T>(propertyName: string, value:T):void;
}


/**
 * Default {@link IPropertyChangeEventTarget} implementation built on the
 * standard `EventTarget`.
 */
export class PropertyChangeEventTarget extends EventTarget implements IPropertyChangeEventTarget
{
    //private propertyChangeEvent = new PropertyChangeEvent('property-change');

    /**
     * Raises a `property-change` {@link PropertyChangeEvent} for the given
     * property value.
     *
     * @param propertyName Name of the property that changed.
     * @param value New value of the property.
     */
    public notifyPropertyChanged<T>(propertyName: string, value:T){

        // this.propertyChangeEvent.propertyName = propertyName;
        // this.propertyChangeEvent.value = value;
        this.dispatchEvent(new PropertyChangeEvent('property-change', propertyName, value) );
    }

}
