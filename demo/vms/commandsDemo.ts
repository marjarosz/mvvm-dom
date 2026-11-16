import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import { Command } from '@mvvm/command';
import type { ICommand } from '@mvvm/command';

/** Commands: click, key, mouseInOut, submit, canExecute, blockWhileExecuting. */
@autoRegisterCommands()
export class CommandsDemoModel extends ViewModel {

    private stopped = false;

    private timer?: ReturnType<typeof setTimeout>;

    private finishWait?: () => void;

    @propertyChange()

    accessor clicks = 0;

    @propertyChange()
    accessor lastKey = 'press Ctrl+S or Enter in the input';

    @propertyChange()
    accessor hoverState = 'idle';

    @propertyChange()
    accessor submitNote = 'form not submitted yet';

    @propertyChange()
    accessor asyncInfo = 'idle';

    @propertyChange()
    accessor asyncBusy = false;

    @propertyChange()
    accessor allowPing = true;

    @propertyChange()
    accessor pings = 0;

    @propertyChange()
    accessor busyClass = 'chip-new';

    @propertyChange()
    accessor pingsText = 'pings: 0 - button auto-disabled via canExecute: true';

    constructor() {

        super();
        // Manual registration: async execution + re-entrancy blocking;
        // while in flight the library disables the source button itself.
        const asyncCmd = new Command(async () => {

            this.asyncInfo = 'running... (button disabled by blockWhileExecuting)';
            await new Promise<void>(resolve => { this.finishWait = resolve; this.timer = setTimeout(resolve, 1200); });
            this.finishWait = undefined;
            this.timer = undefined;
            if (this.stopped) return;
            this.asyncInfo = 'finished after 1.2s';
        }, undefined, { blockWhileExecuting: true });

        asyncCmd.subscribeExecutionState?.(isExecuting => {
            this.asyncBusy = isExecuting;
            this.busyClass = isExecuting ? 'chip-active' : 'chip-done';
        });

        this.registerCommand('runAsync', asyncCmd);
    }

    override dispose(): void {

        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
        this.finishWait?.();
        super.dispose();
    }

    @command<CommandsDemoModel>('inc')
    private inc(_command: ICommand): void {

        this.clicks++;
    }

    @command<CommandsDemoModel>('saveKey')
    private saveKey(cmd: ICommand): void {

        this.lastKey = `shortcut matched: ${cmd.commandData.args.join(' ')}`;
    }

    @command<CommandsDemoModel>('hover')
    private hover(cmd: ICommand): void {

        const type = cmd.commandData.sourceEvent.type;
        this.hoverState = type === 'mouseenter' ? 'mouse entered (mouseenter)' : 'mouse left (mouseleave)';
    }

    @command<CommandsDemoModel>('submitNote')
    private submitNoteCommand(_command: ICommand): void {

        this.submitNote = 'form submit command ran, page did NOT reload';
    }

    @command<CommandsDemoModel>('ping', { canExecute() { return this.allowPing; } })
    private ping(_command: ICommand): void {

        this.pings++;
        this.pingsText = `pings: ${this.pings} - button auto-disabled via canExecute: ${this.allowPing}`;
    }

    @command<CommandsDemoModel>('toggleGuard')
    private toggleGuard(_command: ICommand): void {

        this.allowPing = !this.allowPing;
        this.pingsText = `pings: ${this.pings} - button auto-disabled via canExecute: ${this.allowPing}`;
        // Re-evaluate the other command's gate: the library re-applies
        // the disabled attribute on the button bound to it.
        this.getCommand('ping')?.notifyCanExecuteChanged?.();
        
    }
}
