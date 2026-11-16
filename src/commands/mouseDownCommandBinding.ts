import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `mousedown` event. */
export default class MouseDownCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private mousedownCallback = this.mousedownElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('mousedown', this.mousedownCallback);
    }

    private mousedownElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('mousedown', this.mousedownCallback);
        super.dispose();
    }
}