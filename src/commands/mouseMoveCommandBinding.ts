import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `mousemove` event. */
export default class MouseMoveCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private mousemoveCallback = this.mousemoveElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        // mousemove - bez stopImmediatePropagation, bo przy dragu
        // zdarzenie musi "wyciec" na document (patrz sekcja 3)
        this.element.addEventListener('mousemove', this.mousemoveCallback);
    }

    private mousemoveElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {
        
        this.element.removeEventListener('mousemove', this.mousemoveCallback);
        super.dispose();
    }
}