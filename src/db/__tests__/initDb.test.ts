import {
  initDb,
  getDbClient,
  getAllDbClients,
  closeDb,
  closeAllDbClients,
} from '../initDb'
import { Pool } from 'pg'
import { createPool as createMySqlPool } from 'mysql2/promise'

jest.mock('pg', () => ({
  Pool: jest.fn(),
}))

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(),
}))

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

describe('initDb / getDbClient / closeDb', () => {
  let mockPgPool: any
  let mockMysqlPool: any

  beforeEach(() => {
    mockPgPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    }
    mockMysqlPool = {
      execute: jest.fn(),
      getConnection: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
      config: {},
    }
    ;(Pool as jest.MockedClass<typeof Pool>).mockImplementation(
      () => mockPgPool
    )
    ;(createMySqlPool as jest.Mock).mockReturnValue(mockMysqlPool)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initDb', () => {
    it('throws when type is missing', async () => {
      await expect(initDb({ options: {} } as any)).rejects.toThrow(
        'Type is required. Accept values: pg | mysql'
      )
    })

    it('throws when options are missing', async () => {
      await expect(initDb({ type: 'pg' } as any)).rejects.toThrow(
        'Connection options is required'
      )
    })

    it('throws for an unsupported database type', async () => {
      await expect(
        initDb({ type: 'oracle' as any, options: {} })
      ).rejects.toThrow('Unsupported database type')
    })

    it('registers a named pg client', async () => {
      await initDb({ name: 'init-pg-1', type: 'pg', options: {} })
      expect(getDbClient('init-pg-1').clientType).toBe('pg')
    })

    it('registers a named mysql client', async () => {
      await initDb({ name: 'init-mysql-1', type: 'mysql', options: {} })
      expect(getDbClient('init-mysql-1').clientType).toBe('mysql')
    })
  })

  describe('getDbClient', () => {
    it('throws when the client is not initialized', () => {
      expect(() => getDbClient('never-registered')).toThrow(
        'Database client "never-registered" is not initialized'
      )
    })

    it('names the default client in the error when no name is given', () => {
      expect(() => getDbClient()).toThrow(
        'Database client "default" is not initialized'
      )
    })
  })

  describe('getAllDbClients', () => {
    it('returns every registered client', async () => {
      await initDb({ name: 'all-a', type: 'pg', options: {} })
      await initDb({ name: 'all-b', type: 'mysql', options: {} })

      const clients = getAllDbClients()

      expect(Object.keys(clients)).toEqual(
        expect.arrayContaining(['all-a', 'all-b'])
      )
    })
  })

  describe('closeDb', () => {
    it('ends the pg pool and removes the client from the registry', async () => {
      await initDb({ name: 'close-pg-1', type: 'pg', options: {} })

      await closeDb('close-pg-1')

      expect(mockPgPool.end).toHaveBeenCalled()
      expect(() => getDbClient('close-pg-1')).toThrow(
        'Database client "close-pg-1" is not initialized'
      )
    })

    it('ends the mysql pool and removes the client from the registry', async () => {
      await initDb({ name: 'close-mysql-1', type: 'mysql', options: {} })

      await closeDb('close-mysql-1')

      expect(mockMysqlPool.end).toHaveBeenCalled()
      expect(() => getDbClient('close-mysql-1')).toThrow(
        'Database client "close-mysql-1" is not initialized'
      )
    })

    it('closes the default client when no name is given', async () => {
      await initDb({ type: 'pg', options: {} })

      await closeDb()

      expect(mockPgPool.end).toHaveBeenCalled()
      expect(() => getDbClient()).toThrow(
        'Database client "default" is not initialized'
      )
    })

    it('throws when the client is not initialized', async () => {
      await expect(closeDb('never-existed')).rejects.toThrow(
        'Database client "never-existed" is not initialized'
      )
    })
  })

  describe('closeAllDbClients', () => {
    it('closes every registered pool', async () => {
      await initDb({ name: 'close-all-x', type: 'pg', options: {} })
      await initDb({ name: 'close-all-y', type: 'mysql', options: {} })

      await closeAllDbClients()

      expect(mockPgPool.end).toHaveBeenCalled()
      expect(mockMysqlPool.end).toHaveBeenCalled()
      expect(() => getDbClient('close-all-x')).toThrow()
      expect(() => getDbClient('close-all-y')).toThrow()
    })
  })
})
