# 🏗️ Star DB Query Builder Architecture

This document describes the internal architecture of the Star DB Query Builder library, explaining how components relate to each other and how the library works internally.

## 📋 Overview

The library is structured in well-defined layers, following single responsibility principles and low coupling. Each module has a specific responsibility and communicates with other modules through well-defined interfaces.

```
┌─────────────────────────────────────────────────────────────┐
│                    Star DB Query Builder                    │
├─────────────────────────────────────────────────────────────┤
│  📚 Public API (index.ts)                                  │
├─────────────────────────────────────────────────────────────┤
│  🔧 Generic Repository (default/)                          │
│  ├── genericRepository.ts - CRUD Methods                   │
│  ├── types.ts - TypeScript Types                           │
│  └── utils.ts - Query Utilities                            │
├─────────────────────────────────────────────────────────────┤
│  🗄️ Database Clients (db/)                                 │
│  ├── initDb.ts - Connection Initialization                 │
│  ├── pgClient.ts - PostgreSQL Client                       │
│  ├── mysqlClient.ts - MySQL Client                         │
│  └── IDatabaseClient.ts - Client Interface                 │
├─────────────────────────────────────────────────────────────┤
│  📊 Monitoring (monitor/)                                  │
│  └── monitor.ts - Event System                             │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Main Components

### 1. Public API (`index.ts`)

**Responsibility**: Entry point of the library, exports all public functionalities.

**Features**:

- Exports initialization configurations
- Exports generic repository methods
- Exports monitoring system
- Exports TypeScript types

```typescript
// Configs
export * from './src/db/initDb'

// Generic Repository
export * from './src/default/genericRepository'

// Monitor
export * from './src/monitor/monitor'

// Types Definition
export type { PgPoolConfig, MySqlPoolOptions, TypeConditions }
```

### 2. Database Clients (`db/`)

**Responsibility**: Manage connections with different types of databases.

#### `initDb.ts`

- Initializes connection pools for PostgreSQL and MySQL
- Manages multiple named connections
- Configures retry options
- Installs necessary extensions (e.g., unaccent)

#### `IDatabaseClient.ts`

- Interface that defines the contract for database clients
- Ensures consistency between different implementations

#### `pgClient.ts`

- Specific implementation for PostgreSQL
- Support for extensions like unaccent
- Management of placeholders ($1, $2, etc.)
- Handling of PostgreSQL-specific types

#### `mysqlClient.ts`

- Specific implementation for MySQL
- Management of placeholders (?)
- Handling of MySQL-specific types

### 3. Generic Repository (`default/`)

**Responsibility**: Provide generic and type-safe CRUD methods.

#### `genericRepository.ts`

Contains all main methods:

- **`findFirst<T>`**: Finds the first record that matches the criteria
- **`findMany<T>`**: Finds multiple records with pagination
- **`insert<P, R>`**: Inserts a new record
- **`insertMany<P, R>`**: Inserts multiple records in batch
- **`update<P, R>`**: Updates a specific record
- **`updateMany<P, R>`**: Updates multiple records
- **`deleteOne<T>`**: Removes a record (soft/hard delete)
- **`deleteMany<T>`**: Removes multiple records
- **`joins<T>`**: Executes queries with joins

#### `types.ts`

Defines all TypeScript types:

```typescript
export interface RetryOptions {
  retries?: number
  factor?: number
  minTimeout?: number
  maxTimeout?: number
  randomize?: boolean
}

export interface OperatorCondition {
  operator:
    | 'ILIKE'
    | 'LIKE'
    | '='
    | '>'
    | '<'
    | 'IN'
    | 'BETWEEN'
    | '!='
    | '<='
    | '>='
    | 'NOT IN'
    | 'LIKE'
    | 'NOT LIKE'
    | 'IS NULL'
    | 'IS NOT NULL'
    | 'NOT EXISTS'
  value: SimpleValue | SimpleValue[]
}

export type Conditions<T> = {
  [P in keyof T]?: Condition<T[P]>
} & LogicalCondition<T>
```

#### `utils.ts`

Utilities for building SQL queries:

- **`createSelectFields`**: Builds SELECT clause
- **`createWhereClause`**: Builds WHERE clause
- **`createOrderByClause`**: Builds ORDER BY clause
- **`createGroupByClause`**: Builds GROUP BY clause
- **`createLimitClause`**: Builds LIMIT clause
- **`createOffsetClause`**: Builds OFFSET clause
- **`generatePlaceholders`**: Generates placeholders for prepared statements
- **`generateSetClause`**: Builds SET clause for UPDATE

### 4. Monitoring (`monitor/`)

**Responsibility**: Provide event system for monitoring and logging.

#### `monitor.ts`

- EventEmitter for database events
- Available events:
  - `CONNECTION_CREATED`: New connection created
  - `QUERY_START`: Query started
  - `QUERY_END`: Query finished
  - `QUERY_ERROR`: Query error
  - `RETRY_ATTEMPT`: Retry attempt

## 🔄 Data Flow

### 1. Initialization

```
1. initDb() is called with configurations
2. Connection pool is created (PostgreSQL/MySQL)
3. Specific client is instantiated
4. Client is stored in global registry
5. CONNECTION_CREATED event is emitted
```

### 2. Query Execution

```
1. Repository method is called (e.g., findMany)
2. Parameters are validated
3. Utilities build the SQL query
4. QUERY_START event is emitted
5. Query is executed on database client
6. Results are processed
7. QUERY_END event is emitted
8. Results are returned
```

### 3. Error Handling

```
1. Error occurs during execution
2. QUERY_ERROR event is emitted
3. Retry system is triggered (if configured)
4. RETRY_ATTEMPT event is emitted for each attempt
5. If all attempts fail, error is propagated
```

## 🛡️ Security

### SQL Injection Prevention

- **Prepared Statements**: All queries use prepared statements
- **Parameter Binding**: Values are passed as parameters, not concatenated
- **Input Validation**: Input validation before query construction

### Connection Security

- **Connection Pooling**: Secure connection reuse
- **Timeout Configuration**: Configurable timeouts to avoid pending connections
- **SSL Support**: SSL support for PostgreSQL

## ⚡ Performance

### Implemented Optimizations

- **Connection Pooling**: Efficient connection reuse
- **Batch Operations**: Batch operations for better performance
- **Query Optimization**: Optimized query construction
- **Memory Management**: Efficient memory management

### Performance Monitoring

- **Query Timing**: Query execution time measurement
- **Connection Metrics**: Connection usage metrics
- **Error Tracking**: Error and retry tracking

## 🔧 Extensibility

### Adding New Databases

1. Implement `IDatabaseClient` interface
2. Create specific client (e.g., `mongoClient.ts`)
3. Add type to `DBClients` enum
4. Update `initDb.ts` to support new type
5. Add tests for new client

### Adding New Operators

1. Add operator to `OperatorCondition` type
2. Implement logic in `createWhereClause`
3. Add tests for new operator
4. Document usage of new operator

### Adding New Events

1. Add event to `MonitorEvents` enum
2. Emit event at appropriate points
3. Document new event
4. Add usage examples

## 🧪 Testing

### Test Structure

- **Unit Tests**: Individual function tests
- **Integration Tests**: Integration tests with real database
- **Mock Tests**: Mock tests for isolation

### Coverage

- **Functions**: 100% of functions tested
- **Branches**: 90%+ branch coverage
- **Lines**: 95%+ line coverage

## 📊 Metrics and Monitoring

### Collected Metrics

- **Query Performance**: Query execution time
- **Connection Usage**: Connection pool usage
- **Error Rates**: Error rates by type
- **Retry Attempts**: Number of retry attempts

### External System Integration

- **Winston**: Winston integration for logging
- **Prometheus**: Metrics for Prometheus
- **Custom Loggers**: Custom logger support

## 🔮 Technical Roadmap

### Next Versions

- **MongoDB Support**: MongoDB client
- **Redis Support**: Redis client
- **Query Caching**: Query caching system
- **Connection Health Checks**: Connection health checks
- **Performance Metrics**: Detailed performance metrics
- **Migration Tools**: Data migration tools
- **Schema Validation**: Schema validation
- **GraphQL Integration**: GraphQL integration

### Planned Improvements

- **Better Error Messages**: More descriptive error messages
- **Query Optimization**: Additional query optimizations
- **Memory Management**: Better memory management
- **Connection Pool Tuning**: Automatic connection pool tuning

---

<div align="center">
  <p>📚 For more information, see the <a href="README.md">main documentation</a></p>
  <p>🔗 <a href="https://github.com/starbem/star-db-query-builder">GitHub Repository</a></p>
</div>
