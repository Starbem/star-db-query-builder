# NodeJS Star DB Query Builder

🎉 Welcome to the NodeJS Database Library! This library provides a set of robust methods to interact with your database seamlessly. With TypeScript support, it ensures type safety and great developer experience.

## Features

- **TypeScript Declarations**: Ensure type safety and better autocompletion in your IDE.
- **Flexible Configuration**: Easily initialize and configure the database client.
- **Comprehensive CRUD Operations**: Perform Create, Read, Update, Delete operations with ease.
- **Join Queries**: Execute complex join queries effortlessly.

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
import { initDb, getDbClient } from 'star-db-query-builder';

// Use PostgresSQL
initDb({
  type: 'pg',
  options: {
     connectionURL: 'YOUR POSTGRES CONNECTION URL'
  },
});

// User MySQL
initDb({
  type: 'mysql',
  options: {
     url: 'YOUR MYSQL CONNECTION URL'
  },
});

// In your service, create an instance of getDbClient
const dbClient = getDbClient();
```

### Methods

#### findFirst

Retrieve the first matching record from a table.

```typescript
import { findFirst } from 'star-db-query-builder';

const result = await findFirst({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    id: { operator: '=', value: 1 }
  }
});

console.log(result);
```

#### findMany

Retrieve multiple records from a table.

```typescript
import { findMany } from 'star-db-query-builder';

const results = await findMany({
  tableName: 'users',
  dbClient,
  select: ['id', 'name', 'email'],
  where: {
    status: { operator: '= ', value: 'active' }
  },
  limit: 10,
  offset: 0,
});

console.log(results);
```

#### insert

Insert a new record into a table.

```typescript
import { insert } from 'star-db-query-builder';

const newUser = { name: 'John Doe', email: 'john@example.com' };

const insertedUser = await insert({
  tableName: 'users',
  dbClient,
  data: newUser,
  returning: ['id', 'name', 'email'],
});

console.log(insertedUser);
```

#### update

Update an existing record in a table.

```typescript
import { update } from 'star-db-query-builder';

const updatedUser = { name: 'John Smith' };

const result = await update({
  tableName: 'users',
  dbClient,
  id: 1,
  data: updatedUser,
  returning: ['id', 'name', 'email'],
});

console.log(result);
```

#### deleteOne

Delete a record from a table.

```typescript
import { deleteOne } from 'star-db-query-builder';

await deleteOne({
  tableName: 'users',
  dbClient,
  id: 1,
  permanently: true,
});

console.log('User deleted');
```

#### joins

Execute a join query.

```typescript
import { joins } from 'star-db-query-builder';

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
        'users.id': { operator: '=', value: exist.user_id }
      }
    ]
  }
});

console.log(joinResults);
```

## License

This project is licensed under the MIT License.

---

👨‍💻 Happy Coding!
