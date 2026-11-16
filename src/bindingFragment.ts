import type { IBindingContext } from './viewModel.js';

/**
 * A structural placeholder inside a view: a comment anchor plus lazily
 * created children. Structural bindings (`if`, `collection`) mount and
 * unmount fragments to add or remove child views.
 */
export interface IBindingFragment {

    /** All currently mounted child nodes, in DOM order. */
    readonly nodes: readonly ChildNode[];

    /** The data context used to create children. */
    readonly context?: IBindingContext;

    /** Mounts the fragment (creates a child when needed). */
    mount(): void;

    /** Unmounts the fragment (disposes all children). */
    unmount(): void;

    /** Creates a child fragment for `context`, optionally preparing its template first. */
    createChild?(context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void): MountedFragment;

    /** Replaces the mounted children with `children`, disposing the removed ones. */
    setChildren?(children: readonly MountedFragment[]): void;
}

/** A created child of a {@link BindingFragment}: its DOM nodes and disposal. */
export interface MountedFragment {

    /** The child's DOM nodes, in order. */
    readonly viewNodeList: ChildNode[];

    /** Detaches the child's nodes and releases its resources. */
    dispose(): void;
}

/** The binding side of a structural declaration (e.g. `if: visible`). */
export interface IStructuralBinding {

    /** Applies the current source value to the fragment (mount/unmount). */
    setValue(value: unknown): void;

    dispose?(): void;
}

/** Creates the {@link IStructuralBinding} for a parsed structural declaration. */
export type StructuralBindingFactory = (
    fragment: IBindingFragment, property: string, args: string[]
) => IStructuralBinding;

/**
 * Default {@link IBindingFragment} implementation.
 *
 * Wraps a comment anchor: while mounted it keeps exactly one child
 * fragment (the view rendered for `context`); unmounting disposes it.
 * `setChildren` patches the DOM incrementally and preserves the focus
 * and text selection of retained nodes.
 */
export class BindingFragment implements IBindingFragment {

    private children: MountedFragment[] = [];

    private wanted = false;

    private updating = false;

    private disposed = false;

    /**
     * @param anchor The comment node marking the fragment's position.
     * @param create Factory that creates a child fragment for a context.
     * @param context The data context used to create children.
     */
    constructor(
        private readonly anchor: Comment,
        private readonly create: (context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void) => MountedFragment,
        public readonly context: IBindingContext | undefined
    ) {}

    /** All currently mounted child nodes, in DOM order. */
    get nodes(): ChildNode[] {

        return this.children.flatMap(child => child.viewNodeList);

    }

    /**
     * Creates a child fragment using the fragment's `create` factory.
     *
     * @param context The data context for the child.
     * @param prepare Optional template preparation hook.
     * @returns The created child fragment.
     * @throws {Error} When the fragment has been disposed.
     */
    createChild(context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void): MountedFragment {

        if (this.disposed) throw new Error('Cannot create a child of a disposed fragment');
        return this.create(context, prepare);

    }

    /**
     * Replaces the mounted children with `children`: retained nodes are
     * re-inserted in place, removed children are disposed, and the focus
     * / text selection of retained nodes is preserved.
     *
     * @param children The new child fragments (must be unique).
     * @throws {Error} When the fragment has been disposed or `children`
     *   contains duplicates.
     */
    setChildren(children: readonly MountedFragment[]): void {

        if (this.disposed) throw new Error('Cannot update a disposed fragment');

        if (new Set(children).size !== children.length) throw new Error('Fragment children must be unique');

        const parent = this.anchor.parentNode;
        const document = this.anchor.ownerDocument;
        const active = document.activeElement;

        const focused = active instanceof HTMLElement && children.some(child =>
            child.viewNodeList.some(node => node === active || node.contains(active))) ? active : undefined;

        const input = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused : undefined;

        const selection = input && input.selectionStart !== null && input.selectionEnd !== null
            ? { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection ?? undefined }
            : undefined;

        let next = this.anchor.nextSibling;

        if (parent) {

            for (const child of children) {

                for (const node of child.viewNodeList) {
                    if (node !== next) parent.insertBefore(node, next);
                    next = node.nextSibling;
                }

            }

        }
        const retained = new Set(children);
        const removed = this.children.filter(old => !retained.has(old));

        this.children = [...children];
        this.disposeChildren(removed);

        if (focused && focused.isConnected && document.activeElement !== focused) {

            focused.focus({ preventScroll: true });
            if (input && selection) input.setSelectionRange(selection.start, selection.end, selection.direction);

        }
    }

    /** Mounts the fragment: creates a single child when needed. */
    mount(): void {

        this.setMounted(true);

    }

    /** Unmounts the fragment: disposes all children. */
    unmount(): void {

        this.setMounted(false);

    }

    /** Convergence loop: adjusts the children until the mounted state matches `wanted`. */
    private setMounted(wanted: boolean): void {

        if (this.disposed) return;

        this.wanted = wanted;
        if (this.updating) return;

        this.updating = true;

        try {

            while (!this.disposed && this.wanted !== Boolean(this.children.length)) {
                if (this.wanted) {
                    const child = this.createChild(this.context);
                    if (this.disposed || !this.wanted) {
                        child.dispose();
                    } else {
                        try {
                            this.setChildren([child]);
                        } catch (error) {
                            child.dispose();
                            throw error;
                        }
                    }
                } else {
                    this.releaseChild();
                }
            }
        } finally {

            this.updating = false;
        }
    }

    /** Disposes all current children. */
    private releaseChild(): void {

        const children = this.children;
        this.children = [];
        this.disposeChildren(children);

    }

    /** Attempts every cleanup before propagating the first failure. */
    private disposeChildren(children: readonly MountedFragment[]): void {

        let failed = false;
        let firstError: unknown;

        for (const child of children) {

            try {
                child.dispose();
            } catch (error) {
                if (!failed) firstError = error;
                failed = true;
            }
        }

        if (failed) throw firstError;
    }

    /** Disposes all children and removes the anchor comment. Idempotent. */
    dispose(): void {

        this.disposed = true;

        try {
            this.releaseChild();
        } finally {
            this.anchor.remove();
        }
        
    }
}
