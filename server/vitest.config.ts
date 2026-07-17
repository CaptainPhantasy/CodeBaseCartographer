import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/**',
        '**/*.test.ts',
        '**/*.d.ts'
      ],
      // Regression guard: current coverage minus ~2 points (baseline 2026-06-11:
      // 39.1% stmts / 77.95% branch / 73.63% funcs / 39.1% lines).
      // Raise as coverage improves; never lower without a recorded reason.
      thresholds: {
        statements: 37,
        branches: 75,
        functions: 71,
        lines: 37
      }
    }
  }
})
