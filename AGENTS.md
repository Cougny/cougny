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

## When in doubt

Ask. Do not assume permission to commit, publish, or share anything.
