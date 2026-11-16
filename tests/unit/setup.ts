import { afterEach, vi } from 'vitest';
import { releaseResources } from './helpers/resources';

afterEach(() => {
  try {
    releaseResources();
  } finally {
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
