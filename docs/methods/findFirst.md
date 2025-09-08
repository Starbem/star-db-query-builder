# findFirst

Finds the first record that matches the specified conditions from a database table.

## Signature

```typescript
findFirst<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select?: string[],
  where?: Conditions<T>,
  groupBy?: string[],
  orderBy?: OrderBy
}): Promise<T | null>
```

## Parameters

| Parameter   | Type              | Required | Description                                          |
| ----------- | ----------------- | -------- | ---------------------------------------------------- |
| `tableName` | `string`          | ✅       | Name of the database table                           |
| `dbClient`  | `IDatabaseClient` | ✅       | Database client instance                             |
| `select`    | `string[]`        | ❌       | Array of field names to select (default: all fields) |
| `where`     | `Conditions<T>`   | ❌       | Conditions to filter records                         |
| `groupBy`   | `string[]`        | ❌       | Fields to group by                                   |
| `orderBy`   | `OrderBy`         | ❌       | Sort order specification                             |

## Return Value

- **Type**: `Promise<T | null>`
- **Description**: Returns the first matching record or `null` if no record is found

## Examples

### Basic Usage

```typescript
import { findFirst } from '@starbemtech/star-db-query-builder'

// Find user by email
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    email: { operator: '=', value: 'user@example.com' },
  },
})

console.log(user) // { id: 'user-123', name: 'John Doe', email: 'user@example.com', ... }
```

### With Specific Fields

```typescript
// Select only specific fields
const user = await findFirst({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    status: { operator: '=', value: 'active' },
  },
})

console.log(user) // { id: 'user-123', name: 'John Doe', email: 'user@example.com' }
```

### With Complex Conditions

```typescript
// Multiple conditions with AND
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    AND: [
      { email: { operator: '=', value: 'user@example.com' } },
      { status: { operator: '=', value: 'active' } },
      { verified: { operator: '=', value: true } },
    ],
  },
})

// Multiple conditions with OR
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    OR: [
      { email: { operator: '=', value: 'user@example.com' } },
      { phone: { operator: '=', value: '+1234567890' } },
    ],
  },
})
```

### With Ordering

```typescript
// Find the most recent user
const latestUser = await findFirst({
  tableName: 'users',
  dbClient,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})

// Find the oldest active user
const oldestUser = await findFirst({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'active' } },
  orderBy: [{ field: 'created_at', direction: 'ASC' }],
})
```

### With Grouping

```typescript
// Find the first user in each status group
const userByStatus = await findFirst({
  tableName: 'users',
  dbClient,
  select: ['status', 'name', 'created_at'],
  groupBy: ['status'],
  orderBy: [{ field: 'created_at', direction: 'ASC' }],
})
```

### Advanced Conditions

```typescript
// Using different operators
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    age: { operator: '>=', value: 18 },
    name: { operator: 'LIKE', value: '%John%' },
    email: { operator: 'IS NOT NULL', value: null },
    status: { operator: 'IN', value: ['active', 'pending'] },
  },
})

// Using BETWEEN
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    created_at: {
      operator: 'BETWEEN',
      value: [new Date('2023-01-01'), new Date('2023-12-31')],
    },
  },
})
```

### TypeScript Usage

```typescript
interface User {
  id: string
  name: string
  email: string
  age: number
  status: 'active' | 'inactive' | 'pending'
  created_at: Date
  updated_at: Date
}

// Typed usage
const user: User | null = await findFirst<User>({
  tableName: 'users',
  dbClient,
  where: {
    email: { operator: '=', value: 'user@example.com' },
  },
})

if (user) {
  console.log(`Found user: ${user.name}`)
} else {
  console.log('User not found')
}
```

### Error Handling

```typescript
try {
  const user = await findFirst({
    tableName: 'users',
    dbClient,
    where: { email: { operator: '=', value: 'user@example.com' } },
  })

  if (user) {
    console.log('User found:', user.name)
  } else {
    console.log('No user found with this email')
  }
} catch (error) {
  console.error('Database error:', error.message)
  // Handle error appropriately
}
```

## Generated SQL Examples

### Simple Query

```sql
SELECT * FROM users WHERE email = $1 LIMIT 1
```

### With Specific Fields

```sql
SELECT id, name, email FROM users WHERE status = $1 LIMIT 1
```

### With Complex Conditions

```sql
SELECT * FROM users
WHERE (email = $1 AND status = $2 AND verified = $3)
LIMIT 1
```

### With Ordering

```sql
SELECT * FROM users
ORDER BY created_at DESC
LIMIT 1
```

### With Grouping

```sql
SELECT status, name, created_at
FROM users
GROUP BY status
ORDER BY created_at ASC
LIMIT 1
```

## Best Practices

### 1. Use Specific Field Selection

```typescript
// Good: Select only needed fields
const user = await findFirst({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: { id: { operator: '=', value: 'user-123' } },
})

// Avoid: Selecting all fields when not needed
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: { id: { operator: '=', value: 'user-123' } },
})
```

### 2. Use Appropriate Indexes

Ensure your database has indexes on fields used in WHERE clauses for better performance:

```sql
-- Example indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 3. Handle Null Results

```typescript
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: { email: { operator: '=', value: 'nonexistent@example.com' } },
})

if (!user) {
  // Handle case when no user is found
  throw new Error('User not found')
}
```

### 4. Use TypeScript for Type Safety

```typescript
interface UserSearchParams {
  email?: string
  status?: string
  age?: number
}

const findUserByParams = async (
  params: UserSearchParams
): Promise<User | null> => {
  const where: Conditions<User> = {}

  if (params.email) {
    where.email = { operator: '=', value: params.email }
  }

  if (params.status) {
    where.status = { operator: '=', value: params.status }
  }

  if (params.age) {
    where.age = { operator: '>=', value: params.age }
  }

  return findFirst<User>({
    tableName: 'users',
    dbClient,
    where,
  })
}
```

## Common Use Cases

### 1. User Authentication

```typescript
const authenticateUser = async (email: string, password: string) => {
  const user = await findFirst({
    tableName: 'users',
    dbClient,
    where: {
      AND: [
        { email: { operator: '=', value: email } },
        { password: { operator: '=', value: password } },
        { status: { operator: '=', value: 'active' } },
      ],
    },
  })

  return user
}
```

### 2. Finding Latest Record

```typescript
const getLatestOrder = async (userId: string) => {
  const order = await findFirst({
    tableName: 'orders',
    dbClient,
    where: { user_id: { operator: '=', value: userId } },
    orderBy: [{ field: 'created_at', direction: 'DESC' }],
  })

  return order
}
```

### 3. Checking Existence

```typescript
const userExists = async (email: string): Promise<boolean> => {
  const user = await findFirst({
    tableName: 'users',
    dbClient,
    select: ['id'],
    where: { email: { operator: '=', value: email } },
  })

  return user !== null
}
```

## Performance Considerations

- **Indexes**: Ensure proper indexes exist on fields used in WHERE clauses
- **Field Selection**: Use `select` to limit returned fields when possible
- **Limit Results**: `findFirst` automatically limits to 1 result, which is optimal
- **Connection Pooling**: Use connection pooling for better performance in high-traffic applications

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- Database-specific errors from the underlying database driver
