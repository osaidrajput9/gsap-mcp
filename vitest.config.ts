import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The stdio test spawns the built server, which takes a moment to boot.
    testTimeout: 30_000,
  },
});
