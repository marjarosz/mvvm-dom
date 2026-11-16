import { BindingMode } from '../bindingMode.js';
import { Binding } from '../binding.js';
import { registerSelection, unregisterSelection } from './selectBindingCoordinator.js';

function sameValues(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Binds the selected values of a `select multiple` (an array of strings);
 * reconciles the option state on option mutations and reports user changes
 * when the mode is not OneWay.
 */
export default class SelectedValuesBinding extends Binding {

    private readonly select: HTMLSelectElement;

    private readonly changeCallback = this.change.bind(this);

    private readonly observer: MutationObserver;

    private selectedValues: string[] = [];

    private initialized = true;

    private hasValue = false;

    constructor(element: HTMLElement, propertyName: string, argList: string[]) {

        super(element, propertyName, argList);

        if (!(element instanceof HTMLSelectElement) || !element.multiple) {
            throw new TypeError('selectedValues binding requires a select multiple element');
        }

        this.select = element;
        this.observer = new MutationObserver(() => this.optionsChanged());

        try {

            registerSelection(element, this);
            if (this.mode !== BindingMode.OneWay) {
                this.select.addEventListener('change', this.changeCallback);
            }
            this.observer.observe(this.select, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['value', 'selected']
            });
        } catch (error) {
            // Each rollback step must run, and none may replace the initialization error.
            // unregisterSelection checks identity, so a conflicting owner remains intact.
            try { unregisterSelection(this.select, this); } catch { /* preserve original error */ }
            try { this.select.removeEventListener('change', this.changeCallback); } catch { /* preserve original error */ }
            try { this.observer.disconnect(); } catch { /* preserve original error */ }
            super.dispose();
            throw error;
        }
    }

    public setValue(value: unknown): void {

        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
            throw new TypeError('selectedValues binding expects an array of strings');
        }

        this.selectedValues = [...value];
        this.hasValue = true;

        if (this.initialized) this.reconcile();
    }

    public endInitialization(): void {

        this.initialized = true;
        this.reconcile();
    }

    public beginInitialization(): void {

        this.initialized = false;
    }

    public optionsChanged(): void {

        if (this.initialized && !this.disposed) this.reconcile();
    }

    private reconcile(): void {

        if (!this.hasValue || this.mode === BindingMode.OneWayToSource) return;

        const wanted = new Set(this.selectedValues);
        const matched = new Set<string>();
        const normalized: string[] = [];

        for (const option of Array.from(this.select.options)) {

            const selected = wanted.has(option.value);
            option.selected = selected;

            if (selected && !matched.has(option.value)) {
                matched.add(option.value);
                normalized.push(option.value);
            }
        }
        if (this.mode === BindingMode.TwoWay && !sameValues(this.selectedValues, normalized)) {

            this.selectedValues = normalized;
            this.dispatchEvent(normalized.slice());
        }
    }

    private change(): void {

        const selected = new Set<string>();
        const values: string[] = [];

        for (const option of Array.from(this.select.options)) {

            if (option.selected && !selected.has(option.value)) {
                selected.add(option.value);
                values.push(option.value);
            }
        }

        this.selectedValues = values;
        this.hasValue = true;

        if (this.mode === BindingMode.TwoWay) this.reconcile();
        this.dispatchEvent(values.slice());
    }

    public dispose(): void {
        
        unregisterSelection(this.select, this);
        this.observer.disconnect();
        this.select.removeEventListener('change', this.changeCallback);
        super.dispose();
    }
}
