import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js'

/**
 * Command binding for `mouseenter`/`mouseleave`; the `trigger` argument
 * selects which of them (`mouseIn`/`mouseOut`/`both`, default `both`).
 * The action argument carries `mouseIn` or `mouseOut`.
 */
export default class MouseInOutCommandBinding extends EventCommandBinding implements IEventCommandBinding {

    private mouseenterCallback = this.mouseenterEvent.bind(this);
    private mouseleaveCallback = this.mouseleaveEvent.bind(this);
    
    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget){

        super(element, commandName, argList, eventTarget);

        const trigger = ('trigger' in this.args) ? this.args['trigger'] : 'both'; //mouseIn, mouseOut

        try {

            if(trigger === 'mouseIn' || trigger === 'both'){
                this.element.addEventListener('mouseenter', this.mouseenterCallback);
            }
            if(trigger === 'mouseOut' || trigger === 'both'){
                this.element.addEventListener('mouseleave', this.mouseleaveCallback);
            }
        } catch (error) {

            this.element.removeEventListener('mouseenter', this.mouseenterCallback);
            this.element.removeEventListener('mouseleave', this.mouseleaveCallback);
            throw error;
        }

        
        
    }

    private mouseenterEvent(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event, 'mouseIn');
    }


    private mouseleaveEvent(event: Event){

        this.eventTarget.commandAction(this.commandName, this.element, event, 'mouseOut');
    }

    public dispose(): void {
        
        this.element.removeEventListener('mouseenter', this.mouseenterCallback);
        this.element.removeEventListener('mouseleave', this.mouseleaveCallback);
        super.dispose();
    }

}
