# upsert

Inserts a record, or updates it in place when it collides with an existing unique/primary key constraint. Added 2026-09-04.

## Signature

```typescript
upsert<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P,
  conflictFields: string[],
  updateFields?: string[],
  returning?: string[]
}): Promise<R>
```

## Parameters

| Parameter        | Type              | Required | Description                                                                  |
| ---------------- | ----------------- | -------- | ----------------------------------------------------------------------------- |
| `tableName`       | `string`          | ✅       | Name of the database table                                                    |
| `dbClient`        | `IDatabaseClient` | ✅       | Database client instance                                                      |
| `data`            | `P`               | ✅       | Object containing the data to insert/update                                   |
| `conflictFields`  | `string[]`        | ✅       | Column(s) to detect the conflict on — see [Prerequisite](#prerequisite) below |
| `updateFields`    | `string[]`        | ❌       | Which fields to update on conflict (default: every field in `data`)           |
| `returning`       | `string[]`        | ❌       | Array of field names to return after the operation                            |

## Return Value

- **Type**: `Promise<R>`
- **Description**: Returns the inserted or updated record.

## Auto-Generated Fields

Same as [`insert`](./insert.md): `id` (UUID v4, only used for the insert path) and `updated_at` (current timestamp) are added automatically and always refreshed on conflict.

## Prerequisite

**`conflictFields` must name columns already covered by a real unique or primary key constraint on `tableName`.** `upsert()` does not create or verify that constraint — it only builds SQL that assumes it exists. Without it:

- On pg, `ON CONFLICT (col)` throws `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- On mysql, `ON DUPLICATE KEY UPDATE` silently never triggers (every call just inserts), because mysql detects the conflict from the table's actual keys, not from anything `upsert()` passes it.

```sql
-- Example: conflictFields: ['email'] requires this constraint to exist
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

## Examples

### Basic Usage

```typescript
import { upsert } from '@starbemtech/star-db-query-builder'

// Insert a user, or update name/age if the email already exists
const user = await upsert({
  tableName: 'users',
  dbClient,
  data: {
    email: 'john@example.com',
    name: 'John Doe',
    age: 30,
  },
  conflictFields: ['email'],
})
```

### Restricting Which Fields Get Updated on Conflict

```typescript
// On conflict, only refresh `name` (and updated_at) — leave `role` untouched
// even if a stale value for it is passed in `data`
const user = await upsert({
  tableName: 'users',
  dbClient,
  data: {
    email: 'john@example.com',
    name: 'John Doe',
    role: 'admin',
  },
  conflictFields: ['email'],
  updateFields: ['name'],
})
```

### With Specific Returning Fields

```typescript
const user = await upsert({
  tableName: 'users',
  dbClient,
  data: { email: 'john@example.com', name: 'John Doe' },
  conflictFields: ['email'],
  returning: ['id', 'name', 'email', 'updated_at'],
})
```

### Composite Conflict Target

```typescript
// Conflict detected on the combination of two columns
const membership = await upsert({
  tableName: 'team_members',
  dbClient,
  data: { team_id: teamId, user_id: userId, role: 'member' },
  conflictFields: ['team_id', 'user_id'],
})
```

### TypeScript Usage

```typescript
interface UserData {
  email: string
  name: string
  age?: number
}

interface User {
  id: string
  email: string
  name: string
  age?: number
  created_at: Date
  updated_at: Date
}

const user: User = await upsert<UserData, User>({
  tableName: 'users',
  dbClient,
  data: { email: 'john@example.com', name: 'John Doe' },
  conflictFields: ['email'],
})
```

## Generated SQL Examples

### PostgreSQL

```sql
INSERT INTO users ("id", "email", "name", "updated_at")
VALUES ($1, $2, $3, $4)
ON CONFLICT ("email") DO UPDATE SET
  "email" = EXCLUDED."email",
  "name" = EXCLUDED."name",
  "updated_at" = EXCLUDED."updated_at"
RETURNING *
```

### MySQL

```sql
INSERT INTO users (`id`, `email`, `name`, `updated_at`)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `name` = VALUES(`name`),
  `updated_at` = VALUES(`updated_at`)

-- mysql has no RETURNING, so upsert() re-selects by conflictFields:
SELECT * FROM users WHERE `email` = ?
```

## Database-Specific Considerations

### PostgreSQL

- `conflictFields` becomes the literal `ON CONFLICT (...)` target — it must exactly match the columns of the constraint (order does not matter for a plain unique index, but every column must be included).
- Uses `RETURNING` — no extra round-trip.

### MySQL

- `conflictFields` is **not** part of the generated SQL. `ON DUPLICATE KEY UPDATE` relies entirely on the table's own unique/PK constraint to detect the conflict — `conflictFields` here is used only to build the follow-up `SELECT` that re-fetches the row, since mysql has no `RETURNING`.
- This means on mysql, `conflictFields` must match a real constraint just the same, but the parameter itself doesn't enforce it — a constraint mismatch fails silently as a always-insert, not with an error.

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- `Data object is required` - The `data` parameter is missing
- `conflictFields is required and cannot be empty` - No conflict target given
- `Invalid column name "..."` / `Invalid conflict field "..."` - A column name in `data`, `conflictFields`, or `updateFields` failed the identifier whitelist (e.g. contains `;`, spaces, or SQL keywords used unsafely)
- `upsert: data must not include [id, updated_at]` - `data` named a column `upsert()` manages itself; `id` is generated and `updated_at` is always refreshed on conflict, so including either in `data` would duplicate the column in the generated INSERT
- `upsert: updateFields references column(s) not present in data: [...]` - A field named in `updateFields` isn't a key of `data` (and isn't `updated_at`, which is always allowed since the function refreshes it itself) — it would resolve to the column's table default instead of a real value, so this is rejected rather than silently applied
- `upsert: conflictFields references column(s) not present in data: [...]` (mysql only) - A field named in `conflictFields` isn't a key of `data` — mysql has no `RETURNING`, so `upsert()` needs these columns' values to re-select the row afterward
- `there is no unique or exclusion constraint matching the ON CONFLICT specification` (pg) - `conflictFields` doesn't match an actual constraint

## See Also

- [insert](./insert.md) - Plain insert without conflict handling
- [findManyCursor](./findManyCursor.md) - Keyset pagination
