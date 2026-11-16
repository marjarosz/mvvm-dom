/**
 * Contract for objects that own resources and can release them
 * deterministically.
 */
export interface IDisposable {
    
    /**
     * Releases the resources owned by this object.
     * Implementations must make this method idempotent, so that repeated
     * calls are no-ops.
     */
    dispose(): void;
}

/** Callback that releases a single resource (a subscription, a listener, ...). */
export type Teardown = () => void;
