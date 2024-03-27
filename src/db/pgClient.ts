import { Pool } from 'pg'
import { IDatabaseClient } from './IDatabaseClient'

export const createPgClient = (pool: Pool): IDatabaseClient => ({
  clientType: 'pg',
  query: async <T>(sql: string, params?: any[]): Promise<T> => {
    const { rows } = await pool.query(sql, params)
    return rows as unknown as T
  },
})
