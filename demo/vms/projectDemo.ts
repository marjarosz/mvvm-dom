import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { Command } from '@mvvm/command';
import { OptionValue } from '@mvvm/index';

interface Task { id: number; name: string; category: string; status: string; priority: string }
const initialTasks = (): Task[] => [

    { id: 1, name: 'Design the component library', category: 'Design', status: 'In progress', priority: 'High' },
    { id: 2, name: 'Connect the reactive models', category: 'Engineering', status: 'Done', priority: 'High' },
    { id: 3, name: 'Write the getting-started guide', category: 'Documentation', status: 'To do', priority: 'Normal' },
    { id: 4, name: 'Test keyboard navigation', category: 'Quality', status: 'To do', priority: 'Normal' },

];

/** A local project workspace. No account, requests or remote persistence. */
export class ProjectDemoModel extends ViewModel {

    @propertyChange() 
    accessor activeTab = 'tasks';

    @propertyChange() 
    accessor editorOpen = false;

    @propertyChange() 
    accessor deleteOpen = false;

    @propertyChange() 
    accessor notice = 'Select a task to edit it, or create something new.';

    @propertyChange() 
    accessor activity = new CollectionObserver<{ label: string; detail: string }>(
        { label: 'Workspace ready', detail: 'Four sample tasks loaded. Try making a change.' }
    );

    @propertyChange() 
    accessor pending = 0;

    @propertyChange() 
    accessor highPriority = 0;

    @propertyChange() 
    accessor tasks = new CollectionObserver<Task>(...initialTasks());

    @propertyChange() 
    accessor visibleTasks: Task[] = [];

    @propertyChange() 
    accessor query = '';

    @propertyChange() 
    accessor filter = 'All';

    @propertyChange() 
    accessor total = 0;

    @propertyChange() 
    accessor completed = 0;

    @propertyChange() 
    accessor active = 0;

    @propertyChange() 
    accessor progress = '0%';

    @propertyChange() 
    accessor empty = false;

    @propertyChange() 
    accessor resultNote = '';

    @propertyChange() 
    accessor title = 'Design the component library';

    @propertyChange() 
    accessor editorTitle = 'Edit task';

    @propertyChange() 
    accessor draftStatus = 'In progress';

    @propertyChange() 
    accessor priority = 'High';

    @propertyChange() 
    accessor category = 'Design';

    @propertyChange() 
    accessor saveNote = 'Changes stay in this demo. Nothing is sent to a server.';

    @propertyChange() 
    accessor busy = false;

    @propertyChange() 
    accessor saveLabel = 'Save changes';

    @propertyChange() 
    accessor filters = ['All', 'To do', 'In progress', 'Done'].map(x => new OptionValue(x, x, x === 'All'));

    @propertyChange() 
    accessor statuses = ['To do', 'In progress', 'Done'].map(x => new OptionValue(x, x, x === 'In progress'));

    private selected = 1;

    private nextId = 5;

    private stopped = false;

    private draggedTask?: number;

    private timer?: ReturnType<typeof setTimeout>;

    private finishWait?: () => void;

    constructor() {
        super();

        this.registerCommand('reorderTask', new Command(command => {
            
            const id = Number(command.commandData.parameter);
            const [phase, placement] = command.commandData.args;
            
            if (phase === 'finish') { this.draggedTask = undefined; return; }
           
            if (this.stopped || this.busy || this.editorOpen || this.deleteOpen) return;
            
            if (phase === 'start') {
                this.draggedTask = this.visibleTasks.some(task => task.id === id) ? id : undefined;
            } else if (phase === 'drop') {
                const source = this.draggedTask;
                this.draggedTask = undefined;
                if (source !== undefined && (placement === 'before' || placement === 'after')) {
                    this.moveTask(source, id, placement);
                }
            } else if (phase === 'up' || phase === 'down') {
                const index = this.visibleTasks.findIndex(task => task.id === id);
                if (index < 0) return;
                const target = this.visibleTasks[index + (phase === 'up' ? -1 : 1)];
                if (target) this.moveTask(id, target.id, phase === 'up' ? 'before' : 'after');
            }
        }));

        this.registerPropertyValidator('title', [{
            isValid: value => typeof value === 'string' && value.trim().length >= 3,
            getMessage: () => 'Use at least 3 characters for the task name.'
        }]);

        this.registerCommand('filterTasks', new Command(() => {
            this.filter = this.filters.find(option => option.isSelected)?.value ?? 'All';
            this.refresh();
        }));

        this.registerCommand('changeStatus', new Command(() => {
            this.draftStatus = this.statuses.find(option => option.isSelected)?.value ?? 'To do';
        }));

        this.registerCommand('selectTask', new Command(command => this.select(Number(command.commandData.parameter)), undefined, { canExecute: () => !this.busy }));
       
        this.registerCommand('newTask', new Command(() => {
            this.selected = 0; this.title = ''; this.category = 'Engineering'; this.priority = 'Normal';
            this.setStatus('To do'); this.editorTitle = 'New task'; this.saveNote = 'Give your next task a name.';
            this.resetPropertyValidationState('title'); this.updateGates();
            this.editorOpen = true;
        }, undefined, { canExecute: () => !this.busy }));

        this.registerCommand('closeEditor', new Command(() => { this.editorOpen = false; }, undefined, { canExecute: () => !this.busy }));
        
        this.registerCommand('requestDelete', new Command(() => { this.deleteOpen = true; }, undefined, { canExecute: () => this.selected !== 0 && !this.busy }));
        
        this.registerCommand('cancelDelete', new Command(() => { this.deleteOpen = false; }));
       
        this.registerCommand('removeTask', new Command(() => {

            const index = this.tasks.findIndex(task => task.id === this.selected);
            if (index < 0) return;
            const name = this.tasks[index].name;

            this.tasks.splice(index, 1); this.selected = 0; this.refresh();
            this.title = ''; this.editorTitle = 'New task'; this.saveNote = 'Task deleted. Add another whenever you are ready.';
            this.deleteOpen = false; this.editorOpen = false;
            this.notice = `Deleted “${name}”.`;
            this.activity.unshift({ label: 'Task deleted', detail: name });

            this.resetPropertyValidationState('title'); this.updateGates();

        }, undefined, { canExecute: () => this.selected !== 0 && !this.busy }));

        this.registerCommand('reverseTasks', new Command(() => { this.tasks.reverse(); this.refresh(); this.notice = 'Task order reversed.'; }));
        
        this.registerCommand('saveTask', new Command(async () => {

            if (!this.validate()) { this.saveNote = 'Check the task name before saving.'; return; }
           
            this.busy = true; this.saveLabel = 'Saving…'; this.saveNote = 'Simulating an asynchronous save…'; this.updateGates();
            await new Promise<void>(resolve => { this.finishWait = resolve; this.timer = setTimeout(resolve, 700); });
            
            this.timer = undefined; this.finishWait = undefined;
            
            if (this.stopped) return;
            
            const data = { name: this.title.trim(), status: this.draftStatus, priority: this.priority, category: this.category.trim() || 'General' };
            const existing = this.tasks.find(task => task.id === this.selected);
            
            if (existing) Object.assign(existing, data);
            else { this.selected = this.nextId++; this.tasks.push({ id: this.selected, ...data }); }
           
            this.title = data.name; this.editorTitle = 'Edit task'; this.busy = false; this.saveLabel = 'Save changes';
            this.saveNote = 'Saved locally for this session. Try changing a filter.';
            this.notice = `${existing ? 'Updated' : 'Created'} “${data.name}”. Saved for this session.`;
            this.activity.unshift({ label: existing ? 'Task updated' : 'Task created', detail: `${data.name} · ${data.status}` });
            this.refresh(); this.updateGates();
            this.editorOpen = false;

        }, undefined, { blockWhileExecuting: true }));

        this.refresh();
    }

    private select(id: number): void {

        const task = this.tasks.find(task => task.id === id);
        if (!task) return;
        this.selected = id; this.title = task.name; this.category = task.category;
        this.priority = task.priority; this.setStatus(task.status); this.editorTitle = 'Edit task';
        this.saveNote = 'Changes stay in this demo. Nothing is sent to a server.';
        this.resetPropertyValidationState('title'); this.updateGates();
        this.editorOpen = true;
    }

    private moveTask(sourceId: number, targetId: number, placement: 'before' | 'after'): void {

        if (sourceId === targetId || ![sourceId, targetId].every(id => this.visibleTasks.some(task => task.id === id))) return;
        
        const previous = Array.from(this.tasks);
        const source = previous.find(task => task.id === sourceId);
        
        if (!source) return;
        
        const next = previous.filter(task => task.id !== sourceId);
        const targetIndex = next.findIndex(task => task.id === targetId);
       
        if (targetIndex < 0) return;
        next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, source);
        
        if (next.every((task, index) => task.id === previous[index].id)) return;

        // One collection publication, preserving task identities; View owns DOM reconciliation.
        this.tasks.splice(0, this.tasks.length, ...next);
        this.refresh();
        this.notice = `Moved “${source.name}” ${placement} “${previous.find(task => task.id === targetId)!.name}”.`;
        this.activity.unshift({ label: 'Task moved', detail: source.name });
    }

    private updateGates(): void {

        for (const name of ['selectTask', 'newTask', 'removeTask', 'requestDelete', 'closeEditor']) this.getCommand(name)?.notifyCanExecuteChanged?.();
    }

    private setStatus(status: string): void {

        this.draftStatus = status;
        this.statuses = ['To do', 'In progress', 'Done'].map(value => new OptionValue(value, value, value === status));
    }

    private refresh(): void {

        this.visibleTasks = this.tasks.filter(task => (this.filter === 'All' || task.status === this.filter) &&
            `${task.name} ${task.category}`.toLowerCase().includes(this.query.toLowerCase()));
        this.total = this.tasks.length;
        this.completed = this.tasks.filter(task => task.status === 'Done').length;
        this.active = this.tasks.filter(task => task.status === 'In progress').length;
        this.pending = this.tasks.filter(task => task.status === 'To do').length;
        this.highPriority = this.tasks.filter(task => task.priority === 'High').length;
        this.progress = `${this.total ? Math.round(this.completed / this.total * 100) : 0}%`;
        this.empty = !this.visibleTasks.length;
        this.resultNote = `${this.visibleTasks.length} of ${this.total} tasks`;
    }

    override dispose(): void {

        this.stopped = true;
        this.draggedTask = undefined;
        if (this.timer) clearTimeout(this.timer);
        this.finishWait?.();
        super.dispose();
        
    }
}
