# Star DB Query Builder

A powerful and flexible database query builder library for Node.js applications, supporting PostgreSQL and MySQL databases with TypeScript support.

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Database Initialization](#database-initialization)
- [Query Methods](#query-methods)
  - [findFirst](#findfirst)
  - [findMany](#findmany)
  - [findManyCursor](#findmanycursor)
  - [insert](#insert)
  - [insertMany](#insertmany)
  - [upsert](#upsert)
  - [update](#update)
  - [updateMany](#updatemany)
  - [deleteOne](#deleteone)
  - [deleteMany](#deletemany)
  - [joins](#joins)
  - [rawQuery](#rawquery)
- [Transactions](#transactions)
  - [withTransaction](#withtransaction)
  - [beginTransaction](#begintransaction)
- [Types and Interfaces](#types-and-interfaces)
- [Advanced Usage](#advanced-usage)
- [Monitoring](#monitoring)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

## 📚 Full Documentation

This README covers everything at a glance. For the deep-dive version of each method (parameters, generated SQL for pg/mysql, edge cases, error messages), see [`docs/INDEX.md`](docs/INDEX.md) or jump straight to a method:

- [findFirst](docs/methods/findFirst.md) · [findMany](docs/methods/findMany.md) · [findManyCursor](docs/methods/findManyCursor.md)
- [insert](docs/methods/insert.md) · [insertMany](docs/methods/insertMany.md) · [upsert](docs/methods/upsert.md)
- [joins](docs/methods/joins.md) · [rawQuery](docs/methods/rawQuery.md) · [transactions](docs/methods/transactions.md)

`update`, `updateMany`, `deleteOne`, `deleteMany`, `initDb`, `getDbClient` have no dedicated file yet in `docs/methods/` — this README and the JSDoc above each function in `src/core/repository.ts` are the reference for those until one exists.

## ✨ Features

### 🔧 **Core Functionality**

- **🔄 Multi-Connection Support**: Connect simultaneously to multiple PostgreSQL and MySQL databases
- **🛡️ Type Safety**: Complete TypeScript support with strong typing
- **⚡ Auto Retry**: Automatic retry for transient errors (timeouts, lost connections)
- **📊 Monitoring**: Event system for monitoring and logging
- **🔍 Query Builder**: Fluent interface for building complex queries
- **📦 Batch Operations**: Optimized batch operations (insertMany, updateMany)

### 🗄️ **Database Support**

- **PostgreSQL**: Complete support with extensions (unaccent)
- **MySQL**: Full compatibility with MySQL 5.7+
- **Connection Pooling**: Efficient connection management
- **Transaction Support**: Full ACID transaction support with automatic rollback
- **Raw SQL**: Execute custom SQL queries when needed

### 🛠️ **Development Tools**

- **ESLint + Prettier**: Clean and consistent code
- **Jest**: Unit and integration tests
- **Husky**: Git hooks for code quality
- **TypeScript**: Compilation and typing

## 📦 Installation

```bash
npm install @starbemtech/star-db-query-builder
# or
pnpm add @starbemtech/star-db-query-builder
# or
yarn add @starbemtech/star-db-query-builder
```

### 🤖 AI agent skill (Claude Code)

If your team uses Claude Code, install the bundled skill so agents get correct usage guidance (method signatures, gotchas like the `update()` operator shape, `upsert()` mysql constraint requirement, etc.) instead of guessing:

```bash
npx star-db-query-builder-install-skill
```

Run it from your repo's root, after installing this package. It copies the skill into `.claude/skills/star-db-query-builder/SKILL.md` in your repo — commit that file so the rest of the team gets it too. Safe to re-run after upgrading the package; it re-syncs from whatever version is currently installed.

## Quick Start

```typescript
import {
  initDb,
  getDbClient,
  findFirst,
  insert,
} from '@starbemtech/star-db-query-builder'

// Initialize database connection
await initDb({
  type: 'pg', // or 'mysql'
  options: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'username',
    password: 'password',
  },
})

// Get database client
const dbClient = getDbClient()

// Find a user
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: { email: { operator: '=', value: 'user@example.com' } },
})

// Insert a new user
const newUser = await insert({
  tableName: 'users',
  dbClient,
  data: { name: 'John Doe', email: 'john@example.com' },
})
```

## Database Initialization

### initDb

Initializes a database connection with the specified configuration.

```typescript
await initDb({
  name?: string,                    // Optional client name (default: 'default')
  type: 'pg' | 'mysql',            // Database type
  options: PoolConfig | MySqlPoolOptions, // Connection options
  retryOptions?: RetryOptions,      // Optional retry configuration
  installUnaccentExtension?: boolean, // PostgreSQL unaccent extension
  queryTimeout?: number             // Optional query timeout in ms (see below)
})
```

`queryTimeout` is applied to every query run through this client. For PostgreSQL it maps onto the pool's `query_timeout` (an explicit `query_timeout` already set in `options` takes precedence over it). For MySQL, since `mysql2` has no pool-wide query timeout, it is passed as the `timeout` option on every individual query.

#### PostgreSQL Example

```typescript
import { initDb } from '@starbemtech/star-db-query-builder'

await initDb({
  name: 'main',
  type: 'pg',
  options: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'postgres',
    password: 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  retryOptions: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 5000,
  },
  installUnaccentExtension: true,
})
```

#### MySQL Example

```typescript
import { initDb } from '@starbemtech/star-db-query-builder'

await initDb({
  name: 'analytics',
  type: 'mysql',
  options: {
    host: 'localhost',
    port: 3306,
    database: 'analytics',
    user: 'root',
    password: 'password',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
  },
})
```

### getDbClient

Retrieves a database client by name.

```typescript
const dbClient = getDbClient(name?: string)
```

```typescript
// Get default client
const defaultClient = getDbClient()

// Get named client
const analyticsClient = getDbClient('analytics')
```

### getAllDbClients

Retrieves every registered database client, keyed by the name it was registered under (including `'default'`).

```typescript
const clients = getAllDbClients() // Record<string, IDatabaseClient>
const names = Object.keys(clients) // ['default', 'analytics', ...]
```

### closeDb

Closes a database client's connection pool and removes it from the registry. Use this to release connections gracefully on application shutdown or between tests — `initDb` does not release the pools it creates on its own.

```typescript
await closeDb() // closes the default client
await closeDb('analytics') // closes a named client
```

Throws if the named client is not initialized.

### closeAllDbClients

Closes every registered database client's connection pool.

```typescript
await closeAllDbClients()
```

### resetDbClients

Clears the in-memory client/pool registry **without** closing any connection — a synchronous escape hatch for test suites and hot-reload tooling that need a clean registry between runs (e.g. calling `initDb` again with the same name without first awaiting a real `closeDb`). Any real, non-mocked pool left registered is orphaned, not released. Production code that wants to release connections should use `closeDb`/`closeAllDbClients` instead.

```typescript
afterEach(() => {
  resetDbClients() // test isolation only — pools here are mocked
})
```

## Query Methods

### findFirst

📖 [Full docs](docs/methods/findFirst.md)

Finds the first record that matches the specified conditions.

```typescript
const result = await findFirst<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select?: string[],
  where?: Conditions<T>,
  groupBy?: string[],
  orderBy?: OrderBy
})
```

#### Examples

```typescript
// Find user by email
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    email: { operator: '=', value: 'user@example.com' },
  },
})

// Find with specific fields
const user = await findFirst({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    status: { operator: '=', value: 'active' },
  },
})

// Find with complex conditions
const user = await findFirst({
  tableName: 'users',
  dbClient,
  where: {
    AND: [
      { email: { operator: '=', value: 'user@example.com' } },
      { status: { operator: '=', value: 'active' } },
    ],
  },
})

// Find with ordering
const latestUser = await findFirst({
  tableName: 'users',
  dbClient,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})
```

### findMany

📖 [Full docs](docs/methods/findMany.md)

Finds multiple records that match the specified conditions.

```typescript
const results = await findMany<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select?: string[],
  where?: Conditions<T>,
  groupBy?: string[],
  orderBy?: OrderBy,
  limit?: number,
  offset?: number,
  unaccent?: boolean
})
```

#### Examples

```typescript
// Find all active users
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    status: { operator: '=', value: 'active' },
  },
})

// Find with pagination
const users = await findMany({
  tableName: 'users',
  dbClient,
  limit: 10,
  offset: 20,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})

// Find with complex conditions
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

// Find with grouping
const userStats = await findMany({
  tableName: 'users',
  dbClient,
  select: ['status', 'COUNT(*) as count'],
  groupBy: ['status'],
})
```

### findManyCursor

📖 [Full docs](docs/methods/findManyCursor.md)

Finds multiple records using keyset (cursor) pagination instead of offset/limit — cost stays flat regardless of page depth, and pages don't skip/repeat rows when data changes between calls.

```typescript
const page = await findManyCursor<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select?: string[],
  where?: Conditions<T>,
  cursorField?: string,      // default: 'id'
  cursor?: string | number,  // omit for the first page
  direction?: 'ASC' | 'DESC',// default: 'ASC'
  limit?: number,            // default: 20
  unaccent?: boolean
}): Promise<{ data: T[]; nextCursor: string | number | null }>
```

#### Examples

```typescript
// First page
const page1 = await findManyCursor({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'active' } },
  cursorField: 'created_at',
  limit: 20,
})

// Next page
const page2 = await findManyCursor({
  tableName: 'users',
  dbClient,
  cursorField: 'created_at',
  cursor: page1.nextCursor,
  limit: 20,
})

// page.nextCursor is null once there are no more rows past this page
```

`findManyCursor` is a separate function, not an option on `findMany` — its return shape (`{ data, nextCursor }`) differs from `findMany`'s plain `T[]`.

### insert

📖 [Full docs](docs/methods/insert.md)

Inserts a single record into the database.

```typescript
const result = await insert<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P,
  returning?: string[]
})
```

#### Examples

```typescript
// Simple insert
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  },
})

// Insert with specific returning fields
const user = await insert({
  tableName: 'users',
  dbClient,
  data: {
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
  returning: ['id', 'name', 'email', 'created_at'],
})

// Insert with TypeScript typing
interface UserData {
  name: string
  email: string
  age: number
}

interface User {
  id: string
  name: string
  email: string
  age: number
  created_at: Date
  updated_at: Date
}

const user: User = await insert<UserData, User>({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  },
})
```

### insertMany

📖 [Full docs](docs/methods/insertMany.md)

Inserts multiple records into the database in a single operation.

```typescript
const results = await insertMany<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P[],
  returning?: string[]
})
```

#### Examples

```typescript
// Insert multiple users
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Doe', email: 'jane@example.com' },
    { name: 'Bob Smith', email: 'bob@example.com' },
  ],
})

// Insert with returning fields
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Doe', email: 'jane@example.com' },
  ],
  returning: ['id', 'name', 'email'],
})
```

### upsert

📖 [Full docs](docs/methods/upsert.md)

Inserts a record, or updates it in place when it collides with an existing unique/primary key constraint. `conflictFields` must name columns already covered by a **real unique or primary key constraint** on `tableName` — `upsert` does not create or verify that constraint, it only builds SQL that assumes it exists.

```typescript
const result = await upsert<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P,
  conflictFields: string[],   // must match a real unique/PK constraint
  updateFields?: string[],    // default: every field in `data`
  returning?: string[]
})
```

#### Examples

```typescript
// Insert a user, or update name/age if the email already exists
// (requires: CREATE UNIQUE INDEX idx_users_email ON users(email);)
const user = await upsert({
  tableName: 'users',
  dbClient,
  data: { email: 'john@example.com', name: 'John Doe', age: 30 },
  conflictFields: ['email'],
})

// Only refresh `name` on conflict, leave other fields untouched
const user = await upsert({
  tableName: 'users',
  dbClient,
  data: { email: 'john@example.com', name: 'John Doe', role: 'admin' },
  conflictFields: ['email'],
  updateFields: ['name'],
})
```

> On mysql, `conflictFields` is **not** part of the generated SQL — `ON DUPLICATE KEY UPDATE` relies entirely on the table's own constraint to detect the conflict. `conflictFields` there is used only to re-select the row afterwards, since mysql has no `RETURNING`.

### update

Updates a single record by ID.

```typescript
const result = await update<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  id: string,
  data: P,
  returning?: string[]
})
```

#### Examples

```typescript
// Simple update
const updatedUser = await update({
  tableName: 'users',
  dbClient,
  id: 'user-123',
  data: {
    name: 'John Updated',
    age: 31,
  },
})

// Update with returning fields
const updatedUser = await update({
  tableName: 'users',
  dbClient,
  id: 'user-123',
  data: {
    status: 'active',
    last_login: new Date(),
  },
  returning: ['id', 'status', 'last_login', 'updated_at'],
})
```

### updateMany

Updates multiple records based on specified conditions.

```typescript
const results = await updateMany<P, R>({
  tableName: string,
  dbClient: IDatabaseClient,
  data: P,
  where: Conditions<T>,
  returning?: string[]
})
```

#### Examples

```typescript
// Update all inactive users
const updatedUsers = await updateMany({
  tableName: 'users',
  dbClient,
  data: {
    status: 'active',
    updated_at: new Date(),
  },
  where: {
    status: { operator: '=', value: 'inactive' },
  },
})

// Update with complex conditions
// updateMany() sets columns to the literal value passed in `data` — it does
// not interpret an { operator, value } shape as an arithmetic update. Read
// the current value first if you need to increment/decrement it.
const updatedUsers = await updateMany({
  tableName: 'users',
  dbClient,
  data: {
    last_login: new Date(),
    login_count: currentLoginCount + 1,
  },
  where: {
    AND: [
      { status: { operator: '=', value: 'active' } },
      { last_login: { operator: '<', value: new Date('2023-01-01') } },
    ],
  },
  returning: ['id', 'name', 'last_login', 'login_count'],
})
```

### deleteOne

Deletes a single record by ID (soft delete by default).

```typescript
await deleteOne<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  id: string,
  permanently?: boolean
})
```

#### Examples

```typescript
// Soft delete (sets status to 'deleted')
await deleteOne({
  tableName: 'users',
  dbClient,
  id: 'user-123',
})

// Permanent delete
await deleteOne({
  tableName: 'users',
  dbClient,
  id: 'user-123',
  permanently: true,
})
```

### deleteMany

Deletes multiple records by IDs (soft delete by default).

```typescript
await deleteMany<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  ids: string[] | number[],
  field?: string,
  permanently?: boolean
})
```

#### Examples

```typescript
// Soft delete multiple users
await deleteMany({
  tableName: 'users',
  dbClient,
  ids: ['user-1', 'user-2', 'user-3'],
})

// Permanent delete with custom field
await deleteMany({
  tableName: 'orders',
  dbClient,
  ids: [1, 2, 3],
  field: 'order_id',
  permanently: true,
})
```

### joins

📖 [Full docs](docs/methods/joins.md)

Executes queries with JOIN operations.

```typescript
const results = await joins<T>({
  tableName: string,
  dbClient: IDatabaseClient,
  select: string[],
  joins: JoinClause[],
  where?: Conditions<T>,
  groupBy?: string[],
  orderBy?: OrderBy,
  limit?: number,
  offset?: number,
  unaccent?: boolean
})
```

#### Examples

```typescript
// Simple JOIN
const usersWithOrders = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.id', 'users.name', 'orders.total'],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  where: {
    'users.status': { operator: '=', value: 'active' },
  },
})

// Multiple JOINs
const report = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.name',
    'users.email',
    'COUNT(orders.id) as order_count',
    'SUM(orders.total) as total_spent',
    'plans.name as plan_name',
  ],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
    {
      type: 'LEFT',
      table: 'user_plans',
      on: 'users.id = user_plans.user_id',
    },
    {
      type: 'LEFT',
      table: 'plans',
      on: 'user_plans.plan_id = plans.id',
    },
  ],
  groupBy: ['users.id', 'users.name', 'users.email', 'plans.name'],
  orderBy: [{ field: 'total_spent', direction: 'DESC' }],
})
```

> `joins()` has no `having` parameter. Filter on the aggregate at the application layer, or use `rawQuery` if you need a real `HAVING` clause.

### rawQuery

📖 [Full docs](docs/methods/rawQuery.md)

Executes raw SQL queries directly on the database.

```typescript
const result = await rawQuery<T>({
  dbClient: IDatabaseClient,
  sql: string,
  params?: any[]
})
```

#### Examples

```typescript
// Simple raw query
const users = await rawQuery({
  dbClient,
  sql: 'SELECT * FROM users WHERE active = true',
})

// Raw query with parameters
const user = await rawQuery({
  dbClient,
  sql: 'SELECT * FROM users WHERE id = ? AND email = ?',
  params: ['user-123', 'user@example.com'],
})

// Complex aggregation
const stats = await rawQuery({
  dbClient,
  sql: `
    SELECT 
      COUNT(*) as total_users,
      AVG(age) as avg_age,
      MAX(created_at) as last_created
    FROM users 
    WHERE created_at >= ?
  `,
  params: [new Date('2023-01-01')],
})
```

## Transactions

📖 [Full docs](docs/methods/transactions.md)

Execute multiple database operations within a single transaction to ensure data consistency and atomicity.

### withTransaction

Executes a function within a database transaction with automatic commit/rollback handling.

```typescript
const result = await withTransaction<T>(
  dbClient: IDatabaseClient,
  transactionFn: (tx: ITransactionClient) => Promise<T>
): Promise<T>
```

#### Examples

```typescript
import {
  withTransaction,
  insert,
  update,
  findFirst,
} from '@starbemtech/star-db-query-builder'

// Create user with profile in a single transaction
const createUserWithProfile = async (userData: any, profileData: any) => {
  return withTransaction(dbClient, async (tx) => {
    // Create user
    const user = await insert({
      tableName: 'users',
      dbClient: tx,
      data: userData,
    })

    // Create user profile
    const profile = await insert({
      tableName: 'user_profiles',
      dbClient: tx,
      data: {
        ...profileData,
        user_id: user.id,
      },
    })

    return { user, profile }
  })
}

// E-commerce order processing
const processOrder = async (orderData: any, orderItems: any[]) => {
  return withTransaction(dbClient, async (tx) => {
    // Create order
    const order = await insert({
      tableName: 'orders',
      dbClient: tx,
      data: {
        ...orderData,
        status: 'pending',
        total: 0,
      },
    })

    let totalAmount = 0

    // Create order items and calculate total
    for (const item of orderItems) {
      await insert({
        tableName: 'order_items',
        dbClient: tx,
        data: {
          ...item,
          order_id: order.id,
        },
      })

      totalAmount += item.price * item.quantity

      // update() sets columns to the literal value passed in `data` — it
      // does not interpret { operator, value } as an arithmetic update.
      // Read the current stock first, then write the computed result.
      const product = await findFirst({
        tableName: 'products',
        dbClient: tx,
        select: ['stock'],
        where: { id: { operator: '=', value: item.product_id } },
      })

      await update({
        tableName: 'products',
        dbClient: tx,
        id: item.product_id,
        data: {
          stock: product.stock - item.quantity,
        },
      })
    }

    // Update order total
    await update({
      tableName: 'orders',
      dbClient: tx,
      id: order.id,
      data: {
        total: totalAmount,
        status: 'confirmed',
      },
    })

    return { order, totalAmount }
  })
}
```

### beginTransaction

Creates a transaction client for manual transaction management.

```typescript
const transaction = await beginTransaction(dbClient: IDatabaseClient): Promise<ITransactionClient>
```

#### Examples

```typescript
import {
  beginTransaction,
  insert,
  update,
} from '@starbemtech/star-db-query-builder'

// Manual transaction management
const complexOperation = async () => {
  const transaction = await beginTransaction(dbClient)

  try {
    // First operation
    const user = await insert({
      tableName: 'users',
      dbClient: transaction,
      data: { name: 'John Doe', email: 'john@example.com' },
    })

    // Second operation
    const profile = await insert({
      tableName: 'user_profiles',
      dbClient: transaction,
      data: { user_id: user.id, bio: 'Hello world' },
    })

    // Third operation
    await update({
      tableName: 'users',
      dbClient: transaction,
      id: user.id,
      data: { profile_created: true },
    })

    // Commit all changes
    await transaction.commit()
    return { user, profile }
  } catch (error) {
    // Rollback on any error
    await transaction.rollback()
    throw error
  }
}
```

### ITransactionClient Interface

```typescript
interface ITransactionClient {
  query: <T>(sql: string, params?: any[]) => Promise<T>
  commit: () => Promise<void>
  rollback: () => Promise<void>
}
```

## Types and Interfaces

### Conditions

Used for building WHERE clauses with type safety.

> `IN`/`NOT IN`/`BETWEEN` accept at most **10,000** values in `value`. A larger array throws a descriptive error instead of building an oversized query — chunk the list (e.g. multiple `IN` queries, or `= ANY($1::type[])` on pg) instead of forwarding an unbounded list (e.g. raw search results) as a single condition.

```typescript
type Conditions<T> = {
  [P in keyof T]?: Condition<T[P]>
} & LogicalCondition<T>

type Condition<T> = OperatorCondition | LogicalCondition<T>

interface OperatorCondition {
  operator:
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'LIKE'
    | 'NOT LIKE'
    | 'ILIKE'
    | 'IN'
    | 'NOT IN'
    | 'BETWEEN'
    | 'IS NULL'
    | 'IS NOT NULL'
    | 'NOT EXISTS'
  value: SimpleValue | SimpleValue[]
}

interface LogicalCondition<T> {
  OR?: Conditions<T>[]
  AND?: Conditions<T>[]
  // Nested AND-group rendered as its own parenthesized clause, e.g.
  // `(a = $1 AND b = $2)`. Despite the name this has nothing to do with SQL
  // JOINs — see the `joins()` query function for that.
  JOINS?: Conditions<object>[]
  notExists?: OperatorCondition
}
```

### OrderBy

Used for specifying sort order.

```typescript
type OrderBy = { field: string; direction: 'ASC' | 'DESC' }[]
```

### JoinClause

Used for JOIN operations.

```typescript
interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: string
}
```

## Advanced Usage

### Complex WHERE Conditions

```typescript
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    AND: [
      { status: { operator: '=', value: 'active' } },
      {
        OR: [
          { age: { operator: '>=', value: 18 } },
          { verified: { operator: '=', value: true } },
        ],
      },
      { created_at: { operator: '>=', value: new Date('2023-01-01') } },
    ],
  },
})
```

### Using Unaccent for PostgreSQL

```typescript
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: {
    name: { operator: 'ILIKE', value: '%joão%' },
  },
  unaccent: true, // Enables unaccent search
})
```

## Monitoring

The library provides a comprehensive monitoring system to track database operations and performance.

### Monitor Events

```typescript
import { monitor, MonitorEvents } from '@starbemtech/star-db-query-builder'

// Monitor connection events
monitor.on(MonitorEvents.CONNECTION_CREATED, (data) => {
  console.log('Database connection created:', data)
})

// Monitor query events
monitor.on(MonitorEvents.QUERY_START, (data) => {
  console.log('Query started:', {
    sql: data.sql,
    params: data.params,
    clientType: data.clientType,
    attempt: data.attempt,
  })
})

monitor.on(MonitorEvents.QUERY_END, (data) => {
  console.log('Query completed:', {
    elapsedTime: data.elapsedTime,
    clientType: data.clientType,
  })
})

monitor.on(MonitorEvents.QUERY_ERROR, (data) => {
  console.error('Query failed:', {
    error: data.error,
    sql: data.sql,
    elapsedTime: data.elapsedTime,
  })
})

// Monitor transaction events
monitor.on(MonitorEvents.TRANSACTION_COMMIT, (data) => {
  console.log('Transaction committed:', data)
})

monitor.on(MonitorEvents.TRANSACTION_ROLLBACK, (data) => {
  console.log('Transaction rolled back:', data)
})

// Monitor retry attempts
monitor.on(MonitorEvents.RETRY_ATTEMPT, (data) => {
  console.warn('Retry attempt:', {
    attempt: data.attempt,
    error: data.error,
    sql: data.sql,
  })
})
```

### Custom Monitoring Implementation

```typescript
// Example: Log all database operations to a file
import fs from 'fs'
import path from 'path'

const logFile = path.join(__dirname, 'database.log')

monitor.on(MonitorEvents.QUERY_START, (data) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'QUERY_START',
    sql: data.sql,
    params: data.params,
    clientType: data.clientType,
  }

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n')
})

monitor.on(MonitorEvents.QUERY_END, (data) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'QUERY_END',
    elapsedTime: data.elapsedTime,
    clientType: data.clientType,
  }

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n')
})
```

### Performance Monitoring

```typescript
// Track slow queries
monitor.on(MonitorEvents.QUERY_END, (data) => {
  if (data.elapsedTime > 1000) {
    // Queries taking more than 1 second
    console.warn('Slow query detected:', {
      sql: data.sql,
      elapsedTime: data.elapsedTime,
      clientType: data.clientType,
    })
  }
})

// Track connection pool usage
monitor.on(MonitorEvents.CONNECTION_CREATED, (data) => {
  console.log('Connection pool status:', {
    clientType: data.clientType,
    poolOptions: data.poolOptions,
  })
})
```

## Best Practices

### 1. Use TypeScript Types

```typescript
interface User {
  id: string
  name: string
  email: string
  created_at: Date
}

const users: User[] = await findMany<User>({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'active' } },
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

### 3. Use Pagination for Large Datasets

```typescript
const users = await findMany({
  tableName: 'users',
  dbClient,
  limit: 50,
  offset: 0,
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
})
```

### 4. Use Batch Operations When Possible

```typescript
// Good: Batch insert
const users = await insertMany({
  tableName: 'users',
  dbClient,
  data: userArray,
})

// Avoid: Multiple individual inserts
for (const user of userArray) {
  await insert({ tableName: 'users', dbClient, data: user })
}
```

### 5. Handle Errors Properly

```typescript
try {
  const user = await findFirst({
    tableName: 'users',
    dbClient,
    where: { email: { operator: '=', value: 'user@example.com' } },
  })
} catch (error) {
  console.error('Database error:', error.message)
  // Handle error appropriately
}
```

### 6. Use Raw Queries Sparingly

```typescript
// Use built-in methods when possible
const users = await findMany({
  tableName: 'users',
  dbClient,
  where: { status: { operator: '=', value: 'active' } },
})

// Use rawQuery only for complex operations
const complexStats = await rawQuery({
  dbClient,
  sql: 'SELECT ... complex aggregation ...',
})
```

### 7. Use Transactions for Data Consistency

```typescript
// Good: Use transactions for related operations
const createUserWithProfile = async (userData: any, profileData: any) => {
  return withTransaction(dbClient, async (tx) => {
    const user = await insert({
      tableName: 'users',
      dbClient: tx,
      data: userData,
    })

    await insert({
      tableName: 'user_profiles',
      dbClient: tx,
      data: { ...profileData, user_id: user.id },
    })

    return user
  })
}

// Avoid: Multiple separate operations without transactions
const badUserCreation = async (userData: any, profileData: any) => {
  const user = await insert({
    tableName: 'users',
    dbClient,
    data: userData,
  })

  // If this fails, the user will be created but profile won't
  await insert({
    tableName: 'user_profiles',
    dbClient,
    data: { ...profileData, user_id: user.id },
  })

  return user
}
```

### 8. Keep Transactions Short

```typescript
// Good: Short, focused transaction
const updateUserStatus = async (userId: string, status: string) => {
  return withTransaction(dbClient, async (tx) => {
    await update({
      tableName: 'users',
      dbClient: tx,
      id: userId,
      data: { status },
    })

    await insert({
      tableName: 'user_status_history',
      dbClient: tx,
      data: { user_id: userId, status, changed_at: new Date() },
    })
  })
}

// Avoid: Long-running transactions
const badTransaction = async () => {
  return withTransaction(dbClient, async (tx) => {
    // ... many operations
    await someSlowOperation() // This could timeout
    // ... more operations
  })
}
```

## Error Handling

The library throws descriptive errors for common issues:

### Common Errors

- `Table name is required`
- `DB client is required`
- `Data object is required`
- `ID is required`
- `Where condition is required`
- `Raw query execution failed: [database message]`
- `Transaction execution failed: [database message]`

### Transaction Error Handling

```typescript
import {
  withTransaction,
  insert,
  update,
} from '@starbemtech/star-db-query-builder'

const safeTransaction = async () => {
  try {
    return await withTransaction(dbClient, async (tx) => {
      // Transaction operations
      const result = await someOperation(tx)
      return result
    })
  } catch (error) {
    // Transaction was automatically rolled back
    console.error('Transaction failed:', error.message)

    // Handle specific error types
    if (error.message.includes('deadlock detected')) {
      // Handle deadlock - you might want to retry
      console.warn('Deadlock detected, retrying...')
      // Implement retry logic
    } else if (error.message.includes('serialization failure')) {
      // Handle serialization failure
      console.warn('Serialization failure, retrying...')
      // Implement retry logic
    } else if (error.message.includes('connection lost')) {
      // Handle connection issues
      console.error('Database connection lost')
      // Implement reconnection logic
    } else {
      // Handle other errors
      console.error('Transaction error:', error.message)
    }

    throw error
  }
}
```

### Retry Logic for Transient Errors

```typescript
const retryTransaction = async <T>(
  transactionFn: (tx: ITransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(dbClient, transactionFn)
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (isRetryableError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        console.warn(
          `Transaction attempt ${attempt} failed, retrying in ${delay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw error
    }
  }

  throw lastError!
}

const isRetryableError = (error: any): boolean => {
  const retryableErrors = [
    'deadlock detected',
    'serialization failure',
    'connection lost',
    'timeout',
  ]

  return retryableErrors.some((msg) =>
    error.message?.toLowerCase().includes(msg)
  )
}
```

Always wrap database operations in try-catch blocks and handle errors appropriately in your application.

## Contributing

We welcome contributions to the Star DB Query Builder! Here's how you can help:

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/starbem/star-db-query-builder.git
   cd star-db-query-builder
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Run tests**

   ```bash
   pnpm test
   ```

4. **Run linting**

   ```bash
   pnpm lint
   ```

5. **Build the project**
   ```bash
   pnpm build
   ```

### Contributing Guidelines

- **Code Style**: Follow the existing code style and use Prettier for formatting
- **TypeScript**: Maintain strict TypeScript typing
- **Tests**: Add tests for new features and bug fixes
- **Documentation**: Update documentation for any API changes
- **Commit Messages**: Use conventional commit messages

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`pnpm test`)
6. Run linting (`pnpm lint`)
7. Commit your changes (`git commit -m 'feat: add amazing feature'`)
8. Push to your branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Reporting Issues

When reporting issues, please include:

- **Environment**: Node.js version, database type and version
- **Steps to Reproduce**: Clear steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Code Sample**: Minimal code sample that demonstrates the issue

### Feature Requests

For feature requests, please:

- **Describe the feature**: Clear description of what you want
- **Use Case**: Explain why this feature would be useful
- **Proposed API**: If you have ideas for the API design
- **Alternatives**: Any alternative solutions you've considered

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [GitHub Wiki](https://github.com/starbem/star-db-query-builder/wiki)
- **Issues**: [GitHub Issues](https://github.com/starbem/star-db-query-builder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/starbem/star-db-query-builder/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

---

Made with ❤️ by the Starbem team
