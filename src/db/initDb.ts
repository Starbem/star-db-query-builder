import { Pool, PoolConfig } from 'pg'
import { createPool as createMySqlPool } from 'mysql2/promise'
import { createPgClient } from './pgClient'
import { createMysqlClient } from './mysqlClient'
import { IDatabaseClient } from './IDatabaseClient'
import { DBClients, RetryOptions } from '../default/types'

const dbClients: Record<string, IDatabaseClient> = {}

export const initDb = async <T>(config: {
  name: string
  type: DBClients
  options: T
  retryOptions?: RetryOptions
}): Promise<void> => {
  if (!config.type)
    throw new Error('Type is required. Accept values: pg | mysql')

  if (!config.options) throw new Error('Connection options is required')

  if (config.type === 'pg') {
    const poolConfig = config.options as unknown as PoolConfig
    const pool = new Pool(config.options)
    dbClients[config.name] = await createPgClient(
      pool,
      config.retryOptions,
      poolConfig
    )

    console.log(
      `@starbemtech/star-db-query-builder: Postgres db client "${config.name}" created successfully`
    )
  } else if (config.type === 'mysql') {
    const pool = createMySqlPool(config.options)
    dbClients[config.name] = createMysqlClient(pool, config.retryOptions)

    console.info(
      `@starbemtech/star-db-query-builder: Postgres db client "${config.name}" created successfully`
    )
  } else {
    throw new Error('Unsupported database type')
  }
}

export const getDbClient = (name: string): IDatabaseClient => {
  const client = dbClients[name]
  if (!client) {
    throw new Error(`Database client "${name}" is not initialized`)
  }

  return client
}

export const getAllDbClients = (): Record<string, IDatabaseClient> => {
  return dbClients
}
