import { type IBinding, Binding } from '../binding.js'

/**
 * Binds the CSS `display` style; booleans use the `trueVal`/`falseVal`
 * arguments (default `block`/`none`), strings are applied as-is.
 * Null and undefined use falseVal, including on the first render. An empty
 * string clears the inline display declaration, allowing CSS to determine it.
 * Other inline style properties are unaffected.
 */
export default class DisplayBinding extends Binding implements IBinding{
    
    setValue(value: unknown): void {
            
        value = value ?? false;

        const valueType = typeof value;

        if(valueType === 'boolean'){

            //Value jest boolean

            const trueVal = ('trueVal' in this.args) ? this.args['trueVal'] : 'block';
            const falseVal = ('falseVal' in this.args) ? this.args['falseVal'] : 'none';

            this.element.style.display = (value) ? trueVal : falseVal;

        } else if(valueType === 'string'){

            //value jest string
            
            this.element.style.display = value as string;
        }

    }
}