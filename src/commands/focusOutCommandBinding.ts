import type { ICommandActionEventTarget } from '../commandActionEventTarget.js';
import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';


/** Command binding for the `focusout` event: dispatches the command action when the element loses focus. */
export default class FocusOutCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private focusoutCallback = this.inputElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('focusout', this.focusoutCallback);
    }

    private inputElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {
        
        this.element.removeEventListener('focusout', this.focusoutCallback);
        super.dispose();
    }
}