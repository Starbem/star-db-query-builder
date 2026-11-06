import {
  initDb,
  getDbClient,
  getAllDbClients,
  closeDb,
  closeAllDbClients,
  resetDbClients,
  DEFAULT_PG_POOL_OPTIONS,
} from '../initDb'
import { EventEmitter } from 'events'
import { Pool } from 'pg'
import { monitor } from '../../monitor/monitor'
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
    POOL_ERROR: 'POOL_ERROR',
  },
}))

describe('initDb / getDbClient / closeDb', () => {
  let mockPgPool: any
  let mockMysqlPool: any

  beforeEach(() => {
    // A real emitter, so tests can fire the pool's 'error' event.
    mockPgPool = Object.assign(new EventEmitter(), {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    })
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

    it('maps queryTimeout onto the pg pool as query_timeout', async () => {
      await initDb({
        type: 'pg',
        options: { host: 'localhost' },
        queryTimeout: 3000,
      })

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'localhost', query_timeout: 3000 })
      )
    })

    it('does not override an explicit query_timeout already set on pg options', async () => {
      await initDb({
        type: 'pg',
        options: { query_timeout: 9000 },
        queryTimeout: 3000,
      })

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({ query_timeout: 9000 })
      )
    })

    it('applies safe pg pool defaults when they are not set', async () => {
      await initDb({ type: 'pg', options: { host: 'localhost' } })

      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        connectionTimeoutMillis: 10_000,
      })
      // pg-pool already closes idle clients after 10s; a longer default
      // would keep more connections open on the database.
      expect(DEFAULT_PG_POOL_OPTIONS).not.toHaveProperty('idleTimeoutMillis')
      expect(DEFAULT_PG_POOL_OPTIONS).not.toHaveProperty('statement_timeout')
      expect(Object.isFrozen(DEFAULT_PG_POOL_OPTIONS)).toBe(true)
    })

    it('keeps the default when an option is explicitly undefined (e.g. unset env var)', async () => {
      await initDb({
        type: 'pg',
        options: { host: 'localhost', connectionTimeoutMillis: undefined },
      })

      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        connectionTimeoutMillis: 10_000,
      })
    })

    it('allows opting out of the connection timeout with 0', async () => {
      await initDb({ type: 'pg', options: { connectionTimeoutMillis: 0 } })

      expect(Pool).toHaveBeenCalledWith({ connectionTimeoutMillis: 0 })
    })

    it('lets explicit pg pool options override the defaults', async () => {
      await initDb({
        type: 'pg',
        options: {
          connectionTimeoutMillis: 2_000,
          idleTimeoutMillis: 5_000,
          application_name: 'accounts-ms:accounts',
        },
      })

      expect(Pool).toHaveBeenCalledWith({
        connectionTimeoutMillis: 2_000,
        idleTimeoutMillis: 5_000,
        application_name: 'accounts-ms:accounts',
      })
    })

    it('reports an idle pg client error instead of crashing the process', async () => {
      const error = new Error(
        'terminating connection due to administrator command'
      )
      await initDb({ name: 'primary', type: 'pg', options: {} })

      // Without a listener, EventEmitter throws on an 'error' event — which
      // is what took the process down on a failover.
      expect(() => mockPgPool.emit('error', error, {})).not.toThrow()
      expect(monitor.emit).toHaveBeenCalledWith('POOL_ERROR', {
        clientType: 'pg',
        clientName: 'primary',
        error,
      })
    })

    it('passes queryTimeout through so every mysql query uses it', async () => {
      mockMysqlPool.execute.mockResolvedValue([[{ id: 1 }], []])

      await initDb({ type: 'mysql', options: {}, queryTimeout: 4000 })
      await getDbClient().query('SELECT 1')

      expect(mockMysqlPool.execute).toHaveBeenCalledWith(
        { sql: 'SELECT 1', timeout: 4000 },
        undefined
      )
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
