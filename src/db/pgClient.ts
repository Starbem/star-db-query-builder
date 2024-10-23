import { Pool } from 'pg'
import { IDatabaseClient } from './IDatabaseClient'

async function ensureUnaccentExtension(pool: Pool): Promise<void> {
  try {
    const checkResult = await pool.query(`
      SELECT 1 FROM pg_extension WHERE extname = 'unaccent'
    `)

    if (checkResult.rows.length === 0) {
      await pool.query('CREATE EXTENSION IF NOT EXISTS unaccent')
      throw new Error(
        '@starbemtech/star-db-query-builder: Extensão unaccent instalada com sucesso.'
      )
    }
  } catch (error) {
    throw new Error(
      `@starbemtech/star-db-query-builder: Não foi possível instalar a extensão unaccent:
      ${error}`
    )
  }
}

export const createPgClient = async (pool: Pool): Promise<IDatabaseClient> => {
  await ensureUnaccentExtension(pool)

  return {
    clientType: 'pg',
    query: async <T>(sql: string, params?: any[]): Promise<T> => {
      const { rows } = await pool.query(sql, params)
      return rows as unknown as T
    },
  }
}
