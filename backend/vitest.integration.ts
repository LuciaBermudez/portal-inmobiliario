import { defineConfig } from 'vitest/config';

/**
 * Tests de integración contra PostgreSQL + PostGIS real (TEST_DATABASE_URL).
 * El globalSetup aplica las migraciones una vez; cada test crea sus propios datos.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.int.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/support/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
