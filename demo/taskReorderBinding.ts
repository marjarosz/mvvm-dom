import { EventCommandBinding } from '@mvvm/eventCommandBinding';
import { CommandBindingFactory } from '@mvvm/commandBindingFactory';
import type { ICommandActionEventTarget } from '@mvvm/commandActionEventTarget';

const mime = 'application/x-mvvm-demo-task';
interface DragSession { source: TaskReorderBinding; token: string; marker?: HTMLElement }
const sessions = new WeakMap<HTMLElement, DragSession>();

/** Owns only the gesture and its presentation. The command owns task order. */
class TaskReorderBinding extends EventCommandBinding {

    private listElement?: HTMLElement;

    private get list(): HTMLElement {

        // Collection bindings construct rows before attaching them to the list.
        // Retain the owner after the first gesture so disposal works after removal.
        this.listElement ??= this.element.closest<HTMLElement>('[data-reorder-list]') ?? undefined;
        return this.listElement ?? this.element;
    }
    private readonly start = (event: DragEvent) => {

        const handle = event.target instanceof Element ? event.target.closest('[data-reorder-handle]') : null;

        if (!handle || !this.element.contains(handle) || this.blocked() || !event.dataTransfer) {
            event.preventDefault(); return;
        }

        this.finish(event);
        const token = crypto.randomUUID();
        event.dataTransfer.setData(mime, token);
        event.dataTransfer.setData('text/plain', token);
        event.dataTransfer.effectAllowed = 'move';
        sessions.set(this.list, { source: this, token });
        this.element.setAttribute('data-dragging', 'true');
        this.emit(event, 'start');
    };
    private readonly over = (event: DragEvent) => {

        const session = this.session(event);
        if (!session) return;
        event.preventDefault();
        event.dataTransfer!.dropEffect = 'move';
        this.clearMarker(session);

        if (session.source !== this) {

            this.element.setAttribute('data-drop-position', this.position(event));
            session.marker = this.element;
        }
    };
    private readonly leave = (event: DragEvent) => {

        if (event.relatedTarget instanceof Node && this.element.contains(event.relatedTarget)) return;
        const session = sessions.get(this.list);
        if (session?.marker === this.element) this.clearMarker(session);

    };
    private readonly drop = (event: DragEvent) => {

        const session = this.session(event);
        const token = event.dataTransfer?.getData(mime) || event.dataTransfer?.getData('text/plain');

        if (!session || token !== session.token) return;
        event.preventDefault();
        try {
            if (session.source !== this) this.emit(event, 'drop', this.position(event));
        } finally { 
            this.finish(event); 
        }
    };
    private readonly end = (event: Event) => {

        if (sessions.get(this.list)?.source === this) this.finish(event);
    };
    private readonly key = (event: KeyboardEvent) => {

        if (event.key === 'Escape') { this.end(event); return; }
        const handle = event.target instanceof Element ? event.target.closest('[data-reorder-handle]') : null;

        if (!handle || !this.element.contains(handle) || !event.altKey ||
            event.ctrlKey || event.metaKey || event.shiftKey || this.blocked()) return;

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.emit(event, event.key === 'ArrowUp' ? 'up' : 'down');
        }
    };
    private readonly click = (event: MouseEvent) => {

        const control = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-reorder-step]') : null;

        if (!control || !this.element.contains(control) || this.blocked()) return;

        const direction = control.dataset.reorderStep;

        if (direction === 'up' || direction === 'down') this.emit(event, direction);
    };

    constructor(element: HTMLElement, name: string, args: string[], target: ICommandActionEventTarget) {

        super(element, name, args, target);
        element.addEventListener('dragstart', this.start);
        element.addEventListener('dragover', this.over);
        element.addEventListener('dragleave', this.leave);
        element.addEventListener('drop', this.drop);
        element.addEventListener('click', this.click);
        element.addEventListener('keydown', this.key);
        element.ownerDocument.addEventListener('dragend', this.end, true);
        element.ownerDocument.addEventListener('keydown', this.escape, true);
        element.ownerDocument.defaultView?.addEventListener('blur', this.end);

    }

    private readonly escape = (event: KeyboardEvent) => { if (event.key === 'Escape') this.end(event); };

    private blocked(): boolean { return this.disposed || this.element.hasAttribute('data-reorder-disabled'); }

    private session(event: DragEvent): DragSession | undefined {

        const session = sessions.get(this.list);
        return !this.blocked() && session && !session.source.blocked() &&
            event.dataTransfer?.types.some(type => type === mime || type === 'text/plain') ? session : undefined;

    }
    private position(event: DragEvent): 'before' | 'after' {

        const rect = this.element.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    }
    private clearMarker(session: DragSession): void {

        session.marker?.removeAttribute('data-drop-position'); session.marker = undefined;

    }
    private emit(event: Event, phase: string, position?: string): void {

        this.eventTarget.commandAction(this.commandName, this.element, event, ...(position ? [phase, position] : [phase]));
    }
    private finish(event: Event): void {

        const session = sessions.get(this.list);
        if (!session) return;
        sessions.delete(this.list);
        this.clearMarker(session);
        session.source.element.removeAttribute('data-dragging');
        session.source.emit(event, 'finish');

    }
    override dispose(): void {

        if (this.disposed) return;
        this.end(new Event('cancel'));
        const session = sessions.get(this.list);
        if (session?.marker === this.element) this.clearMarker(session);
        this.element.removeEventListener('dragstart', this.start);
        this.element.removeEventListener('dragover', this.over);
        this.element.removeEventListener('dragleave', this.leave);
        this.element.removeEventListener('drop', this.drop);
        this.element.removeEventListener('click', this.click);
        this.element.removeEventListener('keydown', this.key);
        this.element.ownerDocument.removeEventListener('dragend', this.end, true);
        this.element.ownerDocument.removeEventListener('keydown', this.escape, true);
        this.element.ownerDocument.defaultView?.removeEventListener('blur', this.end);
        super.dispose();
        
    }
}

CommandBindingFactory.registerCommandBinding('demoTaskReorder', (element, name, args, target) =>
    new TaskReorderBinding(element, name, args, target));
