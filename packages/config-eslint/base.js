import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Shared flat ESLint config for all Cougny packages.
 * Extend it from a package's `eslint.config.js`.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**', 'coverage/**'],
  },
];
