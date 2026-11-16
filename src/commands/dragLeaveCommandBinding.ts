import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `dragleave` event. */
export default class DragLeaveCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private dragleaveCallback = this.dragleaveElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);
        this.element.addEventListener('dragleave', this.dragleaveCallback);
    }

    private dragleaveElement(event: DragEvent){
        
        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('dragleave', this.dragleaveCallback);
        super.dispose();
    }
}
