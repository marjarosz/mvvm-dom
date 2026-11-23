import type { IDisposable, Teardown } from './disposable.js';

/**
 * Collects teardown callbacks and disposables, releasing all of them at once
 * in reverse registration order.
 *
 * Disposal is idempotent: once disposed, further `add()` calls execute the
 * provided teardown immediately instead of storing it.
 */
export class CompositeDisposable implements IDisposable {

    private disposed = false;

    private readonly teardowns: Teardown[] = [];

    /**
     * Registers a teardown callback to run when this composite is disposed.
     * If the composite is already disposed, the callback is invoked
     * immediately.
     *
     * @param teardown Callback that releases a single resource.
     */
    public add(teardown: Teardown): void {
        if (this.disposed) {
            teardown();
            return;
        }
        this.teardowns.push(teardown);
    }

    /**
     * Registers another disposable to be disposed together with this
     * composite.
     *
     * @param disposable Object to dispose when this composite is disposed.
     */
    public addDisposable(disposable: IDisposable): void {
        this.add(() => disposable.dispose());
    }

    /**
     * Runs all registered teardowns in reverse registration order and marks
     * this composite as disposed. An error thrown by a single teardown is
     * reported to the console with its original thrown value and does not stop
     * the remaining teardowns.
     */
    public dispose(): void {

        if (this.disposed) {
            return;
        }

        this.disposed = true;

        while (this.teardowns.length > 0) {
            const td = this.teardowns.pop();
            if (td) {
                
                try {
                    td();
                } catch (error) {
                    console.warn('Error during teardown in CompositeDisposable', error);
                }
            }
        }
    }
}
