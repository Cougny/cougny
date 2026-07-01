import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { base } from './base.js';

/**
 * ESLint (flat) config for Next.js apps. Layered on the shared base and adds
 * Next.js core-web-vitals rules plus the React Hooks rules.
 *
 * We compose these from `@next/eslint-plugin-next` and
 * `eslint-plugin-react-hooks` directly (both support ESLint 10) rather than the
 * meta `eslint-config-next` package, whose transitive plugins still cap out at
 * ESLint 9.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const next = [
  ...base,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
];
