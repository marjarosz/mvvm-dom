import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { Command } from '@mvvm/command';
import { propertyChange } from '@mvvm/propertyDecorators';
import { requireTemplate } from '../mount';

class PanelModel extends ViewModel {

    private releasedAlready = false;

    @propertyChange()
     accessor title = '';

    @propertyChange() 
    accessor note = '';

    @propertyChange() 
    accessor count = 0;

    // Assigned in the constructor, not as a parameter property: Babel lowers the
    // decorators of this class (Oxc does not) and its transform would move a
    // parameter property above the super() call. See scripts/vite-transform.mts.
    private readonly released: () => void;

    constructor(id: number, remove: () => void, released: () => void) {

        super();
        this.released = released;
        this.title = `Panel ${id}`;
        this.registerCommand('increment', new Command(() => { this.count++; }));
        this.registerCommand('remove', new Command(remove));

    }

    override dispose(): void {

        if (this.releasedAlready) return;
        this.releasedAlready = true;
        super.dispose();
        this.released();
    }
}

/** This model owns the child Views; innerHTML only borrows and moves them. */
export class ViewPanelsDemoModel extends ViewModel {

    @propertyChange() 
    accessor panels = new ArrayObserver<View>();

    @propertyChange() 
    accessor live = 0;

    @propertyChange() 
    accessor disposedCount = 0;

    @propertyChange() 
    accessor empty = false;

    @propertyChange() 
    accessor action = 'Edit a note, increment a counter, then reverse the panels.';

    private serial = 0;

    private releasedAlready = false;

    constructor() {

        super();

        this.registerCommand('addPanel', new Command(() => this.add()));
        this.registerCommand('reversePanels', new Command(() => {
            this.panels.reverse();
            this.action = 'Same Views, new order. Notes and counters stay with their panels.';
        }));

        this.registerCommand('clearPanels', new Command(() => {
            const removed = this.panels.splice(0);
            for (const view of removed) view.dispose();
            this.refresh();
            this.action = 'All panels removed; their Views and owned models were disposed.';
        }));

        this.add();
        this.add();

        this.action = 'Edit a note, increment a counter, then reverse the panels.';
    }

    private refresh(): void {

        this.live = this.panels.length;
        this.empty = this.live === 0;
    }

    private add(): void {

        const id = ++this.serial;

        const model = new PanelModel(id, () => {
            const index = this.panels.indexOf(view);
            if (index < 0) return;
            this.panels.splice(index, 1); // Detach first; then explicitly release ownership.
            view.dispose();
            this.refresh();
            this.action = `Panel ${id} removed. Its View and model are disposed.`;
        }, () => { this.disposedCount++; });

        const view = new View(requireTemplate('workPanelTpl'), model);

        this.panels.push(view);
        this.refresh();
        this.action = `Panel ${id} added with its own model.`;
    }

    override dispose(): void {

        if (this.releasedAlready) return;
        this.releasedAlready = true;
        for (const view of this.panels.splice(0)) view.dispose();
        super.dispose();
        
    }
}
