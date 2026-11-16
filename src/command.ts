import { CommandActionEvent } from "./commandActionEvent.js";

/**
 * Immutable data describing the invocation context of a command execution.
 */
export interface CommandData {

    /** Name of the command. */
    readonly commandName: string;

    /** Object that triggered the command (usually the source element). */
    readonly objectSender: object;

    /** Raw string arguments of the binding fragment that triggered the command. */
    readonly args: readonly string[];

    /** Original DOM event that triggered the command. */
    readonly sourceEvent: Event;

    /** Optional resolved command parameter. */
    readonly parameter?: unknown;
}

/**
 * A ViewModel command: an executable unit of business logic that views
 * trigger through command bindings. Commands support optional
 * `canExecute` gating, execution-state tracking, and re-entrancy blocking.
 */
export interface ICommand {
    /** Invocation data of the most recent (or pending) execution. */
    readonly commandData: CommandData;

    /** Whether at least one execution is currently in flight. */
    readonly isExecuting?: boolean;

    /**
     * Subscribes to execution state changes (entered/exited the executing state).
     *
     * @param listener Callback receiving the new `isExecuting` value.
     * @returns A function that removes the subscription.
     */
    subscribeExecutionState?(listener: (isExecuting: boolean) => void): () => void;

    /**
     * Checks whether the command can be executed with the given parameter.
     *
     * @param parameter Parameter the execution would be started with.
     * @returns `true` when the command can be executed.
     */
    canExecute?(parameter?: unknown): boolean;

    /**
     * Subscribes to `canExecute` state changes.
     *
     * @param listener Callback invoked when the ability to execute may have changed.
     * @returns A function that removes the subscription.
     */
    subscribeCanExecuteChanged?(listener: () => void): () => void;

    /** Notifies subscribers that the `canExecute` state may have changed. */
    notifyCanExecuteChanged?(): void;

    /**
     * Executes the command.
     *
     * @param event The command action event describing the invocation.
     * @returns A promise when the execution is asynchronous, otherwise `undefined`.
     */
    execute(event: CommandActionEvent): void | Promise<void>;
}

/**
 * Options controlling a {@link Command} instance.
 */
export interface CommandOptions {

    /**
     * Optional gate checked before each execution.
     * @param parameter Parameter the execution would be started with.
     * @returns `true` when the execution is allowed.
     */
    canExecute?: (parameter: unknown) => boolean;

    /**
     * When `true`, the command reports `canExecute` as `false` while an
     * execution is in flight (re-entrancy blocking).
     */
    blockWhileExecuting?: boolean;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {

    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false;
    return 'then' in value && typeof value.then === 'function';

}

/**
 * Default {@link ICommand} implementation.
 *
 * The constructor takes a callback that receives a frozen `ICommand`
 * invocation proxy bound to this instance, so callbacks can inspect the
 * current invocation data and even re-invoke the command. Execution count
 * is reference-counted: overlapping asynchronous executions keep
 * `isExecuting` `true` until all of them settle.
 */
export class Command implements ICommand {

    private activeExecutions = 0;

    private readonly executionStateTarget = new EventTarget();

    private readonly canExecuteTarget = new EventTarget();

    private readonly emptyCommandData: CommandData = Object.freeze({
        commandName: '',
        objectSender: {},
        args: Object.freeze([]),
        sourceEvent: new Event('')
    });

    private currentCommandData = this.emptyCommandData;

    /**
     * @param executeCallback Invoked for each execution with a frozen
     *   `ICommand` invocation proxy. May return a value or a promise; a
     *   promise keeps the command in the executing state until it settles.
     * @param onError Optional callback receiving rejected async executions.
     *   When omitted, rejections re-throw on the returned promise.
     * @param options Optional execution gating options.
     */
    constructor(
        private readonly executeCallback: (command: ICommand) => unknown,
        private readonly onError?: (error: unknown) => void,
        private readonly options: CommandOptions = {}
    ) {
    }

    /** Invocation data of the most recent (or pending) execution. */
    get commandData(): CommandData {

        return this.currentCommandData;

    }

    /** Whether at least one execution is currently in flight. */
    get isExecuting(): boolean {

        return this.activeExecutions > 0;

    }

    /**
     * Subscribes to execution state changes (entered/exited the executing state).
     *
     * @param listener Callback receiving the new `isExecuting` value.
     * @returns A function that removes the subscription.
     */
    subscribeExecutionState(listener: (isExecuting: boolean) => void): () => void {

        const handler = (event: Event) => listener((event as CustomEvent<boolean>).detail);
        this.executionStateTarget.addEventListener('change', handler);

        return () => this.executionStateTarget.removeEventListener('change', handler);
    }

    /**
     * Checks whether the command can be executed with the given parameter.
     * Fails when `blockWhileExecuting` is set and an execution is in
     * flight, or when the configured gate returns `false`.
     *
     * @param parameter Parameter the execution would be started with.
     * @returns `true` when the command can be executed.
     */
    canExecute(parameter?: unknown): boolean {

        return !(this.options.blockWhileExecuting && this.isExecuting) &&
            (this.options.canExecute?.(parameter) ?? true);

    }

    /**
     * Subscribes to `canExecute` state changes.
     *
     * @param listener Callback invoked when the ability to execute may have changed.
     * @returns A function that removes the subscription.
     */
    subscribeCanExecuteChanged(listener: () => void): () => void {

        this.canExecuteTarget.addEventListener('change', listener);
        return () => this.canExecuteTarget.removeEventListener('change', listener);

    }

    /** Notifies subscribers that the `canExecute` state may have changed. */
    notifyCanExecuteChanged(): void {

        this.canExecuteTarget.dispatchEvent(new Event('change'));

    }

    /**
     * Executes the command with the given invocation event.
     * No-op when `canExecute` rejects the invocation. Synchronous callback
     * results settle immediately; promise results keep the executing state
     * until they settle.
     *
     * @param event The command action event describing the invocation.
     * @returns The settled promise chain for asynchronous executions.
     * @throws Errors thrown synchronously by the callback propagate unchanged.
     */
    public execute(event: CommandActionEvent): void | Promise<void> {

        if (!this.canExecute(event.parameter)) return;

        const data: CommandData = Object.freeze({
            commandName: event.commandName,
            objectSender: event.objectSender,
            args: Object.freeze([...event.args]),
            sourceEvent: event.sourceEvent,
            parameter: event.parameter
        });

        this.currentCommandData = data;
        const command = this;

        const invocation: ICommand = Object.freeze({
            commandData: data,
            get isExecuting() {
                return command.isExecuting;
            },
            subscribeExecutionState: (listener: (isExecuting: boolean) => void) =>
                command.subscribeExecutionState(listener),
            canExecute: (parameter?: unknown) => command.canExecute(parameter),
            subscribeCanExecuteChanged: (listener: () => void) => command.subscribeCanExecuteChanged(listener),
            notifyCanExecuteChanged: () => command.notifyCanExecuteChanged(),
            execute: (nextEvent: CommandActionEvent) => command.execute(nextEvent)
        });

        this.updateActiveExecutions(1);

        try {

            const result = this.executeCallback(invocation);
            if (!isPromiseLike(result)) {
                this.updateActiveExecutions(-1);
                return;
            }

            return Promise.resolve(result)
                .then(() => undefined)
                .catch(error => {
                    if (!this.onError) throw error;
                    this.onError(error);
                })
                .finally(() => {
                    this.updateActiveExecutions(-1);
                });
        } catch (error) {
            // Inspecting/assimilating a callback result can throw synchronously too.
            this.updateActiveExecutions(-1);
            throw error;
        }
    }

    private updateActiveExecutions(change: 1 | -1): void {

        const wasExecuting = this.isExecuting;
        this.activeExecutions += change;

        if (wasExecuting !== this.isExecuting) {
            if (this.options.blockWhileExecuting) this.notifyCanExecuteChanged();
            this.executionStateTarget.dispatchEvent(
                new CustomEvent<boolean>('change', { detail: this.isExecuting })
            );
        }
        
    }
}
