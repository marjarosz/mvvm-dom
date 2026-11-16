import type { ICommandActionEventTarget } from './commandActionEventTarget.js'
import { splitFirstTopLevel } from './bindingParser.js';


/**
 * Contract for bindings that forward DOM element events to a command
 * action target. Implementations listen to a specific DOM event on the
 * element and raise `command-action` events.
 */
export interface IEventCommandBinding {

    subscribe(functionEvent: (event: Event)=>void):void;
    unsubscribe(functionEvent: (event: Event)=>void):void;
    dispose(): void;

}

/**
 * Base class for command bindings: keeps the `command-action` listeners,
 * parses the `name:value` argument pairs of the binding fragment into
 * `args` for the concrete implementations, and tracks disposal.
 */
export abstract class EventCommandBinding {


    protected args: {[argName: string]: string} = Object.create(null);

    protected readonly commandListeners = new Set<(event: Event) => void>();

    protected disposed = false;

    /**
     * @param element DOM element to listen on.
     * @param commandName Name of the command to trigger.
     * @param argList Raw `name:value` argument strings of the binding fragment.
     * @param eventTarget Target that receives `command-action` events.
     */
    constructor(protected element: HTMLElement, protected commandName: string, argList: string[], protected eventTarget: ICommandActionEventTarget){
        
        for (const arg of argList){
            const argArray = splitFirstTopLevel(arg, ':');
            if(argArray){
                this.args[argArray[0].trim()] = argArray[1].trim();   
            }
        }

    }

    /**
     * Subscribes a `command-action` listener to the backing event target.
     *
     * @param functionEvent Listener to subscribe.
     * @throws {Error} When called on a disposed binding.
     */
    public subscribe(functionEvent: (event: Event)=>void){

        if(this.disposed){
            throw new Error('Cannot subscribe to a disposed EventCommandBinding');
        }

        this.commandListeners.add(functionEvent);
        this.eventTarget.addEventListener('command-action', functionEvent);
    }

    /**
     * Removes a previously subscribed `command-action` listener.
     *
     * @param functionEvent Listener to remove.
     */
    public unsubscribe(functionEvent: (event: Event)=>void){

        this.commandListeners.delete(functionEvent);
        this.eventTarget.removeEventListener('command-action', functionEvent);

    }

    /**
     * Unsubscribes all listeners and marks the binding as disposed.
     * Idempotent.
     */
    public dispose(): void {

        if(this.disposed){
            return;
        }

        this.disposed = true;

        for(const listener of this.commandListeners){
            this.eventTarget.removeEventListener('command-action', listener);
        }
        
        this.commandListeners.clear();
    }

 

}


