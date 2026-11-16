import type { IValidationStateChangeEventTarget } from '../validationStateEventTarget.js';
import { type IValidationErrorBinding, ValidationErrorBinding } from '../validationErrorBinding.js';

/**
 * Validation binding that reflects the validation state as CSS classes on
 * the element (`errorClass` / `noErrorClass`). Optionally re-applies or
 * clears the classes on `focus` / `blur` via the `focusIn` / `focusOut`
 * arguments.
 */
export class ClassValidationErrorBinding extends ValidationErrorBinding implements IValidationErrorBinding {

    private focusOutCallback = this.focusOut.bind(this);

    private focusInCallback = this.focusIn.bind(this);
    
 
    
    /**
     * @param element DOM element to toggle classes on.
     * @param propertyName Name of the validated ViewModel property.
     * @param argList Raw `name:value` argument strings of the binding fragment.
     * @param eventTarget Target that publishes `error-change` events.
     */
    constructor(element: HTMLElement, propertyName: string, argList: string[], eventTarget: IValidationStateChangeEventTarget){
        super(element, propertyName, argList, eventTarget);

        
        if('focusOut' in this.argsList && this.argsList['focusOut'] === 'true'){
            this.element.addEventListener('blur', this.focusOutCallback);
             
        }

        if('focusIn' in this.argsList && this.argsList['focusIn'] === 'true'){
            this.element.addEventListener('focus', this.focusInCallback);
             
        }

    }

    /** Applies the validation result by toggling the error/no-error classes. */
    setValid(isValid: boolean, message?: string): void {

        super.setValid(isValid);
        this.setClass(isValid);
    }

    private setClass(isValid: boolean){

        if(isValid){
            this.removeErrorClass();
            this.addNoErrorClass();

        } else {
            this.removeNoErrorClass();
            this.addErrorClass();
  
        }
    }

    private focusOut(event: Event){
        
        if(this.isValid){
            this.removeNoErrorClass();
        }
    }

    private focusIn(event: Event){
        
        this.setClass(this.isValid);
    }

    private addErrorClass(){

       if(('errorClass' in this.argsList)){
           this.element.classList.add(this.argsList['errorClass']);
       }
          
    }

    private removeErrorClass(){

        if(('errorClass' in this.argsList)){
            this.element.classList.remove(this.argsList['errorClass']);
        }
    }

    private addNoErrorClass(){

        if(('noErrorClass' in this.argsList)) {
            this.element.classList.add(this.argsList['noErrorClass']);
        }
    }

    private removeNoErrorClass(){

        if(('noErrorClass' in this.argsList)) {
            this.element.classList.remove(this.argsList['noErrorClass']);
        }
    }

    /** Marks the property valid and removes both error and no-error classes. */
    public reset(): void {

        super.reset();
        this.removeErrorClass();
        this.removeNoErrorClass();
    }

    /** Removes the focus listeners and disposes the base binding. */
    public dispose(): void {
        
        this.element.removeEventListener('blur', this.focusOutCallback);
        this.element.removeEventListener('focus', this.focusInCallback);
        super.dispose();
    }
}
