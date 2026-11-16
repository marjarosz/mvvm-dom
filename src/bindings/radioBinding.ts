import { BindingMode } from '../bindingMode.js';
import { type IBinding, Binding } from '../binding.js';

/**
 * Binding for `input[type=radio]`.
 *
 * The view model holds the VALUE of the selected option (the input's `value`
 * attribute), e.g. "skip" | "update".
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

        const target = value == null ? '' : String(value);
        const input = this.element as HTMLInputElement;

        // Ustaw tylko wtedy, gdy stan różni się od docelowego -
        // chroni przed "wyścigiem" przy zdarzeniu change z tego samego inputa.
        const shouldBeChecked = input.value === target;

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