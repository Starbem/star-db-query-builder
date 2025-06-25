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
} from '../genericRepository'
import { testUtils } from '../../setupTests'
import { Conditions } from '../types'

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
}))

describe('GenericRepository', () => {
  let mockDbClient: any

  beforeEach(() => {
    mockDbClient = testUtils.createMockDbClient('pg')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('findFirst', () => {
    it('should throw error when tableName is not provided', async () => {
      await expect(
        findFirst({
          tableName: '',
          dbClient: mockDbClient,
        })
      ).rejects.toThrow('Table name is required')
    })

    it('should throw error when dbClient is not provided', async () => {
      await expect(
        findFirst({
          tableName: 'users',
          dbClient: null as any,
        })
      ).rejects.toThrow('DB client is required')
    })

    it('should find first record with basic query', async () => {
      const mockResult = [{ id: '1', name: 'John Doe' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await findFirst({
        tableName: 'users',
        dbClient: mockDbClient,
        select: ['id', 'name'],
      })

      expect(result).toEqual(mockResult[0])
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM users'),
        []
      )
    })

    it('should find first record with WHERE conditions', async () => {
      const mockResult = [{ id: '1', name: 'John Doe' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const conditions: Conditions<any> = {
        status: { operator: '=', value: 'active' },
      }

      const result = await findFirst({
        tableName: 'users',
        dbClient: mockDbClient,
        where: conditions,
      })

      expect(result).toEqual(mockResult[0])
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active']
      )
    })

    it('should return null when no records found', async () => {
      mockDbClient.query.mockResolvedValue([])

      const result = await findFirst({
        tableName: 'users',
        dbClient: mockDbClient,
      })

      expect(result).toBeNull()
    })

    it('should handle ORDER BY clause', async () => {
      const mockResult = [{ id: '1', name: 'John Doe' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await findFirst({
        tableName: 'users',
        dbClient: mockDbClient,
        orderBy: [{ field: 'created_at', direction: 'DESC' }],
      })

      expect(result).toEqual(mockResult[0])
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        []
      )
    })

    it('should handle GROUP BY clause', async () => {
      const mockResult = [{ id: '1', name: 'John Doe' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await findFirst({
        tableName: 'users',
        dbClient: mockDbClient,
        groupBy: ['status'],
      })

      expect(result).toEqual(mockResult[0])
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY status'),
        []
      )
    })
  })

  describe('findMany', () => {
    it('should throw error when tableName is not provided', async () => {
      await expect(
        findMany({
          tableName: '',
          dbClient: mockDbClient,
        })
      ).rejects.toThrow('Table name is required')
    })

    it('should throw error when dbClient is not provided', async () => {
      await expect(
        findMany({
          tableName: 'users',
          dbClient: null as any,
        })
      ).rejects.toThrow('DB client is required')
    })

    it('should find multiple records', async () => {
      const mockResult = [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Jane Smith' },
      ]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await findMany({
        tableName: 'users',
        dbClient: mockDbClient,
        select: ['id', 'name'],
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name FROM users'),
        []
      )
    })

    it('should handle LIMIT and OFFSET', async () => {
      const mockResult = [{ id: '1', name: 'John Doe' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await findMany({
        tableName: 'users',
        dbClient: mockDbClient,
        limit: 10,
        offset: 20,
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10'),
        []
      )
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET 20'),
        []
      )
    })

    it('should return empty array when no records found', async () => {
      mockDbClient.query.mockResolvedValue(null)

      const result = await findMany({
        tableName: 'users',
        dbClient: mockDbClient,
      })

      expect(result).toEqual([])
    })

    it('should handle unaccent parameter', async () => {
      const mockResult = [{ id: '1', name: 'John Doe' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const conditions: Conditions<any> = {
        name: { operator: 'ILIKE', value: '%john%' },
      }

      const result = await findMany({
        tableName: 'users',
        dbClient: mockDbClient,
        where: conditions,
        unaccent: true,
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('unaccent(name::text) ILIKE unaccent($1)'),
        ['%john%']
      )
    })
  })

  describe('insert', () => {
    it('should throw error when tableName is not provided', async () => {
      await expect(
        insert({
          tableName: '',
          dbClient: mockDbClient,
          data: { name: 'John Doe' },
        })
      ).rejects.toThrow('Table name is required')
    })

    it('should throw error when dbClient is not provided', async () => {
      await expect(
        insert({
          tableName: 'users',
          dbClient: null as any,
          data: { name: 'John Doe' },
        })
      ).rejects.toThrow('DB client is required')
    })

    it('should throw error when data is not provided', async () => {
      await expect(
        insert({
          tableName: 'users',
          dbClient: mockDbClient,
          data: null as any,
        })
      ).rejects.toThrow('Data object is required')
    })

    it('should insert record with PostgreSQL', async () => {
      const mockResult = [
        { id: '123e4567-e89b-12d3-a456-426614174000', name: 'John Doe' },
      ]
      mockDbClient.query.mockResolvedValue(mockResult)

      const data = { name: 'John Doe', email: 'john@example.com' }

      const result = await insert({
        tableName: 'users',
        dbClient: mockDbClient,
        data,
        returning: ['id', 'name'],
      })

      expect(result).toEqual(mockResult[0])
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT INTO users (id, name, email, updated_at) VALUES ($1, $2, $3, $4) RETURNING id, name'
        ),
        expect.arrayContaining([
          '123e4567-e89b-12d3-a456-426614174000',
          'John Doe',
          'john@example.com',
        ])
      )
    })

    it('should insert record with MySQL', async () => {
      const mysqlClient = testUtils.createMockDbClient('mysql')
      const mockResult = [
        { id: '123e4567-e89b-12d3-a456-426614174000', name: 'John Doe' },
      ]
      mysqlClient.query.mockResolvedValue(mockResult)

      const data = { name: 'John Doe', email: 'john@example.com' }

      const result = await insert({
        tableName: 'users',
        dbClient: mysqlClient,
        data,
        returning: ['id', 'name'],
      })

      expect(result).toEqual(mockResult[0])
      expect(mysqlClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT INTO users (id, name, email, updated_at) VALUES (?, ?, ?, ?)'
        ),
        expect.arrayContaining([
          '123e4567-e89b-12d3-a456-426614174000',
          'John Doe',
          'john@example.com',
        ])
      )
    })

    it('should handle authorization field with quotes for PostgreSQL', async () => {
      const mockResult = [{ id: '123e4567-e89b-12d3-a456-426614174000' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const data = { authorization: 'Bearer token' }

      await insert({
        tableName: 'users',
        dbClient: mockDbClient,
        data,
      })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('"authorization"'),
        expect.any(Array)
      )
    })
  })

  describe('insertMany', () => {
    it('should insert multiple records', async () => {
      const mockResult = [
        { id: '123e4567-e89b-12d3-a456-426614174000', name: 'John Doe' },
        { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Jane Smith' },
      ]
      mockDbClient.query.mockResolvedValue(mockResult)

      const data = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' },
      ]

      const result = await insertMany({
        tableName: 'users',
        dbClient: mockDbClient,
        data,
        returning: ['id', 'name'],
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT INTO users (id, name, email, updated_at) VALUES'
        ),
        expect.any(Array)
      )
    })
  })

  describe('update', () => {
    it('should update record by ID', async () => {
      const mockResult = [{ id: '1', name: 'John Updated' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const data = { name: 'John Updated' }

      const result = await update({
        tableName: 'users',
        dbClient: mockDbClient,
        id: '1',
        data,
        returning: ['id', 'name'],
      })

      expect(result).toEqual(mockResult[0])
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE users SET name = $1 WHERE id = '1' RETURNING id, name"
        ),
        ['John Updated']
      )
    })

    it('should update record without returning for MySQL', async () => {
      const mysqlClient = testUtils.createMockDbClient('mysql')
      mysqlClient.query
        .mockResolvedValueOnce([]) // UPDATE query
        .mockResolvedValueOnce([{ id: '1', name: 'John Updated' }]) // SELECT query

      const data = { name: 'John Updated' }

      const result = await update({
        tableName: 'users',
        dbClient: mysqlClient,
        id: '1',
        data,
      })

      expect(result).toEqual({ id: '1', name: 'John Updated' })
      expect(mysqlClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET name = ? WHERE id = '1'"),
        ['John Updated']
      )
    })
  })

  describe('updateMany', () => {
    it('should update multiple records with WHERE conditions', async () => {
      const mockResult = [
        { id: '1', name: 'John Updated' },
        { id: '2', name: 'Jane Updated' },
      ]
      mockDbClient.query.mockResolvedValue(mockResult)

      const data = { status: 'inactive' }
      const conditions: Conditions<any> = {
        status: { operator: '=', value: 'active' },
      }

      const result = await updateMany({
        tableName: 'users',
        dbClient: mockDbClient,
        data,
        where: conditions,
        returning: ['id', 'name'],
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE users SET status = $1  WHERE status = $2 RETURNING id, name'
        ),
        ['inactive', 'active']
      )
    })
  })

  describe('deleteOne', () => {
    it('should soft delete record by ID', async () => {
      mockDbClient.query.mockResolvedValue([])

      await deleteOne({
        tableName: 'users',
        dbClient: mockDbClient,
        id: '1',
      })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE users SET status = 'deleted' WHERE id = $1"
        ),
        ['1']
      )
    })

    it('should permanently delete record by ID', async () => {
      mockDbClient.query.mockResolvedValue([])

      await deleteOne({
        tableName: 'users',
        dbClient: mockDbClient,
        id: '1',
        permanently: true,
      })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users WHERE id = $1'),
        ['1']
      )
    })
  })

  describe('deleteMany', () => {
    it('should soft delete multiple records by IDs', async () => {
      mockDbClient.query.mockResolvedValue([])

      await deleteMany({
        tableName: 'users',
        dbClient: mockDbClient,
        ids: ['1', '2', '3'],
      })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE users SET status = 'deleted' WHERE id IN ($1, $2, $3)"
        ),
        ['1', '2', '3']
      )
    })

    it('should permanently delete multiple records by IDs', async () => {
      mockDbClient.query.mockResolvedValue([])

      await deleteMany({
        tableName: 'users',
        dbClient: mockDbClient,
        ids: ['1', '2', '3'],
        permanently: true,
      })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users WHERE id IN ($1, $2, $3)'),
        ['1', '2', '3']
      )
    })

    it('should delete by custom field', async () => {
      mockDbClient.query.mockResolvedValue([])

      await deleteMany({
        tableName: 'users',
        dbClient: mockDbClient,
        ids: ['john@example.com', 'jane@example.com'],
        field: 'email',
      })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE users SET status = 'deleted' WHERE email IN ($1, $2)"
        ),
        ['john@example.com', 'jane@example.com']
      )
    })
  })

  describe('joins', () => {
    it('should execute query with JOINs', async () => {
      const mockResult = [{ id: '1', name: 'John Doe', role_name: 'Admin' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await joins({
        tableName: 'users',
        dbClient: mockDbClient,
        select: ['users.id', 'users.name', 'roles.name as role_name'],
        joins: [
          {
            type: 'INNER',
            table: 'roles',
            on: 'users.role_id = roles.id',
          },
        ],
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT users.id, users.name, roles.name as role_name FROM users INNER JOIN roles ON users.role_id = roles.id'
        ),
        []
      )
    })

    it('should handle multiple JOINs', async () => {
      const mockResult = [{ id: '1', name: 'John Doe', department_name: 'IT' }]
      mockDbClient.query.mockResolvedValue(mockResult)

      const result = await joins({
        tableName: 'users',
        dbClient: mockDbClient,
        select: [
          'users.id',
          'users.name',
          'departments.name as department_name',
        ],
        joins: [
          {
            type: 'INNER',
            table: 'roles',
            on: 'users.role_id = roles.id',
          },
          {
            type: 'LEFT',
            table: 'departments',
            on: 'users.department_id = departments.id',
          },
        ],
      })

      expect(result).toEqual(mockResult)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'INNER JOIN roles ON users.role_id = roles.id LEFT JOIN departments ON users.department_id = departments.id'
        ),
        []
      )
    })
  })
})
