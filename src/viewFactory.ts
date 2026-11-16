import { View, type IView, type IViewOptions } from './view.js'
import type { IBindingContext } from './viewModel.js'

/** Creates {@link View}s from templates. */
export interface IViewFactory{

    /** Creates a view from an explicit template element. */
    getView(template: HTMLElement, dataContext?: IBindingContext, options?: IViewOptions) : IView

    /** Creates a view from the template with the given `id`. */
    getViewById(id: string, dataContext?: IBindingContext, options?: IViewOptions) : IView

    /** Returns the template element with the given `id`. */
    getTemplateById(id: string): HTMLElement

}

/** Default {@link IViewFactory}: resolves templates by `id` from the document. */
export class ViewFactory implements IViewFactory{

    /**
     * Creates a view from an explicit template element.
     *
     * @param template The template element to render.
     * @param dataContext The data context to bind to, if any.
     * @param options Optional constructor options.
     * @returns The created view.
     */
    getView(template: HTMLElement, dataContext?: IBindingContext, options?: IViewOptions): View {

        return new View(template, dataContext, undefined, options);
    }

    /**
     * Creates a view from the template with the given `id`.
     *
     * @param id The `id` of the template element in the document.
     * @param dataContext The data context to bind to, if any.
     * @param options Optional constructor options.
     * @returns The created view.
     * @throws {Error} When no template with `id` exists.
     * @throws {TypeError} When the element with `id` is not an HTMLElement.
     */
    getViewById(id: string, dataContext?: IBindingContext, options?: IViewOptions): View {

        return this.getView(this.getTemplateById(id), dataContext, options);
    }

    /**
     * Returns the template element with the given `id`.
     *
     * @param id The `id` of the template element in the document.
     * @returns The template element.
     * @throws {Error} When no element with `id` exists.
     * @throws {TypeError} When the element with `id` is not an HTMLElement.
     */
    getTemplateById(id: string): HTMLElement {

        const template = document.getElementById(id);

        if (!template) throw new Error(`View template not found: ${id}`);

        if (!(template instanceof HTMLElement)) throw new TypeError(`View template is not an HTMLElement: ${id}`);
        
        return template;
    }

}