import type { IBindingContext } from './viewModel.js';
import type { IPropertyChangeEvent } from './propertyChangeEvent.js';
import {BindingMode} from './bindingMode.js';
import type { IBinding } from './binding.js';
import {BindingFactory} from './bindingFactory.js';
import { CommandBindingCoordinator } from './commandBindingCoordinator.js';
import type { IValidationErrorBinding } from './validationErrorBinding.js';
import { ValidationErrorBindingFactory } from './validationErrorBindingFactory.js';
import type { IValidationStateChangeEvent } from './validationStateEvent.js';
import { parseBindings, type ParsedBinding } from './bindingParser.js';
import { CompositeDisposable } from './compositeDisposable.js';
import { BindingFragment, type IStructuralBinding, type StructuralBindingFactory } from './bindingFragment.js';
import { convertToView, convertToViewModel } from './valueConverter.js'



/**
 * A rendered instance of a template: the DOM nodes it owns, the data
 * context it is bound to, and its lifecycle.
 */
export interface IView {

    //readonly template: HTMLTemplateElement;

    /** The unique view id, or `null` when not assigned. */
    readonly id: number | null;

    /** All DOM nodes of the view, including mounted structural children. */
    readonly viewNodeList: ChildNode[]

    /** The view name (defaults to an empty string). */
    name: string;

    /** Whether the view owns (and disposes on dispose) its data context. */
    ownsDataContext: boolean;

    /** The bound data context, if any. */
    readonly dataContext: IBindingContext | undefined;

    /** Removes all view nodes from the DOM (without disposing). */
    detach(): void;

    /** Detaches the nodes, disposes all bindings and - when owned - the data context. */
    dispose(): void;

    /** Whether the view has been disposed. */
    readonly isDisposed: boolean;
}

/** Options for the {@link View} constructor. */
export interface IViewOptions {

    /**
     * Whether the view owns (and disposes on dispose) the given data context.
     * Defaults to true, which preserves the default behavior.
     * For a shared model set false and clean up the model at its owner.
     */
    ownsDataContext?: boolean;

}

/**
 * A concrete {@link IView}: renders a template into DOM nodes and wires
 * `data-bind`, `data-command` and `data-validate-error` declarations to
 * the data context.
 *
 * The view subscribes to data-context property and validation-state
 * changes and updates the bound DOM; element changes are propagated back
 * (unless the binding mode is one-way). Structural bindings (`if`,
 * `collection`) mount and unmount child views via {@link BindingFragment}s.
 */
export class View implements IView {

    /** The unique view id, or `null` when not assigned. */
    readonly id: number | null = null;

    /** Whether the view owns (and disposes on dispose) its data context. */
    public ownsDataContext: boolean = true;

    /** The bound data context, if any. */
    get dataContext(){
        return this._dataContext;
    }

    protected _nodeList: ChildNode[] = [];

    private readonly templateName: string;

    private readonly structuralBindings = new Map<string, IStructuralBinding[]>();

    private readonly rootFragments = new Map<ChildNode, BindingFragment>();

    private structuralBindingsReady = false;

    /** All DOM nodes of the view, including mounted structural children. */
    get viewNodeList(): ChildNode[] {
        if (!this.rootFragments.size) return this._nodeList;
        const nodes: ChildNode[] = [];
        for (const root of this._nodeList) {
            nodes.push(root);
            const branch = this.rootFragments.get(root);
            if (branch) nodes.push(...branch.nodes);
        }
        return nodes;
    }

    /** The view name (defaults to an empty string). */
    public name: string = '';

    protected properties: {[name: string]: IBinding[]} = Object.create(null);


    protected errors: {[name: string]: IValidationErrorBinding[]} = Object.create(null)

    protected _dataContext? : IBindingContext;

    private activeEdit?: { binding: IBinding; value: unknown };

    private readonly disposables = new CompositeDisposable();

    private readonly propertyChangeCallback =
        this.propertyChange.bind(this);

    private readonly validationStateChangeCallback =
        this.validationStateChanged.bind(this);

    private readonly validationResetCallback =
        this.validationStateReset.bind(this);


    private disposed = false;

    /** Whether the view has been disposed. */
    get isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * @param template The template element (or any element whose content
     *   is used) to render.
     * @param context The data context to bind to, if any.
     * @param id The optional unique view id.
     * @param options Optional constructor options.
     * @throws {TypeError} When `template` is not an HTMLElement.
     */
    constructor(template: HTMLElement, context?: IBindingContext, id?: number, options?: IViewOptions)
    {

        if (!(template instanceof HTMLElement)) {
            throw new TypeError('View template must be an HTMLElement');
        }

        if(id != undefined) {
            this.id = id;
        }

        if(options && options.ownsDataContext != undefined) {
            this.ownsDataContext = options.ownsDataContext;
        }

        this._dataContext = context;
        this.templateName = template.id;


        try {

            const importedNode = this.prepareTemplate(template);

            if (context) {
                this.disposables.add(() => context.unsubscribeProperties(this.propertyChangeCallback));
                context.subscribeProperties(this.propertyChangeCallback);
                this.disposables.add(() => context.unsubscribeValidationState(this.validationStateChangeCallback));
                context.subscribeValidationState(this.validationStateChangeCallback);
                this.disposables.add(() => context.unsubscribeValidationReset(this.validationResetCallback));
                context.subscribeValidationReset(this.validationResetCallback);
            }

            this.prepareStructuralBindings(importedNode);
            this._nodeList = Array.from(importedNode.childNodes);
            this.prepareProperties(importedNode);
            this.prepareValidateError(importedNode);
            this.prepareCommands(importedNode);
            this.structuralBindingsReady = true;

            for (const property of this.structuralBindings.keys()) {
                this.updateStructuralBindings(property);
            }
        } catch (error) {
            this.disposables.dispose();
            throw error;
        }


    }

    /** Removes all view nodes from the DOM (without disposing). */
    public detach(): void {

        for(const node of this.viewNodeList){
            node.remove();
        }
    }

    /** Imports the template content into a document fragment. */
    private prepareTemplate(template: HTMLElement): DocumentFragment {

        if (template instanceof HTMLTemplateElement) return document.importNode(template.content, true);

        const fragment = document.createDocumentFragment();
        fragment.append(document.importNode(template, true));
        return fragment;
    }

    /** Replaces structural-binding elements with comment anchors and {@link BindingFragment}s. */
    private prepareStructuralBindings(fragment: DocumentFragment): void {

        for (const element of Array.from(fragment.querySelectorAll('[data-bind]'))) {

            // Descendants of a captured template are prepared when it mounts.
            if (!fragment.contains(element)) continue;
            const declarations = this.readBindings(element.getAttribute('data-bind')!, 'data-bind');
            const other: string[] = [];
            let structural: { bind: ParsedBinding; create: StructuralBindingFactory } | undefined;

            for (const bind of declarations) {

                const declaration = bind.declaration;
                const create = BindingFactory.getStructuralBindingFactory(bind.bindingType);
                if (!create) {
                    other.push(`{${declaration}}`);
                    continue;
                }
                if (structural || !bind.propertyName) {
                    throw new Error(`Invalid structural binding: {${declaration}}. Use one structural binding with a property per element.`);
                }
                structural = { bind, create };
            }

            if (!structural) continue;

            const { bind, create } = structural;
            const property = bind.propertyName;

            const anchor = document.createComment(`${bind.bindingType}: ${property}`);
            element.replaceWith(anchor);

            if (other.length) element.setAttribute('data-bind', other.join(', '));
            else element.removeAttribute('data-bind');

            const template = document.createElement('template');
            template.id = this.templateName;
            template.content.append(element);

            const branch = new BindingFragment(anchor, (context, prepare) => {
                const childTemplate = template.cloneNode(true) as HTMLTemplateElement;
                prepare?.(childTemplate);
                return new View(childTemplate, context, undefined, { ownsDataContext: false });
            }, this._dataContext);

            this.disposables.addDisposable(branch);
            const binding = create(branch, property, bind.args);

            if (binding.dispose) this.disposables.add(() => binding.dispose?.());

            const bindings = this.structuralBindings.get(property) ?? [];
            bindings.push(binding);
            this.structuralBindings.set(property, bindings);

            if (anchor.parentNode === fragment) {

                this.rootFragments.set(anchor, branch);
            }
        }
    }

    /**
     * Creates property bindings for all `data-bind` declarations, in two
     * phases: create and register all bindings, then set the initial
     * values and subscribe.
     */
    private prepareProperties(importedNode: DocumentFragment){

        const binds = Array.from(importedNode.querySelectorAll("[data-bind]"));

        // Faza 1: utworz i zarejestruj wszystkie bindingi, zanim ktokolwiek
        // zapisze wartosc - tak wartosc literala jednego bindinga zawierajaca
        // token innego bindinga nie zostanie potraktowana jak szablon
        // (np. przez interpolate).
        const created: {binding: IBinding; propertyName: string}[] = [];

        for (const bn of binds){

           const bindsData = bn.attributes.getNamedItem('data-bind')?.nodeValue as string;
           if(bindsData){

                const bindsArray = this.readBindings(bindsData, 'data-bind');

                for (const bindingDeclaration of bindsArray){

                    if(bindingDeclaration.propertyName && bindingDeclaration.bindingType){
                        const propObject = BindingFactory.createBinding(bindingDeclaration.bindingType, bn as HTMLElement, bindingDeclaration.propertyName, bindingDeclaration.args);
                        this.disposables.addDisposable(propObject);

                        propObject.beginInitialization?.();

                        if(bindingDeclaration.propertyName in this.properties) {
                                this.properties[bindingDeclaration.propertyName].push(propObject);
                        } else {
                                this.properties[bindingDeclaration.propertyName] = [propObject];
                        }

                        created.push({binding: propObject, propertyName: bindingDeclaration.propertyName});
                    }
                }

                bn.removeAttribute('data-bind');
           }
        }

        // Faza 2: w kolejnosci tworzenia ustaw poczatkowa wartosc i zasubskrybuj.
        for (const {binding, propertyName} of created) {

            if(this._dataContext && binding.mode != BindingMode.OneWayToSource){
                const raw = this._dataContext.getPropertyValue(propertyName);
                const val = convertToView(raw, propertyName, this._dataContext);
                binding.setValue(val);
            }

            if(binding.mode != BindingMode.OneWay){
                binding.subscribe(event => this.propertyElementChange(binding, event as IPropertyChangeEvent));
            }
        }

        for (const {binding} of created) binding.endInitialization?.();
    }


    /** Creates command binding coordinators for all `data-command` declarations. */
    private prepareCommands(importedNode: DocumentFragment){

        const commands = Array.from(importedNode.querySelectorAll("[data-command]"));

        for (const cm of commands){
            const bindsCommand = cm.attributes.getNamedItem('data-command')?.nodeValue as string;
            if(bindsCommand){
                const commandsArray = this.readBindings(bindsCommand, 'data-command');
                for (const commandDeclaration of commandsArray){

                    if(commandDeclaration.propertyName && commandDeclaration.bindingType){
                        this.disposables.addDisposable(new CommandBindingCoordinator(cm as HTMLElement, commandDeclaration, this._dataContext));
                    }

                }
                cm.removeAttribute('data-command');
            }

        }

    }

    /** Creates validation error bindings for all `data-validate-error` declarations. */
    private prepareValidateError(importedNode: DocumentFragment) {

        const  valErrors = Array.from(importedNode.querySelectorAll("[data-validate-error]"));

        for (const ve of valErrors){

            const bindsVE = ve.attributes.getNamedItem('data-validate-error')?.nodeValue as string;

            if(bindsVE){

                const veArray = this.readBindings(bindsVE, 'data-validate-error');

                for(const bindElementVE of veArray){

                    if(bindElementVE.propertyName && bindElementVE.bindingType){
                        
                        const errorObj = ValidationErrorBindingFactory.createValidationErrorBinding(bindElementVE.bindingType, ve as HTMLElement, bindElementVE.propertyName, bindElementVE.args);
                        this.disposables.addDisposable(errorObj);
                        const validateFocusCallback = () => {
                            /** Runs property validation on focus-in. */
                            if(this._dataContext){
                                this._dataContext.validateProperty(bindElementVE.propertyName);
                            }
                        };

                        this.disposables.add(() => {
                            ve.removeEventListener('focusin', validateFocusCallback);
                        });

                        ve.addEventListener('focusin', validateFocusCallback);

                        if(bindElementVE.propertyName in this.errors){
                            this.errors[bindElementVE.propertyName].push(errorObj);
                        } else {
                            this.errors[bindElementVE.propertyName] = [errorObj];
                        }

                        const state = this._dataContext?.getPropertyValidationState?.(bindElementVE.propertyName);

                        if (state?.validated) errorObj.setValid(state.isValid, state.message);
                        else if (state) errorObj.reset();
                    }
                }
            }

            ve.removeAttribute('data-validate-error');
        }
    }

    /** Parses an attribute value into bindings, including the template id in error contexts. */
    private readBindings(value: string, attribute: string): ParsedBinding[] {

        const context = this.templateName ? `#${this.templateName} ${attribute}` : attribute;
        return parseBindings(value, context, attribute === 'data-bind');
    }

    /**
     * Detaches the nodes, disposes all bindings, fragments and command
     * coordinators, and - when {@link View.ownsDataContext} - disposes the
     * data context. Idempotent.
     */
    public dispose(): void {

        if(this.disposed){
            return;
        }

        this.disposed = true;

        // Zapisz context przed sprzątaniem, aby nie mutować pól do których
        // odnoszą się callbacki sprzątające w trakcie dispose.
        const context = this._dataContext;

        try {
            this.detach();
            this.disposables.dispose();

            if(this.ownsDataContext && context){

                context.dispose();
            }
        } finally {
            this._nodeList = [];
            this.structuralBindings.clear();
            this.rootFragments.clear();
            this.properties = Object.create(null);
            this.errors = Object.create(null);
            this._dataContext = undefined;
        }
    }

    /** Applies the current value of `property` to all of its structural bindings. */
    private updateStructuralBindings(property: string): void {

        for (const binding of this.structuralBindings.get(property) ?? []) {

            if (this.disposed) return;
            binding.setValue(this._dataContext?.getPropertyValue(property));
        }
    }

    /** Applies a data-context property change to the bound and structural bindings. */
    private propertyChange(event : Event){

        const change = event as IPropertyChangeEvent;
        if (this.structuralBindingsReady) this.updateStructuralBindings(change.propertyName);

        if(change.propertyName in this.properties){

            for (const proBind of this.properties[change.propertyName]){

                if (this.activeEdit?.binding === proBind && Object.is(this.activeEdit.value, change.value)) continue;
                
                if(proBind.mode != BindingMode.OneWayToSource) {
                    const val = convertToView(change.value, change.propertyName, this._dataContext!);
                    proBind.setValue(val);
                }
            }
        }
    }

    /** Applies a validation-state change to the error bindings of the property. */
    private validationStateChanged(event: Event) {

        if((event as IValidationStateChangeEvent).propertyName in this.errors){
            for(const erCh of this.errors[(event as IValidationStateChangeEvent).propertyName]){
                erCh.setValid((event as IValidationStateChangeEvent).isValid, (event as IValidationStateChangeEvent).message );
            }
        }
    }

    /** Resets the error bindings of the property. */
    private validationStateReset(event: Event) {

        if((event as IValidationStateChangeEvent).propertyName in this.errors){
            for(const erCh of this.errors[(event as IValidationStateChangeEvent).propertyName]){
                erCh.reset();
            }
        }
    }

    /** Propagates an element change back to the data context (view-to-model conversion). */
    private propertyElementChange(binding: IBinding, event: IPropertyChangeEvent){

        const context = this._dataContext;
        if (!context) return;
        
        const name = event.propertyName;
        const value = convertToViewModel(event.value, name, context);
        const previous = this.activeEdit;
        this.activeEdit = { binding, value };

        try {
            if (context.setPropertyValueFromView) context.setPropertyValueFromView(name, value);
            else context.setPropertyValue(name, value);
        } finally {
            this.activeEdit = previous;
        }
    }


}
