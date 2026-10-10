import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Synthesizing CDK stages is CPU-bound; the default 5s is tight on a cold start.
    testTimeout: 30_000,
  },
});
