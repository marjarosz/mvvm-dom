import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `dragover` event: calls `preventDefault` (required for `drop` to fire) and sets `dropEffect` to `copy`. */
export default class DragOverCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private dragoverCallback = this.dragoverElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);
        this.element.addEventListener('dragover', this.dragoverCallback);
    }

    private dragoverElement(event: DragEvent){

        // BEZ preventDefault() drop się NIE wydarzy - to go umożliwia
        event.preventDefault();

        if(event.dataTransfer){
            event.dataTransfer.dropEffect = 'copy';
        }
        
       
        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('dragover', this.dragoverCallback);
        super.dispose();
    }

   
}
