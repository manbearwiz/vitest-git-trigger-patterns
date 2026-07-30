import { coverageConfigDefaults, type ViteUserConfig } from 'vitest/config';

export default {
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rolldownOptions: {
      external: [/^node:/],
    },
    sourcemap: true,
  },
  test: {
    environment: 'node',
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['cobertura', 'text', 'html', 'lcov'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
      exclude: [
        ...coverageConfigDefaults.exclude,
        './*.config.{js,ts,mts}',
        'dist',
      ],
    },
  },
} satisfies ViteUserConfig;
