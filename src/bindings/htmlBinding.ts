import { type IBinding, Binding } from '../binding.js'
import {View} from '../view.js'
import { ViewListController, type ViewListPlace } from '../viewListController.js';

/**
 * Binds the element's content: a View / HTMLElement / array is managed by a
 * {@link ViewListController}; any other value is set as trusted HTML.
 */
export default class HtmlBinding extends Binding implements IBinding{

    private controller?: ViewListController;

    // Węzły wstawione przez gałąź HTML - usuwane przy przejściu
    // do View/Array oraz przy dispose (statyczne dzieci elementu zostają).
    private htmlNodes: Node[] = [];

    private get place(): ViewListPlace {
        return (this.args['place'] === 'start' || this.args['place'] === 'end')
            ? this.args['place'] as ViewListPlace
            : 'end';
    }

    /**
     * Sets the value:
     * - View / HTMLElement - single element through the list controller
     *   (replacement: the previous element is detached, nothing accumulates)
     * - Array / ArrayObserver - list managed by the controller
     *   (snapshot diff: insert / remove / move)
     * - anything else - trusted HTML (the controller is released, views detached)
     */
    setValue(value: unknown){

        if(value instanceof View || value instanceof HTMLElement || Array.isArray(value)){

            this.removeHtmlNodes();
            if(!this.controller){
                this.controller = new ViewListController(this.element, this.place);
            }
            this.controller.setSource(Array.isArray(value) ? value : [value]);
        } else {
            this.destroyController();
            this.element.replaceChildren();
            const val = this.prepareValue(value);
            this.element.innerHTML = val.toString();
            this.htmlNodes = Array.from(this.element.childNodes);
        }

    }

    /**
     * Releases the list controller.
     *
     * Ownership rule: the binding borrows a View - it detaches the DOM but
     * does NOT dispose it. The owner (view model) disposes its own children.
     * (no replaceChildren - the host's static children stay.)
     */
    private destroyController(): void {

        if(this.controller){
            this.controller.dispose();
            this.controller = undefined;
        }
    }

    // Usuwa węzły z gałęzi HTML, o ile nadal są podpięte;
    // statyczne dzieci elementu hosta pozostają nietknięte.
    private removeHtmlNodes(): void {

        for (const node of this.htmlNodes) {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
        this.htmlNodes = [];
    }

    public dispose(): void {
        
        this.removeHtmlNodes();
        this.destroyController();
        super.dispose();
    }
}
