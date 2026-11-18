import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['e2e/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', URL: 'readonly', window: 'readonly', indexedDB: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', navigator: 'readonly', document: 'readonly', caches: 'readonly' } },
  },
);
