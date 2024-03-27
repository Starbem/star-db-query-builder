import { QueryParams } from './types'
import {
  createGroupByClause,
  createLimitClause,
  createOrderByClause,
  generatePlaceholders,
  createSelectFields,
  createWhereClause,
  generateSetClause,
} from './utils'

export const findFirst = async <T>({
  tableName,
  dbClient,
  select,
  where,
  groupBy,
  orderBy,
}: QueryParams): Promise<T> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = createSelectFields(select)
  const [whereClause, params] = createWhereClause(where)
  const orderByClause = createOrderByClause(orderBy)
  const groupByClause = createGroupByClause(groupBy)

  const rows = await dbClient.query<T>(
    `SELECT ${fields} FROM ${tableName}
      ${whereClause.length > 7 ? whereClause : ''}
      ${groupByClause}
      ${orderByClause}
    `,
    [params]
  )

  return rows[0] || null
}

export const findMany = async <T>({
  tableName,
  dbClient,
  select,
  where,
  groupBy,
  orderBy,
  limit,
}: QueryParams): Promise<T[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = createSelectFields(select)
  const [whereClause, params] = createWhereClause(where)
  const orderByClause = createOrderByClause(orderBy)
  const groupByClause = createGroupByClause(groupBy)
  const limitClause = createLimitClause(limit)

  const rows = await dbClient.query<T[]>(
    `SELECT ${fields} FROM ${tableName}
      ${whereClause.length > 7 ? whereClause : ''}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
    `,
    [params]
  )

  return rows || []
}

export const insert = async <T>({
  tableName,
  dbClient,
  data,
  returning,
}: QueryParams & { data: T; returning?: string[] }): Promise<T | void> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!data) throw new Error('Data object is required')

  const keys = Object.keys(data)
  const values = Object.values(data)

  const placeholders = generatePlaceholders(keys, dbClient.clientType)
  let query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`

  if (dbClient.clientType === 'pg') {
    if (returning && returning.length > 0) {
      query += ` RETURNING ${createSelectFields(returning)}`
    }
  }

  const inserted = await dbClient.query<T[]>(query, values)

  if (dbClient.clientType === 'pg') return inserted[0]
}

export const update = async <T>({
  tableName,
  dbClient,
  id,
  data,
  returning,
}: QueryParams & { data: T; returning?: string[] }): Promise<T | void> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!id) throw new Error('ID is required')
  if (!data) throw new Error('Data object is required')

  const keys = Object.keys(data)
  const values: any[] = Object.values(data)

  const setClause = generateSetClause(keys, dbClient.clientType)
  let query = `UPDATE ${tableName} SET ${setClause} WHERE ${id}`

  if (dbClient.clientType === 'pg') {
    if (returning && returning.length > 0) {
      query += ` RETURNIN ${createSelectFields(returning)}`
    }
  }

  const updated = await dbClient.query<T[]>(query, values)

  if (dbClient.clientType === 'pg') return updated[0]
}

export const deleteOne = async ({
  tableName,
  dbClient,
  id,
  permanently = false,
}: QueryParams & { permanently?: boolean }): Promise<void> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!id) throw new Error('ID is required')

  await dbClient.query(
    permanently
      ? `DELETE FROM ${tableName} WHERE id = ${dbClient.clientType === 'pg' ? '$1' : '?'}`
      : `UPDATE ${tableName} SET status = 'deleted' WHERE id = ${dbClient.clientType === 'pg' ? '$1' : '?'}`,
    [id]
  )
}
