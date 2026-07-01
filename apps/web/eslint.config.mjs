import { next } from '@cougny/config-eslint/next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...next,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
