---
name: star-db-query-builder
description: >
  Use this skill whenever writing, reviewing, or debugging code that uses
  `@starbemtech/star-db-query-builder` (Starbem's internal Postgres/MySQL query
  builder) — importing it, calling initDb/findFirst/findMany/findManyCursor/
  insert/insertMany/update/updateMany/upsert/deleteOne/deleteMany/joins/rawQuery/
  withTransaction, or adding a new backend service endpoint that needs a
  database query. Also use it when asked to "use the query builder", "add a
  query with star-db-query-builder", or when a file already imports from
  `@starbemtech/star-db-query-builder`. DO NOT use for Prisma/Knex/TypeORM code,
  and do not use it to modify the library's own source (that's a repo working
  directly in `libs/star-db-query-builder` — see its AGENTS.md instead).
---

# star-db-query-builder usage

Function-based SQL query builder for Postgres (`pg`) and MySQL (`mysql2`). No ORM. You write against a typed function API; the library builds parameterized SQL for you. This skill exists so agents write **correct** calls on the first try instead of guessing an API shape that doesn't exist.

Full reference: `docs/methods/*.md` and `README.md` in the library repo (`starbem/star-db-query-builder`). This skill is the fast-path summary — when in doubt on an edge case, read the actual doc file for that method rather than guessing.

## Setup

```ts
import { initDb, getDbClient } from '@starbemtech/star-db-query-builder'

await initDb({
  type: 'pg', // or 'mysql' — NOT 'postgres', that string throws "Unsupported database type"
  options: { host, port, user, password, database },
  // optional: name (for multiple named connections), retryOptions, queryTimeout,
  // installUnaccentExtension (pg only)
})

const dbClient = getDbClient() // or getDbClient('name') for a named connection
```

Every query function below takes `dbClient` explicitly — it is not implicit/global per call.

## Core functions

```ts
findFirst({ tableName, dbClient, where?, select?, orderBy?, groupBy? })      // -> T | null, always LIMIT 1
findMany({ tableName, dbClient, where?, select?, orderBy?, groupBy?, limit?, offset?, unaccent? })  // -> T[]
findManyCursor({ tableName, dbClient, cursorField, cursor?, limit, direction?, where?, select? })   // -> { data, nextCursor }
insert({ tableName, dbClient, data, returning? })          // single row, all column names auto-quoted
insertMany({ tableName, dbClient, data: T[], returning? })  // batch insert, every item must share the same keys
update({ tableName, dbClient, id, data })                   // SET col = literal value only, see gotcha below
updateMany({ tableName, dbClient, where, data })
upsert({ tableName, dbClient, data, conflictFields, updateFields?, returning? })
deleteOne({ tableName, dbClient, id, permanently? })         // soft delete by default (sets status = 'deleted'), permanently=true for hard delete
deleteMany({ tableName, dbClient, ids, field? })             // field defaults to 'id'
joins({ tableName, dbClient, joins: [...], where?, select?, orderBy?, groupBy?, limit?, offset? })
rawQuery({ dbClient, sql, params? })                         // escape hatch — you write the SQL, still parameterized
withTransaction(dbClient, async (txClient) => { ... })       // auto commit/rollback
```

## Gotchas that will produce wrong or broken code if ignored

1. **`update()`/`updateMany()` do NOT support arithmetic updates.** `data: { stock: { operator: '-', value: qty } }` is not interpreted — it is not a supported shape at all. If you need `stock = stock - qty`, read the current value first (`findFirst`), compute in JS, then pass the literal result:
   ```ts
   const row = await findFirst({ tableName: 'products', dbClient, where: { id: { operator: '=', value: productId } } })
   await update({ tableName: 'products', dbClient, id: productId, data: { stock: row.stock - qty } })
   ```
   Do this inside `withTransaction` if it must be atomic against concurrent writes — the library does not do this for you.

2. **`joins()` has no `having` parameter.** `QueryParams<T>` doesn't declare one, so `joins({ ..., having: {...} })` is a TypeScript type error, not a runtime no-op. For HAVING, use `rawQuery`.

3. **`JOINS` inside a `Conditions<T>` `where` object is NOT a SQL JOIN.** It's a nested AND-group of conditions, unfortunately named. If you want an actual SQL join, use the `joins()` function, not a `JOINS` key inside `where`.

4. **`upsert()` on MySQL does not put `conflictFields` in the generated SQL.** MySQL's `ON DUPLICATE KEY UPDATE` relies entirely on the table's real unique/PK constraint — `conflictFields` is only used to re-select the row afterward (MySQL has no `RETURNING`). The function does not create or verify that the constraint exists. Before using `upsert`, confirm the target table actually has a unique constraint or PK on the fields you're passing as `conflictFields` — otherwise MySQL will just insert duplicates.

5. **Table/column/field names go through strict identifier validation** (`assertValidIdentifier` for `tableName`, `join.table`, `deleteMany.field`, `data` keys in `insert`/`insertMany`/`upsert`/`update`/`updateMany`, and `where` field names; a looser `assertSafeSqlFragment` for `select`/`groupBy`/`orderBy.field`/`join.on`/`where` `NOT EXISTS` subqueries that still allows real SQL expressions like `COUNT(*) as count`). Never build these strings by concatenating unsanitized user input yourself and passing them in expecting the library to catch it silently — it throws on invalid identifiers, so validate/allowlist at your own layer too if the name comes from user input.

6. **`findManyCursor()` is a separate function, not a `findMany()` option.** Its return shape is `{ data, nextCursor }`, not a bare array — don't destructure it like `findMany`'s return.

7. **Values are always parameterized — never string-interpolate a value into `where`/`data`.** The library already does this correctly for you; the mistake to avoid is bypassing it via `rawQuery` with interpolated strings instead of `params`.

8. **Every `where` condition must be `{ operator, value }` — a plain value throws, it is not silently ignored.** `where: { status: 'active' }` throws `Invalid where condition for "status"`; use `where: { status: { operator: '=', value: 'active' } }`. This matters most on `updateMany`/`deleteMany`: getting the shape wrong used to silently drop the condition and run the write against every row in the table — now it throws instead, but write your conditions correctly rather than relying on the error.

9. **`IN`/`NOT IN`/`BETWEEN` cap at 10,000 values in `value`**, throwing a descriptive error past that — chunk the list instead of forwarding an unbounded array (e.g. raw search results) as a single condition. `BETWEEN` additionally requires exactly 2 values.

## Where conditions (`Conditions<T>`)

Every condition is `{ operator, value }` — there is no `{ EQUALS: x }` / `{ IN: [...] }` shorthand, that shape does not exist in the code:

```ts
where: {
  id: { operator: '=', value: someId },
  status: { operator: 'IN', value: ['active', 'pending'] },
  createdAt: { operator: 'BETWEEN', value: [start, end] },
  name: { operator: 'ILIKE', value: '%term%' },   // add unaccent: true on findMany/joins to also strip accents (pg only)
  deletedAt: { operator: 'IS NULL', value: null },
  OR: [
    { email: { operator: '=', value: a } },
    { email: { operator: '=', value: b } },
  ],
}
```

Valid `operator` values: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `NOT LIKE`, `ILIKE`, `IN`, `NOT IN`, `BETWEEN`, `IS NULL`, `IS NOT NULL`, `NOT EXISTS`.

## Common mistake to avoid: don't invent methods

If a method/param you want to use isn't in the list above, check `docs/methods/` and `README.md` in the library repo before assuming it exists. This library's docs have previously drifted from the implementation (phantom params, unsupported shapes) — when unsure, prefer reading `src/core/repository.ts` in the library repo over trusting an example that "looks right."
