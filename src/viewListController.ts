import { ArrayObserver, type CollectionChange } from './arrayObserver.js';

/** Placement of the rendered list within the host element. */
export type ViewListPlace = 'start' | 'end';

/**
 * Controller for a list of views/items inside a host element.
 *
 * Semantics: snapshot-based reconciliation. After every source change the
 * CURRENT snapshot of the collection is rendered, and the controller
 * computes the minimal insert/remove/move operations against the current
 * DOM (position identity = reference identity).
 *
 * Ownership rule: the controller borrows views - it detaches DOM but does
 * NOT destroy the views.
 */
export class ViewListController {

    /** Placement of the list within the host: 'start' or 'end'. */
    public place: ViewListPlace;

    private readonly host: HTMLElement;

    private items: unknown[] = [];

    private itemSet = new Set<unknown>();

    private source?: ArrayObserver<unknown>;

    private readonly observerCallback = this.onSourceChange.bind(this);

    private rendering = false;

    private dirty = false;

    // Oczekujące żądanie setSource złożone w trakcie renderu.
    // `undefined` oznacza brak żądania; obiekt oznacza żądanie do zastosowania
    // po zakończeniu renderu (source może być undefined - czyść do pustej listy).
    private pendingSource?: { source: unknown[] | ArrayObserver<unknown> | undefined };

    private disposed = false;

    private readonly readyOnce = new WeakSet<Element>();

    /**
     * @param host The element that receives the rendered list items.
     * @param place Where the list is placed within the host (default 'end').
     */
    constructor(host: HTMLElement, place: ViewListPlace = 'end') {
        this.host = host;
        this.place = place;
    }

    /**
     * Attaches a source (a plain array or an {@link ArrayObserver}) and
     * renders the current snapshot. Observation happens BEFORE rendering
     * (re-entrancy safety - a source change during rendering is not lost).
     *
     * @param source The new source; `undefined` clears the list.
     */
    public setSource(source: unknown[] | ArrayObserver<unknown> | undefined): void {

        // setSource w trakcie renderu - zapisz żądanie i zastosuj je
        // po zakończeniu bieżącego renderu (pełnego lub przyrostowego).
        if (this.disposed) return;

        if (this.rendering) {
            this.pendingSource = { source };
            return;
        }
        // walidacja SNAPSHOTU nowego źródła PRZED zmianą subskrypcji -
        // odrzucone źródło nie zostawia po sobie żadnego śladu (stara subskrypcja
        // i stare widoki pozostają aktywne).
        this.validate(Array.from(source ?? []));

        this.dirty = false;

        if (this.source) {
            this.source.unsubscribeChanges(this.observerCallback);
        }

        this.source = source instanceof ArrayObserver ? source : undefined;

        if (this.source) {
            this.source.subscribeChanges(this.observerCallback);
        }

        this.render(Array.from(source ?? []));
    }

    /** Re-renders the current snapshot of the source. */
    public refresh(): void {

        if (this.disposed) {
            return;
        }

        this.render(Array.from(this.source ?? this.items));
    }

    /**
     * Releases the source and detaches all items from the host (views are
     * NOT destroyed - ownership rule). Idempotent.
     */
    public dispose(): void {

        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.pendingSource = undefined;
        this.dirty = false;

        if (this.source) {
            this.source.unsubscribeChanges(this.observerCallback);
        }

        this.source = undefined;

        for (const item of this.items) {
            ViewListController.detachItem(item, this.host);
        }

        this.items = [];
        this.itemSet.clear();
    }

    private onSourceChange(change: CollectionChange<unknown>): void {

        if (!this.source) {
            return;
        }

        if (this.rendering) {
            this.dirty = true;
            return;
        }

        if (change.type === 'reset') {
            this.render(Array.from(this.source));
            return;
        }

        if (this.tryIncremental(change)) {
            return;
        }

        this.render(Array.from(this.source));
    }

    /**
     * Fast path for single inserts/removes: no full diff.
     * Returns false when the controller state does not match the
     * notification (e.g. sort/fill/splice with replacement) - then the
     * full reconciliation runs.
     */
    private tryIncremental(change: CollectionChange<unknown>): boolean {

        const source = this.source;
        const current = this.items;

        if (this.disposed || !source || change.type !== 'splice') {
            return false;
        }

        const { index, removed, added } = change;
        if (source.length !== current.length - removed.length + added.length ||
            index < 0 || index + removed.length > current.length) {
            return false;
        }

        for (let i = 0; i < removed.length; i++) {
            if (current[index + i] !== removed[i]) {
                return false;
            }

        }

        if (added.length === 0 && removed.length > 0 &&
            (index === 0 || index + removed.length === current.length)) {

            this.rendering = true;

            try {
                for (const item of removed) {
                    ViewListController.detachItem(item, this.host);
                    this.itemSet.delete(item);
                }
                current.splice(index, removed.length);
            } finally {
                this.finishRender();
            }

            return true;
        }

        if (removed.length !== 0 || added.length === 0 ||
            (index !== 0 && index !== current.length)) {

            return false;
        }

        let before: Node | null;

        if (index === current.length) {

            if (added.some((item, offset) => source[index + offset] !== item)) {
                return false;
            }

            if (current.length === 0) {
                before = null;
            } else {
                const nodes = ViewListController.nodesOf(current[current.length - 1]);
                const last = nodes[nodes.length - 1];
                if (!last || last.parentNode !== this.host) {
                    return false;
                }
                before = last.nextSibling;
            }
        } else {

            if (added.some((item, offset) => source[offset] !== item)) {
                return false;
            }

            if (current.length === 0) {
                before = null;
            } else {
                const first = ViewListController.nodesOf(current[0])[0];
                if (!first || first.parentNode !== this.host) {
                    return false;
                }
                before = first;
            }
        }

        if (current.length === 0 && this.place === 'start') {

            before = this.host.firstChild;
        }

        this.validate([...added], true);
        this.rendering = true;

        try {

            const inserted: Node[] = [];
            for (const item of added) {

                for (const node of ViewListController.nodesOf(item)) {
                    this.host.insertBefore(node, before);
                    inserted.push(node);
                }
                this.itemSet.add(item);
            }

            current.splice(index, 0, ...added);
            this.emitReady(inserted);
        } finally {
            this.finishRender();
        }
        return true;
    }

    private finishRender(): void {

        this.rendering = false;
        if (this.disposed) return;
        const pending = this.pendingSource;
        this.pendingSource = undefined;

        try {
            if (pending) this.setSource(pending.source);
        } finally {
            // A rejected switch can still leave changes to the active source.
            if (this.dirty && this.source && !this.disposed) {
                this.dirty = false;
                this.render(Array.from(this.source));
            }
        }
    }

    private render(desired: unknown[]): void {

        if (this.rendering || this.disposed) {
            return;
        }

        this.validate(desired);

        const document = this.host.ownerDocument;
        const active = document.activeElement;
        const focused = active instanceof HTMLElement && this.host.contains(active) &&
            desired.some(item => ViewListController.nodesOf(item).some(node => node.contains(active)))
            ? active : undefined;
        const input = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
            ? focused : undefined;
        const selection = input && input.selectionStart !== null && input.selectionEnd !== null
            ? { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection ?? undefined }
            : undefined;
        this.rendering = true;

        try {
            const current = this.items;
            const keepA = ViewListController.longestCommonSubsequence(current, desired);
            const keepAt: { [idx: number]: boolean } = {};
            
            for (const idx of keepA) {
                keepAt[idx] = true;
            }

            const keptItems = new Set<unknown>();
           
            for (const idx of keepA) {
                keptItems.add(current[idx]);
            }

            // 1) usuń elementy, które nie pozostały
            for (let i = 0; i < current.length; i++) {
                if (!keepAt[i]) {
                    ViewListController.detachItem(current[i], this.host);
                }
            }

            // 2) jedno przejście wstecz: węzeł referencyjny wyznacza początek
            //    już ułożonego sufiksu, a kolekcja pozostaje w kolejności źródła.
            const desiredNodes = new Set<Node>();
            for (const item of desired) {
                for (const node of ViewListController.nodesOf(item)) {
                    desiredNodes.add(node);
                }
            }

            let reference: Node | null = null;

            if (this.place === 'start') {
                for (let n = this.host.firstChild; n; n = n.nextSibling) {
                    if (!desiredNodes.has(n)) {
                        reference = n;
                        break;
                    }
                }
            }

            for (let i = desired.length - 1; i >= 0; i--) {

                const nodes = ViewListController.nodesOf(desired[i]);
                let alreadyPlaced = true;

                for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
                    const expectedNext = nodeIndex + 1 < nodes.length
                        ? nodes[nodeIndex + 1]
                        : reference;
                    if (nodes[nodeIndex].parentNode !== this.host ||
                        nodes[nodeIndex].nextSibling !== expectedNext) {
                        alreadyPlaced = false;
                        break;
                    }
                }

                if (!alreadyPlaced) {
                    ViewListController.detachItem(desired[i], this.host);
                    for (const node of nodes) {
                        this.host.insertBefore(node, reference);
                    }
                }

                reference = nodes[0];
            }

            this.items = desired;
            this.itemSet = new Set(desired);

            // Detaching retained nodes can reset focus to the document body.
            // Restore before ready handlers, so their explicit focus changes win.
            if (focused?.isConnected && this.host.contains(focused) &&
                document.activeElement !== focused &&
                (!document.activeElement || document.activeElement === document.body)) {

                focused.focus({ preventScroll: true });

                if (input && selection && document.activeElement === focused) {
                    input.setSelectionRange(selection.start, selection.end, selection.direction);
                }
            }

            const insertedNodes: Node[] = [];

            for (const item of desired) {
                if (!keptItems.has(item)) {
                    insertedNodes.push(...ViewListController.nodesOf(item));
                }
            }

            this.emitReady(insertedNodes);
        } finally {

            this.finishRender();
        }
    }

    /**
     * Validates BEFORE mutation - an error means no partial DOM change.
     */
    private validate(desired: unknown[], incremental = false): void {

        const seenItems = new Set<unknown>();
        const seenNodes = new Set<Node>();

        for (const item of desired) {

            if (seenItems.has(item) || (incremental && this.itemSet.has(item))) {
                throw new Error(`ViewListController: zduplikowany element w źródle (${item})`);
            }

            seenItems.add(item);
            const nodes = ViewListController.nodesOf(item);

            if (nodes.length === 0) {
                throw new Error('ViewListController: element bez renderowalnych węzłów');
            }

            for (const node of nodes) {
                if (seenNodes.has(node)) {
                    throw new Error('ViewListController: ten sam węzeł użyty przez dwa elementy');
                }
                seenNodes.add(node);
            }
        }
        // Nakładanie korzeni: wystarczy sprawdzić przodków każdego węzła (O(n·głębokość)).
        for (const node of seenNodes) {

            if (node.contains(this.host)) {
                throw new Error('ViewListController: korzeń elementu zawiera host');
            }

            for (let p = node.parentNode; p && p !== this.host; p = p.parentNode) {
                if (seenNodes.has(p)) {
                    throw new Error('ViewListController: nachodzące na siebie korzenie elementów');
                }
            }
        }
        const currentItems = incremental ? new Set<unknown>() : this.itemSet;

        for (const item of desired) {
            if (currentItems.has(item)) {
                continue;
            }

            for (const node of ViewListController.nodesOf(item)) {
                if (this.host.contains(node)) {
                    throw new Error('ViewListController: węzeł elementu jest już w hoście');
                }
            }
        }
    }

    private emitReady(nodes: Node[]): void {

        for (const node of nodes) {
            if (this.disposed) return;
            if (node instanceof Element) {
                this.markReady(node);
            }
        }
    }

    private markReady(root: Element): void {

        if (this.readyOnce.has(root)) {
            return;
        }

        const targets: Element[] = [root];
        root.querySelectorAll('*').forEach((el) => targets.push(el));

        for (const el of targets) {
            if (this.disposed) return;
            if (!this.readyOnce.has(el)) {
                this.readyOnce.add(el);
                el.dispatchEvent(new Event('ready'));
            }
        }
    }

    private static nodesOf(item: unknown): Node[] {

        if (item instanceof HTMLElement) {
            return [item];
        }

        if (item != null && typeof item === 'object' && Array.isArray((item as {viewNodeList?: unknown}).viewNodeList)) {
            return (item as {viewNodeList: ChildNode[]}).viewNodeList as Node[];
        }

        return [];
    }

    private static detachItem(item: unknown, host: HTMLElement): void {

        for (const node of ViewListController.nodesOf(item)) {
            if (host.contains(node) && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    }

    /**
     * Longest common subsequence (reference identity) - returns the indices
     * of `a` elements that keep their relative order in `b`.
     *
     * @param a The first list (the current DOM state).
     * @param b The second list (the desired state).
     * @returns Indices of `a` forming the common subsequence, in order.
     */
    static longestCommonSubsequence(a: unknown[], b: unknown[]): number[] {
        // Elementy są unikalne (walidacja), więc LCS = najdłuższy rosnący
        // podciąg pozycji w `b` - O(n log n) zamiast tablicy DP n×m.
        const posInB = new Map<unknown, number>();

        for (let j = 0; j < b.length; j++) {
            posInB.set(b[j], j);
        }
        const aIdx: number[] = [];
        const pos: number[] = [];

        for (let i = 0; i < a.length; i++) {
            const p = posInB.get(a[i]);
            if (p !== undefined) {
                aIdx.push(i);
                pos.push(p);
            }
        }

        const tails: number[] = [];
        const prev: number[] = [];

        for (let k = 0; k < pos.length; k++) {
            let lo = 0;
            let hi = tails.length;

            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (pos[tails[mid]] < pos[k]) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            
            prev[k] = lo > 0 ? tails[lo - 1] : -1;
            tails[lo] = k;
        }
        const result: number[] = [];
        let k = tails.length > 0 ? tails[tails.length - 1] : -1;

        while (k >= 0) {
            result.push(aIdx[k]);
            k = prev[k];
        }

        result.reverse();
        
        return result;
    }
}
