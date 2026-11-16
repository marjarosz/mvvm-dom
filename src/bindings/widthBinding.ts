import SizeBinding from './sizeBinding.js'
import {PropertyChangeEvent} from '../propertyChangeEvent.js'

/** Binds the element width via {@link SizeBinding}; resize events are pushed back as property changes when the mode is not OneWay. */
export default class WidthBinding extends SizeBinding {

    setValue(value: unknown): void {
        
        this.setWidth(value);
    }

    resizeCallback(resize: ResizeObserverEntry[]): void {

        if(resize.length > 0){
            this.propertyChange.dispatchEvent(new PropertyChangeEvent('property-change', this.propertyName, resize[0].contentRect.width));
        }

       
    }

}