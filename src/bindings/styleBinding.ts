import { type IBinding, Binding } from '../binding.js'

/**
 * Binds a CSS style: with a `styleName` argument sets that style property,
 * otherwise replaces the whole `style` attribute (string or number).
 */
export default class StyleBinding extends Binding implements IBinding {

    setValue(value: unknown): void {
        
        const valueType = typeof value;

        if(valueType === 'number'){

            this.setStyleValue((value as number).toString())
        } else if(valueType === 'string') {

            this.setStyleValue(value as string);
        }
        
    }

    private setStyleValue(value: string){

        if('styleName' in this.args){
            this.element.style.setProperty(this.args['styleName'], value as string);
        } else {
            this.element.setAttribute('style', value as string);
        }
    }

}