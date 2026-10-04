import { defineConfig } from 'vitest/config';

// Dedicated config for the slow, full-dataset solvability sweep (npm run
// verify:challenges) so it never runs as part of the fast default test suite
// (vitest.config.ts), which excludes tests/verify entirely.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/verify/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
