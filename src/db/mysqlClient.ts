import { Pool, PoolConnection } from 'mysql2/promise'
import promiseRetry from 'promise-retry'
import { IDatabaseClient, ITransactionClient } from './IDatabaseClient'
import { RetryOptions } from '../core/types'
import { monitor, MonitorEvents } from '../monitor/monitor'
import {
  DEFAULT_RETRY_OPTIONS,
  shouldRetry,
  toPromiseRetryOptions,
} from './retryPolicy'

const transientErrorCodes = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ECONNREFUSED',
])

/**
 * Creates a MySQL database client
 *
 * This function initializes a MySQL database client with the provided pool configuration
 * and optional retry options. It sets up monitoring for connection events and query operations.
 *
 * Transient connection errors are retried only for read-only statements,
 * unless `retryOptions.retryWrites` is set (see `shouldRetry`). Without
 * `retryOptions`, `DEFAULT_RETRY_OPTIONS` applies.
 *
 * @param pool - The MySQL pool instance
 * @param retryOptions - Optional retry options for failed queries (defaults to `DEFAULT_RETRY_OPTIONS`)
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
  retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS,
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

          if (shouldRetry(error, sql, transientErrorCodes, retryOptions)) {
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
      }, toPromiseRetryOptions(retryOptions))
    },
    beginTransaction: async (): Promise<ITransactionClient> => {
      const connection: PoolConnection = await pool.getConnection()

      // Releasing twice, or sending a late ROLLBACK on a connection that is
      // already back in the pool, can touch another caller's work. Every exit
      // path goes through here exactly once.
      let finished = false
      const finish = (error?: unknown) => {
        if (finished) return
        finished = true
        if (error) {
          // The connection may be broken or mid-transaction: never hand it
          // back to the pool.
          connection.destroy()
        } else {
          connection.release()
        }
      }

      const assertActive = () => {
        if (finished) {
          throw new Error(
            '@starbemtech/star-db-query-builder: transaction already finished'
          )
        }
      }

      try {
        await connection.beginTransaction()
      } catch (error) {
        finish(error)
        throw error
      }

      return {
        clientType: 'mysql',
        query: async <T>(sql: string, params?: any[]): Promise<T> => {
          assertActive()
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
              ? await connection.execute({ sql, timeout: queryTimeout }, params)
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
          assertActive()
          try {
            await connection.commit()
          } catch (error) {
            finish(error)
            throw error
          }
          finish()
          monitor.emit(MonitorEvents.TRANSACTION_COMMIT, {
            clientType: 'mysql',
          })
        },
        // No-op once the transaction has finished (committed, rolled back or
        // failed to commit): the connection is no longer ours to use.
        rollback: async (): Promise<void> => {
          if (finished) return
          try {
            await connection.rollback()
          } catch (error) {
            finish(error)
            throw error
          }
          finish()
          monitor.emit(MonitorEvents.TRANSACTION_ROLLBACK, {
            clientType: 'mysql',
          })
        },
      }
    },
  }
}
