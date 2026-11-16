/**
 * Event carrying the full invocation context of a command action: which
 * command was triggered, by what object, from which DOM event, with which
 * arguments and parameter.
 */
export interface ICommandActionEvent extends Event{

    /** Name of the triggered command. */
    readonly commandName: string;

    /** Object that triggered the command (usually the source element). */
    readonly objectSender: object;

    /** Raw string arguments of the binding fragment. */
    readonly args: string[];

    /** Optional resolved command parameter. */
    readonly parameter?: unknown;

}

/**
 * Standard DOM `Event` implementation of {@link ICommandActionEvent}.
 */
export class CommandActionEvent extends Event implements ICommandActionEvent {

    /**
     * @param type Event type (conventionally `command-action`).
     * @param commandName Name of the triggered command.
     * @param objectSender Object that triggered the command.
     * @param sourceEvent Original DOM event that triggered the command.
     * @param args Raw string arguments of the binding fragment.
     * @param parameter Optional resolved command parameter.
     */
    constructor(type: string, public readonly commandName: string, public readonly objectSender: object, public readonly sourceEvent: Event, public readonly args: string[], public readonly parameter?: unknown){
        
        super(type);
        
    }

}
