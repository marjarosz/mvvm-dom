import { type IBinding, Binding } from '../binding.js';


/**
 * Binds a class list string; classes that were present at construction are
 * treated as static and are never removed. Null, undefined and an empty
 * string remove the dynamic classes. Other non-string values are ignored.
 */
export default class ClassBinding extends Binding implements IBinding {

    private _lastClass: string = '';

    private readonly staticClasses = new Set(this.element.classList);

    setValue(value: unknown): void {
        
        value = value ?? '';

        if (typeof value === 'string') {

            const nextClasses = new Set(this.getClassListArray(value));
            const previousClasses = this.getClassListArray(this._lastClass);
            const toRemove = previousClasses.filter(className =>
                !this.staticClasses.has(className) && !nextClasses.has(className)
            );

            if (toRemove.length) this.element.classList.remove(...toRemove);

            if (nextClasses.size) this.element.classList.add(...nextClasses);

            this._lastClass = value;
        }

    }

    private getClassListArray(classString: string){
        
        const list = classString.trim().split(/\s+/).filter(Boolean);

        return list;
    }
}