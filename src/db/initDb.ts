import { Pool, PoolConfig } from 'pg'
import { createPool as createMySqlPool } from 'mysql2/promise'
import { createPgClient } from './pgClient'
import { createMysqlClient } from './mysqlClient'
import { IDatabaseClient } from './IDatabaseClient'
import { DBClients, RetryOptions } from '../default/types'

const dbClients: Record<string, IDatabaseClient> = {}
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
 *   installUnaccentExtension: true
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
 *   retryOptions: { maxRetries: 3, delay: 1000 }
 * });
 */
export const initDb = async <T>(config: {
  name?: string
  type: DBClients
  options: T
  retryOptions?: RetryOptions
  installUnaccentExtension?: boolean
}): Promise<void> => {
  if (!config.type)
    throw new Error('Type is required. Accept values: pg | mysql')

  if (!config.options) throw new Error('Connection options is required')

  if (config.type === 'pg') {
    const poolConfig = config.options as unknown as PoolConfig
    const pool = new Pool(config.options)
    dbClients[config.name || defaultName] = await createPgClient(
      pool,
      config.retryOptions,
      poolConfig,
      config.installUnaccentExtension
    )

    console.log(
      `@starbemtech/star-db-query-builder: Postgres db client "${config.name}" created successfully`
    )
  } else if (config.type === 'mysql') {
    const pool = createMySqlPool(config.options)
    dbClients[config.name || defaultName] = createMysqlClient(
      pool,
      config.retryOptions
    )

    console.info(
      `@starbemtech/star-db-query-builder: Postgres db client "${config.name}" created successfully`
    )
  } else {
    throw new Error('Unsupported database type')
  }
}

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
 * @returns Promise<void> - Resolves when the database client is successfully initialized
 *
 * @throws {Error} When database type is not provided or is invalid
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
 *   installUnaccentExtension: true
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
 *   retryOptions: { maxRetries: 3, delay: 1000 }
 * });
 */
export const getDbClient = (name?: string): IDatabaseClient => {
  const client = dbClients[name || defaultName]
  if (!client) {
    throw new Error(`Database client "${name}" is not initialized`)
  }

  return client
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
export const getAllDbClients = (): Record<string, IDatabaseClient> => {
  return dbClients
}
