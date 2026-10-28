import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
  main: 'src/server.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // El paquete compartido se publica como TypeScript fuente: se empaqueta dentro del bundle.
  noExternal: ['@portal/shared'],
});
