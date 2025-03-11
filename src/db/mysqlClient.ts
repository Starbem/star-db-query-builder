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

function isTransientError(error: any): boolean {
  return error && error.code && transientErrorCodes.has(error.code)
}

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
