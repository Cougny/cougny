# packages/config — shared TypeScript & ESLint config

Two internal packages keep tooling consistent across the monorepo.

## `@cougny/config-typescript`

Shared `tsconfig` presets, extended by every package.

| Preset         | For                                 | Notes                                                      |
| -------------- | ----------------------------------- | ---------------------------------------------------------- |
| `base.json`    | all                                 | `strict`, `noUncheckedIndexedAccess`, ES2022.              |
| `node.json`    | services (`api`, `signaling`, `db`) | `NodeNext`, `outDir dist`, `types: ["node"]`.              |
| `library.json` | shared libs (`protocol`)            | `composite`, declaration maps.                             |
| `nextjs.json`  | `web`                               | DOM libs, `Bundler` resolution, `jsx: preserve`, `noEmit`. |

Usage:

```jsonc
// packages/<name>/tsconfig.json
{ "extends": "@cougny/config-typescript/node.json", "include": ["src/**/*.ts"] }
```

## `@cougny/config-eslint`

Shared **flat** ESLint config (ESLint 10).

| Export                       | Contents                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@cougny/config-eslint/base` | `js.recommended` + `typescript-eslint.recommended` + `eslint-config-prettier`, plus repo rules (unused-vars with `_` escape, consistent type imports).                                                 |
| `@cougny/config-eslint/next` | `base` + `@next/eslint-plugin-next` (core-web-vitals) + `eslint-plugin-react-hooks`. Composed from the plugins directly (not the meta `eslint-config-next`, whose transitive plugins cap at ESLint 9). |

Each package has a one-line `eslint.config.js`:

```js
import { base } from '@cougny/config-eslint/base';
export default base;
```

> **Flat config & the working directory:** ESLint resolves flat config from the
> current working directory, not per-file. That's why the repo also has a root
> [`eslint.config.js`](../../eslint.config.js) mirroring `base` — it's what
> `lint-staged` uses when it runs `eslint` from the repo root. See
> [development.md](../development.md#pre-commit-husky--lint-staged).

The web app uses the same flat-config system via `@cougny/config-eslint/next`
(Next 16 removed `next lint`). It is excluded from the **root** config's scope so
lint-staged doesn't double-lint it with the non-Next base.
