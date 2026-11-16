import type { IEventCommandBinding } from './eventCommandBinding.js'
import { type ICommandActionEventTarget, CommandActionEventTarget } from './commandActionEventTarget.js'
import ClickCommandBinding from './commands/clickCommandBinding.js'
import MouseInOutCommandBinding from './commands/mouseInOutCommandBinding.js';
import ChangeCommandBinding from './commands/changeCommandBinding.js';
import InputCommandBinding from './commands/inputCommandBinding.js';
import FocusOutCommandBinding from './commands/focusOutCommandBinding.js';
import ResizeCommandBinding from './commands/resizeCommandBinding.js';
import AnimationEndCommandBinding from './commands/animationEndCommandBinding.js';
import EnterCommandBinding from './commands/enterCommandBinding.js';
import KeyCommandBinding from './commands/keyCommandBinding.js';
import SubmitCommandBinding from './commands/submitCommandBinding.js';
import DragOverCommandBinding from './commands/dragOverCommandBinding.js';
import DragLeaveCommandBinding from './commands/dragLeaveCommandBinding.js';
import DropCommandBinding from './commands/dropCommandBinding.js';
import ReadyCommandBinding from './commands/readyCommandBinding.js';
import MouseMoveCommandBinding from './commands/mouseMoveCommandBinding.js';
import MouseUpCommandBinding from './commands/mouseUpCommandBinding.js';
import MouseDownCommandBinding from './commands/mouseDownCommandBinding.js';

/**
 * Creates a command event binding for a registered type. The factory is
 * invoked with the element, the command name, the raw `name:value` argument
 * strings and the event target; the target is always provided.
 */
export type CommandBindingCreate =
    (element: HTMLElement, name: string, argList: string[], eventTarget: ICommandActionEventTarget) => IEventCommandBinding;

/**
 * Creates command event bindings by name.
 *
 * Registered types: `click`, `mouseInOut`, `change`, `input`, `focusout`,
 * `resize`, `animationend`, `enter`, `key`, `submit`, `dragover`,
 * `dragleave`, `drop`, `ready`, `mousedown`, `mouseup`, `mousemove`.
 * New types can be added with {@link CommandBindingFactory.registerCommandBinding}.
 */
export class CommandBindingFactory {

    private static readonly commandBindingFactories = new Map<string, CommandBindingCreate>([
        ['click', (element, name, argList, eventTarget) => new ClickCommandBinding(element, name, argList, eventTarget)],
        ['mouseInOut', (element, name, argList, eventTarget) => new MouseInOutCommandBinding(element, name, argList, eventTarget)],
        ['change', (element, name, argList, eventTarget) => new ChangeCommandBinding(element, name, argList, eventTarget)],
        ['input', (element, name, argList, eventTarget) => new InputCommandBinding(element, name, argList, eventTarget)],
        ['focusout', (element, name, argList, eventTarget) => new FocusOutCommandBinding(element, name, argList, eventTarget)],
        ['resize', (element, name, argList, eventTarget) => new ResizeCommandBinding(element, name, argList, eventTarget)],
        ['animationend', (element, name, argList, eventTarget) => new AnimationEndCommandBinding(element, name, argList, eventTarget)],
        ['enter', (element, name, argList, eventTarget) => new EnterCommandBinding(element, name, argList, eventTarget)],
        ['key', (element, name, argList, eventTarget) => new KeyCommandBinding(element, name, argList, eventTarget)],
        ['submit', (element, name, argList, eventTarget) => new SubmitCommandBinding(element, name, argList, eventTarget)],
        ['dragover', (element, name, argList, eventTarget) => new DragOverCommandBinding(element, name, argList, eventTarget)],
        ['dragleave', (element, name, argList, eventTarget) => new DragLeaveCommandBinding(element, name, argList, eventTarget)],
        ['drop', (element, name, argList, eventTarget) => new DropCommandBinding(element, name, argList, eventTarget)],
        ['ready', (element, name, argList, eventTarget) => new ReadyCommandBinding(element, name, argList, eventTarget)],
        ['mousedown', (element, name, argList, eventTarget) => new MouseDownCommandBinding(element, name, argList, eventTarget)],
        ['mouseup', (element, name, argList, eventTarget) => new MouseUpCommandBinding(element, name, argList, eventTarget)],
        ['mousemove', (element, name, argList, eventTarget) => new MouseMoveCommandBinding(element, name, argList, eventTarget)]
    ]);


    /**
     * Creates a command event binding of the given type.
     *
     * @param type Binding type (e.g. `click`, `input`, `key`).
     * @param element DOM element to listen on.
     * @param name Name of the command to trigger.
     * @param argList Raw `name:value` argument strings of the binding fragment.
     * @param eventTarget Target that receives `command-action` events. A new
     *   target is created when omitted.
     * @returns The created binding.
     * @throws {Error} When the type is not registered.
     */
    static createCommandBinding(type: string, element: HTMLElement, name:string, argList: string[], eventTarget?:ICommandActionEventTarget): IEventCommandBinding{

        const evTarget = (eventTarget) ? eventTarget : new CommandActionEventTarget();

        const create = this.commandBindingFactories.get(type);

        if (create) return create(element, name, argList, evTarget);

        throw new Error(
            `CommandBindingFactory: unknown command type '${type}' ` +
            `for command '${name}'`
        );
    }

    /**
     * Registers a new command event binding type.
     *
     * @param name The command binding type name.
     * @param create The factory invoked with the element, command name,
     *   raw arguments and the event target.
     * @throws {Error} When the name is already registered.
     */
    static registerCommandBinding(name: string, create: CommandBindingCreate): void {

        this.checkAvailable(name);
        this.commandBindingFactories.set(name, create);

    }

    /** Rejects names that are already taken by a command binding type. */
    private static checkAvailable(name: string): void {

        if(this.commandBindingFactories.has(name)){
            throw new Error(`CommandBindingFactory: command '${name}' is already registered`);
        }
        
    }
}
