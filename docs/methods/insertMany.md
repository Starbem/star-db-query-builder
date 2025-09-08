# insertMany

Inserts multiple records into a database table in a single operation and returns the inserted records.

## Signature

```typescript
insertMany<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P[],
  returning?: string[]
}): Promise<R[]>
```

## Parameters

| Parameter   | Type              | Required | Description                                    |
| ----------- | ----------------- | -------- | ---------------------------------------------- |
| `tableName` | `string`          | ✅       | Name of the database table                     |
| `dbClient`  | `IDatabaseClient` | ✅       | Database client instance                       |
| `data`      | `P[]`             | ✅       | Array of objects containing the data to insert |
| `returning` | `string[]`        | ❌       | Array of field names to return after insertion |

## Return Value

- **Type**: `Promise<R[]>`
- **Description**: Returns an array of inserted records with all fields (including auto-generated ones)

## Auto-Generated Fields

The `insertMany` method automatically adds the following fields to every record:

- **`id`**: A UUID v4 string for each record
- **`updated_at`**: Current timestamp for each record

## Examples

### Basic Usage

```typescript
import { insertMany } from '@starbemtech/star-db-query-builder'

// Insert multiple users
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: [
    { name: 'John Doe', email: 'john@example.com', age: 30 },
    { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
    { name: 'Bob Johnson', email: 'bob@example.com', age: 35 },
  ],
})

console.log(users)
// [
//   {
//     id: '550e8400-e29b-41d4-a716-446655440000',
//     name: 'John Doe',
//     email: 'john@example.com',
//     age: 30,
//     created_at: '2023-12-01T10:00:00.000Z',
//     updated_at: '2023-12-01T10:00:00.000Z'
//   },
//   {
//     id: '550e8400-e29b-41d4-a716-446655440001',
//     name: 'Jane Smith',
//     email: 'jane@example.com',
//     age: 25,
//     created_at: '2023-12-01T10:00:00.000Z',
//     updated_at: '2023-12-01T10:00:00.000Z'
//   },
//   // ... more users
// ]
```

### With Specific Returning Fields

```typescript
// Return only specific fields after insertion
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Smith', email: 'jane@example.com' },
  ],
  returning: ['id', 'name', 'email', 'created_at'],
})

console.log(users)
// [
//   {
//     id: '550e8400-e29b-41d4-a716-446655440000',
//     name: 'John Doe',
//     email: 'john@example.com',
//     created_at: '2023-12-01T10:00:00.000Z'
//   },
//   // ... more users
// ]
```

### TypeScript Usage

```typescript
interface UserData {
  name: string
  email: string
  age: number
  bio?: string
}

interface User {
  id: string
  name: string
  email: string
  age: number
  bio?: string
  created_at: Date
  updated_at: Date
}

// Typed usage
const usersData: UserData[] = [
  { name: 'John Doe', email: 'john@example.com', age: 30 },
  { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
]

const users: User[] = await insertMany<UserData, User>({
  tableName: 'users',
  dbClient,
  data: usersData,
})

console.log(`Created ${users.length} users`)
```

### Inserting with Mixed Data Types

```typescript
// Insert with various data types
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: [
    {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      is_active: true,
      preferences: { theme: 'dark', language: 'en' },
      birth_date: new Date('1990-01-01'),
    },
    {
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 25,
      is_active: false,
      preferences: { theme: 'light', language: 'es' },
      birth_date: new Date('1995-05-15'),
    },
  ],
})
```

### Error Handling

```typescript
try {
  const users = await insertMany({
    tableName: 'users',
    dbClient,
    data: [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@example.com' },
    ],
  })

  console.log(`Successfully created ${users.length} users`)
} catch (error) {
  if (error.message.includes('duplicate key')) {
    console.error('One or more users already exist')
  } else {
    console.error('Failed to create users:', error.message)
  }
}
```

### Batch Processing Large Datasets

```typescript
const insertUsersInBatches = async (
  allUsersData: any[],
  batchSize: number = 100
) => {
  const results = []

  for (let i = 0; i < allUsersData.length; i += batchSize) {
    const batch = allUsersData.slice(i, i + batchSize)

    try {
      const batchResults = await insertMany({
        tableName: 'users',
        dbClient,
        data: batch,
      })

      results.push(...batchResults)
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}`)
    } catch (error) {
      console.error(
        `Failed to process batch starting at index ${i}:`,
        error.message
      )
      // Continue with next batch or handle as needed
    }
  }

  return results
}

// Usage
const allUsers = await insertUsersInBatches(largeUserDataset, 50)
```

## Generated SQL Examples

### PostgreSQL

```sql
INSERT INTO users (id, name, email, age, updated_at)
VALUES
  ($1, $2, $3, $4, $5),
  ($6, $7, $8, $9, $10),
  ($11, $12, $13, $14, $15)
RETURNING *
```

### MySQL

```sql
INSERT INTO users (id, name, email, age, updated_at)
VALUES
  (?, ?, ?, ?, ?),
  (?, ?, ?, ?, ?),
  (?, ?, ?, ?, ?)

SELECT * FROM users
WHERE id IN (?, ?, ?)
ORDER BY FIELD(id, ?, ?, ?)
```

### With Specific Returning Fields (PostgreSQL)

```sql
INSERT INTO users (id, name, email, age, updated_at)
VALUES
  ($1, $2, $3, $4, $5),
  ($6, $7, $8, $9, $10)
RETURNING id, name, email, created_at
```

## Best Practices

### 1. Use Appropriate Batch Sizes

```typescript
// Good: Use reasonable batch sizes (50-1000 records)
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: userData.slice(0, 100), // Limit to 100 records
})

// Avoid: Inserting too many records at once
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: hugeUserArray, // Could cause memory issues
})
```

### 2. Validate Data Before Insertion

```typescript
const validateUserData = (userData: any) => {
  if (!userData.name || !userData.email) {
    throw new Error('Name and email are required')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(userData.email)) {
    throw new Error(`Invalid email format: ${userData.email}`)
  }

  return userData
}

const createUsers = async (usersData: any[]) => {
  // Validate all data before insertion
  const validatedData = usersData.map(validateUserData)

  return insertMany({
    tableName: 'users',
    dbClient,
    data: validatedData,
  })
}
```

### 3. Handle Partial Failures

```typescript
const createUsersWithErrorHandling = async (usersData: any[]) => {
  const successfulInserts = []
  const failedInserts = []

  // Process in smaller batches to minimize impact of failures
  const batchSize = 50

  for (let i = 0; i < usersData.length; i += batchSize) {
    const batch = usersData.slice(i, i + batchSize)

    try {
      const results = await insertMany({
        tableName: 'users',
        dbClient,
        data: batch,
      })

      successfulInserts.push(...results)
    } catch (error) {
      // Log the error and continue with individual inserts
      console.error(`Batch failed:`, error.message)

      for (const userData of batch) {
        try {
          const result = await insert({
            tableName: 'users',
            dbClient,
            data: userData,
          })
          successfulInserts.push(result)
        } catch (individualError) {
          failedInserts.push({ data: userData, error: individualError.message })
        }
      }
    }
  }

  return {
    successful: successfulInserts,
    failed: failedInserts,
  }
}
```

### 4. Use TypeScript for Type Safety

```typescript
interface BulkUserData {
  name: string
  email: string
  age: number
  department?: string
}

interface BulkUserResult {
  id: string
  name: string
  email: string
  age: number
  department?: string
  created_at: Date
  updated_at: Date
}

const createBulkUsers = async (
  usersData: BulkUserData[]
): Promise<BulkUserResult[]> => {
  return insertMany<BulkUserData, BulkUserResult>({
    tableName: 'users',
    dbClient,
    data: usersData,
  })
}
```

### 5. Optimize for Performance

```typescript
// Good: Use insertMany for bulk operations
const importUsers = async (csvData: any[]) => {
  const batchSize = 1000
  const results = []

  for (let i = 0; i < csvData.length; i += batchSize) {
    const batch = csvData.slice(i, i + batchSize)

    const batchResults = await insertMany({
      tableName: 'users',
      dbClient,
      data: batch,
    })

    results.push(...batchResults)
  }

  return results
}

// Avoid: Multiple individual inserts
const importUsersSlow = async (csvData: any[]) => {
  const results = []

  for (const userData of csvData) {
    const result = await insert({
      tableName: 'users',
      dbClient,
      data: userData,
    })
    results.push(result)
  }

  return results
}
```

## Common Use Cases

### 1. Data Import/CSV Processing

```typescript
const importUsersFromCSV = async (csvFilePath: string) => {
  const csvData = await parseCSV(csvFilePath)

  // Transform CSV data to match database schema
  const usersData = csvData.map((row) => ({
    name: row.name,
    email: row.email,
    age: parseInt(row.age),
    department: row.department,
  }))

  // Insert in batches
  const batchSize = 500
  const results = []

  for (let i = 0; i < usersData.length; i += batchSize) {
    const batch = usersData.slice(i, i + batchSize)

    const batchResults = await insertMany({
      tableName: 'users',
      dbClient,
      data: batch,
      returning: ['id', 'name', 'email'],
    })

    results.push(...batchResults)
  }

  return results
}
```

### 2. Bulk User Creation

```typescript
const createUsersFromTemplate = async (template: any, count: number) => {
  const usersData = Array.from({ length: count }, (_, index) => ({
    ...template,
    name: `${template.name} ${index + 1}`,
    email: `${template.emailPrefix}${index + 1}@example.com`,
  }))

  return insertMany({
    tableName: 'users',
    dbClient,
    data: usersData,
  })
}

// Usage
const testUsers = await createUsersFromTemplate(
  { name: 'Test User', emailPrefix: 'testuser', age: 25 },
  100
)
```

### 3. Data Migration

```typescript
const migrateUsers = async (oldUsers: any[]) => {
  // Transform old data format to new format
  const newUsersData = oldUsers.map((oldUser) => ({
    name: oldUser.full_name,
    email: oldUser.email_address,
    age: oldUser.user_age,
    status: oldUser.is_active ? 'active' : 'inactive',
    migrated_at: new Date(),
  }))

  return insertMany({
    tableName: 'users',
    dbClient,
    data: newUsersData,
    returning: ['id', 'name', 'email'],
  })
}
```

### 4. Seed Data

```typescript
const seedInitialData = async () => {
  // Seed users
  const users = await insertMany({
    tableName: 'users',
    dbClient,
    data: [
      { name: 'Admin User', email: 'admin@example.com', role: 'admin' },
      { name: 'Regular User', email: 'user@example.com', role: 'user' },
    ],
  })

  // Seed categories
  const categories = await insertMany({
    tableName: 'categories',
    dbClient,
    data: [
      { name: 'Technology', description: 'Tech-related content' },
      { name: 'Business', description: 'Business-related content' },
    ],
  })

  return { users, categories }
}
```

## Performance Considerations

### 1. Batch Size Optimization

```typescript
// Test different batch sizes to find optimal performance
const findOptimalBatchSize = async (testData: any[]) => {
  const batchSizes = [50, 100, 500, 1000, 2000]
  const results = []

  for (const batchSize of batchSizes) {
    const startTime = Date.now()

    try {
      await insertMany({
        tableName: 'users',
        dbClient,
        data: testData.slice(0, batchSize),
      })

      const endTime = Date.now()
      results.push({
        batchSize,
        time: endTime - startTime,
        recordsPerSecond: (batchSize / (endTime - startTime)) * 1000,
      })
    } catch (error) {
      results.push({ batchSize, error: error.message })
    }
  }

  return results
}
```

### 2. Memory Management

```typescript
// Process large datasets without loading everything into memory
const processLargeDataset = async (dataStream: any[]) => {
  const batchSize = 1000
  let processedCount = 0

  for (let i = 0; i < dataStream.length; i += batchSize) {
    const batch = dataStream.slice(i, i + batchSize)

    await insertMany({
      tableName: 'users',
      dbClient,
      data: batch,
    })

    processedCount += batch.length
    console.log(`Processed ${processedCount} records`)

    // Optional: Add delay to prevent overwhelming the database
    if (i + batchSize < dataStream.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}
```

### 3. Index Considerations

```sql
-- Ensure proper indexes exist for bulk operations
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Consider temporarily disabling indexes during large bulk inserts
-- (PostgreSQL example)
-- DROP INDEX idx_users_email;
-- INSERT INTO users ... (bulk insert)
-- CREATE INDEX idx_users_email ON users(email);
```

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- `Data array is required and cannot be empty` - The `data` parameter is missing or empty
- `duplicate key value violates unique constraint` - One or more records have duplicate unique values
- `column "field_name" of relation "table_name" does not exist` - Invalid field name
- `null value in column "field_name" violates not-null constraint` - Required field is missing
- Memory errors when trying to insert too many records at once
