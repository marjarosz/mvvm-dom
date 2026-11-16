import { type IBinding, Binding } from '../binding.js';
import { removeDisabledContribution, setDisabledContribution } from '../disabledCoordinator.js';

/**
 * Sets or removes a boolean attribute (e.g. `disabled`); the `disabled`
 * attribute is additionally coordinated through the disabled coordinator.
 */
export default class BooleanAttributeBinding extends Binding implements IBinding {

    constructor(
        element: HTMLElement,
        propertyName: string,
        argList: string[],
        private readonly attributeName: string
    ) {

        super(element, propertyName, argList);
        if (attributeName === 'disabled') setDisabledContribution(element, this, 'bindings', element.hasAttribute('disabled'));
    }

    setValue(value: unknown): void {

        if (this.attributeName === 'disabled') {
            setDisabledContribution(this.element, this, 'bindings', value === true);
            return;
        }

        if (value === true) {
            this.element.setAttribute(this.attributeName, this.attributeName);
        } else {
            this.element.removeAttribute(this.attributeName);
        }

    }

    dispose(): void {
        
        if (this.attributeName === 'disabled') removeDisabledContribution(this.element, this, 'bindings');
        super.dispose();
    }
}