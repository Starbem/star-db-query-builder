# Raw Query - Usage Examples

The `rawQuery` method allows you to execute pure SQL queries directly on the database, offering maximum flexibility for complex cases that cannot be resolved with the standard generic repository methods.

## Import

```typescript
import { rawQuery } from 'star-db-query-builder'
```

## Method Signature

```typescript
rawQuery<T = any>({
  dbClient: IDatabaseClient,
  sql: string,
  params?: any[]
}): Promise<T>
```

## Usage Examples

### 1. Simple Query without Parameters

```typescript
// Find all active users
const activeUsers = await rawQuery({
  dbClient,
  sql: 'SELECT * FROM users WHERE active = true',
})
```

### 2. Query with Parameters

```typescript
// Find specific user
const user = await rawQuery({
  dbClient,
  sql: 'SELECT * FROM users WHERE id = ? AND email = ?',
  params: ['user-123', 'user@example.com'],
})
```

### 3. Aggregation Queries

```typescript
// User statistics
const stats = await rawQuery({
  dbClient,
  sql: `
    SELECT 
      COUNT(*) as total_users,
      AVG(age) as avg_age,
      MIN(created_at) as first_user,
      MAX(created_at) as last_user
    FROM users 
    WHERE created_at >= ?
  `,
  params: [new Date('2023-01-01')],
})
```

### 4. Queries with Complex JOINs

```typescript
// Complex report with multiple JOINs
const report = await rawQuery({
  dbClient,
  sql: `
    SELECT 
      u.name,
      u.email,
      COUNT(o.id) as total_orders,
      SUM(o.total) as total_spent,
      p.name as plan_name
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    LEFT JOIN user_plans up ON u.id = up.user_id
    LEFT JOIN plans p ON up.plan_id = p.id
    WHERE u.created_at >= ?
    GROUP BY u.id, u.name, u.email, p.name
    HAVING COUNT(o.id) > ?
    ORDER BY total_spent DESC
  `,
  params: [new Date('2023-01-01'), 5],
})
```

### 5. Queries with Subqueries

```typescript
// Users with more orders than average
const topUsers = await rawQuery({
  dbClient,
  sql: `
    SELECT 
      u.*,
      COUNT(o.id) as order_count
    FROM users u
    INNER JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    HAVING COUNT(o.id) > (
      SELECT AVG(order_count) 
      FROM (
        SELECT COUNT(*) as order_count 
        FROM orders 
        GROUP BY user_id
      ) as avg_orders
    )
  `,
})
```

### 6. Queries with Window Functions

```typescript
// User ranking by spending
const userRanking = await rawQuery({
  dbClient,
  sql: `
    SELECT 
      u.name,
      u.email,
      SUM(o.total) as total_spent,
      ROW_NUMBER() OVER (ORDER BY SUM(o.total) DESC) as rank,
      PERCENT_RANK() OVER (ORDER BY SUM(o.total) DESC) as percentile
    FROM users u
    INNER JOIN orders o ON u.id = o.user_id
    WHERE o.created_at >= ?
    GROUP BY u.id, u.name, u.email
    ORDER BY total_spent DESC
  `,
  params: [new Date('2023-01-01')],
})
```

### 7. Queries with CTEs (Common Table Expressions)

```typescript
// Monthly growth analysis
const monthlyGrowth = await rawQuery({
  dbClient,
  sql: `
    WITH monthly_stats AS (
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as new_users,
        SUM(total) as revenue
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.created_at >= ?
      GROUP BY DATE_TRUNC('month', created_at)
    ),
    growth_calc AS (
      SELECT 
        month,
        new_users,
        revenue,
        LAG(new_users) OVER (ORDER BY month) as prev_users,
        LAG(revenue) OVER (ORDER BY month) as prev_revenue
      FROM monthly_stats
    )
    SELECT 
      month,
      new_users,
      revenue,
      CASE 
        WHEN prev_users > 0 
        THEN ROUND(((new_users - prev_users)::float / prev_users) * 100, 2)
        ELSE 0 
      END as user_growth_percent,
      CASE 
        WHEN prev_revenue > 0 
        THEN ROUND(((revenue - prev_revenue)::float / prev_revenue) * 100, 2)
        ELSE 0 
      END as revenue_growth_percent
    FROM growth_calc
    ORDER BY month
  `,
  params: [new Date('2023-01-01')],
})
```

### 8. Batch Update Queries

```typescript
// Update status of multiple records
const updateResult = await rawQuery({
  dbClient,
  sql: `
    UPDATE users 
    SET 
      last_login = ?,
      login_count = login_count + 1,
      updated_at = ?
    WHERE id IN (${userIds.map(() => '?').join(',')})
  `,
  params: [new Date(), new Date(), ...userIds],
})
```

### 9. Queries with TypeScript Typing

```typescript
// Define interface for the result
interface UserStats {
  total_users: number
  active_users: number
  avg_age: number
  last_created: Date
}

// Typed query
const stats: UserStats = await rawQuery<UserStats>({
  dbClient,
  sql: `
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN active = true THEN 1 END) as active_users,
      AVG(age) as avg_age,
      MAX(created_at) as last_created
    FROM users
  `,
})
```

### 10. Error Handling

```typescript
try {
  const result = await rawQuery({
    dbClient,
    sql: 'SELECT * FROM non_existent_table',
  })
} catch (error) {
  console.error('Query error:', error.message)
  // The error will be: "Raw query execution failed: [database message]"
}
```

## Important Considerations

### Security

- **ALWAYS** use prepared parameters to avoid SQL injection
- Validate and sanitize data before using in queries
- Avoid concatenating strings directly in SQL

### Performance

- Use `rawQuery` only when necessary
- Consider using appropriate indexes for complex queries
- Monitor the performance of raw queries

### Compatibility

- The method works with PostgreSQL and MySQL
- Database-specific syntax (like `DATE_TRUNC` in PostgreSQL) may not work in other DBMS
- Test queries in different environments

### Limitations

- No automatic type validation
- No automatic query caching
- No automatic retry on failure
- No automatic query logging

## Recommended Use Cases

✅ **Use `rawQuery` when:**

- You need very complex queries with multiple JOINs
- You want to use database-specific functions (window functions, CTEs, etc.)
- You need maximum performance for critical queries
- You want to do complex aggregation queries
- You need queries that don't fit the CRUD pattern

❌ **Avoid `rawQuery` when:**

- You can use the standard repository methods
- The query is simple (basic SELECT, INSERT, UPDATE, DELETE)
- You need automatic type validation
- You want to take advantage of automatic caching
- The query can be reused across different DBMS
