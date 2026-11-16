import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { decoratorTransform, oxcOptions } from './scripts/vite-transform.mts';

export default defineConfig({
  plugins: [decoratorTransform()],
  resolve: { alias: { '@mvvm': fileURLToPath(new URL('./src', import.meta.url)) } },
  oxc: oxcOptions,
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/app/' } },
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/unit/setup.ts'],
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
