import { BindingMode } from '../bindingMode.js';
import { type IBinding, Binding } from '../binding.js';

/**
 * Binding for `input[type=radio]`.
 *
 * The view model holds the VALUE of the selected option (the input's `value`
 * attribute), e.g. "skip" | "update". Null and undefined never match and
 * uncheck the input, including on the first render. An empty string still
 * matches value="". Other values are compared using String(value).
 *
 * Usage:
 *   <input type="radio" name="grp" value="skip"   data-bind="{radio: existingLabelsBehavior, mode: twoWay}">
 *   <input type="radio" name="grp" value="update" data-bind="{radio: existingLabelsBehavior, mode: twoWay}">
 */
export default class RadioBinding extends Binding implements IBinding {

    private radioChangeCallback = this.radioChange.bind(this);

    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]) {

        super(element, propertyName, argList);

        if (this.mode != BindingMode.OneWay) {
            this.element.addEventListener('change', this.radioChangeCallback);
        }
    }

    setValue(value: unknown): void {

        if (!(this.element instanceof HTMLInputElement) || this.element.type !== 'radio') {
            return;
        }

        const input = this.element as HTMLInputElement;

        // Ustaw tylko wtedy, gdy stan różni się od docelowego -
        // chroni przed "wyścigiem" przy zdarzeniu change z tego samego inputa.
        const shouldBeChecked = value != null && input.value === String(value);

        if (input.checked !== shouldBeChecked) {
            input.checked = shouldBeChecked;
        }
    }

    private radioChange(ev: Event) {

        if (this.element instanceof HTMLInputElement && this.element.checked) {
            this.dispatchEvent(this.element.value);
        }
    }

    public dispose(): void {
        
        this.element.removeEventListener('change', this.radioChangeCallback);
        super.dispose();
    }
}