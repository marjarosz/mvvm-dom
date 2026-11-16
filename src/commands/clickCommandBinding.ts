import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'
/** Command binding for the `click` event: dispatches the command action on element click. */
export default class ClickCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private clickCallback = this.clickElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('click', this.clickCallback);
    }

    private clickElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {
        
        this.element.removeEventListener('click', this.clickCallback);
        super.dispose();
    }

}