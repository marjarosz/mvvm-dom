
import { type IBinding, Binding } from '../binding.js'

/** Binds the element's text content. */
export default class TextBinding extends Binding implements IBinding {
     
    setValue(value: unknown){

        const val = this.prepareValue(value);
        this.element.innerText = val.toString();
    }
}