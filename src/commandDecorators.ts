import './decoratorMetadata.js';
import { Command, type ICommand } from './command.js';
import type { IViewModel } from './viewModel.js';

const COMMAND_META_KEY = Symbol('mvvm:commands');
const AUTO_REGISTER_KEY = Symbol('mvvm:auto-register-commands');
type CommandMetadata = Map<string, string | symbol>;
type CommandMetadataHolder = { [COMMAND_META_KEY]?: CommandMetadata };
type AutoRegisterMetadataHolder = { [AUTO_REGISTER_KEY]?: true };
type CommandMethod = (command: ICommand) => unknown;

/**
 * Options for the `@command` decorator.
 */
export interface DecoratedCommandOptions<This extends IViewModel> {

    /**
     * Optional gate checked before each execution, called with the ViewModel
     * instance as `this`.
     *
     * @param parameter Parameter the execution would be started with.
     * @returns `true` when the execution is allowed.
     */
    canExecute?: (this: This, parameter: unknown) => boolean;

    /**
     * When `true`, the command reports `canExecute` as `false` while an
     * execution is in flight (re-entrancy blocking).
     */
    blockWhileExecuting?: boolean;
}

function getOwnCommandMetadata(metadata: DecoratorMetadataObject | undefined): CommandMetadata {

    if (!metadata) throw new Error('Standard decorator metadata is unavailable');

    const holder = metadata as CommandMetadataHolder;

    if (!Object.prototype.hasOwnProperty.call(metadata, COMMAND_META_KEY)) {
        Object.defineProperty(metadata, COMMAND_META_KEY, { value: new Map() });
    }

    return holder[COMMAND_META_KEY]!;
}

function shouldAutoRegister(instance: IViewModel): boolean {

    const metadataKey = (Symbol as typeof Symbol & { metadata: symbol }).metadata;
    let metadata = Reflect.get(instance.constructor, metadataKey) as DecoratorMetadataObject | undefined;

    while (metadata) {

        const holder = metadata as AutoRegisterMetadataHolder;
        if (Object.prototype.hasOwnProperty.call(metadata, AUTO_REGISTER_KEY) &&
            holder[AUTO_REGISTER_KEY]) {
            return true;
        }
        metadata = Object.getPrototypeOf(metadata);
    }

    return false;
}

/**
 * Registers the decorated instance method as a ViewModel command.
 * Commands are registered per instance (initializer) when the class
 * hierarchy is marked with {@link autoRegisterCommands}.
 *
 * @param commandName Name under which the command is registered.
 * @param options Optional execution gating options.
 * @returns A standard method decorator.
 * @throws {Error} When applied to a non-method, or when the command name
 *   is already declared on the same class.
 */
export function command<This extends IViewModel = IViewModel>(commandName: string, options?: DecoratedCommandOptions<This>) {
    return function (
        _method: CommandMethod,
        context: ClassMethodDecoratorContext<This, CommandMethod>
    ): void {
        
        if (context.kind !== 'method') {
            throw new Error('@command can only decorate a method');
        }

        const methodName = context.name;
        const metadata = getOwnCommandMetadata(context.metadata);

        if (metadata.has(commandName)) {
            throw new Error(`Command already declared: ${commandName}`);
        }

        metadata.set(commandName, methodName);

        context.addInitializer(function (this: This) {

            if (!shouldAutoRegister(this)) return;

            const method = (this as unknown as Record<string | symbol, unknown>)[methodName];

            if (typeof method !== 'function') {
                throw new Error(`Command method is unavailable: ${String(methodName)}`);
            }

            this.registerCommand(commandName, new Command((cmd: ICommand) => {
                return (method as CommandMethod).call(this, cmd);
            }, undefined, {
                canExecute: options?.canExecute ? parameter => options.canExecute!.call(this, parameter) : undefined,
                blockWhileExecuting: options?.blockWhileExecuting
            }));

        });
    };
}

/**
 * Marks the class hierarchy for automatic registration of decorated commands.
 *
 * @returns A standard class decorator.
 * @throws {Error} When applied to a non-class.
 */
export function autoRegisterCommands() {

    return function <T extends abstract new (...args: never[]) => IViewModel>(
        value: T,
        context: ClassDecoratorContext<T>
    ): void {

        if (context.kind !== 'class') {
            throw new Error('@autoRegisterCommands can only decorate a class');
        }
        
        const metadata = context.metadata as DecoratorMetadataObject & AutoRegisterMetadataHolder;
        Object.defineProperty(metadata, AUTO_REGISTER_KEY, { value: true });
    };
}
