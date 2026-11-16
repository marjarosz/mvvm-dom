import type { IBindingFragment, IStructuralBinding } from '../bindingFragment.js';

/** Structural binding: mounts the fragment when the value is `true`, unmounts it for `false`/nullish. */
export default class IfBinding implements IStructuralBinding {

    constructor(private readonly fragment: IBindingFragment, private readonly property: string, args: string[]) {
        if (args.length) throw new Error(`Binding 'if' takes no arguments for '${property}'`);
    }

    setValue(value: unknown): void {
        
        if (value === true) this.fragment.mount();
        else if (value === false || value == null) this.fragment.unmount();
        else throw new TypeError(`Binding 'if' expects a boolean for '${this.property}'`);
    }
}
