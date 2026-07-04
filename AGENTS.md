# AGENTS.md

Guidance for any AI agent or assistant working in this repository.

> This file, `CLAUDE.md`, and `.github/copilot-instructions.md` must always
> contain the same guidance. They are mirrors of each other — see the rules
> below.

## Core rules

1. **Keep the instruction files in sync.** `AGENTS.md`, `CLAUDE.md`, and
   `.github/copilot-instructions.md` must stay accurate and identical at all
   times. Whenever you change one, make the exact same change to the others in
   the same edit. If they ever drift, reconcile them before doing anything
   else.

2. **Follow established, large-scale application best practices.** Structure
   code, naming, testing, and architecture the way mature production codebases
   do. Prefer clear, conventional, well-organized solutions over clever or
   ad-hoc ones.

3. **Never self-advertise.** Do not mention any AI assistant, tool, or vendor
   anywhere — not in commit messages, code comments, documentation, PR
   descriptions, or any other artifact. No "Co-Authored-By" or "Generated
   with" attributions of any kind.

4. **Never commit on your own.** Do not run `git commit` (or push) unless the
   user explicitly asks you to. Stage and prepare changes if helpful, but the
   user decides when to commit.

5. **Never hardcode English.** Do not embed user-facing English strings
   directly in code. Route all user-facing text through the project's
   internationalization (i18n) layer so it can be translated and localized.
   Keep locale-specific formatting (dates, numbers, currency) localizable too.

6. **Use the latest major release of everything.** Keep all dependencies — npm
   packages, Docker base images, tooling, and language runtimes — on their
   latest stable major version. When adding or updating a dependency, choose the
   newest stable release and do the migration it requires rather than pinning to
   an older major. Avoid pre-release/beta versions.

7. **Never `prisma db push` — schema changes go through migrations.** Create
   migrations in development with `pnpm db:migrate` (`prisma migrate dev`) and
   apply them everywhere else — CI, Docker, production — with
   `prisma migrate deploy` only. Never mutate a database schema outside a
   committed migration in `packages/db/prisma/migrations/`.

8. **Never create worktrees or branches without being asked.** Do not create
   git worktrees, long-lived branches, or similar repository clutter unless
   the user explicitly requests it. Remove any temporary artifacts you do
   create before finishing the task.

## When in doubt

Ask. Do not assume permission to commit, publish, or share anything.
