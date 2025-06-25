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

/**
 * Finds the first record in the specified table
 *
 * This function retrieves the first record from the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template T - The type of the record to be returned
 * @param params - Query parameters including table name, database client, select fields, where conditions, group by, order by, and limit
 * @returns Promise<T | null> - The first record or null if no record is found
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 *
 * @example
 * const firstRecord = await findFirst({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   select: ['id', 'name', 'email'],
 *   where: { status: 'active' },
 *   groupBy: ['status'],
 *   orderBy: [{ field: 'created_at', direction: 'DESC' }],
 * })
 *
 * @example
 * const firstRecord = await findFirst({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   select: ['id', 'name', 'email'],
 *   where: { status: 'active' },
 *   groupBy: ['status'],
 *   orderBy: [{ field: 'created_at', direction: 'DESC' }],
 * })
 */
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

/**
 * Finds multiple records in the specified table
 *
 * This function retrieves multiple records from the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template T - The type of the records to be returned
 * @param params - Query parameters including table name, database client, select fields, where conditions, group by, order by, limit, and offset
 * @returns Promise<T[]> - The records found in the table
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 *
 * @example
 * const records = await findMany({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   select: ['id', 'name', 'email'],
 *   where: { status: 'active' },
 *   groupBy: ['status'],
 *   orderBy: [{ field: 'created_at', direction: 'DESC' }],
 *   limit: 10,
 *   offset: 0,
 *   unaccent: true,
 * })
 */
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

/**
 * Inserts a new record into the specified table
 *
 * This function inserts a new record into the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template P - The type of the data to be inserted
 * @template R - The type of the record to be returned
 * @param params - Query parameters including table name, database client, data to be inserted, and optional returning fields
 * @returns Promise<R> - The inserted record
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When data object is not provided
 *
 * @example
 * const insertedRecord = await insert({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   data: { name: 'John Doe', email: 'john.doe@example.com' },
 *   returning: ['id', 'name', 'email'],
 * })
 */
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

/**
 * Inserts multiple records into the specified table
 *
 * This function inserts multiple records into the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template P - The type of the data to be inserted
 * @template R - The type of the record to be returned
 * @param params - Query parameters including table name, database client, data to be inserted, and optional returning fields
 * @returns Promise<R[]> - The inserted records
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When data array is not provided or empty
 *
 * @example
 * const insertedRecords = await insertMany({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   data: [{ name: 'John Doe', email: 'john.doe@example.com' }, { name: 'Jane Doe', email: 'jane.doe@example.com' }],
 *   returning: ['id', 'name', 'email'],
 * })
 */
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

/**
 * Updates a record in the specified table
 *
 * This function updates a record in the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template P - The type of the data to be updated
 * @template R - The type of the record to be returned
 * @param params - Query parameters including table name, database client, ID of the record to be updated, data to be updated, and optional returning fields
 * @returns Promise<R | void> - The updated record or void if no record is found
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When ID is not provided
 *
 * @example
 * const updatedRecord = await update({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   id: '123',
 *   data: { name: 'John Doe', email: 'john.doe@example.com' },
 *   returning: ['id', 'name', 'email'],
 * })
 */
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

/**
 * Updates multiple records in the specified table
 *
 * This function updates multiple records in the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template P - The type of the data to be updated
 * @template R - The type of the record to be returned
 * @param params - Query parameters including table name, database client, data to be updated, where conditions, and optional returning fields
 * @returns Promise<R[]> - The updated records
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When data object is not provided
 * @throws {Error} When where condition is not provided
 *
 * @example
 * const updatedRecords = await updateMany({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   data: { name: 'John Doe', email: 'john.doe@example.com' },
 *   where: { status: 'active' },
 *   returning: ['id', 'name', 'email'],
 * })
 */
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

/**
 * Deletes a record from the specified table
 *
 * This function deletes a record from the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template T - The type of the record to be deleted
 * @param params - Query parameters including table name, database client, ID of the record to be deleted, and optional permanently flag
 * @returns Promise<void> - Resolves when the record is deleted
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When ID is not provided
 *
 * @example
 * await deleteOne({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   id: '123',
 *   permanently: true,
 * })
 */
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

/**
 * Deletes multiple records from the specified table
 *
 * This function deletes multiple records from the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template T - The type of the record to be deleted
 * @param params - Query parameters including table name, database client, IDs of the records to be deleted, field to be used for deletion, and optional permanently flag
 * @returns Promise<void> - Resolves when the records are deleted
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When IDs are not provided or empty
 * @throws {Error} When field is not provided
 *
 * @example
 * await deleteMany({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   ids: ['123', '456', '789'],
 *   field: 'id',
 *   permanently: true,
 * })
 */
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

/**
 * Joins multiple tables in the specified table
 *
 * This function joins multiple tables in the specified table based on the provided
 * query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @template T - The type of the record to be joined
 * @param params - Query parameters including table name, database client, select fields, joins, where conditions, group by, order by, limit, and offset
 * @returns Promise<T[]> - The records found in the joined tables
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When select fields are not provided
 * @throws {Error} When joins are not provided
 *
 * @example
 * const records = await joins({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   select: ['id', 'name', 'email'],
 *   joins: [{ type: 'INNER', table: 'orders', on: 'users.id = orders.user_id' }],
 *   where: { status: 'active' },
 *   groupBy: ['status'],
 *   orderBy: [{ field: 'created_at', direction: 'DESC' }],
 *   limit: 10,
 *   offset: 0,
 *   unaccent: true,
 * })
 */
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

/**
 * Builds a query string from the provided query parameters
 *
 * This function builds a query string from the provided query parameters. It constructs the SQL query, executes it, and returns the result.
 *
 * @param params - Query parameters including select fields, from table, joins, where conditions, group by, order by, limit, and offset
 * @returns Promise<string> - The query string
 *
 * @example
 * const queryString = await buildQuery({
 *   select: ['id', 'name', 'email'],
 *   from: 'users',
 *   joins: [{ type: 'INNER', table: 'orders', on: 'users.id = orders.user_id' }],
 *   where: { status: 'active' },
 *   groupBy: ['status'],
 *   orderBy: [{ field: 'created_at', direction: 'DESC' }],
 *   limit: 10,
 *   offset: 0,
 * })
 */
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
