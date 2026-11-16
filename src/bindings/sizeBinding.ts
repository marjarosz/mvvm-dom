
import { type IBinding, Binding } from '../binding.js'
import {BindingMode} from '../bindingMode.js'
import {PropertyChangeEvent} from '../propertyChangeEvent.js'


/**
 * Base binding for element size (width/height): applies the value with the
 * `unit` argument (default `px`) and, when the mode is not OneWay, watches
 * resizes with a ResizeObserver and reports them as property changes.
 */
export default class SizeBinding extends Binding implements IBinding {

    protected resizeObserver?: ResizeObserver

    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]){

        super(element, propertyName, argList);

        if(this.mode != BindingMode.OneWay){

            this.resizeObserver = new ResizeObserver(this.resizeCallback.bind(this));

            try {
                this.resizeObserver.observe(this.element);
            } catch (error) {
                this.resizeObserver.disconnect();
                throw error;
            }
        }

    }

    protected getUnit(){

        return ('unit' in this.args) ? this.args['unit'] : 'px';
    }

    protected setHeight(height: unknown){

        const unit = this.getUnit();

        const heightType = typeof height;

        if(heightType === 'string'){
            this.element.style.height = height as string;
        } else if (heightType === 'number'){
            this.element.style.height = (height as number).toString() + unit;
        } else {
            this.element.style.removeProperty('height');
        }

    }

    protected setWidth(width: unknown){

        const unit = this.getUnit();

        const widthType = typeof width;

        if(widthType === 'string'){
            this.element.style.width = width as string;
        } else if (widthType === 'number'){
            this.element.style.width = (width as number).toString() + unit;
        } else {
            this.element.style.removeProperty('width');
        }
    }



    setValue(value: unknown): void {

        if (!Array.isArray(value) || value.length !== 2) {

            this.setWidth(null);
            this.setHeight(null);
            return;
        }

        this.setWidth(value[0]);
        this.setHeight(value[1]);
    }

    resizeCallback(resize: ResizeObserverEntry[]): void {

        if (resize.length === 0) return;

        const { width, height } = resize[0].contentRect;

        this.propertyChange.dispatchEvent(
            new PropertyChangeEvent('property-change', this.propertyName, [width, height])
        );
    }

    public dispose(): void {

        if(this.resizeObserver){
            this.resizeObserver.disconnect();
            this.resizeObserver = undefined;
        }
        
        super.dispose();
    }

}
