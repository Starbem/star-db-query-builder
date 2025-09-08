import { createMysqlClient } from '../mysqlClient'
import { createPool, Pool } from 'mysql2/promise'

// Mock mysql2 module
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(),
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
    TRANSACTION_COMMIT: 'TRANSACTION_COMMIT',
    TRANSACTION_ROLLBACK: 'TRANSACTION_ROLLBACK',
  },
}))

describe('MySqlClient', () => {
  let mockPool: jest.Mocked<Pool>

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      execute: jest.fn(),
      getConnection: jest.fn(),
      config: {},
    } as any
    ;(createPool as jest.MockedFunction<typeof createPool>).mockReturnValue(
      mockPool
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createMysqlClient', () => {
    it('should return client with correct clientType', () => {
      const client = createMysqlClient(mockPool)

      expect(client.clientType).toBe('mysql')
    })

    it('should execute query and return rows', async () => {
      const mockRows = [{ id: 1, name: 'John Doe' }]
      mockPool.execute.mockResolvedValue([mockRows, []] as any)

      const client = createMysqlClient(mockPool)
      const result = await client.query('SELECT * FROM users WHERE id = ?', [1])

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        [1]
      )
      expect(result).toEqual(mockRows)
    })

    it('should handle query without parameters', async () => {
      const mockRows = [{ id: 1, name: 'John Doe' }]
      mockPool.execute.mockResolvedValue([mockRows, []] as any)

      const client = createMysqlClient(mockPool)
      const result = await client.query('SELECT * FROM users')

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users',
        undefined
      )
      expect(result).toEqual(mockRows)
    })

    it('should handle empty result set', async () => {
      mockPool.execute.mockResolvedValue([[], []] as any)

      const client = createMysqlClient(mockPool)
      const result = await client.query('SELECT * FROM users WHERE id = ?', [
        999,
      ])

      expect(result).toEqual([])
    })

    it('should handle query errors', async () => {
      const error = new Error('Database connection failed')
      mockPool.execute.mockRejectedValue(error)

      const client = createMysqlClient(mockPool)

      await expect(client.query('SELECT * FROM users')).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle retry options', async () => {
      const mockRows = [{ id: 1, name: 'John Doe' }]
      mockPool.execute.mockResolvedValue([mockRows, []] as any)

      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
      }

      const client = createMysqlClient(mockPool, retryOptions)
      const result = await client.query('SELECT * FROM users')

      expect(result).toEqual(mockRows)
    })

    it('should handle transient errors with retry', async () => {
      const transientError = new Error('Connection lost')
      ;(transientError as any).code = 'ECONNRESET'

      const mockRows = [{ id: 1, name: 'John Doe' }]

      // First call fails with transient error, second succeeds
      mockPool.execute
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce([mockRows, []] as any)

      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 500,
      }

      const client = createMysqlClient(mockPool, retryOptions)
      const result = await client.query('SELECT * FROM users')

      expect(mockPool.execute).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockRows)
    })

    it('should throw non-transient errors immediately', async () => {
      const permanentError = new Error('Table does not exist')
      ;(permanentError as any).code = 'ER_NO_SUCH_TABLE'

      mockPool.execute.mockRejectedValue(permanentError)

      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 500,
      }

      const client = createMysqlClient(mockPool, retryOptions)

      await expect(
        client.query('SELECT * FROM nonexistent_table')
      ).rejects.toThrow('Table does not exist')
      expect(mockPool.execute).toHaveBeenCalledTimes(1)
    })

    describe('beginTransaction', () => {
      let mockConnection: any

      beforeEach(() => {
        mockConnection = {
          execute: jest.fn(),
          beginTransaction: jest.fn(),
          commit: jest.fn(),
          rollback: jest.fn(),
          release: jest.fn(),
        }
        mockPool.getConnection.mockResolvedValue(mockConnection)
      })

      it('should create a transaction client', async () => {
        const client = createMysqlClient(mockPool)
        const transaction = await client.beginTransaction()

        expect(mockPool.getConnection).toHaveBeenCalled()
        expect(mockConnection.beginTransaction).toHaveBeenCalled()
        expect(transaction).toHaveProperty('query')
        expect(transaction).toHaveProperty('commit')
        expect(transaction).toHaveProperty('rollback')
      })

      it('should execute queries within transaction', async () => {
        const mockRows = [{ id: 1, name: 'John Doe' }]
        mockConnection.execute.mockResolvedValue([mockRows, []])

        const client = createMysqlClient(mockPool)
        const transaction = await client.beginTransaction()
        const result = await transaction.query(
          'SELECT * FROM users WHERE id = ?',
          [1]
        )

        expect(mockConnection.execute).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE id = ?',
          [1]
        )
        expect(result).toEqual(mockRows)
      })

      it('should commit transaction successfully', async () => {
        const client = createMysqlClient(mockPool)
        const transaction = await client.beginTransaction()
        await transaction.commit()

        expect(mockConnection.commit).toHaveBeenCalled()
        expect(mockConnection.release).toHaveBeenCalled()
      })

      it('should rollback transaction on error', async () => {
        const client = createMysqlClient(mockPool)
        const transaction = await client.beginTransaction()
        await transaction.rollback()

        expect(mockConnection.rollback).toHaveBeenCalled()
        expect(mockConnection.release).toHaveBeenCalled()
      })

      it('should release connection even if commit fails', async () => {
        const commitError = new Error('Commit failed')
        mockConnection.commit.mockRejectedValue(commitError)

        const client = createMysqlClient(mockPool)
        const transaction = await client.beginTransaction()

        await expect(transaction.commit()).rejects.toThrow('Commit failed')
        expect(mockConnection.release).toHaveBeenCalled()
      })

      it('should release connection even if rollback fails', async () => {
        const rollbackError = new Error('Rollback failed')
        mockConnection.rollback.mockRejectedValue(rollbackError)

        const client = createMysqlClient(mockPool)
        const transaction = await client.beginTransaction()

        await expect(transaction.rollback()).rejects.toThrow('Rollback failed')
        expect(mockConnection.release).toHaveBeenCalled()
      })

      it('should release connection if beginTransaction fails', async () => {
        const beginError = new Error('Begin transaction failed')
        mockConnection.beginTransaction.mockRejectedValue(beginError)

        const client = createMysqlClient(mockPool)

        await expect(client.beginTransaction()).rejects.toThrow(
          'Begin transaction failed'
        )
        expect(mockConnection.release).toHaveBeenCalled()
      })
    })
  })
})
