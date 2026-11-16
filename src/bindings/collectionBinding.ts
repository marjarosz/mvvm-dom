import { parseBindings } from '../bindingParser.js';
import { CollectionObserver } from '../collectionObserver.js';
import type { IBindingFragment, IStructuralBinding, MountedFragment } from '../bindingFragment.js';
import { CollectionScope } from './collectionScope.js';

type Row = { item: unknown; source?: CollectionObserver<unknown>; view: MountedFragment };

function prepareRow(template: HTMLTemplateElement): void {

    const root = template.content;

    for (const element of Array.from(root.querySelectorAll('[data-bind]'))) {
        const bindings = parseBindings(element.getAttribute('data-bind')!, 'collection row', true);

        for (const binding of bindings) {

            if (binding.args.some(arg => /^\s*mode\s*:\s*(twoWay|oneWayToSource)\s*$/.test(arg))) {
                throw new Error('Collection row bindings must be read-only');
            }
        }
    }

    const walker = template.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    const additions = new Map<Element, Set<string>>();

    while ((node = walker.nextNode())) {

        const parent = node.parentElement;

        if (!parent || parent.closest('script, style, template')) continue;
        let nested = false;

        for (let element: Element | null = parent; element && root.contains(element); element = element.parentElement) {
            const declaration = element.getAttribute('data-bind');
            if (declaration && parseBindings(declaration).some(binding => binding.bindingType === 'collection')) {
                nested = true;
                break;
            }
        }

        if (nested) continue;

        const pattern = /\{\{\s*((?:object|parent)(?:\.[A-Za-z_$][\w$]*)+)\s*\}\}/g;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(node.textContent ?? ''))) {
            const paths = additions.get(parent) ?? new Set<string>();
            paths.add(match[1]);
            additions.set(parent, paths);
        }
    }
    for (const [element, paths] of additions) {

        const declaration = element.getAttribute('data-bind') ?? '';
        const existing = declaration ? parseBindings(declaration) : [];
        const added = [...paths]
            .filter(path => !existing.some(binding => binding.bindingType === 'interpolate' && binding.propertyName === path))
            .map(path => `{interpolate: ${path}}`);

        if (added.length) element.setAttribute('data-bind', [declaration, ...added].filter(Boolean).join(', '));
    }
}

/**
 * Structural binding: renders one child fragment per array item, reusing
 * rows by identity and diffing the list on every change; row bindings must
 * be read-only.
 */
export default class CollectionBinding implements IStructuralBinding {

    private source?: CollectionObserver<unknown>;

    private rows: Row[] = [];

    private readonly changed = () => this.render(this.source ?? []);

    private disposed = false;

    private rendering = false;

    private queued?: readonly unknown[];

    constructor(private readonly fragment: IBindingFragment, private readonly property: string, args: string[]) {

        if (args.length) throw new Error(`Binding 'collection' takes no arguments for '${property}'`);
        
        if (!fragment.createChild || !fragment.setChildren) throw new Error('Collection binding requires a multi-child fragment');
    }

    setValue(value: unknown): void {

        if (value != null && !Array.isArray(value)) {
            throw new TypeError(`Binding 'collection' expects an array for '${this.property}'`);
        }

        const next = value instanceof CollectionObserver ? value : undefined;
        const previous = this.source;

        if (next !== previous) {
            previous?.unsubscribeChanges(this.changed);
            this.source = next;
            next?.subscribeChanges(this.changed);
        }

        try {
            this.render(value ?? []);
        } catch (error) {
            if (next !== previous && this.source === next) {
                next?.unsubscribeChanges(this.changed);
                this.source = previous;
                previous?.subscribeChanges(this.changed);
            }

            throw error;
        }
    }

    private render(values: readonly unknown[]): void {

        if (this.disposed) return;
        
        if (this.rendering) {
            this.queued = values;
            return;
        }

        this.rendering = true;

        try {
            let current: readonly unknown[] | undefined = values;

            do {
                this.queued = undefined;
                this.renderOnce(current);
                current = this.queued;
            } while (current && !this.disposed);
        } finally {
            this.rendering = false;
            this.queued = undefined;
        }
    }

    private renderOnce(values: readonly unknown[]): void {

        const source = values instanceof CollectionObserver ? values : undefined;
        const old = [...this.rows];
        const created: Row[] = [];
        const next: Row[] = [];

        try {

            for (const item of [...values]) {

                const index = old.findIndex(row => Object.is(row.item, item) && row.source === source);

                if (index >= 0) {
                    next.push(old.splice(index, 1)[0]);
                } else {

                    const scope = new CollectionScope(item, this.fragment.context, source);

                    try {

                        const child = this.fragment.createChild!(scope, prepareRow);
                        const view: MountedFragment = {
                            get viewNodeList() { return child.viewNodeList; },
                            dispose() { child.dispose(); scope.dispose(); }
                        };

                        const row = { item, source, view };
                        created.push(row);
                        next.push(row);

                    } catch (error) {
                        scope.dispose();
                        throw error;
                    }
                }
            }
            if (this.disposed) {

                for (const row of created) row.view.dispose();
                return;
            }
            this.fragment.setChildren!(next.map(row => row.view));
            this.rows = next;
        } catch (error) {

            for (const row of created) row.view.dispose();
            throw error;
        }
    }

    dispose(): void {

        if (this.disposed) return;
        
        this.disposed = true;
        this.source?.unsubscribeChanges(this.changed);
        this.source = undefined;
        this.fragment.setChildren?.([]);
        this.rows = [];
    }
}
