import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'
/** Command binding for the `input` event: dispatches the command action on every input. */
export default class InputCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private inputCallback = this.inputElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){
        
        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('input', this.inputCallback);
    }

    private inputElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('input', this.inputCallback);
        super.dispose();
    }

}