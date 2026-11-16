import { ViewModel } from '@mvvm/viewModel';
import { View } from '@mvvm/view';
import { ViewFactory } from '@mvvm/viewFactory';
import { Command } from '@mvvm/command';

/** Two views borrowing one model. The owner releases the model last. */
export function mountLifecycle(host: HTMLElement): () => void {

    const factory = new ViewFactory();
    const model = new ViewModel();

    model.registerProperty('count', 0);
    model.registerCommand('bump', new Command(() => model.setPropertyValueAndNotify('count', Number(model.getPropertyValue('count')) + 1)));

    const controls = new ViewModel();

    controls.registerProperty('stateNote', 'Two views, one shared model. Increment either counter.');
    let children: View[] = [];
   
    const mount = () => {
        for (const child of children) child.dispose();
        children = [0, 1].map(() => factory.getViewById('lifeTpl', model, { ownsDataContext: false }));
        for (const child of children) host.append(...child.viewNodeList);
        controls.setPropertyValueAndNotify('stateNote', 'Two views mounted. Both borrow the same model.');
    };
    controls.registerCommand('mountView', new Command(mount));

    controls.registerCommand('detachView', new Command(() => {
        for (const child of children) child.detach();
        controls.setPropertyValueAndNotify('stateNote', 'Detached: nodes are off-screen, views and model are still alive.');
    }));

    controls.registerCommand('reattachView', new Command(() => {
        for (const child of children) host.append(...child.viewNodeList);
        controls.setPropertyValueAndNotify('stateNote', children.length ? 'Reattached the same views; counter state is preserved.' : 'Views were disposed. Mount them again.');
    }));

    controls.registerCommand('disposeView', new Command(() => {
        for (const child of children) child.dispose();
        children = [];
        controls.setPropertyValueAndNotify('stateNote', 'Views disposed. The shared model is still owned here; mount again to reuse it.');
    }));

    const view = factory.getViewById('lifeCtlTpl', controls);
    document.getElementById('lifeControls')!.append(...view.viewNodeList);
    mount();
    
    return () => { for (const child of children) child.dispose(); view.dispose(); model.dispose(); };
}
