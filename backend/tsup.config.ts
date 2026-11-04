import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    worker: 'src/worker.ts',
    migrate: 'src/cli/migrate.ts',
    seed: 'src/cli/seed.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // El paquete compartido se publica como TypeScript fuente: se empaqueta dentro del bundle.
  noExternal: ['@portal/shared'],
});
