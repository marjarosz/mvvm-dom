import type { ICommandActionEventTarget } from '../commandActionEventTarget.js';
import KeyCommandBinding from './keyCommandBinding.js';

/** Enter-key variant of {@link KeyCommandBinding} bound to the default `Enter` shortcut. */
export default class EnterCommandBinding extends KeyCommandBinding {
    
    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget) {
        super(element, commandName, argList, eventTarget, true);
    }
}
