import { type IEventCommandBinding, EventCommandBinding } from '../eventCommandBinding.js';
import type { ICommandActionEventTarget } from '../commandActionEventTarget.js';

type Modifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';
interface Shortcut {
    key: string;
    modifiers: Set<Modifier>;
}

const modifiers: Modifier[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const keyAliases: Record<string, string> = { Plus: '+', Pipe: '|', Space: ' ' };

function parseShortcuts(value: string): Shortcut[] {
    
    return value.split('|').map(alternative => {
        
        const parts = alternative.split('+').map(part => part.trim());
        const selected = new Set<Modifier>();
        let key: string | undefined;

        for (const part of parts) {
            
            if (!part) throw new SyntaxError(`Key binding: invalid shortcut '${alternative.trim()}'`);
            const modifier = modifiers.find(name => name.toLowerCase() === part.toLowerCase());
            
            if (modifier) {
                if (selected.has(modifier)) throw new SyntaxError(`Key binding: duplicate modifier '${part}'`);
                selected.add(modifier);
            } else {
                if (key !== undefined || !(Array.from(part).length === 1 || /^[A-Za-z][A-Za-z0-9]*$/.test(part))) {
                    throw new SyntaxError(`Key binding: invalid key '${part}' in '${alternative.trim()}'`);
                }
                key = Object.prototype.hasOwnProperty.call(keyAliases, part) ? keyAliases[part] : part;
            }

        }
       
        if (key === undefined) throw new SyntaxError(`Key binding: missing key in '${alternative.trim()}'`);
        return { key, modifiers: selected };
    });
}

function sameKey(expected: string, actual: string): boolean {
   
    return /^\p{L}$/u.test(expected) && /^\p{L}$/u.test(actual)
        ? expected.toLowerCase() === actual.toLowerCase()
        : expected === actual;
}

/**
 * Command binding for keyboard shortcuts: matches the `keys` argument
 * (`|`-separated alternatives of `+`-separated parts, e.g. `Ctrl+Shift+P`,
 * aliases `+`, `|` and ` `) against keydown events. Options: `preventDefault`
 * (default `true`), `allowRepeat`, `allowComposition`, `allowExtraModifiers`
 * (default `false`); the action arguments carry the pressed key and the
 * active modifiers.
 */
export default class KeyCommandBinding extends EventCommandBinding implements IEventCommandBinding {
    
    private readonly shortcuts: Shortcut[];

    private readonly preventDefault: boolean;

    private readonly allowRepeat: boolean;

    private readonly allowComposition: boolean;

    private readonly allowExtraModifiers: boolean;

    private readonly enterShortcut: boolean;

    private readonly keydownCallback = (event: KeyboardEvent) => this.keydownEvent(event);

    constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget, enterShortcut = false) {
        
        super(element, commandName, argList, eventTarget);
        this.enterShortcut = enterShortcut;
        
        if (enterShortcut) {

            this.shortcuts = parseShortcuts('Enter');
            this.preventDefault = true;
            this.allowRepeat = true;
            this.allowComposition = true;
            this.allowExtraModifiers = true;

        } else {

            const allowed = new Set(['keys', 'parameter', 'preventDefault', 'allowRepeat', 'allowComposition', 'allowExtraModifiers']);
            
            for (const name of Object.keys(this.args)) {
                if (!allowed.has(name)) throw new SyntaxError(`Key binding: unknown argument '${name}'`);
            }

            if (!this.args.keys) throw new SyntaxError('Key binding: keys is required');
            
            this.shortcuts = parseShortcuts(this.args.keys);
            this.preventDefault = this.booleanOption('preventDefault', true);
            this.allowRepeat = this.booleanOption('allowRepeat', false);
            this.allowComposition = this.booleanOption('allowComposition', false);
            this.allowExtraModifiers = this.booleanOption('allowExtraModifiers', false);
        }
        try {

            this.element.addEventListener('keydown', this.keydownCallback);
        } catch (error) {

            this.element.removeEventListener('keydown', this.keydownCallback);
            throw error;
        }
    }

    private booleanOption(name: string, defaultValue: boolean): boolean {

        const value = this.args[name];
        
        if (value === undefined) return defaultValue;
        
        if (value !== 'true' && value !== 'false') throw new SyntaxError(`Key binding: '${name}' must be true or false`);
       
        return value === 'true';
    }

    private keydownEvent(event: KeyboardEvent): void {
        
        if ((!this.allowRepeat && event.repeat) || (!this.allowComposition && event.isComposing)) return;
        const active: Modifier[] = [];
        
        if (event.ctrlKey) active.push('Ctrl');
        
        if (event.altKey) active.push('Alt');
        
        if (event.shiftKey) active.push('Shift');
        
        if (event.metaKey) active.push('Meta');
        
        const matches = this.shortcuts.some(shortcut => sameKey(shortcut.key, event.key) &&
            modifiers.every(modifier => shortcut.modifiers.has(modifier)
                ? active.includes(modifier)
                : this.allowExtraModifiers || !active.includes(modifier)));

        if (!matches) return;

        if (this.preventDefault) event.preventDefault();

        this.eventTarget.commandAction(this.commandName, this.element, event, ...(this.enterShortcut ? [] : [event.key, ...active]));
    }

    public dispose(): void {
        
        this.element.removeEventListener('keydown', this.keydownCallback);
        super.dispose();
    }
}
