import { BindingMode } from '../bindingMode.js';
import { PropertyChangeEvent } from '../propertyChangeEvent.js';
import { type IBinding, Binding } from '../binding.js';

/**
 * Binds the `checked` state of a checkbox (boolean, string, number or
 * bigint); clicks are propagated back when the mode is not OneWay.
 */
export default class CheckedBinding extends Binding implements IBinding {

    private checkedChangeCallback = this.checkedChange.bind(this);

    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]){

        super(element, propertyName, argList);

        if(this.mode != BindingMode.OneWay){
              this.element.addEventListener('click', this.checkedChangeCallback);
        }

       
    }

    setValue(value: unknown): void {

        const valueType = typeof value;
        let isChecked = false;

        if(valueType === 'boolean'){
            isChecked = value as boolean;
            
        } else if (valueType === 'string'){

            if(value as string === 'true'){
                isChecked = true;
            } 

        } else if (valueType === 'number' || valueType === 'bigint'){

            if(value as number > 0){
                isChecked = true;
            }

        }

        if(isChecked){
            (this.element as HTMLInputElement).checked = true;
        } else {
            (this.element as HTMLInputElement).checked = false;
        }
        

    }

    private checkedChange(ev: Event){

        if(this.element instanceof HTMLInputElement){       
            this.propertyChange.dispatchEvent(new PropertyChangeEvent('property-change', this.propertyName, (this.element as HTMLInputElement).checked));
        }
    }

    public dispose(): void {
        
        this.element.removeEventListener('click', this.checkedChangeCallback);
        super.dispose();
    }
}