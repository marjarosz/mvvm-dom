import type { IBindingContext } from '../viewModel.js';
import type { ConverterTargetProvider } from '../valueConverter.js';
import { PropertyChangeEvent, type IPropertyChangeEvent } from '../propertyChangeEvent.js';
import { CollectionObserver } from '../collectionObserver.js';

/**
 * Binding context of one collection row: resolves `object.*` paths on the
 * row item and `parent.*` on the parent scope, re-emitting property changes
 * when the row or the source collection changes.
 */
export class CollectionScope implements IBindingContext, ConverterTargetProvider {

    private readonly events = new EventTarget();

    private readonly values = new Map<string, unknown>();

    private readonly anyListeners = new Set<() => void>();

    private readonly sourceChanged = () => this.refresh();

    private readonly parentChanged = (event: Event) => {
        const change = event as IPropertyChangeEvent;
        if (!change.propertyName.startsWith('object.') && !change.propertyName.startsWith('parent.')) {
            this.events.dispatchEvent(new PropertyChangeEvent('property-change', change.propertyName, change.value));
        }
        this.refresh();
    };

    constructor(
        public readonly object: unknown,
        private readonly parent: IBindingContext | undefined,
        private readonly source: CollectionObserver<unknown> | undefined
    ) {

        this.source?.subscribeItemChanges(this.sourceChanged);

        if (parent instanceof CollectionScope) parent.anyListeners.add(this.sourceChanged);
        parent?.subscribeProperties(this.parentChanged);
    }

    getPropertyValue(name: string): unknown {

        const value = this.resolve(name);
        if (name === 'object' || name === 'parent' || name.startsWith('object.') || name.startsWith('parent.')) this.values.set(name, value);
        return value;
    }

    getConverterTarget(name: string): { context: object; propertyName: string } | undefined {
        
        if (name.startsWith('parent.') && this.parent instanceof CollectionScope) {
            return this.parent.getConverterTarget('object.' + name.slice(7));
        }

        if (name.startsWith('parent.')) return undefined;

        if (!name.startsWith('object.') && name !== 'object') {
            const parentName = name;
            if (this.parent instanceof CollectionScope) return this.parent.getConverterTarget(parentName);
            return this.parent ? { context: this.parent, propertyName: parentName } : undefined;
        }

        const parts = name.split('.').slice(1);

        if (!parts.length) return undefined;
        const propertyName = parts.pop()!;
        let context: unknown = this.object;

        for (const part of parts) {
            if (context == null) return undefined;
            context = Reflect.get(Object(context), part);
        }

        return context !== null && (typeof context === 'object' || typeof context === 'function')
            ? { context, propertyName }
            : undefined;
    }

    private resolve(name: string): unknown {

        const parts = name.split('.');
        let value: unknown;

        if (parts[0] === 'object') value = this.object;
        else if (parts[0] === 'parent') value = this.parent instanceof CollectionScope ? this.parent.object : undefined;
        else return this.parent?.getPropertyValue(name);
       
        for (const key of parts.slice(1)) {
            if (value == null) return undefined;
            value = Reflect.get(Object(value), key);
        }

        return value;
    }

    private refresh(): void {

        for (const [name, old] of this.values) {
            const value = this.resolve(name);
            if (!Object.is(value, old)) {
                this.values.set(name, value);
                this.events.dispatchEvent(new PropertyChangeEvent('property-change', name, value));
            }
        }
        for (const callback of [...this.anyListeners]) callback();
    }

    setPropertyValue(): void { 

        throw new Error('Collection row bindings are read-only'); 
    }

    subscribeProperties(callback: (event: Event) => void): void { 

        this.events.addEventListener('property-change', callback); 
    }
    
    unsubscribeProperties(callback: (event: Event) => void): void { 

        this.events.removeEventListener('property-change', callback); 

    }
    
    subscribeValidationState(callback: (event: Event) => void): void { 

        this.parent?.subscribeValidationState(callback); 

    }
    
    unsubscribeValidationState(callback: (event: Event) => void): void { 
        
        this.parent?.unsubscribeValidationState(callback); 
    
    }
    
    subscribeValidationReset(callback: (event: Event) => void): void { 
        
        this.parent?.subscribeValidationReset(callback); 
    
    }
    
    unsubscribeValidationReset(callback: (event: Event) => void): void { 
        
        this.parent?.unsubscribeValidationReset(callback); 
    
    }
    
    getCommand(name: string) { 
        
        return this.parent?.getCommand(name); 
    
    }
    
    subscribeCommands(callback: (name: string) => void): () => void {

        return this.parent?.subscribeCommands?.(callback) ?? (() => {});

    }
    
    subscribeContextChanges(callback: () => void): () => void {

        this.anyListeners.add(callback);
        return () => this.anyListeners.delete(callback);
    }
    
    validateProperty(name: string): void { 
        
        this.parent?.validateProperty(name); 
    
    }
    
    getPropertyValidationState(name: string) {

        return this.parent?.getPropertyValidationState?.(name) ?? { isValid: true, validated: false };
    }
    
    dispose(): void {

        this.source?.unsubscribeItemChanges(this.sourceChanged);
        
        if (this.parent instanceof CollectionScope) this.parent.anyListeners.delete(this.sourceChanged);
        this.parent?.unsubscribeProperties(this.parentChanged);
        this.values.clear();
        this.anyListeners.clear();
    }
}
