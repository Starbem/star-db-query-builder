# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) working in this repository.

## Project

`@starbemtech/star-db-query-builder` — Starbem's internal npm package. A custom SQL query builder for Postgres (`pg`) and MySQL (`mysql2`). No ORM (no Prisma/Knex/TypeORM). Function-based API, dual-database support, connection pooling with retry, transactions, and an observability `monitor` (EventEmitter).

Consumed internally by Starbem backend services. Package manager: **pnpm** (`packageManager: pnpm@8.6.2` in `package.json`).

## Structure

- `src/core/repository.ts` — all query functions: `findFirst`, `findMany`, `findManyCursor`, `insert`, `insertMany`, `update`, `updateMany`, `upsert`, `deleteOne`, `deleteMany`, `joins`, `rawQuery`, `withTransaction`, `beginTransaction`.
- `src/core/utils.ts` — SQL clause builders (`createWhereClause`, `createSelectFields`, `createOrderByClause`, `createGroupByClause`, `generateSetClause`, etc.) and identifier sanitizers (`assertValidIdentifier`, `assertSafeSqlFragment`).
- `src/core/types.ts` — types (`Conditions<T>`, `QueryParams<T>`, `OperatorCondition`, `CursorPageResult<T>`, etc.).
- `src/db/initDb.ts` / `pgClient.ts` / `mysqlClient.ts` — client init, named client registry, pool, retry logic.
- `src/monitor/monitor.ts` — EventEmitter singleton (`CONNECTION_CREATED`, `QUERY_START/END/ERROR`, `RETRY_ATTEMPT`, `TRANSACTION_COMMIT/ROLLBACK`).
- `docs/INDEX.md` + `docs/methods/*.md` — per-method documentation. **Only** link files that actually exist — do not invent paths.
- `README.md` — top-level usage docs; every documented method should have both a usage section here and, when it exists, a `📖 Full docs` link to `docs/methods/<name>.md`.

## Critical security rule

This library builds raw SQL strings. **Never** concatenate a caller-supplied value directly into a query string — always go through the placeholder/param array, and always validate identifiers through the existing sanitizers:

- `assertValidIdentifier` — strict whitelist, for anything that must be a bare identifier: `tableName`, `join.table`, `deleteMany.field`. Never accepts expressions.
- `assertSafeSqlFragment` — blocks `; -- /* */` and backticks, for parameters that are documented to accept a real SQL expression: `select`, `groupBy`, `orderBy.field`, `join.on` (e.g. `COUNT(*) as count`).

If you add a new function that accepts a table/column/field name from the caller, it must go through one of these two validators. If you add a function that accepts a raw value, it must go through the params array, never string interpolation. Treat any deviation as a P0 bug, not a style nit.

## Commands

```bash
pnpm install            # install deps (frozen lockfile in CI)
pnpm run build           # tsc compile to dist/
pnpm run type:check      # tsc --noEmit
pnpm run lint            # eslint src/**/*.ts
pnpm run lint:fix        # eslint --fix
pnpm run format          # prettier --write
pnpm run format:check    # prettier --check
pnpm run test            # jest
pnpm run test:watch      # jest --watch
pnpm run test:coverage   # jest --coverage
pnpm run test:ci         # jest --ci --coverage --watchAll=false
```

Coverage thresholds (`jest.config.ts`, enforced): branches/functions/lines/statements ≥ 70% globally. Current actual coverage is ~96%+ — do not let a new PR drag it toward the floor.

## Before calling anything done

Every code change (bug fix, new function, refactor) must pass, in this order, before you report it as finished:

1. `pnpm run type:check`
2. `pnpm run test` (or `test:ci`) — add/update tests for the behavior you changed. A bug fix without a regression test is not considered fixed.
3. `pnpm run lint`

This mirrors the pre-commit hook (`.husky/pre-commit`: `pnpm run type:check && pnpm run test`), so a broken build will not silently commit — but do not rely on the hook alone; run it yourself first and read the output.

## Git conventions

**Branches:** `type/short-description`, e.g. `fix/bugs-and-create-tests`, `feat/upsert-support`. Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `ci`.

**Commits:** Conventional Commits, `type(scope): description`. Scope is usually the file or module touched (e.g. `repository`, `package.json`, `README`). Examples from history:

```
feat(repository): implement upsert function to handle insert or update logic for unique key conflicts
fix(repository.ts): remove unnecessary length check on whereClause for cleaner SQL query construction
test(initDb): add unit tests for database initialization and client management functions
docs: update documentation index and method descriptions for clarity and completeness
ci: split publish workflow into CI + Release, remove NPM_TOKEN dependency
```

Do not use `--no-verify` to skip the pre-commit hook. If it fails, fix the underlying issue.

**Commit only when asked.** Do not auto-commit as a side effect of finishing a task unless the user explicitly requested a commit.

**Push only when asked.** Never push without an explicit user instruction, and never force-push to `main` without explicit confirmation.

**Versioning/release:** semver via `npm version` (`version:patch`/`version:minor`/`version:major`), or interactively via `bash scripts/release.sh`. Tags are `vX.Y.Z`. A tag push is what triggers the release workflow (see below) — don't create a `v*` tag casually. Full step-by-step: [RELEASE.md](./RELEASE.md).

## CI/CD

Two workflows in `.github/workflows/`:

- **`ci.yml`** — runs on push/PR to `main`. Matrix over Node 18/20/22 (matches `engines.node: >=18`). Steps: lint → format:check → type:check → build → test:ci.
- **`release.yml`** — runs only on tag push matching `v*.*.*`. Publishes to npm via **Trusted Publishing (OIDC)** — no `NPM_TOKEN`/`NODE_AUTH_TOKEN` secret involved. Requires `permissions: contents: write, id-token: write` and a Trusted Publisher configured on npmjs.com for this package pointing at this repo + `release.yml`. Release notes are built from real `git log` commit history between tags, not GitHub's PR-based auto-generated notes.

If you touch either workflow, keep this pattern (matches `starbem-cli` and `react-starsystem`) — do not reintroduce an `NPM_TOKEN` secret or a combined test+publish workflow.

## Documentation rules

- Never document a parameter, option, or behavior that doesn't exist in the code. This repo has a history of docs drifting from implementation (phantom `having` param on `joins()`, `update()`/`updateMany()` examples using an `{operator, value}` shape that isn't actually interpreted, `findFirst` docs claiming a `LIMIT` that wasn't in the query). When writing or reviewing docs, cross-check every example against `src/core/repository.ts`.
- `docs/INDEX.md` must only link files that exist. If a method has no dedicated doc yet, list it under "Not documented here yet" instead of inventing a link.
- When you add a new documented method, add it in three places: `docs/methods/<name>.md`, an entry (with link) in `docs/INDEX.md`, and a section + inline `📖 Full docs` link in `README.md`.

## Known open items (check before assuming these are done)

- Major dependency bumps intentionally deferred as of the last dependency pass: `uuid` (11→14), `jest`/`@types/jest` (29→30), `eslint-plugin-jest` (28→29), `eslint` 10, `lint-staged` 17, `typescript` 7, `globals` 17, `@types/node` 26. Each needs its own validation pass, not a blind bump.
- `update`, `updateMany`, `deleteOne`, `deleteMany`, `initDb`, `getDbClient`, `closeDb`, `closeAllDbClients`, `resetDbClients` have no dedicated file under `docs/methods/` yet.
- Trusted Publisher setup on npmjs.com for this package is a manual step outside this repo — verify it's done before relying on `release.yml` actually succeeding.
