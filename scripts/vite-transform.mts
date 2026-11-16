import type { OxcOptions } from 'vite';
import babel from '@rolldown/plugin-babel';

/**
 * Transform options shared by every Oxc-powered config (demo build, browser
 * fixture, vitest, package smoke test). `build.target` stays separate: these
 * options are what each module is transpiled with.
 */
export const oxcOptions: OxcOptions = {
  target: 'es2020',
  // The project compiles with `useDefineForClassFields: false`, and Oxc does not
  // always see that value - it only reads the tsconfig of a config's root, while
  // the sources live elsewhere. The pair below is the documented equivalent
  // (rolldown CompilerAssumptions), so class fields keep TypeScript's
  // assignment semantics here too.
  assumptions: { setPublicClassFields: true },
  typescript: { removeClassFieldsWithoutInitializer: true },
};

// Oxc does not lower TC39 Stage 3 decorators yet (oxc-project/oxc#9170), so
// Babel re-processes only the files whose code contains an `@`. The filter is
// deliberately broad: skipping a decorated file would break the build, while
// running Babel over a plain file changes nothing.
//
// Watch out: Oxc strips TypeScript first, and Babel's decorator transform moves
// TypeScript parameter properties above the `super()` call it wraps, so a class
// with member decorators must not use a parameter property - assign that field
// in the constructor body instead (see demo/vms/viewPanelsDemo.ts). Class
// decorators are not affected.
export const decoratorTransform = () => babel({
  presets: [{
    preset: () => ({ plugins: [['@babel/plugin-proposal-decorators', { version: '2023-11' }]] }),
    rolldown: { filter: { code: /@[A-Za-z_$]/ } },
  }],
});
