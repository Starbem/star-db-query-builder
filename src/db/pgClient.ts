import { Pool, PoolConfig } from 'pg'
import promiseRetry from 'promise-retry'
import { IDatabaseClient } from './IDatabaseClient'
import { RetryOptions } from '../default/types'
import { monitor, MonitorEvents } from '../monitor/monitor'

const transientErrorCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'])

function isTransientError(error: any): boolean {
  return error && error.code && transientErrorCodes.has(error.code)
}

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
  }
}
