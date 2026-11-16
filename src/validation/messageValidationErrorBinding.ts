import type { IValidationStateChangeEventTarget } from '../validationStateEventTarget.js';
import { type IValidationErrorBinding, ValidationErrorBinding } from '../validationErrorBinding.js';

/**
 * Validation binding that renders the validation error message into the
 * element. Visibility is controlled either by the `showClass` / `hideClass`
 * arguments (when both are present) or by toggling `style.display`.
 */
export class MessageValidationErrorBinding extends ValidationErrorBinding implements IValidationErrorBinding {

    /**
     * @param element DOM element that displays the error message.
     * @param propertyName Name of the validated ViewModel property.
     * @param argList Raw `name:value` argument strings of the binding fragment.
     * @param eventTarget Target that publishes `error-change` events.
     */
    constructor(element: HTMLElement, propertyName: string, argList: string[], eventTarget: IValidationStateChangeEventTarget){
        
        super(element, propertyName, argList, eventTarget);
    }

    /**
     * Shows the error message (falling back to the `defaultMessage`
     * argument) when invalid, and hides the element when valid.
     */
    setValid(isValid: boolean, message?: string): void {
        
        super.setValid(isValid, message);

        if(isValid){
            this.setMessage('');
            this.setVisible(false);
            return;
        }

        const resolvedMessage = (message && message.length > 0)
            ? message
            : (('defaultMessage' in this.argsList) ? this.argsList['defaultMessage'] : '');

        this.setMessage(resolvedMessage);
        this.setVisible(true);
    }

    private setMessage(message: string){

        this.element.innerText = message;
    }

    private setVisible(visible: boolean){

        if('showClass' in this.argsList && 'hideClass' in this.argsList){

            if(visible){
                this.element.classList.remove(this.argsList['hideClass']);
                this.element.classList.add(this.argsList['showClass']);
            } else {
                this.element.classList.remove(this.argsList['showClass']);
                this.element.classList.add(this.argsList['hideClass']);
            }

            return;
        }

        this.element.style.display = visible ? '' : 'none';
    }

    /** Marks the property valid, clears the message and hides the element. */
    public reset(): void {
        
        super.reset();
        this.setMessage('');
        this.setVisible(false);
    }
}
