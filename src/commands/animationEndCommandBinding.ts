
import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/** Command binding for the `animationend` event. */
export default class AnimationEndCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private animationendCallback = this.animationendElement.bind(this);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);
        this.element.addEventListener('animationend', this.animationendCallback);
        
    }

    private animationendElement(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event);
    }

    public dispose(): void {

        this.element.removeEventListener('animationend', this.animationendCallback);
        super.dispose();
    }
}