import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import { CollectionObserver } from '@mvvm/collectionObserver';
import type { ICommand } from '@mvvm/command';

interface Task {
    name: string;
    details: { status: string };
}

/** Collections: CollectionObserver rows with nested paths, ArrayObserver operations. */
@autoRegisterCommands()
export class CollectionsDemoModel extends ViewModel {

    @propertyChange()
    accessor projectLabel = 'Release team';

    @propertyChange()
    accessor tasks = new CollectionObserver<Task>(
        { name: 'Design', details: { status: 'active' } },
        { name: 'Code', details: { status: 'active' } },
        { name: 'Test', details: { status: 'new' } }
    );

    @propertyChange()
    accessor lastAction = 'no collection operation yet';

    @command<CollectionsDemoModel>('addTask')
    private addTask(_command: ICommand): void {

        const n = this.tasks.length + 1;
        this.tasks.push({ name: `Task ${n}`, details: { status: 'new' } });
        this.lastAction = `push() -> ${this.tasks.length} rows`;
    }

    @command<CollectionsDemoModel>('removeLast')
    private removeLast(_command: ICommand): void {

        if (!this.tasks.length) return;
        const removed = this.tasks.pop();
        this.lastAction = `pop() -> removed '${removed?.name}', ${this.tasks.length} rows`;
    }

    @command<CollectionsDemoModel>('shuffle')
    private shuffle(_command: ICommand): void {

        this.tasks.reverse();
        this.lastAction = 'reverse() -> rows reordered';
    }

    @command<CollectionsDemoModel>('cycleStatus')
    private cycleStatus(_command: ICommand): void {

        if (!this.tasks.length) return;
        const row = this.tasks[0];
        const next = row.details.status === 'new' ? 'active' : row.details.status === 'active' ? 'done' : 'new';
        row.details.status = next;
        this.lastAction = `row[0].details.status = '${next}' (deep observation)`;
    }

    @command<CollectionsDemoModel>('selectRow')
    private selectRow(cmd: ICommand): void {

        this.lastAction = `row command, parameter: '${cmd.commandData.parameter}'`;
    }
}

/**
 * Imperative API showcase: `ArrayObserver<HTMLElement>` feeding the `innerHTML`
 * binding with snapshot reconciliation. DOM elements and mutation commands
 * are supplied in `main.ts` to keep the ViewModel DOM-free.
 */
export class ArrayDemoModel extends ViewModel {
    
    @propertyChange()
    accessor tagInfo = 'ArrayObserver with 3 items';
}
