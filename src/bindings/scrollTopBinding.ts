import { BindingMode } from '../bindingMode.js';
import { PropertyChangeEvent } from '../propertyChangeEvent.js';
import { type IBinding, Binding } from '../binding.js';



/** Binds the element's `scrollTop`; scroll events are pushed back as property changes when the mode is not OneWay. */
export default class ScrollTopBinding extends Binding implements IBinding {

    private scrollChangeCallback = this.scrollChange.bind(this);

    private lastPosition?: number;
    
    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]){
        super(element, propertyName, argList);

        if(this.mode != BindingMode.OneWay){
            
            this.element.addEventListener('scroll', this.scrollChangeCallback);

        }

    }


    setValue(value: unknown): void {
     
        if( typeof value === 'number'){
            if (this.element.scrollTop !== value) this.element.scrollTop = value;
            this.lastPosition = this.element.scrollTop;

        }

    }

    private scrollChange(){
       
        const position = this.element.scrollTop;

        if (position === this.lastPosition) return;
        
        this.lastPosition = position;
        this.propertyChange.dispatchEvent(new PropertyChangeEvent('property-change', this.propertyName, position));
    }

    public dispose(): void {

        this.element.removeEventListener('scroll', this.scrollChangeCallback);
        super.dispose();
    }

}
