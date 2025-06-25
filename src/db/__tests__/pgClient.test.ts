import { createPgClient } from '../pgClient'
import { Pool } from 'pg'

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn(),
}))

// Mock monitor
jest.mock('../../monitor/monitor', () => ({
  monitor: {
    emit: jest.fn(),
  },
  MonitorEvents: {
    CONNECTION_CREATED: 'CONNECTION_CREATED',
    QUERY_START: 'QUERY_START',
    QUERY_END: 'QUERY_END',
    QUERY_ERROR: 'QUERY_ERROR',
    RETRY_ATTEMPT: 'RETRY_ATTEMPT',
  },
}))

describe('PgClient', () => {
  let mockPool: jest.Mocked<Pool>

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any
    ;(Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createPgClient', () => {
    it('should return client with correct clientType', async () => {
      const client = await createPgClient(mockPool)
      expect(client.clientType).toBe('pg')
    })

    it('should execute query and return rows', async () => {
      const mockRows = [{ id: 1, name: 'John Doe' }]
      mockPool.query.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any)
      const client = await createPgClient(mockPool)
      const result = await client.query('SELECT * FROM users WHERE id = $1', [
        1,
      ])
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      )
      expect(result).toEqual(mockRows)
    })

    it('should handle query without parameters', async () => {
      const mockRows = [{ id: 1, name: 'John Doe' }]
      mockPool.query.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any)
      const client = await createPgClient(mockPool)
      const result = await client.query('SELECT * FROM users')
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users',
        undefined
      )
      expect(result).toEqual(mockRows)
    })

    it('should handle empty result set', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as any)
      const client = await createPgClient(mockPool)
      const result = await client.query('SELECT * FROM users WHERE id = $1', [
        999,
      ])
      expect(result).toEqual([])
    })

    it('should handle query errors', async () => {
      const error = new Error('Database connection failed')
      mockPool.query.mockRejectedValue(error)
      const client = await createPgClient(mockPool)
      await expect(client.query('SELECT * FROM users')).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle retry options', async () => {
      const mockRows = [{ id: 1, name: 'John Doe' }]
      mockPool.query.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any)
      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
      }
      const client = await createPgClient(mockPool, retryOptions)
      const result = await client.query('SELECT * FROM users')
      expect(result).toEqual(mockRows)
    })

    it('should handle transient errors with retry', async () => {
      const transientError = new Error('Connection lost')
      ;(transientError as any).code = 'ECONNRESET'
      const mockRows = [{ id: 1, name: 'John Doe' }]
      // First call fails with transient error, second succeeds
      mockPool.query
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as any)
      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 500,
      }
      const client = await createPgClient(mockPool, retryOptions)
      const result = await client.query('SELECT * FROM users')
      expect(mockPool.query).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockRows)
    })

    it('should throw non-transient errors immediately', async () => {
      const permanentError = new Error('Table does not exist')
      ;(permanentError as any).code = 'ER_NO_SUCH_TABLE'
      mockPool.query.mockRejectedValue(permanentError)
      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 500,
      }
      const client = await createPgClient(mockPool, retryOptions)
      await expect(
        client.query('SELECT * FROM nonexistent_table')
      ).rejects.toThrow('Table does not exist')
      expect(mockPool.query).toHaveBeenCalledTimes(1)
    })

    it('should install unaccent extension when requested', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Extension not found
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Extension created
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as any) // Query result
      const client = await createPgClient(mockPool, undefined, undefined, true)
      await client.query('SELECT * FROM users')
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT 1 FROM pg_extension WHERE extname = 'unaccent'"
        )
      )
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EXTENSION IF NOT EXISTS unaccent')
      )
    })
  })
})
