import { Pool, PoolConfig, PoolClient } from 'pg'
import promiseRetry from 'promise-retry'
import { IDatabaseClient, ITransactionClient } from './IDatabaseClient'
import { RetryOptions } from '../core/types'
import { monitor, MonitorEvents } from '../monitor/monitor'

const transientErrorCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'])

/**
 * Checks if the given error is a transient error that can be retried
 *
 * Transient errors are temporary network or connection issues that typically
 * resolve themselves and can be safely retried. This function checks if the
 * error code matches known transient error patterns for PostgreSQL connections.
 *
 * @param error - The error object to check
 * @returns boolean - True if the error is transient and can be retried, false otherwise
 *
 * @example
 * try {
 *   const result = await pool.query(sql, params);
 * } catch (error) {
 *   if (isTransientError(error)) {
 *     // Retry the operation
 *     console.log('Transient error detected, retrying...');
 *   } else {
 *     // Handle permanent error
 *     throw error;
 *   }
 * }
 */
function isTransientError(error: any): boolean {
  return error && error.code && transientErrorCodes.has(error.code)
}

/**
 * Ensures that the unaccent extension is installed in the PostgreSQL database
 *
 * This function checks if the unaccent extension is installed in the database
 * and installs it if it is not. It also emits a connection created event to
 * the monitor.
 *
 * @param pool - The PostgreSQL pool instance
 * @returns Promise<void> - Resolves when the unaccent extension is installed or already exists
 *
 * @example
 * await ensureUnaccentExtension(pool);
 */
async function ensureUnaccentExtension(pool: Pool): Promise<void> {
  try {
    const checkResult = await pool.query(`
      SELECT 1 FROM pg_extension WHERE extname = 'unaccent'
    `)

    if (checkResult.rows.length === 0) {
      await pool.query('CREATE EXTENSION IF NOT EXISTS unaccent')

      monitor.emit(MonitorEvents.CONNECTION_CREATED, {
        clientType: 'pg',
        extension: 'unaccent',
        status: 'installed',
      })

      console.info(
        '@starbemtech/star-db-query-builder: Extensão unaccent instalada com sucesso.'
      )
    }
  } catch (error) {
    monitor.emit(MonitorEvents.QUERY_ERROR, {
      clientType: 'pg',
      action: 'install_unaccent',
      error,
    })
    throw new Error(
      `@starbemtech/star-db-query-builder: Não foi possível instalar a extensão unaccent:
      ${error}`
    )
  }
}

/**
 * Creates a PostgreSQL database client
 *
 * This function initializes a PostgreSQL database client with the provided pool configuration
 * and optional retry options. It sets up monitoring for connection events and query operations.
 *
 * @param pool - The PostgreSQL pool instance
 * @param retryOptions - Optional retry options for failed queries
 * @param poolConfig - Optional pool configuration
 * @param installUnaccentExtension - Optional flag to install unaccent extension
 * @returns IDatabaseClient - The PostgreSQL database client instance
 *
 * @example
 * const pgClient = await createPgClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 *
 * @example
 * const pgClient = await createPgClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 *
 * @example
 * const pgClient = await createPgClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 */
export const createPgClient = async (
  pool: Pool,
  retryOptions?: RetryOptions,
  poolConfig?: PoolConfig,
  installUnaccentExtension?: boolean
): Promise<IDatabaseClient> => {
  if (installUnaccentExtension) {
    await ensureUnaccentExtension(pool)
  }

  monitor.emit(MonitorEvents.CONNECTION_CREATED, {
    clientType: 'pg',
    poolOptions: poolConfig,
  })

  return {
    clientType: 'pg',
    query: async <T>(sql: string, params?: any[]): Promise<T> => {
      return promiseRetry(async (retry, attempt) => {
        const startTime = Date.now()
        try {
          monitor.emit(MonitorEvents.QUERY_START, {
            clientType: 'pg',
            sql,
            params,
            attempt,
          })

          const { rows } = await pool.query(sql, params)

          const elapsedTime = Date.now() - startTime
          monitor.emit(MonitorEvents.QUERY_END, {
            clientType: 'pg',
            sql,
            params,
            attempt,
            elapsedTime,
          })

          return rows as unknown as T
        } catch (error) {
          const elapsedTime = Date.now() - startTime
          monitor.emit(MonitorEvents.QUERY_ERROR, {
            clientType: 'pg',
            sql,
            params,
            attempt,
            elapsedTime,
            error,
          })

          if (isTransientError(error)) {
            console.warn(
              `Postgres query attempt ${attempt} failed, retrying...`,
              error
            )

            monitor.emit(MonitorEvents.RETRY_ATTEMPT, {
              clientType: 'pg',
              sql,
              params,
              attempt,
              error,
            })

            return retry(error)
          }

          throw error
        }
      }, retryOptions)
    },
    beginTransaction: async (): Promise<ITransactionClient> => {
      const client: PoolClient = await pool.connect()

      try {
        await client.query('BEGIN')

        return {
          query: async <T>(sql: string, params?: any[]): Promise<T> => {
            const startTime = Date.now()
            try {
              monitor.emit(MonitorEvents.QUERY_START, {
                clientType: 'pg',
                sql,
                params,
                attempt: 1,
                inTransaction: true,
              })

              const { rows } = await client.query(sql, params)

              const elapsedTime = Date.now() - startTime
              monitor.emit(MonitorEvents.QUERY_END, {
                clientType: 'pg',
                sql,
                params,
                attempt: 1,
                elapsedTime,
                inTransaction: true,
              })

              return rows as unknown as T
            } catch (error) {
              const elapsedTime = Date.now() - startTime
              monitor.emit(MonitorEvents.QUERY_ERROR, {
                clientType: 'pg',
                sql,
                params,
                attempt: 1,
                elapsedTime,
                error,
                inTransaction: true,
              })
              throw error
            }
          },
          commit: async (): Promise<void> => {
            try {
              await client.query('COMMIT')
              monitor.emit(MonitorEvents.TRANSACTION_COMMIT, {
                clientType: 'pg',
              })
            } finally {
              client.release()
            }
          },
          rollback: async (): Promise<void> => {
            try {
              await client.query('ROLLBACK')
              monitor.emit(MonitorEvents.TRANSACTION_ROLLBACK, {
                clientType: 'pg',
              })
            } finally {
              client.release()
            }
          },
        }
      } catch (error) {
        client.release()
        throw error
      }
    },
  }
}
