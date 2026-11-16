 import type { IViewModel } from './viewModel.js';

/**
 * Contract for factories that create {@link IViewModel} instances by name.
 */
export interface IViewModelFactoryBase {
    /**
     * Creates a ViewModel instance by name.
     *
     * @param viewModelName Key of the requested ViewModel in the handler map.
     * @param args Arguments forwarded to the ViewModel constructor.
     * @returns The created ViewModel instance.
     * @throws {Error} When the name is not present in the handler map or the
     *   constructor throws.
     */
    getViewModel(viewModelName: string, ...args: any[]): IViewModel
}

type ViewModelConstructor = new (...args: any[]) => IViewModel;

type ViewModelHandlerMap = Record<string, ViewModelConstructor>;

/**
 * Base class for name-based ViewModel factories.
 * Subclasses provide the name-to-constructor map through
 * `getViewModelHandler()`.
 */
export abstract class ViewModelFactoryBase implements IViewModelFactoryBase{

    /**
     * Returns the map of ViewModel names to constructors.
     * @returns The handler map for this factory.
     */
    protected abstract getViewModelHandler(): ViewModelHandlerMap;

    /**
     * Creates a ViewModel instance by name, forwarding `args` to the
     * constructor.
     *
     * @param viewModelName Key of the requested ViewModel in the handler map.
     * @param args Arguments forwarded to the ViewModel constructor.
     * @returns The created ViewModel instance.
     * @throws {Error} When the name is not present in the handler map, or the
     *   constructor throws (the original error is reported inside the message).
     */
    getViewModel(viewModelName: string, ...args: any[]){

        const handler = this.getViewModelHandler();

        if (!Object.prototype.hasOwnProperty.call(handler, viewModelName)) {
            throw new Error('ViewModel: ' + viewModelName + ' not exist in list');
        }

        const ViewModelClass = handler[viewModelName];
        
        try {
            return new ViewModelClass(...args) as IViewModel;
        } catch(e) {
            throw new Error('ViewModel: ' + viewModelName + ' creation failed. Error message: ' + e);
        }
    }
        
}
