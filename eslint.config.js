import { base } from '@cougny/config-eslint/base';

/**
 * Root ESLint config. Individual packages have their own `eslint.config.js`
 * (used by `pnpm lint`), but flat config resolves relative to the working
 * directory — so this root config is what `lint-staged` uses when it runs
 * `eslint --fix` from the repo root on staged files. It mirrors the shared
 * base every package already uses, keeping results identical.
 *
 * The web app is linted by its own `next lint` (and excluded from lint-staged's
 * eslint step), so it is ignored here.
 */
export default [
  ...base,
  {
    ignores: ['apps/web/**', '**/dist/**', '**/.next/**', '**/node_modules/**'],
  },
];
