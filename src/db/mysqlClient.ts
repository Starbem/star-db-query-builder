import { Pool } from 'mysql2/promise'
import promiseRetry from 'promise-retry'
import { IDatabaseClient } from './IDatabaseClient'
import { RetryOptions } from '../default/types'
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
 * @returns IDatabaseClient - The MySQL database client instance
 *
 * @example
 * const mysqlClient = createMysqlClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 *
 * @example
 * const mysqlClient = createMysqlClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 *
 * @example
 * const mysqlClient = createMysqlClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 *
 * @example
 * const mysqlClient = createMysqlClient(pool, { retries: 3, factor: 2, minTimeout: 1000 });
 */
export const createMysqlClient = (
  pool: Pool,
  retryOptions?: RetryOptions
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

          const [rows] = await pool.execute(sql, params)

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
            console.warn(
              `MySQL query attempt ${attempt} failed, retrying...`,
              error
            )
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
  }
}
