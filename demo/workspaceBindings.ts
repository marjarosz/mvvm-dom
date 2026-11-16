import { Binding } from '@mvvm/binding';
import { BindingFactory } from '@mvvm/bindingFactory';
import { BindingMode } from '@mvvm/bindingMode';

/** Native modal behavior, with its open state owned by the ViewModel. */
class DialogBinding extends Binding {

    private readonly dialog: HTMLDialogElement;

    private opener?: HTMLElement;

    private pointerOpener?: HTMLElement;

    private readonly rememberOpener = (event: PointerEvent) => {

        if (!this.dialog.open && event.target instanceof Element) {
            this.pointerOpener = event.target.closest<HTMLElement>('button, a[href], input, select, textarea, [tabindex]') ?? undefined;
        }

    };
    private pointerStartedOutside = false;

    private readonly cancel = (event: Event) => { event.preventDefault(); this.requestClose(); };

    private readonly close = () => {

        if (this.dialog.open || this.disposed) return;
        this.dispatchEvent(false);

        if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('[data-new-task]')?.focus({ preventScroll: true });

    };
    private outside(event: MouseEvent): boolean {

        const rect = this.dialog.getBoundingClientRect();
        return event.target === this.dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);

    }
    private readonly pointerDown = (event: PointerEvent) => { this.pointerStartedOutside = this.outside(event); };

    private readonly click = (event: MouseEvent) => {

        if (this.pointerStartedOutside && this.outside(event)) this.requestClose();
        this.pointerStartedOutside = false;

    };

    private readonly keydown = (event: KeyboardEvent) => {

        if (!this.dialog.open) this.pointerOpener = undefined;

        if (event.key !== 'Tab' || !this.dialog.open) return;

        const open = Array.from(document.querySelectorAll('dialog[open]'));

        if (open[open.length - 1] !== this.dialog) return;

        const focusable = Array.from(this.dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]'))
            .filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!first) { event.preventDefault(); this.dialog.focus(); return; }

        if (!this.dialog.contains(document.activeElement) || document.activeElement === this.dialog) {
            event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
        }
    };

    constructor(element: HTMLElement, name: string, args: string[]) {

        super(element, name, args);

        if (!(element instanceof HTMLDialogElement) || this.mode !== BindingMode.TwoWay) {
            throw new Error('demoDialog requires a dialog element and mode: twoWay');
        }

        this.dialog = element;
        this.dialog.tabIndex = -1;
        element.addEventListener('cancel', this.cancel);
        element.addEventListener('close', this.close);
        element.addEventListener('pointerdown', this.pointerDown);
        element.addEventListener('click', this.click);
        document.addEventListener('keydown', this.keydown, true);
        document.addEventListener('pointerdown', this.rememberOpener, true);
    }

    setValue(value: unknown): void {
        if (value && !this.dialog.open) {

            // WebKit does not focus buttons on pointer activation. Remember the
            // initiating control so dismissal still returns to the right place.
            this.opener = this.pointerOpener ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
                ? document.activeElement : undefined);
            this.pointerOpener = undefined;
            this.dialog.showModal();
        } else if (!value && this.dialog.open) this.dialog.close();
    }

    private requestClose(): void {

        if (this.dialog.hasAttribute('data-busy')) return;
        this.dialog.close();
        this.dispatchEvent(false);
    }

    override dispose(): void {

        this.dialog.removeEventListener('cancel', this.cancel);
        this.dialog.removeEventListener('close', this.close);
        this.dialog.removeEventListener('pointerdown', this.pointerDown);
        this.dialog.removeEventListener('click', this.click);
        document.removeEventListener('keydown', this.keydown, true);
        document.removeEventListener('pointerdown', this.rememberOpener, true);
        if (this.dialog.open) this.dialog.close();
        super.dispose();

    }
}

/** Accessible tab selection: click, arrows, Home/End and roving tab stops. */
class TabsBinding extends Binding {

    private readonly tabs: HTMLButtonElement[];

    private readonly click = (event: MouseEvent) => {

        const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]');
        if (tab && this.tabs.includes(tab)) this.select(tab);

    };

    private readonly keydown = (event: KeyboardEvent) => {

        const current = this.tabs.indexOf(event.target as HTMLButtonElement);
        if (current < 0) return;
        let next: number;

        switch (event.key) {
            case 'ArrowRight': next = (current + 1) % this.tabs.length; break;
            case 'ArrowLeft': next = (current + this.tabs.length - 1) % this.tabs.length; break;
            case 'Home': next = 0; break;
            case 'End': next = this.tabs.length - 1; break;
            default: return;
        }

        event.preventDefault();
        this.select(this.tabs[next]);
        this.tabs[next].focus();

    };

    constructor(element: HTMLElement, name: string, args: string[]) {

        super(element, name, args);
        this.tabs = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        element.addEventListener('click', this.click);
        element.addEventListener('keydown', this.keydown);

    }

    private select(tab: HTMLButtonElement): void {

        const value = tab.dataset.tab;
        this.setValue(value);
        this.dispatchEvent(value);
    }

    setValue(value: unknown): void {

        for (const tab of this.tabs) {
            const selected = tab.dataset.tab === value;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            const panel = this.element.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`);
            if (panel) panel.hidden = !selected;
        }

    }

    override dispose(): void {

        this.element.removeEventListener('click', this.click);
        this.element.removeEventListener('keydown', this.keydown);
        super.dispose();
        
    }
}

BindingFactory.registerBinding('demoDialog', (element, name, args) => new DialogBinding(element, name, args));
BindingFactory.registerBinding('demoTabs', (element, name, args) => new TabsBinding(element, name, args));
