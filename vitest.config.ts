import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'server/**',
        'dist/**',
        'vite.config.ts',
        'vitest.config.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts'
      ],
      // Regression guard: current coverage minus ~2 points (baseline 2026-06-11:
      // 70.05% stmts / 58.93% branch / 73.03% funcs / 71% lines).
      // Raise as coverage improves; never lower without a recorded reason.
      thresholds: {
        statements: 68,
        branches: 56,
        functions: 71,
        lines: 69
      }
    }
  }
})