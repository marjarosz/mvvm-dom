import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `mouseup` event. */
export default class MouseUpCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private mouseupCallback = this.mouseupElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){
        
        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('mouseup', this.mouseupCallback);
    }

    private mouseupElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('mouseup', this.mouseupCallback);
        super.dispose();

    }
}