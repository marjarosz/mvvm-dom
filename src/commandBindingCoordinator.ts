import { splitFirstTopLevel, type ParsedBinding } from './bindingParser.js';
import { CommandActionEvent } from './commandActionEvent.js';
import type { ICommand } from './command.js';
import { setDisabledContribution, removeDisabledContribution } from './disabledCoordinator.js';
import type { IBindingContext } from './viewModel.js';
import { CommandBindingFactory } from './commandBindingFactory.js';

function supportsDisabled(element: HTMLElement): boolean {
    return element instanceof HTMLButtonElement || element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement ||
        element instanceof HTMLFieldSetElement || element instanceof HTMLOptGroupElement ||
        element instanceof HTMLOptionElement;
}

/**
 * Connects a DOM element with a ViewModel command: creates the matching
 * command event binding for the element, resolves the optional `parameter`
 * from the binding context, forwards command action events to the command,
 * and keeps the element's `disabled` state in sync with the command's
 * `canExecute` state.
 */
export class CommandBindingCoordinator {

    private readonly commandElement;

    private readonly parameter?: string;

    private readonly supportsDisabled: boolean;

    private command?: ICommand;

    private disposed = false;

    private unsubscribeCommand?: () => void;

    private unsubscribeRegistry?: () => void;

    private unsubscribeContext?: () => void;

    private readonly propertyChanged = () => this.update();

    private readonly invoked = (event: Event) => this.execute(event as CommandActionEvent);

    /**
     * @param element DOM element the command is bound to.
     * @param binding Parsed binding fragment (type, property name, args).
     * @param context Binding context providing command and property access.
     * @throws {SyntaxError} When the `parameter` argument is not a valid
     *   property expression.
     */
    constructor(private readonly element: HTMLElement, private readonly binding: ParsedBinding, private readonly context?: IBindingContext) {
       
        const parameter = binding.args.map(arg => splitFirstTopLevel(arg, ':')).find(part => part?.[0].trim() === 'parameter')?.[1].trim();
        
        if (parameter !== undefined && (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(parameter) ||
            ['null', 'undefined', 'true', 'false'].includes(parameter))) {
            throw new SyntaxError(`Invalid command parameter '${parameter}' for '${binding.propertyName}'`);
        }

        this.parameter = parameter;
        this.supportsDisabled = supportsDisabled(element);
        this.commandElement = CommandBindingFactory.createCommandBinding(binding.bindingType, element, binding.propertyName, binding.args);
        
        try {

            this.commandElement.subscribe(this.invoked);

            if (parameter && context) context.subscribeProperties(this.propertyChanged);

            if (parameter) this.unsubscribeContext = context?.subscribeContextChanges?.(this.propertyChanged);

            this.unsubscribeRegistry = context?.subscribeCommands?.(name => {
                if (name === binding.propertyName) this.connect();
            });

            this.connect();
        } catch (error) {

            this.dispose();
            throw error;
        }
    }

    private value(): unknown {

        return this.parameter ? this.context?.getPropertyValue(this.parameter) : undefined;
    }

    private connect(): void {

        // A registry notification may still hold this callback in its snapshot.
        if (this.disposed) return;

        this.unsubscribeCommand?.();
        this.unsubscribeCommand = undefined;
        this.command = this.context?.getCommand(this.binding.propertyName);
        this.unsubscribeCommand = this.command?.subscribeCanExecuteChanged?.(() => this.update());
        this.update();
    }

    private update(): void {

        if (this.disposed) return;

        const parameter = this.value();

        if (this.supportsDisabled) {
            const allowed = this.command !== undefined && (this.command.canExecute?.(parameter) ?? true);
            setDisabledContribution(this.element, this, 'commands', !allowed);
        }
    }

    private execute(event: CommandActionEvent): void {

        if (this.disposed) return;

        const command = this.context?.getCommand(this.binding.propertyName);

        if (!command) return;

        try {

            const parameter = this.value();
            if (command.canExecute && !command.canExecute(parameter)) return;
            
            const invocation = new CommandActionEvent(event.type, event.commandName, event.objectSender, event.sourceEvent, event.args, parameter);
            const execution = command.execute(invocation);
            
            if (execution) void execution.catch(error => console.error(`Command '${event.commandName}' failed`, error));
        
        } catch (error) {
            console.error(`Command '${event.commandName}' failed`, error);
        }
    }

    /** Releases all subscriptions and disposes the underlying event binding. */
    dispose(): void {

        if (this.disposed) return;
        this.disposed = true;

        this.unsubscribeRegistry?.();
        this.unsubscribeRegistry = undefined;
        this.unsubscribeContext?.();
        this.unsubscribeContext = undefined;
        this.unsubscribeCommand?.();
        this.unsubscribeCommand = undefined;

        if (this.parameter) this.context?.unsubscribeProperties(this.propertyChanged);

        this.commandElement.dispose();
        
        if (this.supportsDisabled) removeDisabledContribution(this.element, this, 'commands');

    }
}
