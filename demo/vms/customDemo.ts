import { Binding } from '@mvvm/binding';
import { BindingMode } from '@mvvm/bindingMode';
import { BindingFactory } from '@mvvm/bindingFactory';
import type { IBindingFragment, IStructuralBinding } from '@mvvm/bindingFragment';
import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import type { ICommand } from '@mvvm/command';

/** Custom regular binding: sets aria-label from the model. */
class AriaLabelBinding extends Binding {

    constructor(element: HTMLElement, propertyName: string, args: string[]) {

        super(element, propertyName, args);

        if (this.mode !== BindingMode.OneWay) {
            throw new Error('ariaLabel supports only mode: oneWay');
        }

        if (Object.keys(this.args).length) {
            throw new Error('ariaLabel does not accept extra arguments');
        }
    }

    setValue(value: unknown): void {

        if (value == null) this.element.removeAttribute('aria-label');
        else this.element.setAttribute('aria-label', String(value));
    }
}

/** Custom structural binding: mounts the branch only while the value is 'ready'. */
class WhenReadyBinding implements IStructuralBinding {

    constructor(private readonly fragment: IBindingFragment, args: string[]) {
        if (args.length) throw new Error('whenReady does not accept arguments');
    }

    setValue(value: unknown): void {
        if (value === 'ready') this.fragment.mount();
        else this.fragment.unmount();
    }
}

BindingFactory.registerBinding('ariaLabel', (element, name, args) =>
    new AriaLabelBinding(element, name, args));

BindingFactory.registerStructuralBinding('whenReady', (fragment, _name, args) =>
    new WhenReadyBinding(fragment, args));

/** Custom bindings showcase: registered types used from plain HTML. */
@autoRegisterCommands()
export class CustomDemoModel extends ViewModel {

    @propertyChange()
    accessor accessibleName = 'Save the document';

    @propertyChange()
    accessor status = 'preparing';

    @propertyChange()
    accessor branchTitle = 'the whenReady branch is mounted';

    @command<CustomDemoModel>('makeReady')
    private makeReady(_command: ICommand): void {

        this.status = this.status === 'ready' ? 'preparing' : 'ready';
    }

    @command<CustomDemoModel>('rename')
    private rename(_command: ICommand): void {
        
        this.accessibleName = this.accessibleName === 'Save the document'
            ? 'Document name changed by command'
            : 'Save the document';
    }
}
