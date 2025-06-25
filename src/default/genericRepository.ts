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
  createOffsetClause,
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
  offset,
  unaccent,
}: QueryParams<T>): Promise<T[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = createSelectFields(select, dbClient.clientType)
  const [whereClause, params] = createWhereClause(
    where,
    1,
    dbClient.clientType,
    unaccent
  )

  const orderByClause = createOrderByClause(orderBy)
  const groupByClause = createGroupByClause(groupBy)
  const limitClause = createLimitClause(limit)
  const offsetClause = createOffsetClause(offset)

  const rows = await dbClient.query<T[]>(
    `SELECT ${fields} FROM ${tableName}
      ${whereClause.length > 7 ? whereClause : ''}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
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

  const keys =
    dbClient.clientType === 'pg'
      ? Object.keys(data).map((key) =>
          key === 'authorization' ? `"${key}"` : key
        )
      : Object.keys(data)
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
    const rows = await dbClient.query<R[]>(
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

export const insertMany = async <P, R>({
  tableName,
  dbClient,
  data,
  returning,
}: QueryParams<R> & { data: P[]; returning?: string[] }): Promise<R[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!data || data.length === 0)
    throw new Error('Data array is required and cannot be empty')

  const firstItem = data[0] as Record<string, any>
  const keys =
    dbClient.clientType === 'pg'
      ? Object.keys(firstItem).map((key) =>
          key === 'authorization' ? `"${key}"` : key
        )
      : Object.keys(firstItem)

  const allKeys = ['id', ...keys, 'updated_at']

  let query = `INSERT INTO ${tableName} (${allKeys.join(', ')}) VALUES `

  const allValues: any[] = []
  const valueRows: string[] = []
  const generatedIds: string[] = []

  data.forEach((item, rowIndex) => {
    const values = Object.values(item as Record<string, any>)
    const generatedUUID: string = uuid()
    generatedIds.push(generatedUUID)
    const currentValues = [generatedUUID, ...values, new Date()]

    allValues.push(...currentValues)

    // Generate unique placeholders for each row
    if (dbClient.clientType === 'pg') {
      const startIndex = rowIndex * allKeys.length + 1
      const placeholders = allKeys
        .map((_, index) => `$${startIndex + index}`)
        .join(', ')
      valueRows.push(`(${placeholders})`)
    } else {
      const placeholders = allKeys.map(() => '?').join(', ')
      valueRows.push(`(${placeholders})`)
    }
  })

  query += valueRows.join(', ')

  if (dbClient.clientType === 'pg') {
    if (returning && returning.length > 0) {
      query += ` RETURNING ${createSelectFields(
        returning,
        dbClient.clientType
      )}`
    }
  }

  const inserted = await dbClient.query<R[]>(query, allValues)

  if (dbClient.clientType === 'mysql') {
    const placeholders = generatedIds.map(() => '?').join(', ')

    const rows = await dbClient.query<R[]>(
      `SELECT ${
        returning && returning.length > 0
          ? createSelectFields(returning, dbClient.clientType)
          : '*'
      } FROM ${tableName}
        WHERE id IN (${placeholders})
        ORDER BY FIELD(id, ${placeholders})
      `,
      [...generatedIds, ...generatedIds]
    )

    return rows
  }

  return inserted
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
  let query = `UPDATE ${tableName} SET ${setClause} WHERE id = '${id}'`

  if (dbClient.clientType === 'pg') {
    if (returning && returning.length > 0) {
      query += ` RETURNING ${createSelectFields(returning, dbClient.clientType)}`
    }
  }

  const updated = await dbClient.query<R[]>(query, values)

  if (dbClient.clientType === 'mysql') {
    const rows = await dbClient.query<R[]>(
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

export const updateMany = async <P, R>({
  tableName,
  dbClient,
  data,
  where,
  returning,
}: QueryParams<R> & { data: P; returning?: string[] }): Promise<R[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!data) throw new Error('Data object is required')
  if (!where) throw new Error('Where condition is required')

  const keys = Object.keys(data)
  const values: any[] = Object.values(data)

  // Generate SET clause with correct placeholders
  const setClause = keys
    .map((key, index) =>
      dbClient.clientType === 'pg' ? `${key} = $${index + 1}` : `${key} = ?`
    )
    .join(', ')

  // Generate WHERE clause with placeholders starting after SET values
  const [whereClause, whereParams] = createWhereClause(
    where,
    values.length + 1,
    dbClient.clientType
  )

  let query = `UPDATE ${tableName} SET ${setClause} ${whereClause}`

  if (dbClient.clientType === 'pg') {
    if (returning && returning.length > 0) {
      query += ` RETURNING ${createSelectFields(returning, dbClient.clientType)}`
    }
  }

  const updated = await dbClient.query<R[]>(query, [...values, ...whereParams])

  if (dbClient.clientType === 'mysql') {
    // For MySQL, we need to fetch the updated records separately
    // since MySQL doesn't support RETURNING clause
    const rows = await dbClient.query<R[]>(
      `SELECT ${
        returning && returning.length > 0
          ? createSelectFields(returning, dbClient.clientType)
          : '*'
      } FROM ${tableName}
        ${whereClause}
      `,
      whereParams
    )

    return rows
  }

  return updated
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

export const deleteMany = async <T>({
  tableName,
  dbClient,
  ids,
  field = 'id',
  permanently = false,
}: QueryParams<T> & {
  ids: string[] | number[]
  field?: string
  permanently?: boolean
}): Promise<void> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')
  if (!ids || ids.length === 0)
    throw new Error('IDs are required and cannot be empty')
  if (!field) throw new Error('Field is required')

  const placeholders =
    dbClient.clientType === 'pg'
      ? ids.map((_, index) => `$${index + 1}`).join(', ')
      : ids.map(() => '?').join(', ')

  const query = permanently
    ? `DELETE FROM ${tableName} WHERE ${field} IN (${placeholders})`
    : `UPDATE ${tableName} SET status = 'deleted' WHERE ${field} IN (${placeholders})`

  await dbClient.query(query, ids)
}

export const joins = async <T>({
  tableName,
  dbClient,
  select,
  joins,
  where,
  groupBy,
  orderBy,
  limit,
  offset,
  unaccent,
}: QueryParams<T>): Promise<T[]> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = Array.isArray(select) ? select : []
  const selectFields = createSelectFields(fields, dbClient.clientType)
  const [whereClause, params] = createWhereClause(
    where,
    1,
    dbClient.clientType,
    unaccent
  )
  const groupByClause = createGroupByClause(groupBy)
  const orderByClause = createOrderByClause(orderBy)
  const limitClause = createLimitClause(limit)
  const offsetClause = createOffsetClause(offset)

  const queryBuilder: QueryBuilder = {
    select: [selectFields],
    from: tableName,
    joins: joins,
    where: whereClause,
    groupBy: [groupByClause],
    orderBy: orderByClause,
    limit: limitClause,
    offset: offsetClause,
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

  if (params.groupBy) {
    queryString += `${params.groupBy}`
  }

  if (params.orderBy) {
    queryString += `${params.orderBy}`
  }

  if (params.limit) {
    queryString += `${params.limit}`
  }

  if (params.offset) {
    queryString += `${params.offset}`
  }

  return queryString
}
