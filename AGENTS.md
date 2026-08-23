<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

- **README.md is the contract.** Whenever you change a feature, route, schema, API, component, or documented behavior, update README.md in the same commit. Stale docs are a bug.

## Working with GitHub

- **Never commit directly to `main`.** All work happens on a branch and lands
  via a pull request — no exceptions, including docs-only or "trivial"
  changes.
- Branch off `main` with a short, descriptive name prefixed by type, e.g.
  `feat/bag-tagging`, `fix/grid-sort-persist`, `docs/update-readme`.
- **Start a new feature branch for each unrelated feature or change.** Don't
  keep adding unrelated work to a branch/PR that's already open for something
  else — even if it's a convenient moment. If what you're about to do isn't
  the same logical change as the branch you're on, branch off `main` again
  instead of piling onto it.
- Open a PR against `main` for every change; don't push straight to `main`
  even if you have permission to.
- Don't merge your own PR unless the user explicitly asks you to. Default to
  opening the PR and stopping there so the user can review.
- Never force-push to `main`, and never rewrite history (`rebase -i`, amend,
  force-push) on a branch someone else may have pulled without checking with
  the user first.
- Keep PRs scoped to one logical change; if README.md needs updating per the
  rule above, include it in the same PR/commit as the change that made it
  stale — don't split docs into a follow-up PR.