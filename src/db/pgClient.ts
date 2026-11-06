import { Pool, PoolConfig, PoolClient } from 'pg'
import promiseRetry from 'promise-retry'
import { IDatabaseClient, ITransactionClient } from './IDatabaseClient'
import { RetryOptions } from '../core/types'
import { monitor, MonitorEvents } from '../monitor/monitor'
import {
  resolveRetryOptions,
  shouldRetry,
  toPromiseRetryOptions,
} from './retryPolicy'

const transientErrorCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'])

/**
 * Whether the error is a regular SQL error reported by a server that is still
 * talking to us (serialization failure, deferred constraint violation, ...),
 * after which the connection is still usable. A FATAL/PANIC error (e.g.
 * `pg_terminate_backend`, admin shutdown) or a network error is not.
 */
function isRecoverableServerError(error: any): boolean {
  return (
    !!error &&
    typeof error.code === 'string' &&
    /^[0-9A-Z]{5}$/.test(error.code) &&
    error.severity === 'ERROR'
  )
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
 * Transient connection errors are retried only for read-only statements,
 * unless `retryOptions.retryWrites` is set (see `shouldRetry`). Unset retry
 * options fall back to `DEFAULT_RETRY_OPTIONS` (see `resolveRetryOptions`).
 *
 * @param pool - The PostgreSQL pool instance
 * @param retryOptions - Optional retry options for failed queries, merged over `DEFAULT_RETRY_OPTIONS`
 * @param poolConfig - Optional pool configuration
 * @param installUnaccentExtension - Optional flag to install unaccent extension
 * @param clientName - Optional registry name of the client, reported on `POOL_ERROR`
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
  installUnaccentExtension?: boolean,
  clientName?: string
): Promise<IDatabaseClient> => {
  const effectiveRetryOptions = resolveRetryOptions(retryOptions)

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

          if (
            shouldRetry(error, sql, transientErrorCodes, effectiveRetryOptions)
          ) {
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
      }, toPromiseRetryOptions(effectiveRetryOptions))
    },
    beginTransaction: async (): Promise<ITransactionClient> => {
      const client: PoolClient = await pool.connect()

      // pg-pool detaches its own 'error' listener while a client is checked
      // out, so a connection dropped mid-transaction (failover, restart,
      // pg_terminate_backend) would otherwise be an unhandled 'error' event
      // and crash the process.
      let connectionError: Error | undefined
      const onClientError = (error: Error) => {
        connectionError = error
        monitor.emit(MonitorEvents.POOL_ERROR, {
          clientType: 'pg',
          clientName,
          error,
          inTransaction: true,
        })
      }
      client.on('error', onClientError)

      // Releasing twice either throws from pg-pool (masking the original
      // error) or, worse, hands the connection to another caller while a
      // late ROLLBACK is still sent on it. Every exit path goes through here.
      let finished = false
      const finish = (error?: unknown) => {
        if (finished) return
        finished = true
        client.removeListener('error', onClientError)
        // A truthy argument makes pg-pool destroy the client instead of
        // returning it to the pool. Only do that when the connection itself
        // may be broken: a plain SQL error (e.g. a serialization failure on
        // COMMIT) leaves it usable, and destroying it would force a reconnect.
        const destroyReason =
          connectionError ??
          (error && !isRecoverableServerError(error)
            ? (error as Error)
            : undefined)
        client.release(destroyReason)
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
        await client.query('BEGIN')
      } catch (error) {
        finish(error)
        throw error
      }

      return {
        clientType: 'pg',
        query: async <T>(sql: string, params?: any[]): Promise<T> => {
          assertActive()
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
          assertActive()
          closing = true
          try {
            await client.query('COMMIT')
          } catch (error) {
            finish(error)
            throw error
          }
          finish()
          monitor.emit(MonitorEvents.TRANSACTION_COMMIT, {
            clientType: 'pg',
          })
        },
        // No-op once the transaction is closing or finished (committed,
        // rolled back or failed to commit): the connection is no longer ours
        // to send ROLLBACK on, and a failed COMMIT already ended the
        // transaction.
        rollback: async (): Promise<void> => {
          if (closing || finished) return
          closing = true
          try {
            await client.query('ROLLBACK')
          } catch (error) {
            finish(error)
            throw error
          }
          finish()
          monitor.emit(MonitorEvents.TRANSACTION_ROLLBACK, {
            clientType: 'pg',
          })
        },
      }
    },
  }
}
