# Transactions

Execute multiple database operations within a single transaction to ensure data consistency and atomicity.

## Overview

Transactions ensure that a series of database operations either all succeed or all fail together. This is crucial for maintaining data integrity when performing complex operations that involve multiple tables or records.

## Available Methods

### withTransaction

Executes a function within a database transaction with automatic commit/rollback handling.

```typescript
withTransaction<T>(
  dbClient: IDatabaseClient,
  transactionFn: (tx: ITransactionClient) => Promise<T>
): Promise<T>
```

### beginTransaction

Creates a transaction client for manual transaction management.

```typescript
beginTransaction(dbClient: IDatabaseClient): Promise<ITransactionClient>
```

## ITransactionClient Interface

```typescript
interface ITransactionClient {
  query: <T>(sql: string, params?: any[]) => Promise<T>
  commit: () => Promise<void>
  rollback: () => Promise<void>
}
```

## Examples

### Basic Transaction with withTransaction

```typescript
import {
  withTransaction,
  insert,
  update,
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

// Usage
try {
  const result = await createUserWithProfile(
    { name: 'John Doe', email: 'john@example.com' },
    { bio: 'Software developer', location: 'New York' }
  )
  console.log('User and profile created successfully:', result)
} catch (error) {
  console.error('Transaction failed:', error.message)
  // Both user and profile creation were rolled back
}
```

### E-commerce Order Processing

```typescript
const processOrder = async (orderData: any, orderItems: any[]) => {
  return withTransaction(dbClient, async (tx) => {
    // Create order
    const order = await insert({
      tableName: 'orders',
      dbClient: tx,
      data: {
        ...orderData,
        status: 'pending',
        total: 0, // Will be calculated
      },
    })

    let totalAmount = 0

    // Create order items and calculate total
    for (const item of orderItems) {
      const orderItem = await insert({
        tableName: 'order_items',
        dbClient: tx,
        data: {
          ...item,
          order_id: order.id,
        },
      })

      totalAmount += item.price * item.quantity

      // Update product stock
      await update({
        tableName: 'products',
        dbClient: tx,
        id: item.product_id,
        data: {
          stock: { operator: '-', value: item.quantity },
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

### Account Transfer

```typescript
const transferMoney = async (
  fromAccountId: string,
  toAccountId: string,
  amount: number
) => {
  return withTransaction(dbClient, async (tx) => {
    // Check sender balance
    const fromAccount = await findFirst({
      tableName: 'accounts',
      dbClient: tx,
      where: { id: { operator: '=', value: fromAccountId } },
    })

    if (!fromAccount || fromAccount.balance < amount) {
      throw new Error('Insufficient funds')
    }

    // Debit from sender
    await update({
      tableName: 'accounts',
      dbClient: tx,
      id: fromAccountId,
      data: {
        balance: { operator: '-', value: amount },
      },
    })

    // Credit to receiver
    await update({
      tableName: 'accounts',
      dbClient: tx,
      id: toAccountId,
      data: {
        balance: { operator: '+', value: amount },
      },
    })

    // Create transaction record
    const transaction = await insert({
      tableName: 'transactions',
      dbClient: tx,
      data: {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        type: 'transfer',
        status: 'completed',
      },
    })

    return transaction
  })
}
```

### Manual Transaction Management

```typescript
import {
  beginTransaction,
  insert,
  update,
} from '@starbemtech/star-db-query-builder'

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

### Nested Operations with Error Handling

```typescript
const createUserWithMultipleRelations = async (userData: any) => {
  return withTransaction(dbClient, async (tx) => {
    try {
      // Create user
      const user = await insert({
        tableName: 'users',
        dbClient: tx,
        data: userData,
      })

      // Create user preferences
      const preferences = await insert({
        tableName: 'user_preferences',
        dbClient: tx,
        data: {
          user_id: user.id,
          theme: 'dark',
          notifications: true,
        },
      })

      // Create user settings
      const settings = await insert({
        tableName: 'user_settings',
        dbClient: tx,
        data: {
          user_id: user.id,
          language: 'en',
          timezone: 'UTC',
        },
      })

      // Create audit log
      await insert({
        tableName: 'audit_logs',
        dbClient: tx,
        data: {
          user_id: user.id,
          action: 'user_created',
          details: JSON.stringify({ email: user.email }),
        },
      })

      return { user, preferences, settings }
    } catch (error) {
      // Transaction will be automatically rolled back
      console.error('Failed to create user with relations:', error)
      throw error
    }
  })
}
```

### Batch Operations with Transactions

```typescript
const bulkUserCreation = async (usersData: any[]) => {
  return withTransaction(dbClient, async (tx) => {
    const results = []

    for (const userData of usersData) {
      // Create user
      const user = await insert({
        tableName: 'users',
        dbClient: tx,
        data: userData,
      })

      // Create default profile
      const profile = await insert({
        tableName: 'user_profiles',
        dbClient: tx,
        data: {
          user_id: user.id,
          bio: 'New user',
          created_at: new Date(),
        },
      })

      results.push({ user, profile })
    }

    // Create batch audit log
    await insert({
      tableName: 'audit_logs',
      dbClient: tx,
      data: {
        action: 'bulk_user_creation',
        details: JSON.stringify({
          count: usersData.length,
          user_ids: results.map((r) => r.user.id),
        }),
      },
    })

    return results
  })
}
```

### Conditional Transaction Logic

```typescript
const processPayment = async (paymentData: any) => {
  return withTransaction(dbClient, async (tx) => {
    // Create payment record
    const payment = await insert({
      tableName: 'payments',
      dbClient: tx,
      data: {
        ...paymentData,
        status: 'processing',
      },
    })

    // Check if payment amount is above threshold
    if (paymentData.amount > 1000) {
      // Require manual approval for large payments
      await insert({
        tableName: 'payment_approvals',
        dbClient: tx,
        data: {
          payment_id: payment.id,
          status: 'pending',
          requires_approval: true,
        },
      })

      // Update payment status
      await update({
        tableName: 'payments',
        dbClient: tx,
        id: payment.id,
        data: { status: 'pending_approval' },
      })
    } else {
      // Auto-approve small payments
      await update({
        tableName: 'payments',
        dbClient: tx,
        id: payment.id,
        data: { status: 'approved' },
      })

      // Process the payment
      await processApprovedPayment(payment.id, tx)
    }

    return payment
  })
}

const processApprovedPayment = async (
  paymentId: string,
  tx: ITransactionClient
) => {
  // Additional payment processing logic
  await update({
    tableName: 'payments',
    dbClient: tx,
    id: paymentId,
    data: { status: 'completed', processed_at: new Date() },
  })
}
```

## Best Practices

### 1. Keep Transactions Short

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

### 2. Handle Errors Properly

```typescript
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
    if (error.message.includes('duplicate key')) {
      throw new Error('Record already exists')
    }

    throw error
  }
}
```

### 3. Use Appropriate Isolation Levels

```typescript
// For read-heavy operations, consider using read-only transactions
const getReportData = async () => {
  return withTransaction(dbClient, async (tx) => {
    // Set transaction to read-only (database-specific)
    await tx.query('SET TRANSACTION READ ONLY')

    const users = await findMany({
      tableName: 'users',
      dbClient: tx,
      where: { status: { operator: '=', value: 'active' } },
    })

    const orders = await findMany({
      tableName: 'orders',
      dbClient: tx,
      where: { status: { operator: '=', value: 'completed' } },
    })

    return { users, orders }
  })
}
```

### 4. Avoid Nested Transactions

```typescript
// Good: Single transaction for related operations
const createOrderWithItems = async (orderData: any, items: any[]) => {
  return withTransaction(dbClient, async (tx) => {
    const order = await insert({
      tableName: 'orders',
      dbClient: tx,
      data: orderData,
    })

    for (const item of items) {
      await insert({
        tableName: 'order_items',
        dbClient: tx,
        data: { ...item, order_id: order.id },
      })
    }

    return order
  })
}

// Avoid: Nested transactions (not supported by most databases)
const badNestedTransaction = async () => {
  return withTransaction(dbClient, async (tx1) => {
    // ... operations

    return withTransaction(dbClient, async (tx2) => {
      // This won't work as expected
    })
  })
}
```

## Error Handling

### Common Transaction Errors

```typescript
const handleTransactionErrors = async () => {
  try {
    return await withTransaction(dbClient, async (tx) => {
      // Your transaction logic
    })
  } catch (error) {
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

## Performance Considerations

### 1. Connection Pooling

```typescript
// Ensure your database client is configured with proper connection pooling
await initDb({
  type: 'pg',
  options: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'username',
    password: 'password',
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
})
```

### 2. Transaction Timeout

```typescript
// Set appropriate timeouts for transactions
const quickTransaction = async () => {
  return withTransaction(dbClient, async (tx) => {
    // Set a timeout for this transaction
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Transaction timeout')), 5000)
    })

    const transactionPromise = (async () => {
      // Your transaction logic
      return await someOperation(tx)
    })()

    return Promise.race([transactionPromise, timeoutPromise])
  })
}
```

### 3. Batch Operations

```typescript
// For large batch operations, consider processing in chunks
const bulkUpdateWithTransactions = async (
  records: any[],
  chunkSize: number = 100
) => {
  const results = []

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)

    const chunkResult = await withTransaction(dbClient, async (tx) => {
      const chunkResults = []

      for (const record of chunk) {
        const result = await update({
          tableName: 'records',
          dbClient: tx,
          id: record.id,
          data: record.data,
        })
        chunkResults.push(result)
      }

      return chunkResults
    })

    results.push(...chunkResult)
  }

  return results
}
```

## Database-Specific Considerations

### PostgreSQL

- Supports nested transactions (savepoints)
- Has excellent transaction isolation
- Supports advisory locks for complex scenarios

### MySQL

- Uses autocommit mode by default
- Supports different isolation levels
- Has limitations with nested transactions

## Monitoring and Logging

```typescript
// Monitor transaction events
import { monitor, MonitorEvents } from '@starbemtech/star-db-query-builder'

monitor.on(MonitorEvents.TRANSACTION_COMMIT, (data) => {
  console.log('Transaction committed:', data)
})

monitor.on(MonitorEvents.TRANSACTION_ROLLBACK, (data) => {
  console.log('Transaction rolled back:', data)
})

monitor.on(MonitorEvents.QUERY_START, (data) => {
  if (data.inTransaction) {
    console.log('Query in transaction:', data.sql)
  }
})
```

## Summary

Transactions are essential for maintaining data consistency in complex operations. The library provides two main approaches:

1. **`withTransaction`**: Automatic transaction management with commit/rollback
2. **`beginTransaction`**: Manual transaction control for advanced scenarios

Always handle errors properly and keep transactions as short as possible to avoid performance issues and deadlocks.
