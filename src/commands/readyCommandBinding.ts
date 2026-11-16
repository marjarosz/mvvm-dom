import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the custom `ready` event dispatched on the element. */
export default class ReadyCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private readyCallback = this.readyElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);
        this.element.addEventListener('ready', this.readyCallback);
    }

    private readyElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('ready', this.readyCallback);
        super.dispose();
    }
}