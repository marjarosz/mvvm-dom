import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import { CollectionObserver } from '@mvvm/collectionObserver';
import type { ICommand } from '@mvvm/command';

interface Dropped {
    label: string;
}

/** Drag & drop: `draggable` as an attribute binding plus the `dragover` / `dragleave` / `drop` commands. */
@autoRegisterCommands()
export class DragDemoModel extends ViewModel {

    @propertyChange()
    accessor dragAttr = 'true';

    @propertyChange()
    accessor dropClass = 'dropzone';

    @propertyChange()
    accessor dropNote = 'drop a chip, a text selection or files here';

    @propertyChange()
    accessor received = new CollectionObserver<Dropped>();

    @command<DragDemoModel>('toggleDraggable')
    private toggleDraggable(_command: ICommand): void {

        this.dragAttr = this.dragAttr === 'true' ? 'false' : 'true';
    }

    @command<DragDemoModel>('dragOver')
    private dragOver(_command: ICommand): void {

        this.dropClass = 'dropzone over';
    }

    @command<DragDemoModel>('dragLeave')
    private dragLeave(_command: ICommand): void {
        
        this.dropClass = 'dropzone';
    }

    @command<DragDemoModel>('dropped')
    private dropped(command: ICommand): void {

        const zone = command.commandData.objectSender as HTMLElement;
        const event = command.commandData.sourceEvent as DragEvent;
        const files = event.dataTransfer?.files;
        const text = event.dataTransfer?.getData('text/plain') ?? '';
        const payload = files?.length
            ? `${files.length} file(s): ${Array.from(files, file => file.name).join(', ')}`
            : text
                ? `"${text.slice(0, 40)}"`
                : `${zone.tagName.toLowerCase()} (no payload)`;
        this.received.push({ label: payload });
        this.dropClass = 'dropzone done';
        this.dropNote = `${this.received.length} dropped - last: ${payload}`;

    }

    @command<DragDemoModel>('clearDrops')
    private clearDrops(_command: ICommand): void {

        this.received.splice(0, this.received.length);
        this.dropClass = 'dropzone';
        this.dropNote = 'drop a chip, a text selection or files here';
    }
}
