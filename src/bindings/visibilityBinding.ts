import { type IBinding, Binding } from '../binding.js'

/** Binds the CSS `visibility` style (`visible`/`hidden`). */
export default class VisibilityBinding extends Binding implements IBinding{

    setValue(value: unknown): void {

        this.element.style.visibility = (value) ? 'visible' : 'hidden';
    }
}