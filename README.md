# NodeJS Star DB Query Builder

🎉 Welcome to the NodeJS Database Library! This library provides a set of robust methods to interact with your database seamlessly. With TypeScript support, it ensures type safety and great developer experience.

## Features

- **Multi-Connection Support:** Simultaneously connect to multiple MySQL and PostgreSQL databases.
- **Automatic Retry:** Automatically retries queries in case of transient errors (e.g. connection loss or timeouts).
- **External Configuration:** Customize connection pool settings and retry parameters through external configuration.
- **Monitoring and Logging:** Emits events during the connection and query lifecycle, making it easier to integrate with your logging and monitoring systems.

## Installation

```bash
// Use npm
$ npm install star-db-query-builder

// Use yarn
$ yarn add star-db-query-builder

// Use pnpm
$ pnpm install star-db-query-builder
```

## Usage

### Initialization

First, initialize the database with the appropriate configuration.

```typescript
import { initDb, getDbClient, PoolConfig } from 'star-db-query-builder';

// Use PostgresSQL
const pgPoolOptions: PoolConfig = {
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  database: process.env.PG_DB,
  // OR
  connectionURL: 'YOUR POSTGRES CONNECTION URL'
  max: Number(process.env.PG_POOL_MAX) || 10,
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT) || 0,
  // Other pool options as needed
}

initDb({
  name: 'pg-prod',
  type: 'pg',
  options: pgPoolOptions,
  retryOptions: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    // Other retry parameters if needed
  }
});

// User MySQL
initDb({
  name: 'mysql-prod',
  type: 'mysql',
  options: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    connectionLimit: Number(process.env.MYSQL_CONN_LIMIT) || 10,
    // OR
    url: 'YOUR MYSQL CONNECTION URL'
    // Other pool options as needed
  },
  retryOptions: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    // Other retry parameters if needed
  }
});

// In your service, create an instance of getDbClient
const dbClient = getDbClient('pg-prod');
```

### Methods

#### findFirst

Retrieve the first matching record from a table.

```typescript
import { findFirst } from 'star-db-query-builder'

const result = await findFirst({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    id: { operator: '=', value: 1 },
  },
})

console.log(result)
```

#### findMany

Retrieve multiple records from a table.

```typescript
import { findMany } from 'star-db-query-builder'

const results = await findMany({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    status: { operator: '= ', value: 'active' },
  },
  limit: 10,
  offset: 0,
})

console.log(results)
```

#### insert

Insert a new record into a table.

```typescript
import { insert } from 'star-db-query-builder'

const newUser = { name: 'John Doe', email: 'john@example.com' }

const insertedUser = await insert({
  tableName: 'users',
  dbClient,
  data: newUser,
  returning: ['id', 'name', 'email'],
})

console.log(insertedUser)
```

#### update

Update an existing record in a table.

```typescript
import { update } from 'star-db-query-builder'

const updatedUser = { name: 'John Smith' }

const result = await update({
  tableName: 'users',
  dbClient,
  id: 1,
  data: updatedUser,
  returning: ['id', 'name', 'email'],
})

console.log(result)
```

#### deleteOne

Delete a record from a table.

```typescript
import { deleteOne } from 'star-db-query-builder'

await deleteOne({
  tableName: 'users',
  dbClient,
  id: 1,
  permanently: true,
})

console.log('User deleted')
```

#### joins

Execute a join query.

```typescript
import { joins } from 'star-db-query-builder'

const joinResults = await joins({
  tableName: 'orders',
  dbClient,
  select: ['orders.id', 'users.name'],
  joins: [
    {
      table: 'users',
      on: { 'orders.userId': 'users.id' },
    },
  ],
  where: {
    JOINS: [
      {
        'users.id': { operator: '=', value: exist.user_id },
      },
    ],
  },
})

console.log(joinResults)
```

### Monitoring and Logging

The library provides a monitoring module that emits key events during the lifecycle of connections and queries. You can subscribe to these events to integrate with your logging or monitoring system.

#### Available Events

CONNECTION_CREATED: Emitted when a new connection (pool) is established.
QUERY_START: Emitted just before a query starts executing.
QUERY_END: Emitted after a query completes, including its execution time.
QUERY_ERROR: Emitted when an error occurs during query execution.
RETRY_ATTEMPT: Emitted when a query is retried due to a transient error.

```ts
import { monitor, MonitorEvents } from '@starbemtech/star-db-query-builder'

monitor.on(MonitorEvents.CONNECTION_CREATED, (data) => {
  console.log('Connection created:', data)
})

monitor.on(MonitorEvents.QUERY_START, (data) => {
  console.log('Query started:', data)
})

monitor.on(MonitorEvents.QUERY_END, (data) => {
  console.log('Query finished:', data)
})

monitor.on(MonitorEvents.QUERY_ERROR, (data) => {
  console.error('Query error:', data)
})

monitor.on(MonitorEvents.RETRY_ATTEMPT, (data) => {
  console.warn('Retrying query:', data)
})
```

## Customizing the Retry Strategy

The automatic retry mechanism leverages the promise-retry library. You can customize the following parameters:

- retries: Number of retry attempts.
- factor: Exponential backoff factor.
- minTimeout: Minimum time (in milliseconds) to wait between retry attempts.

These parameters are passed via the retryOptions property when initializing the connection.

## Contributing

Feel free to contribute by opening pull requests or issues with improvements and bug fixes.

## License

This project is licensed under the MIT License.

This documentation explains how to set up connections with external configuration for both connection pool and retry options, retrieve clients to execute queries, and monitor events for logging and diagnostics.

---

👨‍💻 Happy Coding!
