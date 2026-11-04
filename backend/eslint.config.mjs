import tseslint from 'typescript-eslint';

const FRAMEWORKS = ['pg', 'pg-boss', 'fastify', '@fastify/*', '@aws-sdk/*', 'socket.io', 'csv-parse', 'jose', '@node-rs/*'];

export default tseslint.config(
  { ignores: ['dist', 'uploads', 'coverage'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Regla de dependencias de Clean Architecture: las capas internas no conocen a las externas.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/application/**', '**/infrastructure/**', '**/interfaces/**', ...FRAMEWORKS],
              message: 'El dominio no puede depender de capas externas ni de frameworks.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**', ...FRAMEWORKS],
              message: 'La capa de aplicación solo depende del dominio (puertos), nunca de adaptadores.',
            },
          ],
        },
      ],
    },
  },
);
