import { Pool as PgPool } from 'pg'
import { createPool as createMySqlPool } from 'mysql2/promise'
import { createPgClient } from './pgClient'
import { createMysqlClient } from './mysqlClient'
import { IDatabaseClient } from './IDatabaseClient'

let dbClient: IDatabaseClient | null = null

export const initDb = (config: { type: 'pg' | 'mysql'; options: any }) => {
  if (config.type === 'pg') {
    const pool = new PgPool(config.options)
    dbClient = createPgClient(pool)
  } else if (config.type === 'mysql') {
    const pool = createMySqlPool(config.options)
    dbClient = createMysqlClient(pool)
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
