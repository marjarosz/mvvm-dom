// Fixture cleanup occurs after assertions, never instead of lifecycle assertions.
const teardowns: Array<() => void> = [];

/** Registers a teardown to run in afterEach, after the test's assertions. */
export function cleanup(teardown: () => void): void {

  teardowns.push(teardown);

}

/**
 * Registers `resource.dispose()` as a teardown and returns the resource, so
 * tests can write `const x = own(new X())` inline. Teardowns run LIFO: a
 * resource created later is disposed earlier, matching typical ownership order.
 */
export function own<T extends { dispose(): void }>(resource: T): T {

  cleanup(() => resource.dispose());
  return resource;

}

/**
 * Runs every pending teardown (LIFO). A failing teardown does not skip the
 * rest; the first error is rethrown at the end so cleanup never masks
 * lifecycle bugs by aborting midway.
 */
export function releaseResources(): void {

  const errors: unknown[] = [];

  while (teardowns.length) {
    try { teardowns.pop()!(); } catch (error) { errors.push(error); }
  }
  
  if (errors.length) throw errors[0];
}
