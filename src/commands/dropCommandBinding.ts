import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `drop` event: calls `preventDefault` so the browser does not open the dropped file. */
export default class DropCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private dropCallback = this.dropElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);
        this.element.addEventListener('drop', this.dropCallback);
    }

    private dropElement(event: DragEvent){

        // BEZ preventDefault() przeglądarka OTWIERZE plik w nowej karcie
        event.preventDefault();
        this.eventTarget.commandAction(this.commandName, this.element, event);
     
    }

    public dispose(): void {
        
        this.element.removeEventListener('drop', this.dropCallback);
        super.dispose();
    }
}
