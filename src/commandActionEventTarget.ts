import {CommandActionEvent} from './commandActionEvent.js'

/**
 * An {@link EventTarget} that can raise command action events.
 */
export interface ICommandActionEventTarget extends EventTarget{
    /**
     * Raises a `command-action` event for the given command invocation.
     *
     * @param commandName Name of the triggered command.
     * @param objectSender Object that triggered the command.
     * @param sourceEvent Original DOM event that triggered the command.
     * @param args Raw string arguments of the binding fragment.
     */
    commandAction(commandName: string, objectSender: object, sourceEvent: Event, ...args: string[]):void
}

/**
 * Default {@link ICommandActionEventTarget} implementation built on the
 * standard `EventTarget`.
 */
export class CommandActionEventTarget extends EventTarget implements ICommandActionEventTarget{

    /**
     * Raises a {@link CommandActionEvent} for the given command invocation.
     *
     * @param commandName Name of the triggered command.
     * @param objectSender Object that triggered the command.
     * @param sourceEvent Original DOM event that triggered the command.
     * @param args Raw string arguments of the binding fragment.
     */
    public commandAction(commandName: string, objectSender: object, sourceEvent: Event, ...args: string[]){
       
        this.dispatchEvent(new CommandActionEvent('command-action', commandName, objectSender, sourceEvent, args));
    }

    

}
