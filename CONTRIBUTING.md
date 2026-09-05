# Contributing

This is Starbem's internal query builder for Postgres/MySQL. External contributions are welcome, but this document — and especially [AGENTS.md](./AGENTS.md) — describes how the project actually works; read it before opening a PR.

## Before you start

- **For anything beyond a small fix, open an issue first** (use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template) so the approach can be discussed before you invest time in an implementation.
- **Security vulnerabilities**: do not open a public issue — see [SECURITY.md](./SECURITY.md).

## Setup

```bash
pnpm install
```

Package manager is pinned to `pnpm@8.6.2` (`packageManager` in `package.json`) — don't use npm/yarn.

## Development workflow

Full conventions — branch naming, commit style, the required local gate before calling anything done, and the critical SQL-sanitization rule every new function must follow — are documented in **[AGENTS.md](./AGENTS.md)**. In short:

1. Branch off `main`: `type/short-description` (`fix/...`, `feat/...`, `docs/...`, `test/...`, `refactor/...`, `chore/...`, `ci/...`).
2. Make your change. If it touches a function that accepts a table/column/field name from the caller, it **must** go through `assertValidIdentifier` or `assertSafeSqlFragment` (see [AGENTS.md](./AGENTS.md#critical-security-rule)) — this is treated as a P0 correctness issue, not a style nit.
3. Before opening a PR, run the full local gate, in order:
   ```bash
   pnpm run type:check
   pnpm run test        # add/update a regression test for any bug fix
   pnpm run lint
   pnpm run format:check
   pnpm run build
   ```
4. If you added or changed a public method, update all three: `docs/methods/<name>.md`, `docs/INDEX.md`, and `README.md`.
5. Add an entry under `CHANGELOG.md`'s `[Unreleased]` section.
6. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): description`) — see real examples in `AGENTS.md` and the git history.
7. Open the PR against `main` using the pull request template. CI (`ci.yml`) runs lint/format/type-check/build/test on Node 18/20/22 — it must pass before merge.

## What not to do

- Don't add `--no-verify` to skip the pre-commit hook.
- Don't hand-write SQL string concatenation for a caller-supplied value — always go through the parameter/placeholder array.
- Don't invent a documented parameter/behavior that isn't actually implemented — this repo has a history of docs drifting from the code; cross-check examples against `src/core/repository.ts`.

## Releasing

Releases are cut by maintainers following **[RELEASE.md](./RELEASE.md)** — not something a contributor PR needs to do.
