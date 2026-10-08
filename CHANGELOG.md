# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries below are generated from the real commit history for each tagged release. See each release on GitHub for the full commit list: https://github.com/starbem/star-db-query-builder/releases

## [Unreleased]

- `fix`: `Conditions<T>`'s `JOINS`/`AND`/`OR` now accept a table-qualified column key (e.g. `'orders.total'`) alongside `T`'s own keys, instead of rejecting it at compile time — `JOINS` in particular was typed `Conditions<object>` regardless of `T`, which (since `keyof object` is `never`) could never actually hold a qualified-column condition. A plain (unqualified) typo of one of `T`'s own keys is still a compile-time error in all three. Fixes #25.
- `fix`: `joins<T>()` gains a second, independent generic `W` (`joins<T, W = T>`) decoupling the result row type from the `where` shape, for the case where `T` is passed explicitly and `where` needs a joined table's column at its top level (not inside `AND`/`OR`/`JOINS`).
- `fix`: an `AND`/`OR`/`JOINS` group element with more than one key (e.g. `{ status: ..., tenant_id: ... }`) no longer silently drops every key past the first — all of a group element's sibling keys are now ANDed together, matching how sibling keys behave at the top level of `where`. Previously a scoping condition placed alongside another key in the same group element (e.g. a `tenant_id` guard) could vanish from the generated SQL with no error.
- `fix`: a transaction client (the `tx` passed to `withTransaction`'s callback, or returned by `beginTransaction`) can now itself be passed as `dbClient` to `findFirst`/`insert`/`update`/etc, matching the pattern documented in `docs/methods/transactions.md` and the README — it previously failed to type-check because `ITransactionClient` had no `clientType`, and these functions required the full `IDatabaseClient` shape (including `beginTransaction`) even though they never call it. `ITransactionClient` now has `clientType`, and the query-executing functions accept the narrower `IQueryClient` (`clientType` + `query`) instead.
- `fix`: `rawQuery` now throws a `RawQueryError` that preserves the original driver error as `.cause` plus the cross-driver fields callers actually branch on (pg's `code`/`detail`/`constraint`, mysql2's `errno`/`sqlState`), instead of a plain `Error` built from just `error.message` that discarded all of it — callers could not distinguish e.g. a unique-constraint violation from a syntax error.
- `fix`: `updateMany` on MySQL now returns the rows it actually updated even when the `where` condition targets a column the update itself changes (e.g. `where: { status: 'pending' }, data: { status: 'done' }`) — it used to re-run the *original* `where` in a post-update `SELECT`, which matched zero (or the wrong) rows once the update had already changed every matched row's `status`. The matching rows' `id`s are now captured before the `UPDATE` runs and used to scope the final `SELECT`.
- `fix`: `update`/`updateMany` now ignore a `data` key whose value is `undefined` instead of passing it through as a real column assignment — node-postgres silently coerces an `undefined` bind value to SQL `NULL` (so a partial DTO built by spreading an object with an unset optional field could overwrite a column with `NULL`), while mysql2 rejects it outright. A `data` object left with no defined keys after filtering throws the same "must have at least one field to update" error as an empty `data` object.
- `fix`: `assertSafeSqlFragment` now also rejects `#`, MySQL's single-line comment marker, which previously passed through untouched in a `select`/`groupBy`/`orderBy.field`/`join.on` fragment.
- `fix`: an `IN`/`NOT IN` condition with an empty array, and an empty `AND`/`OR`/`JOINS` array, now throw a descriptive error instead of silently building invalid SQL (`key IN ()`, or a bare `()` fragment) that only surfaced as an opaque syntax error from the database.
- `fix`: `tsc --noEmit` (the `type:check` script, run by the pre-commit hook and CI) now also type-checks everything under `__tests__/` via `tsconfig.test.json` — previously excluded, which is how a type-level regression introduced earlier in this same change set reached `main` undetected.
- `fix`: `lint`/`format`/`format:check` now target the `src` directory instead of the unquoted glob `src/**/*.ts`, which the shell expanded to `src/*/*.ts` before npm/eslint/prettier ever saw it — silently skipping every file directly under `src` (`setupTests.ts`) and every file two or more directories deep. Several previously-unlinted/-unformatted files were reformatted as a result.
- `docs`: documented that `monitor`'s `QUERY_START`/`QUERY_END`/`QUERY_ERROR` events carry the raw, unredacted query `params`, and that `retryOptions` retries any query (including non-idempotent statements) without regard to idempotency — both in the README's new "Security & Operational Notes" section.

## [1.4.0] - 2026-09-04

- `fix`: `createWhereClause` no longer throws `RangeError: Maximum call stack size exceeded` on a large `IN`/`NOT IN`/`BETWEEN` condition — `values.push(...value)` (spreading the array into a function call) replaced with a plain loop. Fixes #21 (item 1) / #22.
- `fix`: `IN`/`NOT IN`/`BETWEEN` condition arrays are now capped at 10,000 values with a descriptive error, instead of silently building a query with tens of thousands of bind parameters. Fixes #21 (item 2).
- `fix`: `update()`/`deleteOne()` now include the table name in the `ID is required` error instead of a bare generic message. Fixes #21 (item 3).
- `fix`: `createLimitClause`/`createOffsetClause` now validate `limit`/`offset` are positive/non-negative integers instead of interpolating whatever the caller passes into the SQL string — a non-numeric value (e.g. forwarded from an unvalidated HTTP query param) previously went straight into `LIMIT`/`OFFSET`.
- `fix`: a `where` condition using a plain value (e.g. `{ status: 'active' }` instead of `{ status: { operator: '=', value: 'active' } }`) now throws instead of being silently dropped from the generated WHERE clause — the silent-drop behavior meant `updateMany`/`deleteMany` calls that intended to scope a write could end up running against every row in the table. `updateMany` additionally refuses to run if `where` produces an empty WHERE clause.
- `fix`: an `operator` passed in lowercase or mixed case (e.g. `'ilike'`, supported pre-1.4.0 since operators used to be interpolated as-is) is now normalized before the whitelist check instead of being rejected — a regression introduced by the P0/#21 sanitization work in this same release.
- `fix`: `BETWEEN` now rejects a `value` array that isn't exactly 2 items, and `NOT EXISTS` now rejects a non-string `value`, instead of building malformed SQL.
- `fix`: `insert`/`insertMany`/`upsert` now reject `data` containing `id` or `updated_at` instead of silently duplicating them in the generated column list (previously produced e.g. `INSERT INTO t ("id", "id", ...)`, a database error with no clear cause).
- `fix`: `upsert`'s `updateFields` now accepts `updated_at` — the function always refreshes it itself regardless of `data`, so rejecting it as "not present in data" (introduced in the prior sanitization pass) was an inconsistent contract.
- `fix`: `deleteMany`/`insertMany` now validate the total bind-parameter count against the same 65535 driver limit `createWhereClause`'s `IN`/`BETWEEN` guard already enforced, instead of only guarding one of the code paths that can build an oversized query.
- `fix`: `createWhereClause` no longer silently drops the `AND` group when `OR` is also present in the same `where` object — both are now rendered.

- `fix`: `findFirst` now adds `LIMIT 1` to the generated query instead of fetching every matching row and taking the first in JS.
- `fix`: `update()` no longer concatenates `id` directly into the SQL string — parameterized for both pg and mysql (was a real SQL injection vector).
- `fix`: `update()`/`updateMany()` now validate and quote every column name in `data` (`assertValidIdentifier` + `quoteIdentifier`), matching `insert`/`upsert`. Previously these column names were interpolated into the SQL string unvalidated.
- `fix`: `createWhereClause` now validates `where` field names (`assertValidIdentifier`), restricts `operator` to a runtime whitelist, and validates `NOT EXISTS` subquery fragments (`assertSafeSqlFragment`) — previously all three were interpolated into the SQL string unvalidated.
- `fix`: `upsert()` no longer duplicates `updated_at` in the generated `SET`/`ON CONFLICT DO UPDATE` clause when it's also named in `updateFields`.
- `fix`: `upsert()` now rejects `updateFields`/`conflictFields` entries that aren't a key of `data`, instead of silently resolving to the column's table default (pg) or building a `WHERE col = NULL` re-select (mysql).
- `fix`: `findManyCursor()` returns `nextCursor: null` (not `undefined`) when `select` omits `cursorField` from the returned rows, matching its declared `string | number | null` return type.
- `feat`: `upsert()` — `ON CONFLICT ... DO UPDATE` (pg) / `ON DUPLICATE KEY UPDATE` (mysql).
- `feat`: `findManyCursor()` — keyset/cursor pagination (`WHERE cursorField > cursor` + `LIMIT limit+1`, no `OFFSET`).
- `feat`: `closeDb`, `closeAllDbClients`, `resetDbClients` for connection pool lifecycle management.
- `feat`: configurable query timeout (`queryTimeout`) for `initDb` and the MySQL client.
- Identifier sanitization added across the query builder (`assertValidIdentifier`, `assertSafeSqlFragment`) to prevent injection via table/column/field names, now covering every code path.
- `insert`/`insertMany` now quote every column name for pg/mysql instead of a single hardcoded special case — fixes reserved-word columns (`order`, `group`, `user`, etc.). Surface-level SQL output change, runtime-equivalent.
- `docs/` and `README.md` audited against the real implementation and corrected (removed a phantom `having` param on `joins()`, fixed `update`/`updateMany` examples that used an unsupported `{operator, value}` shape, fixed the `JOINS` type definition, added docs for `upsert`, `findManyCursor`, and the connection-pool lifecycle functions).
- CI/CD split into `ci.yml` (lint/format/type-check/build/test on push+PR) and `release.yml` (tag-triggered, npm Trusted Publishing via OIDC, no `NPM_TOKEN`).
- Dependency cleanup: removed unused `@typescript-eslint/eslint-plugin`/`parser`; safe in-range updates to `mysql2`, `pg`, `eslint`, `typescript`, and others.
- Published npm package restricted to `dist`, `bin`, `.claude`, `CHANGELOG.md` via an explicit `files` allowlist — previously shipped `coverage/`, test sources, `.github/`, and other dev-only files due to a missing `files` field combined with a near-empty `.npmignore`.

## [1.3.0] - 2025-09-08

- `insertMany`/`updateMany` batch operations added to the query builder.
- `rawQuery` added with documentation.
- `beginTransaction`/commit/rollback test coverage added for both MySQL and PostgreSQL clients.
- Pre-commit hook updated to run type-checking, then tests.
- README rewritten: clearer title/description, install instructions, usage examples, table of contents, method docs links.
- Outdated `genericRepository`/`utils` tests removed as part of a broader cleanup.
- Dependency bump: `braces` 3.0.2 → 3.0.3 (#9).
- Removed unused `.eslintignore`/`.eslintrc.json` (#18).

## [1.0.38] - 2025-06-12

- Removed an unnecessary local dependency link to `@starbemtech/star-db-query-builder` left over from local development.

## [1.0.37] - 2025-04-23

- `pgClient`: `installUnaccentExtension` is now conditional instead of always running.
- `initDb`/`getDbClient`: optional `name` parameter to target a specific database client instance.

## [1.0.34] - 2025-03-26

- New `monitor` module exported from the package entrypoint for observability (connection/query/transaction events).

## [1.0.33] - 2025-03-11

- `OperatorCondition`: added `ILIKE`, `IS NULL` / `IS NOT NULL`, and `NOT EXISTS` operators; `createWhereClause` updated to handle each correctly.
- `initDb` made asynchronous to support async setup operations.
- `pgClient`: ensures the `unaccent` extension is installed when requested.
- `findMany`/`joins`: added `unaccent` support via `QueryParams`.
- `deleteMany` added — delete multiple records by a list of IDs.
- `insert`: reserved-word column names are wrapped in double quotes for PostgreSQL.
- Multi-connection support for MySQL and PostgreSQL, automatic retry mechanism for transient errors, externally configurable connection pool/retry settings, and monitoring/logging events.
- Dependency bumps: `@types/pg` → 8.11.11, `typescript` → 5.8.2, `mysql2` → 3.13.0, `pg` → 8.13.3, `uuid` → 11.1.0; added `@types/promise-retry`.

## [1.0.23] - 2024-07-18

- Version bump only, no functional change since 1.0.22.

## [1.0.22] - 2024-07-04

- `joins`: added `orderBy` and `groupBy` support.
- `findMany`/`joins`: added `offset` support for pagination.
- Fixed a Postgres-specific bug in the WHERE-clause utility.
- Fixed `RETURNING` clause behavior on `update`.
- `package.json`: raised the minimum Node version requirement to `>=18`; removed the pinned `pnpm` version constraint from `engines` for flexibility; removed the unused commit-message linter package.

## [1.0.14] - 2024-04-11

- Added `joins` query support with an updated interface and query fixes.

## [1.0.13] - 2024-04-05

- Added a query to fetch by user subscription.
- Type declarations introduced; return type adjustments.

## [1.0.11] - 2024-04-02

- Initial tagged release: core query methods, MySQL function support, `createWhereClause`, and initial type definitions.
