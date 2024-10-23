import { Pool as PgPool } from 'pg'
import { createPool as createMySqlPool } from 'mysql2/promise'
import { createPgClient } from './pgClient'
import { createMysqlClient } from './mysqlClient'
import { IDatabaseClient } from './IDatabaseClient'
import { DBClients } from '../default/types'

let dbClient: IDatabaseClient | null = null

export const initDb = async <T>(config: {
  type: DBClients
  options: T
}): Promise<void> => {
  if (!config.type)
    throw new Error('Type is required. Accept values: pg | mysql')

  if (!config.options) throw new Error('Connection options is required')

  if (config.type === 'pg') {
    const pool = new PgPool(config.options)
    dbClient = await createPgClient(pool)

    console.log(
      `@starbemtech/star-db-query-builder: Postgres db client created success`
    )
  } else if (config.type === 'mysql') {
    const pool = createMySqlPool(config.options)
    dbClient = createMysqlClient(pool)

    console.info(
      `@starbemtech/star-db-query-builder: MySQL db client created success.`
    )
  } else {
    throw new Error('Unsupported database type')
  }
}

export const getDbClient = (): IDatabaseClient => {
  if (!dbClient) {
    throw new Error('Database client is not initialized')
  }

  return dbClient
}
