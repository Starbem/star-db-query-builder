import { v4 as uuid } from 'uuid'
import { QueryParams, QueryBuilder } from './types'
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
}: QueryParams<T>): Promise<T | null> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = createSelectFields(select, dbClient.clientType)
  const [whereClause, params] = createWhereClause<T>(
    where,
    1,
    dbClient.clientType
  )

  const orderByClause = createOrderByClause(orderBy)
  const groupByClause = createGroupByClause(groupBy)

  const rows = await dbClient.query<T[]>(
    `SELECT ${fields} FROM ${tableName}
      ${whereClause.length > 7 ? whereClause : ''}
      ${groupByClause}
      ${orderByClause}
      `,
    params
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
}: QueryParams<T>): Promise<T[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = createSelectFields(select, dbClient.clientType)
  const [whereClause, params] = createWhereClause(where, 1, dbClient.clientType)
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
    params
  )

  return rows || []
}

export const insert = async <P, R>({
  tableName,
  dbClient,
  data,
  returning,
}: QueryParams<R> & { data: P; returning?: string[] }): Promise<R> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!data) throw new Error('Data object is required')

  const keys = Object.keys(data)
  const values = Object.values(data)

  keys.unshift('id')
  const generatedUUID: string = uuid()
  values.unshift(generatedUUID)

  keys.push('updated_at')
  values.push(new Date())

  const placeholders = generatePlaceholders(keys, dbClient.clientType)
  let query = `INSERT INTO ${tableName} (${keys.join(
    ', '
  )}) VALUES (${placeholders})`

  if (dbClient.clientType === 'pg') {
    if (returning && returning.length > 0) {
      query += ` RETURNING ${createSelectFields(
        returning,
        dbClient.clientType
      )}`
    }
  }

  const inserted = await dbClient.query<R[]>(query, values)

  if (dbClient.clientType === 'mysql') {
    const rows = await dbClient.query<R>(
      `SELECT ${
        returning && returning.length > 0
          ? createSelectFields(returning, dbClient.clientType)
          : '*'
      } FROM ${tableName}
        WHERE
          id = ?
      `,
      [generatedUUID]
    )

    return rows[0]
  }

  return inserted[0]
}

export const update = async <P, R>({
  tableName,
  dbClient,
  id,
  data,
  returning,
}: QueryParams<R> & { data: P; returning?: string[] }): Promise<R | void> => {
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
      query += ` RETURNIN ${createSelectFields(returning, dbClient.clientType)}`
    }
  }

  const updated = await dbClient.query<R[]>(query, values)

  if (dbClient.clientType === 'mysql') {
    const rows = await dbClient.query<R>(
      `SELECT ${
        returning && returning.length > 0
          ? createSelectFields(returning, dbClient.clientType)
          : '*'
      } FROM ${tableName}
        WHERE
          id = ?
      `,
      [id]
    )

    return rows[0]
  }

  return updated[0]
}

export const deleteOne = async <T>({
  tableName,
  dbClient,
  id,
  permanently = false,
}: QueryParams<T> & { permanently?: boolean }): Promise<void> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!id) throw new Error('ID is required')

  await dbClient.query(
    permanently
      ? `DELETE FROM ${tableName} WHERE id = ${
          dbClient.clientType === 'pg' ? '$1' : '?'
        }`
      : `UPDATE ${tableName} SET status = 'deleted' WHERE id = ${
          dbClient.clientType === 'pg' ? '$1' : '?'
        }`,
    [id]
  )
}

export const joins = async <T>({
  tableName,
  dbClient,
  select,
  joins,
  where,
  groupBy,
}: QueryParams<T>): Promise<T[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = Array.isArray(select) ? select : []
  const selectFields = createSelectFields(fields, dbClient.clientType)
  const [whereClause, params] = createWhereClause(where, 1, dbClient.clientType)
  const groupByClause = createGroupByClause(groupBy)

  const queryBuilder: QueryBuilder = {
    select: [selectFields],
    from: tableName,
    joins: joins,
    where: whereClause,
    groupBy: [groupByClause],
  }

  const queryString = await buildQuery(queryBuilder)

  const rows = await dbClient.query<T[]>(queryString, params)

  return rows
}

async function buildQuery(params: QueryBuilder): Promise<string> {
  let queryString = `SELECT ${params.select.join(', ')} FROM ${params.from}`

  if (params.joins) {
    for (const join of params.joins) {
      queryString += ` ${join.type} JOIN ${join.table} ON ${join.on}`
    }
  }

  if (params.where) {
    queryString += `${params.where}`
  }

  return queryString
}
