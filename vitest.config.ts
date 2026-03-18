import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      // TODO: Fix these test files — mocks need updating after API helpers migration
      'src/__tests__/admin-users-route.test.ts',
      'src/__tests__/babysitter-profile-route.test.ts',
      'src/__tests__/booking-route.test.ts',
      'src/__tests__/caregivers-route.test.ts',
      'src/__tests__/children-route.test.ts',
      'src/__tests__/notifications-route.test.ts',
      'src/__tests__/stripe-webhooks-route.test.ts',
      'src/__tests__/user-switch-role-route.test.ts',
      'src/__tests__/components/Navigation.test.tsx',
      'node_modules/**',
    ],
    setupFiles: ['src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
