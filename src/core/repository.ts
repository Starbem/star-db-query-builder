import { v4 as uuid } from 'uuid'
import {
  QueryParams,
  QueryBuilder,
  RawQueryParams,
  CursorPageResult,
} from './types'
import { IDatabaseClient, ITransactionClient } from '../db/IDatabaseClient'
import {
  createGroupByClause,
  createLimitClause,
  createOrderByClause,
  generatePlaceholders,
  createSelectFields,
  createWhereClause,
  generateSetClause,
  createOffsetClause,
  assertValidIdentifier,
  assertSafeSqlFragment,
  quoteIdentifier,
} from './utils'

const JOIN_TYPES = new Set(['INNER', 'LEFT', 'RIGHT', 'FULL'])

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
 *   where: { status: { operator: '=', value: 'active' } },
 *   groupBy: ['status'],
 *   orderBy: [{ field: 'created_at', direction: 'DESC' }],
 * })
 *
 * @example
 * const firstRecord = await findFirst({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   select: ['id', 'name', 'email'],
 *   where: { status: { operator: '=', value: 'active' } },
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
  assertValidIdentifier(tableName, 'table name')
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
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT 1
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
 *   where: { status: { operator: '=', value: 'active' } },
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
  assertValidIdentifier(tableName, 'table name')
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
      ${whereClause}
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
 * Finds multiple records in the specified table using keyset (cursor)
 * pagination instead of offset/limit
 *
 * Unlike offset-based pagination, keyset pagination stays O(1) regardless of
 * how deep the page is (no `OFFSET N` row-skipping) and does not skip/repeat
 * rows when the underlying data changes between pages. It requires
 * `cursorField` to be a strictly ordered, indexed column — `id` (if
 * sequential) or `created_at` are typical choices; a plain UUID `id` works
 * for uniqueness but its ordering is arbitrary, so prefer a monotonically
 * increasing column when the page order matters to callers.
 *
 * @template T - The type of the records to be returned
 * @param params - Query parameters including table name, database client, select fields, where conditions, cursor field, cursor value, direction, page size and unaccent
 * @returns Promise<CursorPageResult<T>> - The page of records plus the cursor to request the next page (`null` when there is no next page)
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When direction is not ASC or DESC
 *
 * @example
 * // First page
 * const page1 = await findManyCursor({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   where: { status: { operator: '=', value: 'active' } },
 *   cursorField: 'created_at',
 *   limit: 20,
 * })
 *
 * @example
 * // Next page
 * const page2 = await findManyCursor({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   cursorField: 'created_at',
 *   cursor: page1.nextCursor,
 *   limit: 20,
 * })
 */
export const findManyCursor = async <T>({
  tableName,
  dbClient,
  select,
  where,
  cursorField = 'id',
  cursor,
  direction = 'ASC',
  limit = 20,
  unaccent,
}: QueryParams<T> & {
  cursorField?: string
  cursor?: string | number
  direction?: 'ASC' | 'DESC'
}): Promise<CursorPageResult<T>> => {
  if (!tableName) throw new Error('Table name is required')
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  assertValidIdentifier(cursorField, 'cursor field')
  if (direction !== 'ASC' && direction !== 'DESC') {
    throw new Error(
      `Invalid direction: "${direction}". Only ASC or DESC are allowed.`
    )
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Invalid limit: "${limit}". Must be a positive integer.`)
  }

  const fields = createSelectFields(select, dbClient.clientType)
  const [whereClause, whereParams, nextIndex] = createWhereClause(
    where,
    1,
    dbClient.clientType,
    unaccent
  )

  const params = [...whereParams]
  let cursorCondition = ''
  if (cursor !== undefined && cursor !== null) {
    const operator = direction === 'ASC' ? '>' : '<'
    const placeholder = dbClient.clientType === 'pg' ? `$${nextIndex}` : '?'
    cursorCondition = `${cursorField} ${operator} ${placeholder}`
    params.push(cursor)
  }

  let combinedWhere = whereClause
  if (cursorCondition) {
    combinedWhere = whereClause
      ? `${whereClause} AND ${cursorCondition}`
      : ` WHERE ${cursorCondition}`
  }

  // fetch one extra row to know whether a next page exists without a
  // separate COUNT query
  const rows = await dbClient.query<T[]>(
    `SELECT ${fields} FROM ${tableName}
      ${combinedWhere}
      ORDER BY ${cursorField} ${direction}
      LIMIT ${limit + 1}
    `,
    params
  )

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const lastRow = data[data.length - 1] as Record<string, any> | undefined

  return {
    data,
    nextCursor: hasMore && lastRow ? (lastRow[cursorField] ?? null) : null,
  }
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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!data) throw new Error('Data object is required')

  const rawKeys = Object.keys(data)
  rawKeys.forEach((key) => assertValidIdentifier(key, 'column name'))

  const keys = rawKeys.map((key) => quoteIdentifier(key, dbClient.clientType))
  const values = Object.values(data)

  keys.unshift(quoteIdentifier('id', dbClient.clientType))
  const generatedUUID: string = uuid()
  values.unshift(generatedUUID)

  keys.push(quoteIdentifier('updated_at', dbClient.clientType))
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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!data || data.length === 0)
    throw new Error('Data array is required and cannot be empty')

  const firstItem = data[0] as Record<string, any>
  const rawKeys = Object.keys(firstItem)
  rawKeys.forEach((key) => assertValidIdentifier(key, 'column name'))

  const rawKeySet = new Set(rawKeys)
  data.forEach((item, index) => {
    const itemKeys = Object.keys(item as Record<string, any>)
    const itemKeySet = new Set(itemKeys)
    const missing = rawKeys.filter((key) => !itemKeySet.has(key))
    const extra = itemKeys.filter((key) => !rawKeySet.has(key))

    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `insertMany: item at index ${index} has different keys than the first item.` +
          (missing.length > 0 ? ` Missing: [${missing.join(', ')}].` : '') +
          (extra.length > 0 ? ` Unexpected: [${extra.join(', ')}].` : '')
      )
    }
  })

  const keys = rawKeys.map((key) => quoteIdentifier(key, dbClient.clientType))

  const allKeys = [
    quoteIdentifier('id', dbClient.clientType),
    ...keys,
    quoteIdentifier('updated_at', dbClient.clientType),
  ]

  let query = `INSERT INTO ${tableName} (${allKeys.join(', ')}) VALUES `

  const allValues: any[] = []
  const valueRows: string[] = []
  const generatedIds: string[] = []

  data.forEach((item, rowIndex) => {
    const record = item as Record<string, any>
    const values = rawKeys.map((key) => record[key])
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
 * Inserts a record, or updates it in place if it collides with an existing
 * unique/primary key
 *
 * Builds `INSERT ... ON CONFLICT (...) DO UPDATE SET ...` for pg and
 * `INSERT ... ON DUPLICATE KEY UPDATE ...` for mysql. `conflictFields` must
 * name columns actually covered by a unique or primary key constraint on
 * `tableName` — this function does not create or verify that constraint, it
 * only builds SQL that assumes it exists. For mysql, `conflictFields` is not
 * part of the generated SQL (`ON DUPLICATE KEY UPDATE` relies on the table's
 * own constraint) — it is used only to re-select the row afterwards, since
 * mysql has no `RETURNING`.
 *
 * @template P - The type of the data to be upserted
 * @template R - The type of the record to be returned
 * @param params - Query parameters including table name, database client, data, conflict target fields, optional fields to update on conflict (defaults to every field in data), and optional returning fields
 * @returns Promise<R> - The inserted or updated record
 *
 * @throws {Error} When table name is not provided
 * @throws {Error} When database client is not provided
 * @throws {Error} When data object is not provided
 * @throws {Error} When conflictFields is not provided or empty
 *
 * @example
 * const record = await upsert({
 *   tableName: 'users',
 *   dbClient: dbClient,
 *   data: { email: 'john.doe@example.com', name: 'John Doe' },
 *   conflictFields: ['email'],
 *   returning: ['id', 'name', 'email'],
 * })
 */
export const upsert = async <P, R>({
  tableName,
  dbClient,
  data,
  conflictFields,
  updateFields,
  returning,
}: QueryParams<R> & {
  data: P
  conflictFields: string[]
  updateFields?: string[]
  returning?: string[]
}): Promise<R> => {
  if (!tableName) throw new Error('Table name is required')
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!data) throw new Error('Data object is required')
  if (!conflictFields || conflictFields.length === 0)
    throw new Error('conflictFields is required and cannot be empty')
  conflictFields.forEach((field) =>
    assertValidIdentifier(field, 'conflict field')
  )

  const rawKeys = Object.keys(data)
  rawKeys.forEach((key) => assertValidIdentifier(key, 'column name'))
  const rawKeySet = new Set(rawKeys)

  const fieldsToUpdate =
    updateFields && updateFields.length > 0 ? updateFields : rawKeys
  fieldsToUpdate.forEach((key) => assertValidIdentifier(key, 'column name'))

  const unknownUpdateFields = fieldsToUpdate.filter(
    (key) => !rawKeySet.has(key)
  )
  if (unknownUpdateFields.length > 0) {
    throw new Error(
      `upsert: updateFields references column(s) not present in data: [${unknownUpdateFields.join(', ')}]. Only columns included in data can be refreshed on conflict — a column left out of data would resolve to its table default instead of the intended value.`
    )
  }

  if (dbClient.clientType === 'mysql') {
    const record = data as Record<string, any>
    const missingConflictValues = conflictFields.filter(
      (field) => record[field] === undefined
    )
    if (missingConflictValues.length > 0) {
      throw new Error(
        `upsert: conflictFields references column(s) not present in data: [${missingConflictValues.join(', ')}]. mysql has no RETURNING, so upsert() re-selects the row by these columns after the write — they must be included in data.`
      )
    }
  }

  const keys = rawKeys.map((key) => quoteIdentifier(key, dbClient.clientType))
  const values = Object.values(data)

  keys.unshift(quoteIdentifier('id', dbClient.clientType))
  const generatedUUID: string = uuid()
  values.unshift(generatedUUID)

  keys.push(quoteIdentifier('updated_at', dbClient.clientType))
  values.push(new Date())

  const placeholders = generatePlaceholders(keys, dbClient.clientType)
  let query = `INSERT INTO ${tableName} (${keys.join(
    ', '
  )}) VALUES (${placeholders})`

  if (dbClient.clientType === 'pg') {
    const conflictTarget = conflictFields
      .map((field) => quoteIdentifier(field, 'pg'))
      .join(', ')
    const updateSet = Array.from(new Set([...fieldsToUpdate, 'updated_at']))
      .map((key) => {
        const quoted = quoteIdentifier(key, 'pg')
        return `${quoted} = EXCLUDED.${quoted}`
      })
      .join(', ')

    query += ` ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateSet}`

    if (returning && returning.length > 0) {
      query += ` RETURNING ${createSelectFields(
        returning,
        dbClient.clientType
      )}`
    }

    const result = await dbClient.query<R[]>(query, values)
    return result[0]
  }

  const updateSet = Array.from(new Set([...fieldsToUpdate, 'updated_at']))
    .map((key) => {
      const quoted = quoteIdentifier(key, 'mysql')
      return `${quoted} = VALUES(${quoted})`
    })
    .join(', ')

  query += ` ON DUPLICATE KEY UPDATE ${updateSet}`

  await dbClient.query(query, values)

  const record = data as Record<string, any>
  const whereClause = conflictFields
    .map((field) => `${quoteIdentifier(field, 'mysql')} = ?`)
    .join(' AND ')
  const conflictValues = conflictFields.map((field) => record[field])

  const rows = await dbClient.query<R[]>(
    `SELECT ${
      returning && returning.length > 0
        ? createSelectFields(returning, dbClient.clientType)
        : '*'
    } FROM ${tableName}
      WHERE ${whereClause}
    `,
    conflictValues
  )

  return rows[0]
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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!id)
    throw new Error(`ID is required for update() on table "${tableName}"`)
  if (!data) throw new Error('Data object is required')
  if (Object.keys(data).length === 0)
    throw new Error('Data object must have at least one field to update')

  const keys = Object.keys(data)
  keys.forEach((key) => assertValidIdentifier(key, 'column name'))
  const values: any[] = Object.values(data)

  const quotedKeys = keys.map((key) =>
    quoteIdentifier(key, dbClient.clientType)
  )
  const setClause = generateSetClause(quotedKeys, dbClient.clientType)
  const idPlaceholder =
    dbClient.clientType === 'pg' ? `$${values.length + 1}` : '?'
  let query = `UPDATE ${tableName} SET ${setClause} WHERE id = ${idPlaceholder}`
  values.push(id)

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
 *   where: { status: { operator: '=', value: 'active' } },
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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!data) throw new Error('Data object is required')
  if (Object.keys(data).length === 0)
    throw new Error('Data object must have at least one field to update')
  if (!where) throw new Error('Where condition is required')

  const keys = Object.keys(data)
  keys.forEach((key) => assertValidIdentifier(key, 'column name'))
  const values: any[] = Object.values(data)

  // Generate SET clause with correct placeholders
  const quotedKeys = keys.map((key) =>
    quoteIdentifier(key, dbClient.clientType)
  )
  const setClause = generateSetClause(quotedKeys, dbClient.clientType)

  // Generate WHERE clause with placeholders starting after SET values
  const [whereClause, whereParams] = createWhereClause(
    where,
    values.length + 1,
    dbClient.clientType
  )

  if (!whereClause) {
    throw new Error(
      'updateMany: where condition produced an empty WHERE clause — refusing to update every row in the table. Pass at least one condition.'
    )
  }

  let query = `UPDATE ${tableName} SET ${setClause}${whereClause}`

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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!id)
    throw new Error(`ID is required for deleteOne() on table "${tableName}"`)

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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')
  if (!ids || ids.length === 0)
    throw new Error('IDs are required and cannot be empty')
  if (!field) throw new Error('Field is required')
  assertValidIdentifier(field, 'field')

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
 *   where: { status: { operator: '=', value: 'active' } },
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
  assertValidIdentifier(tableName, 'table name')
  if (!dbClient) throw new Error('DB client is required')

  if (joins) {
    joins.forEach((join) => {
      if (!JOIN_TYPES.has(join.type)) {
        throw new Error(
          `Invalid join type: "${join.type}". Only INNER, LEFT, RIGHT or FULL are allowed.`
        )
      }
      assertValidIdentifier(join.table, 'join table')
      assertSafeSqlFragment(join.on, 'join on condition')
    })
  }

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
 * Executa uma query SQL raw diretamente no banco de dados
 * @param params - Parâmetros da query raw
 * @returns Promise com o resultado da query
 *
 * @example
 * // Query simples sem parâmetros
 * const users = await rawQuery({
 *   dbClient,
 *   sql: 'SELECT * FROM users WHERE active = true'
 * })
 *
 * @example
 * // Query com parâmetros
 * const user = await rawQuery({
 *   dbClient,
 *   sql: 'SELECT * FROM users WHERE id = ? AND email = ?',
 *   params: ['user-id', 'user@example.com']
 * })
 *
 * @example
 * // Query de agregação
 * const stats = await rawQuery({
 *   dbClient,
 *   sql: `
 *     SELECT
 *       COUNT(*) as total_users,
 *       AVG(age) as avg_age,
 *       MAX(created_at) as last_created
 *     FROM users
 *     WHERE created_at >= ?
 *   `,
 *   params: [new Date('2023-01-01')]
 * })
 */
export const rawQuery = async <T = any>({
  dbClient,
  sql,
  params = [],
}: RawQueryParams): Promise<T> => {
  if (!dbClient) throw new Error('DB client is required')
  if (!sql || typeof sql !== 'string')
    throw new Error('SQL query is required and must be a string')

  try {
    const result = await dbClient.query<T>(sql, params)
    return result
  } catch (error) {
    throw new Error(
      `Raw query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
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
 *   where: { status: { operator: '=', value: 'active' } },
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

/**
 * Executes a function within a database transaction
 * @param dbClient - Database client instance
 * @param transactionFn - Function to execute within the transaction
 * @returns Promise with the result of the transaction function
 *
 * @example
 * // Simple transaction
 * const result = await withTransaction(dbClient, async (tx) => {
 *   const user = await insert({
 *     tableName: 'users',
 *     dbClient: tx,
 *     data: { name: 'John', email: 'john@example.com' }
 *   })
 *
 *   await insert({
 *     tableName: 'user_profiles',
 *     dbClient: tx,
 *     data: { user_id: user.id, bio: 'Hello world' }
 *   })
 *
 *   return user
 * })
 *
 * @example
 * // Transaction with error handling
 * try {
 *   const result = await withTransaction(dbClient, async (tx) => {
 *     // Multiple operations that must succeed or fail together
 *     const order = await insert({
 *       tableName: 'orders',
 *       dbClient: tx,
 *       data: { user_id: 'user-123', total: 100 }
 *     })
 *
 *     await update({
 *       tableName: 'users',
 *       dbClient: tx,
 *       id: 'user-123',
 *       data: { last_order_id: order.id }
 *     })
 *
 *     return order
 *   })
 * } catch (error) {
 *   // Transaction was automatically rolled back
 *   console.error('Transaction failed:', error)
 * }
 */
export const withTransaction = async <T>(
  dbClient: IDatabaseClient,
  transactionFn: (tx: ITransactionClient) => Promise<T>
): Promise<T> => {
  const transaction = await dbClient.beginTransaction()

  try {
    const result = await transactionFn(transaction)
    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

/**
 * Creates a transaction client for manual transaction management
 * @param dbClient - Database client instance
 * @returns Promise with the transaction client
 *
 * @example
 * // Manual transaction management
 * const transaction = await beginTransaction(dbClient)
 *
 * try {
 *   const user = await insert({
 *     tableName: 'users',
 *     dbClient: transaction,
 *     data: { name: 'John', email: 'john@example.com' }
 *   })
 *
 *   await insert({
 *     tableName: 'user_profiles',
 *     dbClient: transaction,
 *     data: { user_id: user.id, bio: 'Hello world' }
 *   })
 *
 *   await transaction.commit()
 *   return user
 * } catch (error) {
 *   await transaction.rollback()
 *   throw error
 * }
 */
export const beginTransaction = async (
  dbClient: IDatabaseClient
): Promise<ITransactionClient> => {
  return dbClient.beginTransaction()
}
