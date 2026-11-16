import type { IBinding } from './binding.js'
import type { StructuralBindingFactory } from './bindingFragment.js';
import IfBinding from './bindings/ifBinding.js';
import CollectionBinding from './bindings/collectionBinding.js';
import HtmlBinding from './bindings/htmlBinding.js'
import TextBinding from './bindings/textBinding.js'
import ValueBinding from './bindings/valueBinding.js'
import VisibilityBinding from './bindings/visibilityBinding.js'
import DisplayBinding from './bindings/displayBinding.js'
import AttributeBinding from './bindings/attributeBinding.js'
import SizeBinding from './bindings/sizeBinding.js'
import HeightBinding  from './bindings/heightBinding.js'
import WidthBinding from './bindings/widthBinding.js'
import StyleBinding from './bindings/styleBinding.js'
import ClassBinding from './bindings/classBinding.js'
import ScrollTopBinding from './bindings/scrollTopBinding.js'
import ScrollLeftBinding from './bindings/scrollLeftBinding.js'
import CheckedBinding from './bindings/checkedBinding.js'
import OptionsBinding from './bindings/optionsBinding.js'
import SelectedValuesBinding from './bindings/selectedValuesBinding.js'
import BooleanAttributeBinding from './bindings/booleanAttributeBinding.js'
import InterpolationBinding from './bindings/interpolationBinding.js'
import RadioBinding from './bindings/radioBinding.js'

type BindFactory = (element: HTMLElement, name: string, argList: string[]) => IBinding;

/**
 * Registry and factory for all binding types.
 *
 * Property bindings (like `text`, `value`) are created via
 * {@link BindingFactory.createBinding}; structural bindings (like `if`,
 * `collection`) via {@link BindingFactory.getStructuralBindingFactory}.
 * New types can be added with {@link BindingFactory.registerBinding} and
 * {@link BindingFactory.registerStructuralBinding}.
 */
export class BindingFactory {

    private static readonly structural = new Map<string, StructuralBindingFactory>([
        ['if', (fragment, property, args) => new IfBinding(fragment, property, args)],
        ['collection', (fragment, property, args) => new CollectionBinding(fragment, property, args)]
    ]);

    /**
     * Returns the factory of a structural binding type.
     *
     * @param name The structural binding type (e.g. `if`, `collection`).
     * @returns The factory, or `undefined` when the type is not structural.
     */
    static getStructuralBindingFactory(name: string): StructuralBindingFactory | undefined {

        return this.structural.get(name);

    }

    /**
     * Registers a new structural binding type.
     *
     * @param name The binding type name.
     * @param create The factory invoked with the fragment, property and args.
     * @throws {Error} When the name is already registered.
     */
    static registerStructuralBinding(name: string, create: StructuralBindingFactory): void {

        this.checkAvailable(name);
        this.structural.set(name, create);

    }


    /** The built-in property binding types. */
    private static readonly bindingFactories = new Map<string, BindFactory>([
        ['innerHTML', (element, name, argList) => new HtmlBinding(element, name, argList)],
        ['text', (element, name, argList) => new TextBinding(element, name, argList)],
        ['value', (element, name, argList) => new ValueBinding(element, name, argList)],
        ['visibility', (element, name, argList) => new VisibilityBinding(element, name, argList)],
        ['display', (element, name, argList) => new DisplayBinding(element, name, argList)],
        ['attribute', (element, name, argList) => new AttributeBinding(element, name, argList)],
        ['size', (element, name, argList) => new SizeBinding(element, name, argList)],
        ['height', (element, name, argList) => new HeightBinding(element, name, argList)],
        ['width', (element, name, argList) => new WidthBinding(element, name, argList)],
        ['style', (element, name, argList) => new StyleBinding(element, name, argList)],
        ['class', (element, name, argList) => new ClassBinding(element, name, argList)],
        ['scrollTop', (element, name, argList) => new ScrollTopBinding(element, name, argList)],
        ['scrollLeft', (element, name, argList) => new ScrollLeftBinding(element, name, argList)],
        ['checked', (element, name, argList) => new CheckedBinding(element, name, argList)],
        ['radio', (element, name, argList) => new RadioBinding(element, name, argList)],
        ['options', (element, name, argList) => new OptionsBinding(element, name, argList)],
        ['selectedValues', (element, name, argList) => new SelectedValuesBinding(element, name, argList)],
        ['readonly', (element, name, argList) => new BooleanAttributeBinding(element, name, argList, 'readonly')],
        ['disabled', (element, name, argList) => new BooleanAttributeBinding(element, name, argList, 'disabled')],
        ['interpolate', (element, name, argList) => new InterpolationBinding(element, name, argList)],
       
    ]);

    /**
     * Creates an {@link IBinding} of the given type.
     *
     * @param type The binding type (e.g. `text`, `value`).
     * @param element The host element.
     * @param name The data-context property to bind.
     * @param argList Raw `name: value` arguments of the declaration.
     * @returns The created binding.
     * @throws {Error} When `type` is not a registered binding type.
     */
    static createBinding(type: string, element: HTMLElement, name:string, argList: string[]): IBinding{

        const create = this.bindingFactories.get(type);

        if (create) return create(element, name, argList);
        throw new Error(
            `BindingFactory: unknown bind type '${type}' for property '${name}'`
        );

    }

    /**
     * Registers a new property binding type.
     *
     * @param name The binding type name.
     * @param bindElement The factory invoked with the element, property name and args.
     * @throws {Error} When the name is already registered.
     */
    static registerBinding(name: string, bindElement: BindFactory){

        this.checkAvailable(name);
        this.bindingFactories.set(name, bindElement);

    }

    /** Rejects names that are already taken by any binding type. */
    private static checkAvailable(name: string): void {

        if(this.structural.has(name) || this.bindingFactories.has(name)){
            throw new Error(`BindingFactory: bind '${name}' is already registered`);
        }
        
    }

}
