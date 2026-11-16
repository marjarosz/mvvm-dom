import { vi } from 'vitest';

// Models registration/delivery only. It makes no claims about browser layout.
export function installResizeObserver(): ResizeObserverProbe[] {

  const instances: ResizeObserverProbe[] = [];

  class Probe extends ResizeObserverProbe {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      instances.push(this);
    }
  }

  vi.stubGlobal('ResizeObserver', Probe);

  return instances;
}

export class ResizeObserverProbe implements ResizeObserver {

  readonly targets = new Set<Element>();

  readonly observe = vi.fn((target: Element) => { this.targets.add(target); });

  readonly unobserve = vi.fn((target: Element) => { this.targets.delete(target); });

  readonly disconnect = vi.fn(() => { this.targets.clear(); });

  constructor(private readonly callback: ResizeObserverCallback) {}

  emit(target: Element, width: number, height: number): void {

    if (!this.targets.has(target)) return;

    const size = [{ inlineSize: width, blockSize: height }];

    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRect(0, 0, width, height),
      borderBoxSize: size,
      contentBoxSize: size,
      devicePixelContentBoxSize: size,
    };

    this.callback([entry], this);
  }
  
}
