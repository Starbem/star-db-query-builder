import { Pool, PoolConnection } from 'mysql2/promise'
import promiseRetry from 'promise-retry'
import { IDatabaseClient, ITransactionClient } from './IDatabaseClient'
import { RetryOptions } from '../core/types'
import { monitor, MonitorEvents } from '../monitor/monitor'
import {
  resolveRetryOptions,
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
 * unless `retryOptions.retryWrites` is set (see `shouldRetry`). Unset retry
 * options fall back to `DEFAULT_RETRY_OPTIONS` (see `resolveRetryOptions`).
 *
 * @param pool - The MySQL pool instance
 * @param retryOptions - Optional retry options for failed queries merged over `DEFAULT_RETRY_OPTIONS`
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
  const effectiveRetryOptions = resolveRetryOptions(retryOptions)

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

          if (
            shouldRetry(error, sql, transientErrorCodes, effectiveRetryOptions)
          ) {
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
      }, toPromiseRetryOptions(effectiveRetryOptions))
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
          // The connection may be broken or still mid-transaction (mysql2
          // doesn't reset a connection on release, and a failed COMMIT doesn't
          // guarantee the transaction ended): never hand it back to the pool.
          connection.destroy()
        } else {
          connection.release()
        }
      }

      // Set synchronously by commit/rollback, before their first await, so a
      // commit racing a rollback (or a query issued after either) can't reach
      // the server once the transaction has started to close.
      let closing = false

      const assertActive = () => {
        if (closing || finished) {
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
          closing = true
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
        // No-op once the transaction is closing or finished (committed,
        // rolled back or failed to commit): the connection is no longer ours
        // to use.
        rollback: async (): Promise<void> => {
          if (closing || finished) return
          closing = true
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
