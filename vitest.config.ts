/// <reference types="vitest" />
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./examples/tsconfig.json'] })],
  test: {
    exclude: ['lib'],
    include: ['src/**/*.test.ts', 'examples/**/*.test.ts'],
    globalSetup: ['./vitest.setup.ts'],
  },
});
