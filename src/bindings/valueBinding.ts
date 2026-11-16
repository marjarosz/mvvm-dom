import { type IBinding, Binding } from '../binding.js'

/**
 * Binds the element's `value` (or `files` for file inputs); reports element
 * changes back on `change`, or on `input` when the `triggerType` argument is
 * `input`.
 */
export default class ValueBinding extends Binding implements IBinding {
    

    private changeEventHandler = this.observeCallback.bind(this);

    private observingEventType?: 'input' | 'change';

    constructor(element: HTMLElement, name:string, argList: string[]){

        super(element, name, argList);
        this.setObserve();
    }

    setValue(value: unknown){
      
        /** Whether the element is a file input. */
        

        if(this.element instanceof HTMLInputElement || this.element instanceof HTMLTextAreaElement){

            if(this.element.type === 'file'){
                (this.element as HTMLInputElement).files = value as FileList | null
                
            } else {
                const text = this.prepareValue(value).toString();
                if (this.element.value !== text) this.element.value = text;
            }

            
        } else {

            this.element.innerText = this.prepareValue(value).toString();
        }
      
        
    }

    private setObserve(){

        if('triggerType' in this.args){

            if(this.args['triggerType'] === 'input'){
                this.element.addEventListener('input', this.changeEventHandler);
                this.observingEventType = 'input';
                
                return;
            } 

        } 

        this.element.addEventListener('change', this.changeEventHandler);
        this.observingEventType = 'change';
       
    }

    public dispose(): void {
        
        if(this.observingEventType){
            this.element.removeEventListener(this.observingEventType, this.changeEventHandler);
            this.observingEventType = undefined;
        }

        super.dispose();
    }

    private observeCallback(event : Event){

        let val;
        
        if((this.element as HTMLInputElement).type === 'file') {
            val = (this.element as HTMLInputElement).files;
        } else {
            val = (this.element as HTMLInputElement).value;
        }
        this.dispatchEvent(val);
    }
}
