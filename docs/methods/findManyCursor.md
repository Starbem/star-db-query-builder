# findManyCursor

Finds multiple records using keyset (cursor) pagination instead of offset/limit. Added 2026-09-04.

## Signature

```typescript
findManyCursor<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select?: string[],
  where?: Conditions<T>,
  cursorField?: string,
  cursor?: string | number,
  direction?: 'ASC' | 'DESC',
  limit?: number,
  unaccent?: boolean
}): Promise<CursorPageResult<T>>
```

## Parameters

| Parameter     | Type              | Required | Default | Description                                                             |
| ------------- | ----------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `tableName`   | `string`          | ✅       | —       | Name of the database table                                               |
| `dbClient`    | `IDatabaseClient` | ✅       | —       | Database client instance                                                  |
| `select`      | `string[]`        | ❌       | all     | Array of field names to select                                            |
| `where`       | `Conditions<T>`   | ❌       | —       | Conditions to filter records (combined with the cursor condition via AND) |
| `cursorField` | `string`          | ❌       | `'id'`  | Column the cursor walks — see [Choosing cursorField](#choosing-cursorfield) |
| `cursor`      | `string \| number`| ❌       | —       | Value of `cursorField` on the last row of the previous page. Omit for the first page. |
| `direction`   | `'ASC' \| 'DESC'` | ❌       | `'ASC'` | Sort direction — also flips the cursor comparison (`>` for ASC, `<` for DESC) |
| `limit`       | `number`          | ❌       | `20`    | Page size. Must be a positive integer — validated before being interpolated into the SQL string (not parameterized) |
| `unaccent`    | `boolean`         | ❌       | —       | Enable unaccent search for PostgreSQL                                     |

## Return Value

```typescript
interface CursorPageResult<T> {
  data: T[]
  nextCursor: string | number | null
}
```

- `data` — up to `limit` rows for this page.
- `nextCursor` — value of `cursorField` on the last row, to pass back in as `cursor` for the next call. `null` when this page reached the end of the result set.

## Why keyset instead of offset/limit

[`findMany`](./findMany.md)'s `limit`/`offset` pagination re-scans and discards `offset` rows on every call — cost grows with page depth, and rows can be skipped or repeated if the underlying data changes between pages (a row inserted before the current offset shifts everything after it).

`findManyCursor` instead filters on `WHERE cursorField > cursor` (or `<` for `DESC`), so the database can seek directly via an index — cost stays flat regardless of how deep the page is, and pages stay stable across concurrent writes as long as `cursorField` values themselves aren't mutated. The trade-off: no jumping to an arbitrary page number, only "next page from this cursor".

## Choosing `cursorField`

`cursorField` must be:

- **A real column** — validated as a bare identifier (`assertValidIdentifier`), so it can't be an expression.
- **Strictly ordered and effectively unique for the walk to make sense** — `created_at`, a sequential `id`, or similar. A random UUID `id` works for correctness (every row still gets visited exactly once) but its ordering carries no meaning, so don't use it when callers care about "most recent first" or similar.
- **Indexed** — without an index on `cursorField` (and ideally on `(cursorField)` combined with whatever `where` filters on), every page scans the table.

## How `nextCursor` is computed

`findManyCursor` requests `limit + 1` rows from the database instead of `limit`. If it gets back `limit + 1` rows, there's a next page — it trims the extra row before returning `data` and sets `nextCursor` from the last row of the trimmed page. This avoids a separate `COUNT(*)` query just to know whether more pages exist.

## Examples

### Basic Usage — First Page

```typescript
import { findManyCursor } from '@starbemtech/star-db-query-builder'

const page1 = await findManyCursor({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'active' } },
  cursorField: 'created_at',
  limit: 20,
})

console.log(page1.data) // up to 20 users
console.log(page1.nextCursor) // e.g. '2026-08-30T12:00:00.000Z', or null if that's everything
```

### Walking Subsequent Pages

```typescript
let cursor: string | number | undefined
const allUsers = []

while (true) {
  const page = await findManyCursor({
    tableName: 'users',
    dbClient,
    cursorField: 'created_at',
    cursor,
    limit: 100,
  })

  allUsers.push(...page.data)

  if (page.nextCursor === null) break
  cursor = page.nextCursor
}
```

### DESC Direction (Most Recent First)

```typescript
// direction flips both ORDER BY and the cursor comparison (`<` instead of `>`)
const page = await findManyCursor({
  tableName: 'orders',
  dbClient,
  cursorField: 'created_at',
  direction: 'DESC',
  limit: 20,
})
```

### Combined with WHERE

```typescript
// Cursor condition is ANDed onto the existing where clause
const page = await findManyCursor({
  tableName: 'orders',
  dbClient,
  where: { status: { operator: '=', value: 'completed' } },
  cursorField: 'id',
  cursor: previousPage.nextCursor,
  limit: 50,
})
```

### TypeScript Usage

```typescript
interface Order {
  id: string
  status: string
  total: number
  created_at: Date
}

const page = await findManyCursor<Order>({
  tableName: 'orders',
  dbClient,
  cursorField: 'created_at',
  limit: 20,
})
```

## Generated SQL Examples

### First Page (no cursor)

```sql
SELECT * FROM orders
  WHERE status = $1
  ORDER BY created_at ASC
  LIMIT 21
```

_(`limit: 20` becomes `LIMIT 21` — the extra row is trimmed in JS to compute `nextCursor`.)_

### Subsequent Page (with cursor, pg)

```sql
SELECT * FROM orders
  WHERE status = $1 AND created_at > $2
  ORDER BY created_at ASC
  LIMIT 21
```

### DESC direction

```sql
SELECT * FROM orders
  WHERE created_at < $1
  ORDER BY created_at DESC
  LIMIT 21
```

### MySQL (positional `?` placeholders)

```sql
SELECT * FROM orders
  WHERE status = ? AND id > ?
  ORDER BY id ASC
  LIMIT 21
```

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- `Invalid identifier "..."` - `cursorField` failed the identifier whitelist
- `Invalid direction: "...". Only ASC or DESC are allowed.` - `direction` was something else
- `Invalid limit: "...". Must be a positive integer.` - `limit` was zero, negative, or not an integer

## Not a Drop-in Replacement for `findMany`

`findManyCursor` is a separate function, not a `cursor` option on [`findMany`](./findMany.md) — its return shape (`{ data, nextCursor }`) differs from `findMany`'s plain `T[]`, so switching an existing `findMany` caller requires updating how the result is consumed, not just adding a parameter.

## See Also

- [findMany](./findMany.md) - Offset/limit pagination
- [upsert](./upsert.md) - Insert-or-update on conflict
