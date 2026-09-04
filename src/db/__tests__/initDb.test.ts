import {
  initDb,
  getDbClient,
  getAllDbClients,
  closeDb,
  closeAllDbClients,
  resetDbClients,
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
    // Without this, the module-level client/pool registry would leak
    // between tests, forcing every test in this file to invent a unique
    // name just to avoid colliding with clients registered by earlier tests.
    resetDbClients()
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

    it('registers a pg client under the default name', async () => {
      await initDb({ type: 'pg', options: {} })
      expect(getDbClient().clientType).toBe('pg')
    })

    it('registers a named mysql client', async () => {
      await initDb({ name: 'secondary', type: 'mysql', options: {} })
      expect(getDbClient('secondary').clientType).toBe('mysql')
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
      await initDb({ type: 'pg', options: {} })
      await initDb({ name: 'secondary', type: 'mysql', options: {} })

      const clients = getAllDbClients()

      expect(Object.keys(clients)).toEqual(
        expect.arrayContaining(['default', 'secondary'])
      )
    })
  })

  describe('closeDb', () => {
    it('ends the pg pool and removes the client from the registry', async () => {
      await initDb({ type: 'pg', options: {} })

      await closeDb()

      expect(mockPgPool.end).toHaveBeenCalled()
      expect(() => getDbClient()).toThrow(
        'Database client "default" is not initialized'
      )
    })

    it('ends the mysql pool and removes the client from the registry', async () => {
      await initDb({ name: 'secondary', type: 'mysql', options: {} })

      await closeDb('secondary')

      expect(mockMysqlPool.end).toHaveBeenCalled()
      expect(() => getDbClient('secondary')).toThrow(
        'Database client "secondary" is not initialized'
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
      await initDb({ type: 'pg', options: {} })
      await initDb({ name: 'secondary', type: 'mysql', options: {} })

      await closeAllDbClients()

      expect(mockPgPool.end).toHaveBeenCalled()
      expect(mockMysqlPool.end).toHaveBeenCalled()
      expect(() => getDbClient()).toThrow()
      expect(() => getDbClient('secondary')).toThrow()
    })
  })

  describe('resetDbClients', () => {
    it('clears the registry without calling pool.end()', async () => {
      await initDb({ type: 'pg', options: {} })

      resetDbClients()

      expect(mockPgPool.end).not.toHaveBeenCalled()
      expect(() => getDbClient()).toThrow(
        'Database client "default" is not initialized'
      )
      expect(getAllDbClients()).toEqual({})
    })

    it('lets a name be reused right away without awaiting a real close', async () => {
      await initDb({ type: 'pg', options: {} })
      resetDbClients()

      await initDb({ name: 'default', type: 'mysql', options: {} })

      expect(getDbClient().clientType).toBe('mysql')
    })
  })
})
