import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `submit` event: prevents native form submission and dispatches the command action instead. */
export default class SubmitCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private submitCallback = this.submitEvent.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        this.element.addEventListener('submit', this.submitCallback);
    }

    private submitEvent(event: Event){

        //Formularz nie wysyla sie natywnie, zapis idzie przez ViewModel
        event.preventDefault();

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {
        
        this.element.removeEventListener('submit', this.submitCallback);
        super.dispose();
    }

}
