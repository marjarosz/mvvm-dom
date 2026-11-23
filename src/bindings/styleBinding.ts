import { type IBinding, Binding } from '../binding.js'

/**
 * Binds a CSS style: with a `styleName` argument sets that style property,
 * otherwise replaces the whole `style` attribute (string or number).
 * Null and undefined clear the style exactly like an empty string, including
 * template inline styles on the first render. Without styleName this leaves
 * style="" and clears all declarations, including those set by other bindings.
 */
export default class StyleBinding extends Binding implements IBinding {

    setValue(value: unknown): void {
        
        value = value ?? '';

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