
import { BindingMode } from '../bindingMode.js';
import { PropertyChangeEvent } from '../propertyChangeEvent.js';
import { type IBinding, Binding } from '../binding.js';
import { controlledSelection, registerOption, unregisterOption } from './selectBindingCoordinator.js';

/** The value, label and selection state of one select option. */
export interface IOptionValue {

    value: string;

    label: string;

    isSelected: boolean;
}

function isOptionValue(value: unknown): value is IOptionValue {

    return typeof value === 'object' &&
        value !== null &&
        'value' in value &&
        typeof value.value === 'string' &&
        'label' in value &&
        typeof value.label === 'string' &&
        'isSelected' in value &&
        typeof value.isSelected === 'boolean';
}

/** Concrete {@link IOptionValue}. */
export class OptionValue implements IOptionValue {
    constructor(public value: string, public label: string, public isSelected: boolean){

    }
}

/**
 * Binds a `select` element's options from an array of {@link IOptionValue}s;
 * reports the current option state back on change when the mode is not
 * OneWay.
 */
export default class OptionsBinding extends Binding implements IBinding {

    protected optionValues: IOptionValue[] = [];

    private changeCallback = this.change.bind(this);

    constructor(protected element: HTMLElement, protected propertyName: string, argList: string[]){

        super(element, propertyName, argList);
        registerOption(element, this);
        this.element.addEventListener('change', this.changeCallback);
    }

    setValue(value: unknown): void {

        if (!(this.element instanceof HTMLSelectElement)) {
            throw new Error('option binding requires a select element');
        }

        if (!Array.isArray(value)) {
            throw new TypeError('option binding expects an array');
        }

        const options = (value as unknown[]).map((item: unknown, index): IOptionValue => {
            if (!isOptionValue(item)) {
                throw new TypeError(`option at index ${index} must have string value and label and boolean isSelected`);
            }
            return { value: item.value, label: item.label, isSelected: item.isSelected };
        });

        this.optionValues = options;
        this.setOptions();
    }

    private setOptions(): void {
        const select = this.element as HTMLSelectElement;

        const options = this.optionValues.map(item => {
            const option = select.ownerDocument.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            return option;
        });

        select.replaceChildren(...options);
        const selected = controlledSelection(this.element);

        if (!selected) {
            if (select.multiple) {
                for (let index = 0; index < options.length; index++) {
                    options[index].selected = this.optionValues[index].isSelected;
                }
            } else {
                select.selectedIndex = this.optionValues.findIndex(item => item.isSelected);
            }
        }

        selected?.optionsChanged();
    }

    private change(): void {

        if (this.mode === BindingMode.OneWay) return;

        const select = this.element as HTMLSelectElement;
        this.optionValues = Array.from(select.options, option => ({
            value: option.value,
            label: option.textContent ?? '',
            isSelected: option.selected
        }));

        this.propertyChange.dispatchEvent(
            new PropertyChangeEvent('property-change', this.propertyName, this.optionValues)
        );
    }

    public dispose(): void {
        
        unregisterOption(this.element, this);
        this.element.removeEventListener('change', this.changeCallback);
        super.dispose();
    }

}
