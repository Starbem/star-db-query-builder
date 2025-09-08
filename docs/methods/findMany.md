# findMany

Finds multiple records that match the specified conditions from a database table.

## Signature

```typescript
findMany<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select?: string[],
  where?: Conditions<T>,
  groupBy?: string[],
  orderBy?: OrderBy,
  limit?: number,
  offset?: number,
  unaccent?: boolean
}): Promise<T[]>
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
| `limit`     | `number`          | ❌       | Maximum number of records to return                  |
| `offset`    | `number`          | ❌       | Number of records to skip                            |
| `unaccent`  | `boolean`         | ❌       | Enable unaccent search for PostgreSQL                |

## Return Value

- **Type**: `Promise<T[]>`
- **Description**: Returns an array of matching records (empty array if no records found)

## Examples

### Basic Usage

```typescript
import { findMany } from '@starbemtech/star-db-query-builder'

// Find all active users
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    status: { operator: '=', value: 'active' },
  },
})

console.log(users) // [{ id: 'user-1', name: 'John', ... }, { id: 'user-2', name: 'Jane', ... }]
```

### With Pagination

```typescript
// Get first 10 users
const users = await findMany({
  tableName: 'users',
  dbClient,
  limit: 10,
  offset: 0,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})

// Get next 10 users (page 2)
const nextUsers = await findMany({
  tableName: 'users',
  dbClient,
  limit: 10,
  offset: 10,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})
```

### With Specific Fields

```typescript
// Select only specific fields
const users = await findMany({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email', 'created_at'],
  where: {
    status: { operator: '=', value: 'active' },
  },
})
```

### With Complex Conditions

```typescript
// Multiple conditions with AND
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    AND: [
      { status: { operator: '=', value: 'active' } },
      { age: { operator: '>=', value: 18 } },
      { verified: { operator: '=', value: true } },
    ],
  },
})

// Multiple conditions with OR
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    OR: [
      { status: { operator: '=', value: 'active' } },
      { status: { operator: '=', value: 'pending' } },
    ],
    created_at: {
      operator: '>=',
      value: new Date('2023-01-01'),
    },
  },
})
```

### With Grouping and Aggregation

```typescript
// Group users by status and count them
const userStats = await findMany({
  tableName: 'users',
  dbClient,
  select: ['status', 'COUNT(*) as count'],
  groupBy: ['status'],
})

console.log(userStats) // [{ status: 'active', count: 150 }, { status: 'inactive', count: 25 }]

// Group by multiple fields
const userStatsByAge = await findMany({
  tableName: 'users',
  dbClient,
  select: ['status', 'age_group', 'COUNT(*) as count', 'AVG(age) as avg_age'],
  groupBy: ['status', 'age_group'],
  where: { status: { operator: '=', value: 'active' } },
})
```

### With Different Operators

```typescript
// Using various operators
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    age: { operator: '>=', value: 18 },
    name: { operator: 'LIKE', value: '%John%' },
    email: { operator: 'IS NOT NULL', value: null },
    status: { operator: 'IN', value: ['active', 'pending'] },
    created_at: {
      operator: 'BETWEEN',
      value: [new Date('2023-01-01'), new Date('2023-12-31')],
    },
  },
})
```

### With Unaccent Search (PostgreSQL)

```typescript
// Search with unaccent for better text matching
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    name: { operator: 'ILIKE', value: '%joão%' },
  },
  unaccent: true, // Enables unaccent search
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
const users: User[] = await findMany<User>({
  tableName: 'users',
  dbClient,
  where: {
    status: { operator: '=', value: 'active' },
  },
})

console.log(`Found ${users.length} active users`)
```

### Advanced Pagination

```typescript
interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

const getUsersPaginated = async (params: PaginationParams) => {
  const offset = (params.page - 1) * params.limit

  const users = await findMany({
    tableName: 'users',
    dbClient,
    limit: params.limit,
    offset,
    orderBy: params.sortBy
      ? [
          {
            field: params.sortBy,
            direction: params.sortOrder || 'ASC',
          },
        ]
      : undefined,
  })

  return users
}

// Usage
const page1Users = await getUsersPaginated({
  page: 1,
  limit: 20,
  sortBy: 'created_at',
  sortOrder: 'DESC',
})
```

### Error Handling

```typescript
try {
  const users = await findMany({
    tableName: 'users',
    dbClient,
    where: { status: { operator: '=', value: 'active' } },
  })

  console.log(`Found ${users.length} users`)
} catch (error) {
  console.error('Database error:', error.message)
  // Handle error appropriately
}
```

## Generated SQL Examples

### Simple Query

```sql
SELECT * FROM users WHERE status = $1
```

### With Pagination

```sql
SELECT * FROM users
ORDER BY created_at DESC
LIMIT 10 OFFSET 20
```

### With Specific Fields

```sql
SELECT id, name, email FROM users WHERE status = $1
```

### With Complex Conditions

```sql
SELECT * FROM users
WHERE (status = $1 AND age >= $2 AND verified = $3)
```

### With Grouping

```sql
SELECT status, COUNT(*) as count
FROM users
GROUP BY status
```

### With Unaccent (PostgreSQL)

```sql
SELECT * FROM users
WHERE unaccent(name) ILIKE unaccent($1)
```

## Best Practices

### 1. Always Use Pagination for Large Datasets

```typescript
// Good: Use pagination
const users = await findMany({
  tableName: 'users',
  dbClient,
  limit: 100,
  offset: 0,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})

// Avoid: Loading all records at once
const allUsers = await findMany({
  tableName: 'users',
  dbClient,
})
```

### 2. Use Specific Field Selection

```typescript
// Good: Select only needed fields
const users = await findMany({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: { status: { operator: '=', value: 'active' } },
})

// Avoid: Selecting all fields when not needed
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'active' } },
})
```

### 3. Use Appropriate Indexes

Ensure your database has indexes on fields used in WHERE clauses:

```sql
-- Example indexes for common queries
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_age ON users(age);
```

### 4. Handle Empty Results

```typescript
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'nonexistent' } },
})

if (users.length === 0) {
  console.log('No users found')
} else {
  console.log(`Found ${users.length} users`)
}
```

### 5. Use TypeScript for Type Safety

```typescript
interface UserSearchParams {
  status?: string
  minAge?: number
  maxAge?: number
  searchTerm?: string
}

const searchUsers = async (params: UserSearchParams): Promise<User[]> => {
  const where: Conditions<User> = {}

  if (params.status) {
    where.status = { operator: '=', value: params.status }
  }

  if (params.minAge || params.maxAge) {
    if (params.minAge && params.maxAge) {
      where.age = {
        operator: 'BETWEEN',
        value: [params.minAge, params.maxAge],
      }
    } else if (params.minAge) {
      where.age = { operator: '>=', value: params.minAge }
    } else if (params.maxAge) {
      where.age = { operator: '<=', value: params.maxAge }
    }
  }

  if (params.searchTerm) {
    where.name = { operator: 'ILIKE', value: `%${params.searchTerm}%` }
  }

  return findMany<User>({
    tableName: 'users',
    dbClient,
    where,
  })
}
```

## Common Use Cases

### 1. User Management

```typescript
// Get all active users with pagination
const getActiveUsers = async (page: number = 1, limit: number = 20) => {
  const offset = (page - 1) * limit

  return findMany({
    tableName: 'users',
    dbClient,
    select: ['id', 'name', 'email', 'created_at'],
    where: { status: { operator: '=', value: 'active' } },
    limit,
    offset,
    orderBy: [{ field: 'created_at', direction: 'DESC' }],
  })
}
```

### 2. Search Functionality

```typescript
const searchUsers = async (searchTerm: string) => {
  return findMany({
    tableName: 'users',
    dbClient,
    where: {
      OR: [
        { name: { operator: 'ILIKE', value: `%${searchTerm}%` } },
        { email: { operator: 'ILIKE', value: `%${searchTerm}%` } },
      ],
    },
    orderBy: [{ field: 'name', direction: 'ASC' }],
  })
}
```

### 3. Analytics and Reporting

```typescript
// Get user statistics by status
const getUserStats = async () => {
  return findMany({
    tableName: 'users',
    dbClient,
    select: ['status', 'COUNT(*) as count'],
    groupBy: ['status'],
  })
}

// Get monthly user registrations
const getMonthlyRegistrations = async (year: number) => {
  return findMany({
    tableName: 'users',
    dbClient,
    select: ['EXTRACT(MONTH FROM created_at) as month', 'COUNT(*) as count'],
    where: {
      created_at: {
        operator: 'BETWEEN',
        value: [new Date(`${year}-01-01`), new Date(`${year}-12-31`)],
      },
    },
    groupBy: ['EXTRACT(MONTH FROM created_at)'],
    orderBy: [{ field: 'month', direction: 'ASC' }],
  })
}
```

### 4. Data Export

```typescript
const exportUsers = async (filters: UserSearchParams) => {
  const where: Conditions<User> = {}

  if (filters.status) {
    where.status = { operator: '=', value: filters.status }
  }

  if (filters.createdAfter) {
    where.created_at = { operator: '>=', value: filters.createdAfter }
  }

  return findMany({
    tableName: 'users',
    dbClient,
    select: ['id', 'name', 'email', 'status', 'created_at'],
    where,
    orderBy: [{ field: 'created_at', direction: 'DESC' }],
  })
}
```

## Performance Considerations

### 1. Indexing Strategy

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_users_status_created_at ON users(status, created_at);
CREATE INDEX idx_users_age_status ON users(age, status);

-- Partial indexes for specific conditions
CREATE INDEX idx_users_active_created_at ON users(created_at)
WHERE status = 'active';
```

### 2. Query Optimization

```typescript
// Good: Use indexed fields in WHERE clause
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    status: { operator: '=', value: 'active' }, // Indexed field
    created_at: { operator: '>=', value: new Date('2023-01-01') }, // Indexed field
  },
})

// Avoid: Using non-indexed fields in WHERE clause
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    bio: { operator: 'LIKE', value: '%developer%' }, // Non-indexed field
  },
})
```

### 3. Memory Management

```typescript
// For large datasets, process in batches
const processUsersInBatches = async (batchSize: number = 1000) => {
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const users = await findMany({
      tableName: 'users',
      dbClient,
      limit: batchSize,
      offset,
      orderBy: [{ field: 'id', direction: 'ASC' }],
    })

    if (users.length === 0) {
      hasMore = false
    } else {
      // Process batch
      await processBatch(users)
      offset += batchSize
    }
  }
}
```

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- Database-specific errors from the underlying database driver
- Memory errors when trying to load too many records at once
