import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'prisma/**',
        '**/*.config.*',
        '**/types/**',
        '**/*.d.ts',
        '**/middleware.ts',
        'src/test/**',
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 0,    // Start at 0, will increase over time
          functions: 0,
          lines: 0,
          statements: 0
        }
      }
    },
    // Use 'include' instead of 'testMatch' to avoid duplicates
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}'
    ],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'coverage',
      'prisma',
      'e2e/**',  // Exclude Playwright E2E tests
      '**/e2e/**'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/test': path.resolve(__dirname, './src/test')
    }
  }
});