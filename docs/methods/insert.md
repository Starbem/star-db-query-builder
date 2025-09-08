# insert

Inserts a single record into a database table and returns the inserted record.

## Signature

```typescript
insert<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P,
  returning?: string[]
}): Promise<R>
```

## Parameters

| Parameter   | Type              | Required | Description                                    |
| ----------- | ----------------- | -------- | ---------------------------------------------- |
| `tableName` | `string`          | ✅       | Name of the database table                     |
| `dbClient`  | `IDatabaseClient` | ✅       | Database client instance                       |
| `data`      | `P`               | ✅       | Object containing the data to insert           |
| `returning` | `string[]`        | ❌       | Array of field names to return after insertion |

## Return Value

- **Type**: `Promise<R>`
- **Description**: Returns the inserted record with all fields (including auto-generated ones like `id`, `created_at`, `updated_at`)

## Auto-Generated Fields

The `insert` method automatically adds the following fields to every record:

- **`id`**: A UUID v4 string
- **`updated_at`**: Current timestamp

## Examples

### Basic Usage

```typescript
import { insert } from '@starbemtech/star-db-query-builder'

// Insert a new user
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  },
})

console.log(user)
// {
//   id: '550e8400-e29b-41d4-a716-446655440000',
//   name: 'John Doe',
//   email: 'john@example.com',
//   age: 30,
//   created_at: '2023-12-01T10:00:00.000Z',
//   updated_at: '2023-12-01T10:00:00.000Z'
// }
```

### With Specific Returning Fields

```typescript
// Return only specific fields after insertion
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    age: 25,
  },
  returning: ['id', 'name', 'email', 'created_at'],
})

console.log(user)
// {
//   id: '550e8400-e29b-41d4-a716-446655440001',
//   name: 'Jane Doe',
//   email: 'jane@example.com',
//   created_at: '2023-12-01T10:00:00.000Z'
// }
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
const userData: UserData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  bio: 'Software developer',
}

const user: User = await insert<UserData, User>({
  tableName: 'users',
  dbClient,
  data: userData,
})

console.log(`Created user with ID: ${user.id}`)
```

### Inserting with Optional Fields

```typescript
// Insert with some optional fields
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    bio: 'Software developer',
    phone: '+1234567890',
    website: 'https://johndoe.com',
  },
})
```

### Inserting with Date Fields

```typescript
// Insert with custom date
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    birth_date: new Date('1990-01-01'),
    last_login: new Date(),
  },
})
```

### Inserting with Boolean Fields

```typescript
// Insert with boolean values
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    is_active: true,
    is_verified: false,
    newsletter_subscribed: true,
  },
})
```

### Inserting with JSON Fields

```typescript
// Insert with JSON data
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: false,
      },
    },
    metadata: {
      source: 'web',
      campaign: 'summer2023',
    },
  },
})
```

### Error Handling

```typescript
try {
  const user = await insert({
    tableName: 'users',
    dbClient,
    data: {
      name: 'John Doe',
      email: 'john@example.com',
    },
  })

  console.log('User created successfully:', user.id)
} catch (error) {
  if (error.message.includes('duplicate key')) {
    console.error('User with this email already exists')
  } else {
    console.error('Failed to create user:', error.message)
  }
}
```

## Generated SQL Examples

### PostgreSQL

```sql
INSERT INTO users (id, name, email, age, updated_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *
```

### MySQL

```sql
INSERT INTO users (id, name, email, age, updated_at)
VALUES (?, ?, ?, ?, ?)

SELECT * FROM users WHERE id = ?
```

### With Specific Returning Fields (PostgreSQL)

```sql
INSERT INTO users (id, name, email, age, updated_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, email, created_at
```

## Best Practices

### 1. Use TypeScript for Type Safety

```typescript
interface CreateUserRequest {
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

const createUser = async (userData: CreateUserRequest): Promise<User> => {
  return insert<CreateUserRequest, User>({
    tableName: 'users',
    dbClient,
    data: userData,
  })
}
```

### 2. Validate Data Before Insertion

```typescript
const createUser = async (userData: any) => {
  // Validate required fields
  if (!userData.name || !userData.email) {
    throw new Error('Name and email are required')
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(userData.email)) {
    throw new Error('Invalid email format')
  }

  // Validate age
  if (userData.age && (userData.age < 0 || userData.age > 150)) {
    throw new Error('Age must be between 0 and 150')
  }

  return insert({
    tableName: 'users',
    dbClient,
    data: userData,
  })
}
```

### 3. Handle Duplicate Key Errors

```typescript
const createUser = async (userData: any) => {
  try {
    return await insert({
      tableName: 'users',
      dbClient,
      data: userData,
    })
  } catch (error) {
    if (
      error.message.includes('duplicate key') ||
      error.message.includes('UNIQUE constraint')
    ) {
      throw new Error('User with this email already exists')
    }
    throw error
  }
}
```

### 4. Use Specific Returning Fields

```typescript
// Good: Return only needed fields
const user = await insert({
  tableName: 'users',
  dbClient,
  data: userData,
  returning: ['id', 'name', 'email', 'created_at'],
})

// Avoid: Returning all fields when not needed
const user = await insert({
  tableName: 'users',
  dbClient,
  data: userData,
})
```

### 5. Sanitize Input Data

```typescript
const sanitizeUserData = (data: any) => {
  return {
    name: data.name?.trim(),
    email: data.email?.toLowerCase().trim(),
    age: data.age ? parseInt(data.age) : undefined,
    bio: data.bio?.trim(),
  }
}

const createUser = async (rawData: any) => {
  const sanitizedData = sanitizeUserData(rawData)

  return insert({
    tableName: 'users',
    dbClient,
    data: sanitizedData,
  })
}
```

## Common Use Cases

### 1. User Registration

```typescript
const registerUser = async (registrationData: {
  name: string
  email: string
  password: string
  age?: number
}) => {
  // Hash password before storing
  const hashedPassword = await hashPassword(registrationData.password)

  const user = await insert({
    tableName: 'users',
    dbClient,
    data: {
      name: registrationData.name,
      email: registrationData.email,
      password: hashedPassword,
      age: registrationData.age,
      status: 'pending',
      verification_token: generateVerificationToken(),
    },
    returning: ['id', 'name', 'email', 'status', 'created_at'],
  })

  // Send verification email
  await sendVerificationEmail(user.email, user.verification_token)

  return user
}
```

### 2. Creating Related Records

```typescript
const createUserWithProfile = async (userData: any, profileData: any) => {
  // Create user first
  const user = await insert({
    tableName: 'users',
    dbClient,
    data: userData,
    returning: ['id'],
  })

  // Create user profile
  const profile = await insert({
    tableName: 'user_profiles',
    dbClient,
    data: {
      ...profileData,
      user_id: user.id,
    },
  })

  return { user, profile }
}
```

### 3. Audit Trail

```typescript
const createAuditLog = async (action: string, userId: string, details: any) => {
  return insert({
    tableName: 'audit_logs',
    dbClient,
    data: {
      action,
      user_id: userId,
      details: JSON.stringify(details),
      ip_address: details.ipAddress,
      user_agent: details.userAgent,
      timestamp: new Date(),
    },
  })
}
```

### 4. Configuration Management

```typescript
const createConfiguration = async (
  key: string,
  value: any,
  description?: string
) => {
  return insert({
    tableName: 'configurations',
    dbClient,
    data: {
      key,
      value: JSON.stringify(value),
      description,
      is_active: true,
    },
  })
}
```

## Database-Specific Considerations

### PostgreSQL

- Uses `RETURNING` clause for efficient data retrieval
- Supports complex data types (JSON, arrays, etc.)
- Better performance with `RETURNING` clause

### MySQL

- Requires separate `SELECT` query after `INSERT`
- Good performance for simple inserts
- Limited support for complex data types

## Performance Considerations

### 1. Index Impact

```sql
-- Ensure proper indexes exist for unique constraints
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 2. Batch Operations

For multiple inserts, consider using `insertMany` instead:

```typescript
// Good: Use insertMany for multiple records
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: [
    { name: 'John', email: 'john@example.com' },
    { name: 'Jane', email: 'jane@example.com' },
  ],
})

// Avoid: Multiple individual inserts
for (const userData of usersData) {
  await insert({ tableName: 'users', dbClient, data: userData })
}
```

### 3. Connection Pooling

Ensure your database client is properly configured with connection pooling for better performance in high-traffic applications.

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- `Data object is required` - The `data` parameter is missing
- `duplicate key value violates unique constraint` - Attempting to insert duplicate unique values
- `column "field_name" of relation "table_name" does not exist` - Invalid field name
- `null value in column "field_name" violates not-null constraint` - Required field is missing
