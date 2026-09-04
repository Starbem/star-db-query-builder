import {
  findFirst,
  findMany,
  insert,
  insertMany,
  update,
  updateMany,
  deleteOne,
  deleteMany,
  joins,
  rawQuery,
  withTransaction,
  beginTransaction,
} from '../repository'
import { IDatabaseClient } from '../../db/IDatabaseClient'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid'),
}))

const createMockDbClient = (
  clientType: 'pg' | 'mysql' = 'pg'
): jest.Mocked<IDatabaseClient> => ({
  clientType,
  query: jest.fn(),
  beginTransaction: jest.fn(),
})

describe('repository', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('findFirst', () => {
    it('throws when tableName is missing', async () => {
      const dbClient = createMockDbClient()
      await expect(
        findFirst({ tableName: '', dbClient } as any)
      ).rejects.toThrow('Table name is required')
    })

    it('throws when dbClient is missing', async () => {
      await expect(
        findFirst({ tableName: 'users', dbClient: undefined } as any)
      ).rejects.toThrow('DB client is required')
    })

    it('rejects a tableName that is not a bare identifier', async () => {
      const dbClient = createMockDbClient()
      await expect(
        findFirst({
          tableName: 'users; DROP TABLE users; --',
          dbClient,
        })
      ).rejects.toThrow(/Invalid table name/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })

    it('returns the first row found', async () => {
      const dbClient = createMockDbClient()
      dbClient.query.mockResolvedValue([{ id: '1', name: 'John' }])

      const result = await findFirst({
        tableName: 'users',
        dbClient,
        where: { status: { operator: '=', value: 'active' } },
      })

      expect(result).toEqual({ id: '1', name: 'John' })
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        ['active']
      )
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active']
      )
    })

    it('returns null when no row is found', async () => {
      const dbClient = createMockDbClient()
      dbClient.query.mockResolvedValue([])

      const result = await findFirst({ tableName: 'users', dbClient })

      expect(result).toBeNull()
    })
  })

  describe('findMany', () => {
    it('returns all rows found with pagination clauses', async () => {
      const dbClient = createMockDbClient()
      const rows = [{ id: '1' }, { id: '2' }]
      dbClient.query.mockResolvedValue(rows)

      const result = await findMany({
        tableName: 'users',
        dbClient,
        select: ['id'],
        limit: 10,
        offset: 5,
        orderBy: [{ field: 'created_at', direction: 'DESC' }],
      })

      expect(result).toEqual(rows)
      const [sql] = dbClient.query.mock.calls[0]
      expect(sql).toContain('SELECT id FROM users')
      expect(sql).toContain('ORDER BY created_at DESC')
      expect(sql).toContain('LIMIT 10')
      expect(sql).toContain('OFFSET 5')
    })

    it('returns an empty array when no rows are found', async () => {
      const dbClient = createMockDbClient()
      dbClient.query.mockResolvedValue(null as any)

      const result = await findMany({ tableName: 'users', dbClient })

      expect(result).toEqual([])
    })
  })

  describe('insert', () => {
    it('throws when data is missing', async () => {
      const dbClient = createMockDbClient()
      await expect(
        insert({ tableName: 'users', dbClient, data: undefined } as any)
      ).rejects.toThrow('Data object is required')
    })

    it('inserts a record for pg and returns the RETURNING row', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([{ id: 'generated-uuid', name: 'John' }])

      const result = await insert({
        tableName: 'users',
        dbClient,
        data: { name: 'John' },
        returning: ['id', 'name'],
      })

      expect(result).toEqual({ id: 'generated-uuid', name: 'John' })
      const [sql, values] = dbClient.query.mock.calls[0] as [string, any[]]
      expect(sql).toContain('INSERT INTO users ("id", "name", "updated_at")')
      expect(sql).toContain('RETURNING id, name')
      expect(values[0]).toBe('generated-uuid')
      expect(values[1]).toBe('John')
    })

    it('quotes reserved-word column names for pg instead of a single hardcoded key', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([{ id: 'generated-uuid' }])

      await insert({
        tableName: 'users',
        dbClient,
        data: { order: 1, group: 'admins', authorization: 'token' },
      })

      const [sql] = dbClient.query.mock.calls[0]
      expect(sql).toContain(
        'INSERT INTO users ("id", "order", "group", "authorization", "updated_at")'
      )
    })

    it('quotes reserved-word column names for mysql using backticks', async () => {
      const dbClient = createMockDbClient('mysql')
      dbClient.query
        .mockResolvedValueOnce({ affectedRows: 1 } as any)
        .mockResolvedValueOnce([{ id: 'generated-uuid' }] as any)

      await insert({
        tableName: 'users',
        dbClient,
        data: { order: 1, group: 'admins' },
      })

      const [sql] = dbClient.query.mock.calls[0]
      expect(sql).toContain(
        'INSERT INTO users (`id`, `order`, `group`, `updated_at`)'
      )
    })

    it('rejects a data key that is not a bare identifier', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        insert({
          tableName: 'users',
          dbClient,
          data: { 'name; DROP TABLE users; --': 'John' },
        })
      ).rejects.toThrow(/Invalid column name/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })

    it('inserts a record for mysql and fetches it back by generated id', async () => {
      const dbClient = createMockDbClient('mysql')
      dbClient.query
        .mockResolvedValueOnce({ affectedRows: 1 } as any) // INSERT
        .mockResolvedValueOnce([{ id: 'generated-uuid', name: 'John' }] as any) // SELECT

      const result = await insert({
        tableName: 'users',
        dbClient,
        data: { name: 'John' },
      })

      expect(result).toEqual({ id: 'generated-uuid', name: 'John' })
      expect(dbClient.query).toHaveBeenCalledTimes(2)
      const [selectSql, selectParams] = dbClient.query.mock.calls[1]
      expect(selectSql).toContain('WHERE')
      expect(selectParams).toEqual(['generated-uuid'])
    })
  })

  describe('insertMany', () => {
    it('throws when data array is empty', async () => {
      const dbClient = createMockDbClient()
      await expect(
        insertMany({ tableName: 'users', dbClient, data: [] })
      ).rejects.toThrow('Data array is required and cannot be empty')
    })

    it('inserts multiple records for pg with unique placeholders per row', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([
        { id: 'generated-uuid', name: 'John' },
        { id: 'generated-uuid', name: 'Jane' },
      ])

      await insertMany({
        tableName: 'users',
        dbClient,
        data: [{ name: 'John' }, { name: 'Jane' }],
        returning: ['id', 'name'],
      })

      const [sql, values] = dbClient.query.mock.calls[0]
      expect(sql).toContain('($1, $2, $3), ($4, $5, $6)')
      expect(values).toHaveLength(6)
    })

    it('aligns values to the first item column order even when a later item declares keys in a different order', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([])

      await insertMany({
        tableName: 'users',
        dbClient,
        data: [
          { name: 'John', email: 'john@example.com' },
          { email: 'jane@example.com', name: 'Jane' },
        ],
      })

      const [, values] = dbClient.query.mock.calls[0] as [string, any[]]
      // row 1: id, name, email, updated_at | row 2: id, name, email, updated_at
      expect(values[1]).toBe('John')
      expect(values[2]).toBe('john@example.com')
      expect(values[5]).toBe('Jane')
      expect(values[6]).toBe('jane@example.com')
    })

    it('throws when an item is missing a key present in the first item', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        insertMany({
          tableName: 'users',
          dbClient,
          data: [{ name: 'John', email: 'john@example.com' }, { name: 'Jane' }],
        })
      ).rejects.toThrow(
        'insertMany: item at index 1 has different keys than the first item. Missing: [email].'
      )
      expect(dbClient.query).not.toHaveBeenCalled()
    })

    it('throws when an item has an unexpected extra key', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        insertMany({
          tableName: 'users',
          dbClient,
          data: [{ name: 'John' }, { name: 'Jane', role: 'admin' }],
        })
      ).rejects.toThrow(
        'insertMany: item at index 1 has different keys than the first item. Unexpected: [role].'
      )
      expect(dbClient.query).not.toHaveBeenCalled()
    })

    it('quotes reserved-word column names for pg', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([{ id: 'generated-uuid' }])

      await insertMany({
        tableName: 'users',
        dbClient,
        data: [{ order: 1 }],
      })

      const [sql] = dbClient.query.mock.calls[0]
      expect(sql).toContain('INSERT INTO users ("id", "order", "updated_at")')
    })

    it('rejects a data key that is not a bare identifier', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        insertMany({
          tableName: 'users',
          dbClient,
          data: [{ 'name; DROP TABLE users; --': 'John' }],
        })
      ).rejects.toThrow(/Invalid column name/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('throws when id is missing', async () => {
      const dbClient = createMockDbClient()
      await expect(
        update({ tableName: 'users', dbClient, id: '', data: { name: 'x' } })
      ).rejects.toThrow('ID is required')
    })

    it('parameterizes the id instead of concatenating it into the SQL string (pg)', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([{ id: '123', name: 'John Updated' }])

      await update({
        tableName: 'users',
        dbClient,
        id: '123',
        data: { name: 'John Updated' },
        returning: ['id', 'name'],
      })

      const [sql, values] = dbClient.query.mock.calls[0]
      expect(sql).toBe(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name'
      )
      expect(sql).not.toContain("'123'")
      expect(values).toEqual(['John Updated', '123'])
    })

    it('parameterizes the id for mysql using ? placeholders', async () => {
      const dbClient = createMockDbClient('mysql')
      dbClient.query
        .mockResolvedValueOnce({ affectedRows: 1 } as any) // UPDATE
        .mockResolvedValueOnce([{ id: '123', name: 'John Updated' }] as any) // SELECT

      await update({
        tableName: 'users',
        dbClient,
        id: '123',
        data: { name: 'John Updated' },
      })

      const [updateSql, updateValues] = dbClient.query.mock.calls[0]
      expect(updateSql).toBe('UPDATE users SET name = ? WHERE id = ?')
      expect(updateValues).toEqual(['John Updated', '123'])
    })

    it('does not let a malicious id string break out of the placeholder (pg)', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([])
      const maliciousId = "1'; DROP TABLE users; --"

      await update({
        tableName: 'users',
        dbClient,
        id: maliciousId,
        data: { name: 'John' },
      })

      const [sql, values] = dbClient.query.mock.calls[0]
      expect(sql).toBe('UPDATE users SET name = $1 WHERE id = $2')
      expect(sql).not.toContain('DROP TABLE')
      expect(values).toEqual(['John', maliciousId])
    })
  })

  describe('updateMany', () => {
    it('throws when where condition is missing', async () => {
      const dbClient = createMockDbClient()
      await expect(
        updateMany({
          tableName: 'users',
          dbClient,
          data: { name: 'x' },
          where: undefined,
        } as any)
      ).rejects.toThrow('Where condition is required')
    })

    it('places WHERE placeholders after SET placeholders', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue([{ id: '1', name: 'John' }])

      await updateMany({
        tableName: 'users',
        dbClient,
        data: { name: 'John' },
        where: { status: { operator: '=', value: 'pending' } },
      })

      const [sql, values] = dbClient.query.mock.calls[0]
      expect(sql).toBe('UPDATE users SET name = $1 WHERE status = $2')
      expect(values).toEqual(['John', 'pending'])
    })
  })

  describe('deleteOne', () => {
    it('soft deletes by default', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue(undefined as any)

      await deleteOne({ tableName: 'users', dbClient, id: '123' })

      expect(dbClient.query).toHaveBeenCalledWith(
        "UPDATE users SET status = 'deleted' WHERE id = $1",
        ['123']
      )
    })

    it('hard deletes when permanently is true', async () => {
      const dbClient = createMockDbClient('mysql')
      dbClient.query.mockResolvedValue(undefined as any)

      await deleteOne({
        tableName: 'users',
        dbClient,
        id: '123',
        permanently: true,
      })

      expect(dbClient.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        ['123']
      )
    })
  })

  describe('deleteMany', () => {
    it('throws when ids array is empty', async () => {
      const dbClient = createMockDbClient()
      await expect(
        deleteMany({ tableName: 'users', dbClient, ids: [] })
      ).rejects.toThrow('IDs are required and cannot be empty')
    })

    it('builds IN clause with one placeholder per id', async () => {
      const dbClient = createMockDbClient('pg')
      dbClient.query.mockResolvedValue(undefined as any)

      await deleteMany({
        tableName: 'users',
        dbClient,
        ids: ['1', '2', '3'],
        permanently: true,
      })

      expect(dbClient.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id IN ($1, $2, $3)',
        ['1', '2', '3']
      )
    })

    it('rejects a field that is not a bare identifier', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        deleteMany({
          tableName: 'users',
          dbClient,
          ids: ['1'],
          field: 'id; DROP TABLE users; --',
        })
      ).rejects.toThrow(/Invalid field/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })
  })

  describe('joins', () => {
    it('builds a query with join clauses', async () => {
      const dbClient = createMockDbClient('pg')
      const rows = [{ id: '1', order_id: '10' }]
      dbClient.query.mockResolvedValue(rows)

      const result = await joins({
        tableName: 'users',
        dbClient,
        select: ['users.id', 'orders.id as order_id'],
        joins: [
          { type: 'INNER', table: 'orders', on: 'users.id = orders.user_id' },
        ],
        where: { status: { operator: '=', value: 'active' } },
      })

      expect(result).toEqual(rows)
      const [sql, values] = dbClient.query.mock.calls[0]
      expect(sql).toContain(
        'INNER JOIN orders ON users.id = orders.user_id'
      )
      expect(sql).toContain('WHERE status = $1')
      expect(values).toEqual(['active'])
    })

    it('rejects an invalid join type', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        joins({
          tableName: 'users',
          dbClient,
          select: ['id'],
          joins: [
            {
              type: 'INNER; DROP TABLE users; --' as any,
              table: 'orders',
              on: 'users.id = orders.user_id',
            },
          ],
        })
      ).rejects.toThrow(/Invalid join type/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })

    it('rejects a join table that is not a bare identifier', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        joins({
          tableName: 'users',
          dbClient,
          select: ['id'],
          joins: [
            {
              type: 'INNER',
              table: 'orders; DROP TABLE users; --',
              on: 'users.id = orders.user_id',
            },
          ],
        })
      ).rejects.toThrow(/Invalid join table/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })

    it('rejects a join ON condition containing a stacked query', async () => {
      const dbClient = createMockDbClient('pg')
      await expect(
        joins({
          tableName: 'users',
          dbClient,
          select: ['id'],
          joins: [
            {
              type: 'INNER',
              table: 'orders',
              on: 'users.id = orders.user_id; DROP TABLE users; --',
            },
          ],
        })
      ).rejects.toThrow(/Invalid join on condition/)
      expect(dbClient.query).not.toHaveBeenCalled()
    })
  })

  describe('rawQuery', () => {
    it('throws when sql is missing', async () => {
      const dbClient = createMockDbClient()
      await expect(
        rawQuery({ dbClient, sql: '' } as any)
      ).rejects.toThrow('SQL query is required and must be a string')
    })

    it('executes the raw sql with params', async () => {
      const dbClient = createMockDbClient()
      dbClient.query.mockResolvedValue([{ total: 5 }])

      const result = await rawQuery({
        dbClient,
        sql: 'SELECT COUNT(*) as total FROM users WHERE status = ?',
        params: ['active'],
      })

      expect(result).toEqual([{ total: 5 }])
      expect(dbClient.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as total FROM users WHERE status = ?',
        ['active']
      )
    })

    it('wraps underlying errors with context', async () => {
      const dbClient = createMockDbClient()
      dbClient.query.mockRejectedValue(new Error('syntax error'))

      await expect(
        rawQuery({ dbClient, sql: 'SELECT * FROM users' })
      ).rejects.toThrow('Raw query execution failed: syntax error')
    })
  })

  describe('withTransaction', () => {
    it('commits when the callback succeeds', async () => {
      const tx = { query: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
      const dbClient = { beginTransaction: jest.fn().mockResolvedValue(tx) }

      const result = await withTransaction(dbClient, async () => 'ok')

      expect(result).toBe('ok')
      expect(tx.commit).toHaveBeenCalled()
      expect(tx.rollback).not.toHaveBeenCalled()
    })

    it('rolls back and rethrows when the callback fails', async () => {
      const tx = { query: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
      const dbClient = { beginTransaction: jest.fn().mockResolvedValue(tx) }
      const error = new Error('boom')

      await expect(
        withTransaction(dbClient, async () => {
          throw error
        })
      ).rejects.toThrow('boom')

      expect(tx.rollback).toHaveBeenCalled()
      expect(tx.commit).not.toHaveBeenCalled()
    })
  })

  describe('beginTransaction', () => {
    it('delegates to dbClient.beginTransaction', async () => {
      const tx = { query: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
      const dbClient = { beginTransaction: jest.fn().mockResolvedValue(tx) }

      const result = await beginTransaction(dbClient)

      expect(result).toBe(tx)
      expect(dbClient.beginTransaction).toHaveBeenCalled()
    })
  })
})
