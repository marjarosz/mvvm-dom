import { describe, expect, it } from 'vitest';
import { ArrayObserver } from '@mvvm/arrayObserver';

// Property-style test: a random-but-seeded operation sequence must keep
// ArrayObserver's state and return values identical to a native Array.
// The seed is part of the test name, so a failure is directly reproducible.
describe('ArrayObserver deterministic operation sequences', () => {

  it.each([1, 17, 2026, 65535])('agrees with Array after every operation (seed %s)', seed => {

    let state = seed;
    // Minimal LCG (Numerical Recipes constants): reproducible across engines,
    // unlike Math.random, so regressions never depend on run-time luck.
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
    const expected: number[] = [], actual = new ArrayObserver<number>();

    for (let step = 0; step < 100; step++) {

      const operation = random() % 8, value = random() % 100, start = (random() % 9) - 4;
      const apply = (array: number[]) => {
        switch (operation) {
          case 0: return array.push(value);
          case 1: return array.unshift(value);
          case 2: return array.pop();
          case 3: return array.shift();
          case 4: return array.splice(start, 2, value);
          case 5: return array.reverse();
          case 6: return array.fill(value, start, start + 1);
          default: return array.copyWithin(start, 0, 2);
        }
      };

      const reference = apply(expected), result = apply(actual);
      expect([...actual], `seed=${seed}, step=${step}, operation=${operation}`).toEqual(expected);
      expect(Array.isArray(result) ? [...result] : result).toEqual(Array.isArray(reference) ? [...reference] : reference);

    }

  });
  
});
