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

#### insertMany

Insert multiple records into a table at once, optimizing performance for batch operations.

#### Parameters

- `tableName`: Name of the table
- `dbClient`: Database client (PostgreSQL or MySQL)
- `data`: Array of objects with the data to be inserted
- `returning` (optional): Array of fields to be returned after insertion

#### Usage Example

```typescript
import { insertMany } from 'star-db-query-builder'

// Data for insertion
const usersData = [
  { name: 'João Silva', email: 'joao@example.com', age: 30 },
  { name: 'Maria Santos', email: 'maria@example.com', age: 25 },
  { name: 'Pedro Costa', email: 'pedro@example.com', age: 35 },
]

// Insert multiple users
const insertedUsers = await insertMany({
  tableName: 'users',
  dbClient: dbClient,
  data: usersData,
  returning: ['id', 'name', 'email', 'created_at'],
})

console.log('Users inserted:', insertedUsers)
```

#### Features

- **Automatic UUID Generation**: Each record receives a unique ID automatically
- **Automatic Timestamp**: The `updated_at` field is filled automatically
- **Support for PostgreSQL and MySQL**: Works with both databases
- **Data Return**: Can return specific fields after insertion
- **Optimized Performance**: Uses a single query to insert all records

#### Database Behavior

**PostgreSQL**: Uses the `RETURNING` clause to return inserted data
**MySQL**: Executes a separate query to fetch inserted records

#### Validations

- Checks if the table name was provided
- Checks if the database client was provided
- Checks if the data array is not empty
- Ensures that all items have the same structure of fields

#### updateMany

Updates multiple records in a table based on a where condition, optimizing performance for batch operations.

#### Parameters

- `tableName`: Name of the table
- `dbClient`: Database client (PostgreSQL or MySQL)
- `data`: Object with the data to be updated
- `where`: Where condition to filter which records to update
- `returning` (optional): Array of fields to be returned after update

#### Usage Example

```typescript
import { updateMany } from 'star-db-query-builder'

// Update data
const updateData = {
  status: 'active',
  updated_at: new Date(),
}

// Where condition
const whereCondition = {
  status: { operator: '=', value: 'pending' },
  created_at: { operator: '<', value: new Date('2024-01-01') },
}

// Update multiple users
const updatedUsers = await updateMany({
  tableName: 'users',
  dbClient: dbClient,
  data: updateData,
  where: whereCondition,
  returning: ['id', 'name', 'email', 'status', 'updated_at'],
})

console.log('Users updated:', updatedUsers)
```

#### Features

- **Batch Update**: Updates multiple records with a single query
- **Conditional Update**: Uses where conditions to filter which records to update
- **Support for PostgreSQL and MySQL**: Works with both databases
- **Data Return**: Can return specific fields after the update
- **Optimized Performance**: Uses a single query to update all matching records

#### Database Behavior

**PostgreSQL**: Uses the `RETURNING` clause to return updated data
**MySQL**: Executes a separate query to fetch updated records

#### Validations

- Checks if the table name was provided
- Checks if the database client was provided
- Checks if the data object was provided
- Checks if the where condition was provided

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

💻 Happy Coding!
