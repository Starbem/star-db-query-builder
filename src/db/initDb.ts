import { Pool, PoolConfig } from 'pg'
import { createPool as createMySqlPool } from 'mysql2/promise'
import { createPgClient } from './pgClient'
import { createMysqlClient } from './mysqlClient'
import { IDatabaseClient } from './IDatabaseClient'
import { DBClients, RetryOptions } from '../core/types'

interface ClosablePool {
  end: () => Promise<void>
}

const dbClients: Record<string, IDatabaseClient> = {}
const dbPools: Record<string, ClosablePool> = {}
const defaultName = 'default'

/**
 * Initialize a database client with the specified configuration
 *
 * @template T - The type of connection options (PoolConfig for PostgreSQL or PoolOptions for MySQL)
 * @param config - Configuration object for database initialization
 * @param config.name - Optional name for the database client (defaults to 'default')
 * @param config.type - Database type ('pg' for PostgreSQL or 'mysql' for MySQL)
 * @param config.options - Connection options specific to the database type
 * @param config.retryOptions - Optional retry configuration for failed queries
 * @param config.installUnaccentExtension - Optional flag to install unaccent extension (PostgreSQL only)
 * @param config.queryTimeout - Optional query timeout in milliseconds, applied to every query run through this client. For PostgreSQL this maps onto the pool's `query_timeout` (an explicit `query_timeout` in `options` takes precedence). For MySQL, since mysql2 has no pool-wide query timeout, it is passed as the `timeout` option on every individual query.
 * @returns Promise<void> - Resolves when the database client is successfully initialized
 *
 * @throws {Error} When type is not provided or is invalid
 * @throws {Error} When connection options are not provided
 * @throws {Error} When an unsupported database type is specified
 *
 * @example
 * // Initialize PostgreSQL client
 * await initDb({
 *   name: 'myPostgresDb',
 *   type: 'pg',
 *   options: {
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'mydb',
 *     user: 'user',
 *     password: 'password'
 *   },
 *   retryOptions: { maxRetries: 3, delay: 1000 },
 *   installUnaccentExtension: true,
 *   queryTimeout: 5000
 * });
 *
 * @example
 * // Initialize MySQL client
 * await initDb({
 *   name: 'myMysqlDb',
 *   type: 'mysql',
 *   options: {
 *     host: 'localhost',
 *     port: 3306,
 *     database: 'mydb',
 *     user: 'user',
 *     password: 'password'
 *   },
 *   retryOptions: { maxRetries: 3, delay: 1000 },
 *   queryTimeout: 5000
 * });
 */
export const initDb = async <T>(config: {
  name?: string
  type: DBClients
  options: T
  retryOptions?: RetryOptions
  installUnaccentExtension?: boolean
  queryTimeout?: number
}): Promise<void> => {
  if (!config.type)
    throw new Error('Type is required. Accept values: pg | mysql')

  if (!config.options) throw new Error('Connection options is required')

  const key = config.name || defaultName

  if (config.type === 'pg') {
    const options = config.options as unknown as PoolConfig
    const poolConfig: PoolConfig =
      config.queryTimeout && options.query_timeout === undefined
        ? { ...options, query_timeout: config.queryTimeout }
        : options
    const pool = new Pool(poolConfig)
    dbClients[key] = await createPgClient(
      pool,
      config.retryOptions,
      poolConfig,
      config.installUnaccentExtension
    )
    dbPools[key] = pool
  } else if (config.type === 'mysql') {
    const pool = createMySqlPool(config.options)
    dbClients[key] = createMysqlClient(
      pool,
      config.retryOptions,
      config.queryTimeout
    )
    dbPools[key] = pool
  } else {
    throw new Error('Unsupported database type')
  }
}

/**
 * Retrieves a specific database client by name
 *
 * @param name - Optional name of the database client to retrieve. If not provided, returns the default client
 * @returns IDatabaseClient - The requested database client instance
 *
 * @throws {Error} When the specified database client name is not found or not initialized
 *
 * @example
 * // Get default database client
 * const defaultClient = getDbClient();
 *
 * @example
 * // Get specific database client by name
 * const postgresClient = getDbClient('myPostgresDb');
 * const mysqlClient = getDbClient('myMysqlDb');
 *
 * @example
 * // Handle error when client is not found
 * try {
 *   const client = getDbClient('nonExistentDb');
 * } catch (error) {
 *   console.error('Database client not found:', error.message);
 * }
 */
export const getDbClient = (name?: string): IDatabaseClient => {
  const key = name || defaultName
  const client = dbClients[key]
  if (!client) {
    throw new Error(`Database client "${key}" is not initialized`)
  }

  return client
}

/**
 * Retrieves every registered database client, keyed by name
 *
 * @returns Record<string, IDatabaseClient> - A map of all initialized database clients, keyed by the name they were registered under (including 'default')
 *
 * @example
 * const clients = getAllDbClients();
 * const names = Object.keys(clients); // ['default', 'myPostgresDb', 'myMysqlDb']
 */
export const getAllDbClients = (): Record<string, IDatabaseClient> => {
  return dbClients
}

/**
 * Closes a database client's connection pool and removes it from the registry
 *
 * Use this to release connections gracefully on application shutdown or
 * between tests, since `initDb` has no other way to release the pools it
 * creates.
 *
 * @param name - Optional name of the database client to close. If not provided, closes the default client
 * @returns Promise<void> - Resolves when the pool has been closed
 *
 * @throws {Error} When the specified database client name is not found or not initialized
 *
 * @example
 * await closeDb() // closes the default client
 *
 * @example
 * await closeDb('myPostgresDb')
 */
export const closeDb = async (name?: string): Promise<void> => {
  const key = name || defaultName
  const pool = dbPools[key]

  if (!pool) {
    throw new Error(`Database client "${key}" is not initialized`)
  }

  await pool.end()
  delete dbPools[key]
  delete dbClients[key]
}

/**
 * Closes every registered database client's connection pool
 *
 * @returns Promise<void> - Resolves when all pools have been closed
 *
 * @example
 * await closeAllDbClients()
 */
export const closeAllDbClients = async (): Promise<void> => {
  await Promise.all(Object.keys(dbPools).map((key) => closeDb(key)))
}

/**
 * Clears the in-memory client/pool registry without closing any connection
 *
 * This is a synchronous escape hatch for test suites and hot-reload tooling
 * that need a clean registry between runs (e.g. calling `initDb` again with
 * the same name without first awaiting a real `closeDb`). It does NOT call
 * `pool.end()`, so any real (non-mocked) connection pool that was registered
 * is orphaned — leaked, not released. Production code that wants to release
 * connections should use `closeDb`/`closeAllDbClients` instead.
 *
 * @example
 * afterEach(() => {
 *   resetDbClients() // test isolation only — pools here are mocked
 * })
 */
export const resetDbClients = (): void => {
  Object.keys(dbClients).forEach((key) => delete dbClients[key])
  Object.keys(dbPools).forEach((key) => delete dbPools[key])
}
