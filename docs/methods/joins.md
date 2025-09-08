# joins

Executes queries with JOIN operations to combine data from multiple tables.

## Signature

```typescript
joins<T>({
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
}): Promise<T[]>
```

## Parameters

| Parameter   | Type              | Required | Description                                        |
| ----------- | ----------------- | -------- | -------------------------------------------------- |
| `tableName` | `string`          | ✅       | Name of the main database table                    |
| `dbClient`  | `IDatabaseClient` | ✅       | Database client instance                           |
| `select`    | `string[]`        | ✅       | Array of field names to select (must be specified) |
| `joins`     | `JoinClause[]`    | ✅       | Array of JOIN clauses                              |
| `where`     | `Conditions<T>`   | ❌       | Conditions to filter records                       |
| `groupBy`   | `string[]`        | ❌       | Fields to group by                                 |
| `orderBy`   | `OrderBy`         | ❌       | Sort order specification                           |
| `limit`     | `number`          | ❌       | Maximum number of records to return                |
| `offset`    | `number`          | ❌       | Number of records to skip                          |
| `unaccent`  | `boolean`         | ❌       | Enable unaccent search for PostgreSQL              |

## JoinClause Interface

```typescript
interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: string
}
```

## Return Value

- **Type**: `Promise<T[]>`
- **Description**: Returns an array of records from the joined tables

## Examples

### Basic JOIN

```typescript
import { joins } from '@starbemtech/star-db-query-builder'

// Get users with their orders
const usersWithOrders = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.id',
    'users.name',
    'users.email',
    'orders.total',
    'orders.created_at',
  ],
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

console.log(usersWithOrders)
// [
//   {
//     id: 'user-1',
//     name: 'John Doe',
//     email: 'john@example.com',
//     total: 150.00,
//     created_at: '2023-12-01T10:00:00.000Z'
//   },
//   // ... more results
// ]
```

### Multiple JOINs

```typescript
// Complex report with multiple tables
const report = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.name',
    'users.email',
    'COUNT(orders.id) as order_count',
    'SUM(orders.total) as total_spent',
    'plans.name as plan_name',
    'plans.price as plan_price',
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
  where: {
    'users.status': { operator: '=', value: 'active' },
  },
  groupBy: [
    'users.id',
    'users.name',
    'users.email',
    'plans.name',
    'plans.price',
  ],
  orderBy: [{ field: 'total_spent', direction: 'DESC' }],
})
```

### Different JOIN Types

```typescript
// INNER JOIN - only users with orders
const usersWithOrders = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'INNER',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})

// LEFT JOIN - all users, with or without orders
const allUsersWithOrders = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})

// RIGHT JOIN - all orders, with or without users
const ordersWithUsers = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'RIGHT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})

// FULL OUTER JOIN - all users and all orders
const allData = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'FULL',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})
```

### Complex WHERE Conditions with JOINs

```typescript
// Users with orders from last month
const recentUsers = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'users.email', 'orders.total', 'orders.created_at'],
  joins: [
    {
      type: 'INNER',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  where: {
    AND: [
      { 'users.status': { operator: '=', value: 'active' } },
      {
        'orders.created_at': { operator: '>=', value: new Date('2023-11-01') },
      },
      { 'orders.total': { operator: '>', value: 100 } },
    ],
  },
  orderBy: [{ field: 'orders.created_at', direction: 'DESC' }],
})
```

### Aggregation with JOINs

```typescript
// User statistics with order data
const userStats = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.id',
    'users.name',
    'COUNT(orders.id) as order_count',
    'SUM(orders.total) as total_spent',
    'AVG(orders.total) as avg_order_value',
    'MAX(orders.created_at) as last_order_date',
  ],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  where: {
    'users.created_at': { operator: '>=', value: new Date('2023-01-01') },
  },
  groupBy: ['users.id', 'users.name'],
  having: {
    'COUNT(orders.id)': { operator: '>', value: 0 },
  },
  orderBy: [{ field: 'total_spent', direction: 'DESC' }],
})
```

### Pagination with JOINs

```typescript
// Paginated user orders
const paginatedOrders = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.name',
    'users.email',
    'orders.id',
    'orders.total',
    'orders.status',
    'orders.created_at',
  ],
  joins: [
    {
      type: 'INNER',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  where: {
    'orders.status': { operator: '=', value: 'completed' },
  },
  limit: 20,
  offset: 0,
  orderBy: [{ field: 'orders.created_at', direction: 'DESC' }],
})
```

### TypeScript Usage

```typescript
interface UserWithOrder {
  user_id: string
  user_name: string
  user_email: string
  order_id: string
  order_total: number
  order_status: string
  order_created_at: Date
}

// Typed usage
const usersWithOrders: UserWithOrder[] = await joins<UserWithOrder>({
  tableName: 'users',
  dbClient,
  select: [
    'users.id as user_id',
    'users.name as user_name',
    'users.email as user_email',
    'orders.id as order_id',
    'orders.total as order_total',
    'orders.status as order_status',
    'orders.created_at as order_created_at',
  ],
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
```

### Error Handling

```typescript
try {
  const result = await joins({
    tableName: 'users',
    dbClient,
    select: ['users.name', 'orders.total'],
    joins: [
      {
        type: 'LEFT',
        table: 'orders',
        on: 'users.id = orders.user_id',
      },
    ],
  })

  console.log(`Found ${result.length} records`)
} catch (error) {
  console.error('Join query error:', error.message)
  // Handle error appropriately
}
```

## Generated SQL Examples

### Simple LEFT JOIN

```sql
SELECT users.id, users.name, users.email, orders.total, orders.created_at
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE users.status = $1
```

### Multiple JOINs with GROUP BY

```sql
SELECT
  users.name,
  users.email,
  COUNT(orders.id) as order_count,
  SUM(orders.total) as total_spent,
  plans.name as plan_name
FROM users
LEFT JOIN orders ON users.id = orders.user_id
LEFT JOIN user_plans ON users.id = user_plans.user_id
LEFT JOIN plans ON user_plans.plan_id = plans.id
WHERE users.status = $1
GROUP BY users.id, users.name, users.email, plans.name
ORDER BY total_spent DESC
```

### Complex WHERE with JOINs

```sql
SELECT users.name, users.email, orders.total, orders.created_at
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE (users.status = $1 AND orders.created_at >= $2 AND orders.total > $3)
ORDER BY orders.created_at DESC
```

## Best Practices

### 1. Always Specify SELECT Fields

```typescript
// Good: Explicit field selection
const result = await joins({
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
})

// Avoid: Not specifying select fields
const result = await joins({
  tableName: 'users',
  dbClient,
  select: [], // This will cause issues
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})
```

### 2. Use Table Aliases for Clarity

```typescript
// Good: Use table prefixes for clarity
const result = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.id as user_id',
    'users.name as user_name',
    'orders.id as order_id',
    'orders.total as order_total',
  ],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})
```

### 3. Choose Appropriate JOIN Types

```typescript
// Use INNER JOIN when you need matching records from both tables
const usersWithOrders = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'INNER', // Only users who have orders
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})

// Use LEFT JOIN when you want all records from the main table
const allUsersWithOrders = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'LEFT', // All users, even those without orders
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})
```

### 4. Use Proper Indexing

```sql
-- Ensure proper indexes exist for JOIN conditions
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX idx_user_plans_plan_id ON user_plans(plan_id);
```

### 5. Handle NULL Values in JOINs

```typescript
// Handle NULL values from LEFT JOINs
const result = await joins({
  tableName: 'users',
  dbClient,
  select: [
    'users.name',
    'COALESCE(orders.total, 0) as total_spent',
    'CASE WHEN orders.id IS NULL THEN 0 ELSE 1 END as has_orders',
  ],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
})
```

## Common Use Cases

### 1. User Dashboard Data

```typescript
const getUserDashboardData = async (userId: string) => {
  return joins({
    tableName: 'users',
    dbClient,
    select: [
      'users.name',
      'users.email',
      'COUNT(orders.id) as total_orders',
      'SUM(orders.total) as total_spent',
      'plans.name as current_plan',
      'plans.price as plan_price',
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
        on: 'users.id = user_plans.user_id AND user_plans.is_active = true',
      },
      {
        type: 'LEFT',
        table: 'plans',
        on: 'user_plans.plan_id = plans.id',
      },
    ],
    where: {
      'users.id': { operator: '=', value: userId },
    },
    groupBy: [
      'users.id',
      'users.name',
      'users.email',
      'plans.name',
      'plans.price',
    ],
  })
}
```

### 2. Sales Report

```typescript
const getSalesReport = async (startDate: Date, endDate: Date) => {
  return joins({
    tableName: 'orders',
    dbClient,
    select: [
      'users.name as customer_name',
      'users.email as customer_email',
      'orders.id as order_id',
      'orders.total as order_total',
      'orders.status as order_status',
      'products.name as product_name',
      'order_items.quantity',
      'order_items.price as item_price',
    ],
    joins: [
      {
        type: 'INNER',
        table: 'users',
        on: 'orders.user_id = users.id',
      },
      {
        type: 'INNER',
        table: 'order_items',
        on: 'orders.id = order_items.order_id',
      },
      {
        type: 'INNER',
        table: 'products',
        on: 'order_items.product_id = products.id',
      },
    ],
    where: {
      AND: [
        { 'orders.created_at': { operator: '>=', value: startDate } },
        { 'orders.created_at': { operator: '<=', value: endDate } },
        { 'orders.status': { operator: '=', value: 'completed' } },
      ],
    },
    orderBy: [{ field: 'orders.created_at', direction: 'DESC' }],
  })
}
```

### 3. Product Analytics

```typescript
const getProductAnalytics = async () => {
  return joins({
    tableName: 'products',
    dbClient,
    select: [
      'products.name as product_name',
      'categories.name as category_name',
      'COUNT(order_items.id) as times_ordered',
      'SUM(order_items.quantity) as total_quantity_sold',
      'SUM(order_items.price * order_items.quantity) as total_revenue',
      'AVG(order_items.price) as avg_price',
    ],
    joins: [
      {
        type: 'LEFT',
        table: 'categories',
        on: 'products.category_id = categories.id',
      },
      {
        type: 'LEFT',
        table: 'order_items',
        on: 'products.id = order_items.product_id',
      },
      {
        type: 'LEFT',
        table: 'orders',
        on: 'order_items.order_id = orders.id AND orders.status = "completed"',
      },
    ],
    groupBy: ['products.id', 'products.name', 'categories.name'],
    having: {
      'COUNT(order_items.id)': { operator: '>', value: 0 },
    },
    orderBy: [{ field: 'total_revenue', direction: 'DESC' }],
  })
}
```

### 4. User Activity Feed

```typescript
const getUserActivityFeed = async (userId: string, limit: number = 50) => {
  return joins({
    tableName: 'users',
    dbClient,
    select: [
      'activity_logs.action',
      'activity_logs.description',
      'activity_logs.created_at',
      'orders.id as order_id',
      'orders.total as order_total',
      'products.name as product_name',
    ],
    joins: [
      {
        type: 'LEFT',
        table: 'activity_logs',
        on: 'users.id = activity_logs.user_id',
      },
      {
        type: 'LEFT',
        table: 'orders',
        on: 'activity_logs.entity_id = orders.id AND activity_logs.entity_type = "order"',
      },
      {
        type: 'LEFT',
        table: 'order_items',
        on: 'orders.id = order_items.order_id',
      },
      {
        type: 'LEFT',
        table: 'products',
        on: 'order_items.product_id = products.id',
      },
    ],
    where: {
      'users.id': { operator: '=', value: userId },
    },
    limit,
    orderBy: [{ field: 'activity_logs.created_at', direction: 'DESC' }],
  })
}
```

## Performance Considerations

### 1. Index Strategy for JOINs

```sql
-- Create indexes on JOIN columns
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX idx_user_plans_plan_id ON user_plans(plan_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_orders_user_status_created ON orders(user_id, status, created_at);
CREATE INDEX idx_order_items_order_product ON order_items(order_id, product_id);
```

### 2. Query Optimization

```typescript
// Good: Use indexed fields in WHERE clauses
const result = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'INNER',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  where: {
    'users.status': { operator: '=', value: 'active' }, // Indexed field
    'orders.created_at': { operator: '>=', value: new Date('2023-01-01') }, // Indexed field
  },
})

// Avoid: Using non-indexed fields in WHERE clauses
const result = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'INNER',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  where: {
    'users.bio': { operator: 'LIKE', value: '%developer%' }, // Non-indexed field
  },
})
```

### 3. Limit Result Sets

```typescript
// Always use LIMIT for large result sets
const result = await joins({
  tableName: 'users',
  dbClient,
  select: ['users.name', 'orders.total'],
  joins: [
    {
      type: 'LEFT',
      table: 'orders',
      on: 'users.id = orders.user_id',
    },
  ],
  limit: 1000, // Prevent memory issues
  orderBy: [{ field: 'users.created_at', direction: 'DESC' }],
})
```

## Error Messages

Common error messages you might encounter:

- `Table name is required` - The `tableName` parameter is missing
- `DB client is required` - The `dbClient` parameter is missing
- `column "field_name" does not exist` - Invalid field name in SELECT or WHERE clause
- `relation "table_name" does not exist` - Invalid table name in JOIN clause
- `syntax error at or near "JOIN"` - Invalid JOIN syntax
- Database-specific errors from the underlying database driver
