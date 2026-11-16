import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import type { ICommand } from '@mvvm/command';

/** ViewModel of the sub-View inserted through the innerHTML binding. */
@autoRegisterCommands()
export class ReadySubModel extends ViewModel {
    
    @propertyChange()
    accessor readyInfo = 'sub-View inserted';

    @command<ReadySubModel>('onReady')
    private onReady(_command: ICommand): void {
        this.readyInfo = 'sub-View inserted, ready event fired';
    }
}

/** Text and structural bindings: text, interpolate, innerHTML, if, display, visibility. */
@autoRegisterCommands()
export class TextDemoModel extends ViewModel {

    @propertyChange()
    accessor userInput = 'plain text';

    @propertyChange()
    accessor who = 'world';

    @propertyChange()
    accessor trustedHtml = '<b>bold</b>, <i>italic</i>, <u>underlined</u>';

    @propertyChange()
    accessor showDetails = true;

    @propertyChange()
    accessor detailsText = 'the if branch is mounted and its bindings work';

    @propertyChange()
    accessor panelVisible = true;

    @propertyChange()
    accessor panelOpacity = 1;

    @propertyChange()
    accessor opacityVal = 0.35;

    @propertyChange()
    accessor opacityText = '0.35';

    @propertyChange()
    accessor readyModel = new ReadySubModel();

    @command<TextDemoModel>('toggleDetails')
    private toggleDetails(_command: ICommand): void {

        this.showDetails = !this.showDetails;
    }

    @command<TextDemoModel>('togglePanel')
    private togglePanel(_command: ICommand): void {

        this.panelVisible = !this.panelVisible;
    }
}
