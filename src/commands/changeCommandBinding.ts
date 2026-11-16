import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `change` event: dispatches the command action when the element's value changes. */
export default class ChangeCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private changeCallback = this.changeElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('change', this.changeCallback);
    }

    private changeElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {
        
        this.element.removeEventListener('change', this.changeCallback);
        super.dispose();
    }

}