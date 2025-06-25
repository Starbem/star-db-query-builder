# 🚀 Star DB Query Builder

[![npm version](https://badge.fury.io/js/@starbemtech%2Fstar-db-query-builder.svg)](https://badge.fury.io/js/@starbemtech%2Fstar-db-query-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue.svg)](https://www.typescriptlang.org/)

> **A robust and type-safe TypeScript library for building SQL queries with PostgreSQL and MySQL support**

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Practical Examples](#-practical-examples)
- [Advanced Use Cases](#-advanced-use-cases)
- [Monitoring](#-monitoring)
- [Contributing](#-contributing)
- [License](#-license)

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
- **Transaction Support**: Transaction support

### 🛠️ **Development Tools**

- **ESLint + Prettier**: Clean and consistent code
- **Jest**: Unit and integration tests
- **Husky**: Git hooks for code quality
- **TypeScript**: Compilation and typing

## 📦 Installation

```bash
# NPM
npm install @starbemtech/star-db-query-builder

# Yarn
yarn add @starbemtech/star-db-query-builder

# PNPM
pnpm add @starbemtech/star-db-query-builder
```

## 🚀 Quick Start

### 1. Initial Configuration

```typescript
import { initDb, getDbClient } from '@starbemtech/star-db-query-builder'

// Configure PostgreSQL
await initDb({
  name: 'postgres-main',
  type: 'pg',
  options: {
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASS,
    database: process.env.PG_DB,
    max: 20,
    connectionTimeoutMillis: 5000,
  },
  retryOptions: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
  },
  installUnaccentExtension: true, // For accent-insensitive search
})

// Configure MySQL
await initDb({
  name: 'mysql-analytics',
  type: 'mysql',
  options: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    connectionLimit: 10,
  },
  retryOptions: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
  },
})

// Get database client
const pgClient = getDbClient('postgres-main')
const mysqlClient = getDbClient('mysql-analytics')
```

### 2. First Query

```typescript
import { findFirst, findMany } from '@starbemtech/star-db-query-builder'

// Find specific user
const user = await findFirst({
  tableName: 'users',
  dbClient: pgClient,
  select: ['id', 'name', 'email', 'created_at'],
  where: {
    email: { operator: '=', value: 'user@example.com' },
    status: { operator: '=', value: 'active' },
  },
})

// Find multiple users
const activeUsers = await findMany({
  tableName: 'users',
  dbClient: pgClient,
  select: ['id', 'name', 'email'],
  where: {
    status: { operator: '=', value: 'active' },
    created_at: { operator: '>=', value: new Date('2024-01-01') },
  },
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
  limit: 10,
  offset: 0,
})
```

## ⚙️ Configuration

### PostgreSQL Connection Options

```typescript
interface PgPoolConfig {
  host: string
  port?: number
  user: string
  password: string
  database: string
  max?: number // Maximum connections in pool
  connectionTimeoutMillis?: number
  idleTimeoutMillis?: number
  ssl?: boolean | object
  // ... other node-postgres options
}
```

### MySQL Connection Options

```typescript
interface MySqlPoolOptions {
  host: string
  port?: number
  user: string
  password: string
  database: string
  connectionLimit?: number
  acquireTimeout?: number
  timeout?: number
  // ... other mysql2 options
}
```

### Retry Options

```typescript
interface RetryOptions {
  retries?: number // Number of attempts (default: 3)
  factor?: number // Exponential factor (default: 2)
  minTimeout?: number // Minimum time between attempts (ms)
  maxTimeout?: number // Maximum time between attempts (ms)
  randomize?: boolean // Add randomness (default: true)
}
```

## 📚 API Reference

### 🔍 **Read Operations**

#### `findFirst<T>(params)`

Returns the first record that matches the criteria.

```typescript
const user = await findFirst<User>({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    id: { operator: '=', value: 'uuid-here' },
  },
})
```

#### `findMany<T>(params)`

Returns multiple records with pagination and ordering.

```typescript
const users = await findMany<User>({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    status: { operator: '=', value: 'active' },
  },
  orderBy: [
    { field: 'created_at', direction: 'DESC' },
    { field: 'name', direction: 'ASC' },
  ],
  limit: 20,
  offset: 40,
  groupBy: ['status'],
})
```

### ✏️ **Write Operations**

#### `insert<P, R>(params)`

Inserts a new record and returns the inserted data.

```typescript
const newUser = await insert<UserData, User>({
  tableName: 'users',
  dbClient,
  data: {
    name: 'John Silva',
    email: 'john@example.com',
    age: 30,
  },
  returning: ['id', 'name', 'email', 'created_at'],
})
```

#### `insertMany<P, R>(params)`

Inserts multiple records in a single operation.

```typescript
const usersData = [
  { name: 'Maria', email: 'maria@example.com' },
  { name: 'Pedro', email: 'pedro@example.com' },
  { name: 'Ana', email: 'ana@example.com' },
]

const insertedUsers = await insertMany<UserData, User>({
  tableName: 'users',
  dbClient,
  data: usersData,
  returning: ['id', 'name', 'email'],
})
```

#### `update<P, R>(params)`

Updates a specific record by ID.

```typescript
const updatedUser = await update<UserData, User>({
  tableName: 'users',
  dbClient,
  id: 'user-uuid',
  data: {
    name: 'John Silva Updated',
    age: 31,
  },
  returning: ['id', 'name', 'age', 'updated_at'],
})
```

#### `updateMany<P, R>(params)`

Updates multiple records based on conditions.

```typescript
const updatedUsers = await updateMany<UserData, User>({
  tableName: 'users',
  dbClient,
  data: {
    status: 'inactive',
    updated_at: new Date(),
  },
  where: {
    last_login: { operator: '<', value: new Date('2024-01-01') },
    status: { operator: '=', value: 'active' },
  },
  returning: ['id', 'name', 'status'],
})
```

### 🗑️ **Delete Operations**

#### `deleteOne<T>(params)`

Removes a specific record (soft delete or hard delete).

```typescript
// Soft delete (mark as deleted)
await deleteOne<User>({
  tableName: 'users',
  dbClient,
  id: 'user-uuid',
  permanently: false, // default
})

// Hard delete (permanently remove)
await deleteOne<User>({
  tableName: 'users',
  dbClient,
  id: 'user-uuid',
  permanently: true,
})
```

#### `deleteMany<T>(params)`

Removes multiple records based on IDs or conditions.

```typescript
// By IDs
await deleteMany<User>({
  tableName: 'users',
  dbClient,
  ids: ['uuid1', 'uuid2', 'uuid3'],
  permanently: true,
})

// By specific field
await deleteMany<User>({
  tableName: 'users',
  dbClient,
  ids: [1, 2, 3],
  field: 'external_id',
  permanently: false,
})
```

### 🔗 **Join Operations**

#### `joins<T>(params)`

Executes complex queries with multiple joins.

```typescript
const ordersWithUsers = await joins<OrderWithUser>({
  tableName: 'orders',
  dbClient,
  select: [
    'orders.id',
    'orders.total',
    'orders.created_at',
    'users.name as user_name',
    'users.email as user_email',
  ],
  joins: [
    {
      type: 'INNER',
      table: 'users',
      on: 'orders.user_id = users.id',
    },
    {
      type: 'LEFT',
      table: 'order_items',
      on: 'orders.id = order_items.order_id',
    },
  ],
  where: {
    'orders.status': { operator: '=', value: 'completed' },
    'orders.created_at': { operator: '>=', value: new Date('2024-01-01') },
  },
  orderBy: [{ field: 'orders.created_at', direction: 'DESC' }],
  limit: 50,
})
```

## 🎯 Practical Examples

### E-commerce System

```typescript
// Find products with stock
const availableProducts = await findMany<Product>({
  tableName: 'products',
  dbClient,
  select: ['id', 'name', 'price', 'stock_quantity'],
  where: {
    stock_quantity: { operator: '>', value: 0 },
    status: { operator: '=', value: 'active' },
    category_id: { operator: 'IN', value: [1, 2, 3] },
  },
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
  limit: 20,
})

// Create order with items
const orderData = {
  user_id: 'user-uuid',
  total: 299.99,
  status: 'pending',
}

const newOrder = await insert<OrderData, Order>({
  tableName: 'orders',
  dbClient,
  data: orderData,
  returning: ['id', 'total', 'created_at'],
})

// Update product stock
const orderItems = [
  { product_id: 1, quantity: 2 },
  { product_id: 3, quantity: 1 },
]

await insertMany<OrderItemData, OrderItem>({
  tableName: 'order_items',
  dbClient,
  data: orderItems.map((item) => ({
    order_id: newOrder.id,
    ...item,
  })),
})

// Update stock
for (const item of orderItems) {
  await updateMany<ProductData, Product>({
    tableName: 'products',
    dbClient,
    data: {
      stock_quantity: { operator: '-', value: item.quantity },
      updated_at: new Date(),
    },
    where: {
      id: { operator: '=', value: item.product_id },
    },
  })
}
```

### Authentication System

```typescript
// Find user by email with password verification
const user = await findFirst<User>({
  tableName: 'users',
  dbClient,
  select: ['id', 'email', 'password_hash', 'status'],
  where: {
    email: { operator: 'ILIKE', value: 'user@example.com' },
    status: { operator: '=', value: 'active' },
  },
})

if (user && (await bcrypt.compare(password, user.password_hash))) {
  // Successful login
  await update<UserData, User>({
    tableName: 'users',
    dbClient,
    id: user.id,
    data: {
      last_login: new Date(),
      login_count: { operator: '+', value: 1 },
    },
  })
}
```

### Notification System

```typescript
// Find unread notifications
const unreadNotifications = await findMany<Notification>({
  tableName: 'notifications',
  dbClient,
  select: ['id', 'title', 'message', 'type', 'created_at'],
  where: {
    user_id: { operator: '=', value: 'user-uuid' },
    read_at: { operator: 'IS NULL' },
  },
  orderBy: [{ field: 'created_at', direction: 'DESC' }],
  limit: 10,
})

// Mark as read
await updateMany<NotificationData, Notification>({
  tableName: 'notifications',
  dbClient,
  data: {
    read_at: new Date(),
  },
  where: {
    user_id: { operator: '=', value: 'user-uuid' },
    read_at: { operator: 'IS NULL' },
  },
})
```

## 🔧 Advanced Use Cases

### Unaccent Search (PostgreSQL)

```typescript
// Search ignoring accents
const searchResults = await findMany<User>({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    name: { operator: 'ILIKE', value: '%joão%' },
  },
  unaccent: true, // Enable accent-insensitive search
})
```

### Complex Conditions

```typescript
// Nested OR/AND conditions
const complexQuery = await findMany<Order>({
  tableName: 'orders',
  dbClient,
  where: {
    OR: [
      {
        status: { operator: '=', value: 'pending' },
        created_at: { operator: '>=', value: new Date('2024-01-01') },
      },
      {
        status: { operator: '=', value: 'processing' },
        priority: { operator: '=', value: 'high' },
      },
    ],
    AND: [
      {
        total: { operator: '>=', value: 100 },
        user_id: { operator: 'IS NOT NULL' },
      },
    ],
  },
})
```

### Subqueries

```typescript
// Users who made orders in the last month
const activeUsers = await findMany<User>({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    id: {
      operator: 'IN',
      value: `SELECT DISTINCT user_id FROM orders 
              WHERE created_at >= '${new Date('2024-01-01').toISOString()}'`,
    },
  },
})
```

### Transactions

```typescript
// Transaction example (custom implementation)
const transaction = await dbClient.beginTransaction()

try {
  // Create order
  const order = await insert<OrderData, Order>({
    tableName: 'orders',
    dbClient: transaction,
    data: orderData,
  })

  // Create order items
  await insertMany<OrderItemData, OrderItem>({
    tableName: 'order_items',
    dbClient: transaction,
    data: orderItems.map((item) => ({
      order_id: order.id,
      ...item,
    })),
  })

  // Update stock
  await updateMany<ProductData, Product>({
    tableName: 'products',
    dbClient: transaction,
    data: { stock_quantity: { operator: '-', value: 1 } },
    where: { id: { operator: 'IN', value: productIds } },
  })

  await transaction.commit()
} catch (error) {
  await transaction.rollback()
  throw error
}
```

## 📊 Monitoring

### Available Events

```typescript
import { monitor, MonitorEvents } from '@starbemtech/star-db-query-builder'

// Connection created
monitor.on(MonitorEvents.CONNECTION_CREATED, (data) => {
  console.log('🔄 New connection created:', data)
})

// Query started
monitor.on(MonitorEvents.QUERY_START, (data) => {
  console.log('🚀 Query started:', {
    sql: data.sql,
    params: data.params,
    timestamp: new Date(),
  })
})

// Query finished
monitor.on(MonitorEvents.QUERY_END, (data) => {
  console.log('✅ Query finished:', {
    duration: data.duration,
    rows: data.rows?.length,
    timestamp: new Date(),
  })
})

// Query error
monitor.on(MonitorEvents.QUERY_ERROR, (data) => {
  console.error('❌ Query error:', {
    error: data.error.message,
    sql: data.sql,
    params: data.params,
    timestamp: new Date(),
  })
})

// Query retry
monitor.on(MonitorEvents.RETRY_ATTEMPT, (data) => {
  console.warn('🔄 Retry attempt:', {
    attempt: data.attempt,
    error: data.error.message,
    timestamp: new Date(),
  })
})
```

### Logging Integration

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

monitor.on(MonitorEvents.QUERY_ERROR, (data) => {
  logger.error('Database query error', {
    error: data.error.message,
    sql: data.sql,
    params: data.params,
    stack: data.error.stack,
  })
})

monitor.on(MonitorEvents.QUERY_END, (data) => {
  if (data.duration > 1000) {
    // Log slow queries (>1s)
    logger.warn('Slow query detected', {
      duration: data.duration,
      sql: data.sql,
      params: data.params,
    })
  }
})
```

## 🛠️ Supported Operators

### Comparison Operators

- `=` - Equal
- `!=` - Not equal
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal

### Text Operators

- `LIKE` - Pattern search
- `NOT LIKE` - Negative pattern search
- `ILIKE` - Case-insensitive search (PostgreSQL)
- `NOT ILIKE` - Negative case-insensitive search

### Set Operators

- `IN` - Belongs to set
- `NOT IN` - Does not belong to set
- `BETWEEN` - Between two values

### Null Operators

- `IS NULL` - Is null
- `IS NOT NULL` - Is not null

### Special Operators

- `NOT EXISTS` - Subquery returns no results

## 🔧 Available Scripts

```bash
# Development
npm run build          # Compile TypeScript
npm run test           # Run tests
npm run test:watch     # Tests in watch mode
npm run test:coverage  # Tests with coverage
npm run lint           # Check linting
npm run lint:fix       # Fix linting issues
npm run format         # Format code

# Versioning
npm run version:patch  # Increment patch (1.0.0 -> 1.0.1)
npm run version:minor  # Increment minor (1.0.0 -> 1.1.0)
npm run version:major  # Increment major (1.0.0 -> 2.0.0)

# Release
npm run release        # Create complete release
```

## 🤝 Contributing

1. **Fork** the project
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Contribution Guidelines

- ✅ Use TypeScript for all new features
- ✅ Add tests for new features
- ✅ Maintain test coverage above 80%
- ✅ Follow linting and formatting conventions
- ✅ Document new APIs and features
- ✅ Update CHANGELOG.md for significant changes

### Project Structure

```
src/
├── db/                 # Database clients
│   ├── initDb.ts      # Connection initialization
│   ├── pgClient.ts    # PostgreSQL client
│   ├── mysqlClient.ts # MySQL client
│   └── IDatabaseClient.ts # Client interface
├── default/           # Generic repository
│   ├── genericRepository.ts # CRUD methods
│   ├── types.ts       # TypeScript types
│   └── utils.ts       # Query utilities
└── monitor/           # Monitoring system
    └── monitor.ts     # Events and monitoring
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 **Email**: julio.sousa@starbem.app
- 🐛 **Issues**: [GitHub Issues](https://github.com/starbem/star-db-query-builder/issues)
- 📖 **Documentation**: [GitHub Wiki](https://github.com/starbem/star-db-query-builder/wiki)

## 🙏 Acknowledgments

- [node-postgres](https://github.com/brianc/node-postgres) - PostgreSQL client
- [mysql2](https://github.com/sidorares/node-mysql2) - MySQL client
- [promise-retry](https://github.com/IndigoUnited/js-promise-retry) - Retry system
- [uuid](https://github.com/uuidjs/uuid) - UUID generation

---

<div align="center">
  <p>Made with ❤️ by the <strong>Starbem</strong> team</p>
  <p>💻 Happy Coding!</p>
</div>
