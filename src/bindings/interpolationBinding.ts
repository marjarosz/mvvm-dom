import { type IBinding, Binding } from '../binding.js';

/**
 * Reactive textual interpolation.
 *
 * `{{property}}` tokens in the element's text (and its descendants) are
 * replaced with empty text slots. `setValue` updates only those slots, so:
 *  - the value always reaches the DOM as text (never through innerHTML),
 *  - the remaining elements, their attributes, values and event handlers
 *    are left untouched,
 *  - the tokens stay in the template and are updated on every assignment,
 *  - tokens in attributes and in `script`, `style` and `template` content
 *    are ignored.
 *
 * The cut-out text is replaced by slots without preserving the original
 * content - restoration is intentionally unsupported: `dispose` only clears
 * the slots.
 */
export default class InterpolationBinding extends Binding implements IBinding {

    private static readonly TOKEN_SOURCE = '{{\\s*([\\w$.]+)\\s*}}';

    private slots: Text[] = [];

    constructor(element: HTMLElement, propertyName: string, argList: string[]) {
        super(element, propertyName, argList);
        this.prepareSlots();
    }

    setValue(value: unknown) {
        // Celowo bez prepareValue: null/undefined sa renderowane jako pusty tekst.
        const text = value == null ? '' : String(value);
        for (const slot of this.slots) {
            if (slot.data !== text) {
                slot.data = text;
            }
        }
    }

    dispose(): void {
        this.slots = [];
        super.dispose();
    }

    /** Walks the element's text descendants and replaces matching tokens with empty text slots. */
    private prepareSlots(): void {

        const walker = document.createTreeWalker(this.element, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        let node: Node | null = walker.nextNode();

        while (node !== null) {
            if (this.isInterpolableTextNode(node as Text)) {
                textNodes.push(node as Text);
            }
            node = walker.nextNode();
        }

        for (const textNode of textNodes) {
            this.replaceMatchingTokens(textNode);
        }
    }

    /** Replaces all tokens named `this.propertyName` in a text node with empty text slots; the remaining content is unchanged. */
    private replaceMatchingTokens(textNode: Text): void {

        const data = textNode.data;
        // Lokalny regex z flaga g i exec - target ES6 nie ma String.matchAll.
        const regex = new RegExp(InterpolationBinding.TOKEN_SOURCE, 'g');

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let found = false;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(data)) !== null) {

            if (match[1] !== this.propertyName) {
                continue;
            }

            found = true;
            const start = match.index;

            if (start > lastIndex) {
                fragment.appendChild(document.createTextNode(data.slice(lastIndex, start)));
            }

            const slot = document.createTextNode('');
            this.slots.push(slot);
            fragment.appendChild(slot);
            lastIndex = start + match[0].length;
        }

        if (found) {
            
            if (lastIndex < data.length) {
                fragment.appendChild(document.createTextNode(data.slice(lastIndex)));
            }
            textNode.replaceWith(fragment);
        }
    }

    /** Text qualifies only when it is not inside `script`/`style`/`template` or a nested `data-bind` scope (another bound element). */
    private isInterpolableTextNode(textNode: Text): boolean {

        const parent = textNode.parentElement;
        if (!parent) {
            return false;
        }

        if (parent.closest('script, style, template')) {
            return false;
        }

        const nestedScope = parent.closest('[data-bind]');
        if (nestedScope && nestedScope !== this.element) {
            return false;
        }

        return true;
    }
}
