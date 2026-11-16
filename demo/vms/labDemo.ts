import { ViewModel } from '@mvvm/viewModel';
import { propertyChange, propertyAlias } from '@mvvm/propertyDecorators';
import { Command } from '@mvvm/command';

/** Less common bindings, direction modes and native event commands. */
export class LabDemoModel extends ViewModel {

    @propertyChange() 
    accessor value = 'Hello, reactive DOM';

    @propertyChange() 
    accessor sourceOnly = 'Waiting for input';

    @propertyAlias('publicName') 
    accessor alias = 'A named property alias';

    @propertyChange() 
    accessor bounds = [200, 90];

    @propertyChange() 
    accessor boxHeight = 80;

    @propertyChange() accessor boxWidth = 180;

    @propertyChange() 
    accessor horizontal = 0;

    @propertyChange() 
    accessor vertical = 0;

    @propertyChange() 
    accessor lastEvent = 'Interact with the controls to see the latest event.';

    @propertyChange()
    accessor animationClass = 'animation-sample';

    @propertyChange() 
    accessor sizeNote = 'Drag the corner to resize the box.';

    @propertyChange() 
    accessor visible = true;

    constructor() {
        super();

        this.registerCommand('event', new Command(command => {
            const event = command.commandData.sourceEvent;
            this.lastEvent = `${event.type} → command executed`;
            if (event instanceof MouseEvent && event.type === 'mousemove') this.lastEvent = `mousemove → ${event.offsetX}, ${event.offsetY}`;
        }));

        this.registerCommand('animate', new Command(() => {
            this.animationClass = this.animationClass === 'animation-sample animate-a' ? 'animation-sample animate-b' : 'animation-sample animate-a';
        }));

        this.registerCommand('changeModel', new Command(() => { this.value = this.value === 'Updated from the model' ? 'Hello, reactive DOM' : 'Updated from the model'; }));
        
        this.registerCommand('toggleVisibility', new Command(() => { this.visible = !this.visible; }));

        this.registerCommand('growHeight', new Command(() => { this.boxHeight = this.boxHeight === 80 ? 140 : 80; }));

        this.registerCommand('growWidth', new Command(() => { this.boxWidth = this.boxWidth === 180 ? 240 : 180; }));

        this.registerCommand('jumpScroll', new Command(() => {
            const reset = this.horizontal > 0 || this.vertical > 0;
            this.horizontal = reset ? 0 : 160;
            this.vertical = reset ? 0 : 180;
        }));

        this.subscribeProperties(event => {
            if ((event as Event & { propertyName: string }).propertyName === 'bounds') this.sizeNote = `${Math.round(this.bounds[0])} × ${Math.round(this.bounds[1])} px - reported by ResizeObserver`;
        });

    }
}
