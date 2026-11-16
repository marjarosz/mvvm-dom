import { type IBinding, Binding } from '../binding.js'
import {BindingMode} from '../bindingMode.js'
import {PropertyChangeEvent} from '../propertyChangeEvent.js'


/**
 * Binds a DOM attribute - its name is given by the `attributeName` argument -
 * to the property; when the mode is not OneWay a MutationObserver pushes
 * external attribute changes back to the data context.
 */
export default class AttributeBinding extends Binding implements IBinding
{


    protected mutationObserver?: MutationObserver

    private lastValue: string | null = null;

    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]){

        super(element, propertyName, argList);

        if(this.mode != BindingMode.OneWay){
           
            if('attributeName' in this.args){
                
                this.lastValue = this.element.getAttribute(this.args['attributeName']);
                this.mutationObserver = new MutationObserver(this.mutationCallback.bind(this));

                try {
                    this.mutationObserver.observe(this.element, {
                        attributeFilter: [this.args['attributeName']],
                        attributes: true
                    });
                } catch (error) {
                    this.mutationObserver.disconnect();
                    throw error;
                }
            }
        }

       
    }

    setValue(value: unknown): void {

        const name = this.args['attributeName'];
        if (!name) return;
        
        let next: string | null;
        if (value == null) next = null;
        else if (typeof value === 'boolean') next = value ? name : null;
        else if (typeof value === 'string' || typeof value === 'number') next = String(value);
        else return;

        this.lastValue = next;

        if (this.element.getAttribute(name) === next) return;

        if (next === null) this.element.removeAttribute(name);
        else this.element.setAttribute(name, next);
    }

    mutationCallback(_records: MutationRecord[]): void {

        const value = this.element.getAttribute(this.args['attributeName']);

        if (value === this.lastValue) return;
        this.lastValue = value;
        this.propertyChange.dispatchEvent(new PropertyChangeEvent('property-change', this.propertyName, value));
    }

    public dispose(): void {

        if(this.mutationObserver){
            this.mutationObserver.disconnect();
            this.mutationObserver = undefined;
        }
        
        super.dispose();
    }
}
