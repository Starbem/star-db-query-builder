# @starbemtech/star-db-query-builder

## Overview

A TypeScript query-builder library shared across Starbem's backend microservices for building and executing PostgreSQL and MySQL queries alongside Prisma. It exposes a generic, type-safe repository API (`findFirst`, `findMany`, `insert`, `update`, `joins`, transactions, etc.) plus connection management for named PostgreSQL and MySQL pools. It is not a deployed service — it's published to npm and imported as a dependency by services such as accounts-ms, doctors-ms, and partner-service.

## Tech Stack

- TypeScript, compiled with `tsc` (Node.js >= 18)
- `pg` (PostgreSQL driver) and `mysql2` (MySQL driver)
- `promise-retry` for automatic retry on transient query/connection errors
- `uuid` for generating record IDs on insert/upsert
- Jest + `ts-jest` for testing
- ESLint (flat config, `typescript-eslint`) + Prettier for linting/formatting
- Husky + `lint-staged` for pre-commit checks
- pnpm (pinned to `8.6.2`) as package manager

## Architecture

The library is organized into three modules under `src/`:

- **`src/core`** — the generic repository (`repository.ts`) with all CRUD/query functions, shared TypeScript types (`types.ts`), and SQL-building utilities (`utils.ts`) that assemble `WHERE`/`SET`/`ORDER BY`/`GROUP BY`/`LIMIT`/`OFFSET` clauses and enforce identifier/SQL-fragment safety (`assertValidIdentifier`, `assertSafeSqlFragment`, `assertNoAutoManagedColumns`, `assertWithinBindParamLimit`).
- **`src/db`** — connection management. `initDb.ts` creates and registers named PostgreSQL/MySQL pools (with optional retry options, query timeout, and the `unaccent` extension for pg), `pgClient.ts`/`mysqlClient.ts` are the concrete client implementations, and `IDatabaseClient.ts` defines the shared client/transaction contract.
- **`src/monitor`** — an `EventEmitter`-based instance (`monitor`) emitting `CONNECTION_CREATED`, `QUERY_START`, `QUERY_END`, `QUERY_ERROR`, and `RETRY_ATTEMPT` events for observability.

`index.ts` is the sole public entry point, re-exporting `initDb`/`getDbClient`/`closeDb`/etc. from `src/db`, all repository functions from `src/core/repository`, the `monitor` instance, and the public TypeScript types.

Note: `ARCHITECTURE.md` in this repo references an older `default/genericRepository.ts` layout — the current source of truth is `src/core/`, `src/db/`, and `src/monitor/` as described above.

## Folder Structure

```
src/
├── core/            # generic repository, types, and SQL-building/validation utilities
│   └── __tests__/   # unit tests for repository.ts and utils.ts
├── db/               # PostgreSQL/MySQL client implementations and pool initialization
│   └── __tests__/   # unit tests for initDb, pgClient, mysqlClient
├── monitor/          # EventEmitter-based query/connection event system
│   └── __tests__/   # unit tests for monitor.ts
└── setupTests.ts     # Jest test setup
```

## Installation

```bash
pnpm add @starbemtech/star-db-query-builder
```

## Usage

```typescript
import {
  initDb,
  getDbClient,
  findFirst,
  findMany,
  insert,
  update,
  withTransaction,
} from '@starbemtech/star-db-query-builder'

// Initialize a named PostgreSQL connection (call once at startup)
await initDb({
  name: 'default',
  type: 'pg',
  options: {
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  retryOptions: { retries: 3 },
})

const dbClient = getDbClient('default')

// Query
const user = await findFirst<{ id: string; name: string }>({
  tableName: 'users',
  dbClient,
  select: ['id', 'name'],
  where: { status: { operator: '=', value: 'active' } },
})

// Insert
const created = await insert({
  tableName: 'users',
  dbClient,
  data: { name: 'John Doe', email: 'john.doe@example.com' },
  returning: ['id', 'name', 'email'],
})

// Transaction
await withTransaction(dbClient, async (tx) => {
  const inserted = await insert({ tableName: 'orders', dbClient: tx, data: { total: 100 } })
  await update({ tableName: 'users', dbClient: tx, id: 'user-id', data: { last_order_id: inserted.id } })
})
```

The full set of exported functions (`findFirst`, `findMany`, `findManyCursor`, `insert`, `insertMany`, `upsert`, `update`, `updateMany`, `deleteOne`, `deleteMany`, `joins`, `rawQuery`, `withTransaction`, `beginTransaction`) is documented with JSDoc in `src/core/repository.ts` and in `docs/methods/`.

## Available Scripts

| Script | Description |
|---|---|
| `build` | Compiles TypeScript to `dist/` via `tsc` (runs `clean` first) |
| `test` | Runs the Jest test suite |
| `test:watch` | Runs Jest in watch mode |
| `test:coverage` | Runs Jest with coverage report |
| `test:ci` | Runs Jest in CI mode (`--ci --coverage --watchAll=false`) |
| `lint` | Lints `src/**/*.ts` with ESLint |
| `lint:fix` | Lints and auto-fixes `src/**/*.ts` |
| `format` | Formats `src/**/*.ts` with Prettier |
| `format:check` | Checks formatting without writing changes |
| `type:check` | Type-checks without emitting (`tsc --noEmit`) |
| `clean` | Removes `dist` and `coverage` |
| `version:patch` / `version:minor` / `version:major` | Bumps version via `npm version` |
| `release` | Runs the interactive release helper (`scripts/release.sh`) |
| `release:patch` / `release:minor` / `release:major` | Bumps version and pushes tags |
| `prepublishOnly` | Clean, build, and `test:ci`, run automatically before `npm publish` |

## Testing

```bash
pnpm test        # run the suite
pnpm test:watch  # watch mode
pnpm test:coverage
pnpm test:ci     # CI mode, used by ci.yml and release.yml
```

Tests live alongside each module in `__tests__/` directories under `src/core`, `src/db`, and `src/monitor`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch naming, commit, and PR conventions, and [AGENTS.md](./AGENTS.md) for the full development workflow, including the mandatory SQL-identifier-sanitization rule for any function that accepts a caller-supplied table/column name.

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request to `main`, across a Node 18/20/22 matrix: `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm format:check`, `pnpm type:check`, `pnpm build`, and `pnpm test:ci`, in that order.

`.github/workflows/release.yml` runs on pushed tags matching `v*.*.*`: installs, builds, runs `test:ci`, generates release notes from git log since the previous tag, creates a GitHub Release, and publishes to npm via OIDC Trusted Publishing (no `NPM_TOKEN`).

## Release Process

See [RELEASE.md](./RELEASE.md) for the full step-by-step. In short: merge to `main`, run the local gate (lint/format/type-check/build/test:ci), update `CHANGELOG.md`, bump the version with `pnpm run version:<patch|minor|major>` (or use the already-bumped `package.json` version), then push the `vX.Y.Z` tag — pushing the tag is what triggers `release.yml` and the npm publish. `scripts/release.sh` wraps the routine steps into one interactive prompt (`pnpm run release`).
