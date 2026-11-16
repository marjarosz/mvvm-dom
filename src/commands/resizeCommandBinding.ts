import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `resize` event: listens on `window` and dispatches the command action. */
export default class ResizeCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private resizeCallback = this.resizeElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){
        super(element, commandName, argList, eventTarget);

        window.addEventListener('resize', this.resizeCallback);
       
    }

    private resizeElement(event: Event){
       
        const params: string[] = [];
        this.eventTarget.commandAction(this.commandName, this.element as HTMLElement, event );

    }

    public dispose(): void {
        
        window.removeEventListener('resize', this.resizeCallback);
        super.dispose();
    }
}