import { Pool } from 'mysql2/promise'
import { IDatabaseClient } from './IDatabaseClient'

export const createMysqlClient = (pool: Pool): IDatabaseClient => ({
  clientType: 'mysql',
  query: async <T>(sql: string, params?: any[]): Promise<T> => {
    const [rows] = await pool.execute(sql, params)
    return rows as unknown as T
  },
})
