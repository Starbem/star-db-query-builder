import { Pool, PoolConnection } from 'mysql2/promise'
import promiseRetry from 'promise-retry'
import { IDatabaseClient, ITransactionClient } from './IDatabaseClient'
import { RetryOptions } from '../core/types'
import { monitor, MonitorEvents } from '../monitor/monitor'

const transientErrorCodes = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ECONNREFUSED',
])

/**
 * Checks if the given error is a transient error that can be retried
 *
 * Transient errors are temporary network or connection issues that typically
 * resolve themselves and can be safely retried. This function checks if the
 * error code matches known transient error patterns for MySQL connections.
 *
 * @param error - The error object to check
 * @returns boolean - True if the error is transient and can be retried, false otherwise
 *
 * @example
 * try {
 *   const result = await pool.execute(sql, params);
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
 * Creates a MySQL database client
 *
 * This function initializes a MySQL database client with the provided pool configuration
 * and optional retry options. It sets up monitoring for connection events and query operations.
 *
 * @param pool - The MySQL pool instance
 * @param retryOptions - Optional retry options for failed queries
 * @param queryTimeout - Optional query timeout in milliseconds, applied to every query since mysql2 has no pool-wide timeout option (only a per-query one)
 * @returns IDatabaseClient - The MySQL database client instance
 *
 * @example
 * const mysqlClient = createMysqlClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 *
 * @example
 * const mysqlClient = createMysqlClient(pool, undefined, 5000); // 5s query timeout
 */
export const createMysqlClient = (
  pool: Pool,
  retryOptions?: RetryOptions,
  queryTimeout?: number
): IDatabaseClient => {
  monitor.emit(MonitorEvents.CONNECTION_CREATED, {
    clientType: 'mysql',
    poolOptions: pool.config,
  })

  return {
    clientType: 'mysql',
    query: async <T>(sql: string, params?: any[]): Promise<T> => {
      return promiseRetry(async (retry, attempt) => {
        const startTime = Date.now()
        try {
          monitor.emit(MonitorEvents.QUERY_START, {
            clientType: 'mysql',
            sql,
            params,
            attempt,
          })

          const [rows] = queryTimeout
            ? await pool.execute({ sql, timeout: queryTimeout }, params)
            : await pool.execute(sql, params)

          const elapsedTime = Date.now() - startTime
          monitor.emit(MonitorEvents.QUERY_END, {
            clientType: 'mysql',
            sql,
            params,
            attempt,
            elapsedTime,
          })

          return rows as unknown as T
        } catch (error: any) {
          const elapsedTime = Date.now() - startTime
          monitor.emit(MonitorEvents.QUERY_ERROR, {
            clientType: 'mysql',
            sql,
            params,
            attempt,
            elapsedTime,
            error,
          })

          if (isTransientError(error)) {
            monitor.emit(MonitorEvents.RETRY_ATTEMPT, {
              clientType: 'mysql',
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
      const connection: PoolConnection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        return {
          query: async <T>(sql: string, params?: any[]): Promise<T> => {
            const startTime = Date.now()
            try {
              monitor.emit(MonitorEvents.QUERY_START, {
                clientType: 'mysql',
                sql,
                params,
                attempt: 1,
                inTransaction: true,
              })

              const [rows] = queryTimeout
                ? await connection.execute(
                    { sql, timeout: queryTimeout },
                    params
                  )
                : await connection.execute(sql, params)

              const elapsedTime = Date.now() - startTime
              monitor.emit(MonitorEvents.QUERY_END, {
                clientType: 'mysql',
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
                clientType: 'mysql',
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
              await connection.commit()
              monitor.emit(MonitorEvents.TRANSACTION_COMMIT, {
                clientType: 'mysql',
              })
            } finally {
              connection.release()
            }
          },
          rollback: async (): Promise<void> => {
            try {
              await connection.rollback()
              monitor.emit(MonitorEvents.TRANSACTION_ROLLBACK, {
                clientType: 'mysql',
              })
            } finally {
              connection.release()
            }
          },
        }
      } catch (error) {
        connection.release()
        throw error
      }
    },
  }
}
