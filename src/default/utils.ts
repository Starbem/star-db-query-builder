import { Conditions, Condition, OrderBy, DBClients } from './types'

/**
 * Converts an array of strings to a comma-separated string with quotes
 *
 * This function takes an array of strings and converts it to a comma-separated string
 * with quotes. It handles the differences between PostgreSQL and MySQL syntax for
 * string arrays.
 *
 * @param items - The array of strings to convert
 * @param clientType - The type of database client
 * @returns A comma-separated string with quotes
 *
 * @example
 * const items = ['item1', 'item2', 'item3']
 * const clientType = 'pg'
 * const result = arrayToStringWithQuotes(items, clientType)
 * // result will be: 'item1', 'item2', 'item3'
 */
const arrayToStringWithQuotes = (
  items: string[],
  clientType: DBClients
): string => {
  const itemsWithQuotes = items.map((item) =>
    clientType === 'pg' ? `${item}` : `${item}`
  )
  return itemsWithQuotes.join(', ')
}

/**
 * Generates a PostgreSQL placeholder for a parameter
 *
 * This function generates a PostgreSQL placeholder for a parameter. It returns
 * a string with a dollar sign and the index of the parameter.
 *
 * @param index - The index of the parameter
 * @returns A PostgreSQL placeholder
 *
 * @example
 * const index = 1
 * const placeholder = pgPlaceholderGenerator(index)
 * // placeholder will be: $1
 */
const pgPlaceholderGenerator = (index: number) => `$${index}`

/**
 * Generates a MySQL placeholder for a parameter
 *
 * This function generates a MySQL placeholder for a parameter. It returns
 * a string with a question mark.
 *
 * @returns A MySQL placeholder
 *
 * @example
 * const placeholder = mysqlPlaceholderGenerator()
 * // placeholder will be: ?
 */
const mysqlPlaceholderGenerator = () => `?`

/**
 * Creates a SELECT clause for a query
 *
 * This function creates a SELECT clause for a query. It takes an array of fields
 * and a database client type and returns a string with the fields separated by commas.
 *
 * @param fields - The array of fields to select
 * @param clientType - The type of database client
 * @returns A string with the fields separated by commas
 *
 * @example
 * const fields = ['id', 'name', 'email']
 * const clientType = 'pg'
 * const result = createSelectFields(fields, clientType)
 * // result will be: "id, name, email"
 */
export const createSelectFields = (
  fields: string[] = [],
  clientType: DBClients
): string => {
  return fields && fields.length > 0
    ? arrayToStringWithQuotes(fields, clientType)
    : '*'
}

/**
 * Generates placeholders for a query
 *
 * This function generates placeholders for a query. It takes an array of keys
 * and a database client type and returns a string with the placeholders separated by commas.
 *
 * @param keys - The array of keys to generate placeholders for
 * @param clientType - The type of database client
 * @returns A string with the placeholders separated by commas
 *
 * @example
 * const keys = ['id', 'name', 'email']
 * const clientType = 'pg'
 * const result = generatePlaceholders(keys, clientType)
 * // result will be: $1, $2, $3
 */
export const generatePlaceholders = (
  keys: any[],
  clientType: DBClients
): string => {
  return keys
    .map((_, index) => (clientType === 'pg' ? `$${index + 1}` : '?'))
    .join(', ')
}

/**
 * Generates a SET clause for a query
 *
 * This function generates a SET clause for a query. It takes an array of keys
 * and a database client type and returns a string with the keys and placeholders separated by commas.
 *
 * @param keys - The array of keys to generate SET clause for
 * @param clientType - The type of database client
 * @returns A string with the keys and placeholders separated by commas
 *
 * @example
 * const keys = ['id', 'name', 'email']
 * const clientType = 'pg'
 * const result = generateSetClause(keys, clientType)
 * // result will be: "id = $1, name = $2, email = $3"
 */
export const generateSetClause = (
  keys: any[],
  clientType: DBClients
): string => {
  return keys
    .map((key, index) =>
      clientType === 'pg' ? `${key} = $${index + 1}` : `${key} = ?`
    )
    .join(', ')
}

/**
 * Creates a WHERE clause for a query
 *
 * This function creates a WHERE clause for a query. It takes an array of conditions
 * and a database client type and returns a string with the conditions separated by AND.
 *
 * @param conditions - The array of conditions to create WHERE clause for
 * @param startIndex - The index of the first parameter
 * @param clientType - The type of database client
 * @param unaccent - Whether to use unaccent function
 * @returns A string with the conditions separated by AND
 *
 * @example
 * const conditions = [{ field: 'name', operator: '=', value: 'John Doe' }]
 * const startIndex = 1
 * const clientType = 'pg'
 * const unaccent = true
 * const result = createWhereClause(conditions, startIndex, clientType, unaccent)
 * // result will be: "name = $1"
 */
export const createWhereClause = <T>(
  conditions: Conditions<T> = {},
  startIndex = 1,
  clientType: DBClients,
  unaccent?: boolean
): [string, any[], number] => {
  let index = startIndex
  const whereParts: string[] = []
  const values: any[] = []

  const processCondition = (key: string, condition: Condition<T>) => {
    if (typeof condition === 'object' && condition !== null) {
      if ('operator' in condition && 'value' in condition) {
        const { operator, value } = condition

        if (operator === 'NOT EXISTS' && typeof value === 'string') {
          whereParts.push(`NOT EXISTS (${value})`)
        } else if (operator.includes('NULL')) {
          whereParts.push(`${key} ${operator}`)
        } else if (Array.isArray(value)) {
          const placeholders = value
            .map(() =>
              clientType === 'pg'
                ? pgPlaceholderGenerator(index++)
                : mysqlPlaceholderGenerator()
            )
            .join(', ')

          if (operator === 'BETWEEN') {
            whereParts.push(
              `${key} ${operator} ${placeholders.replace(', ', ' AND ')}`
            )
          } else if (operator === 'IN') {
            whereParts.push(`${key} ${operator} (${placeholders})`)
          } else {
            whereParts.push(`${key} ${operator} (${placeholders})`)
          }
          values.push(...value)
        } else {
          if (unaccent && clientType === 'pg') {
            if (operator.toUpperCase() === 'ILIKE') {
              whereParts.push(
                `unaccent(${key}::text) ILIKE unaccent(${pgPlaceholderGenerator(index)})`
              )
            } else {
              whereParts.push(
                `unaccent(${key}::text) ${operator} unaccent(${pgPlaceholderGenerator(index)})`
              )
            }
          } else {
            whereParts.push(
              clientType === 'pg'
                ? `${key} ${operator} ${pgPlaceholderGenerator(index)}`
                : `${key} ${operator} ${mysqlPlaceholderGenerator()}`
            )
          }
          index++
          values.push(value)
        }
      }
    }
  }

  if ('JOINS' in conditions) {
    const logicalOperator = conditions.JOINS ? 'AND' : 'OR'
    const compositeConditions = conditions.JOINS

    if (Array.isArray(compositeConditions)) {
      const subWhereParts = compositeConditions
        .map((subCondition: any) => {
          if (
            typeof subCondition === 'object' &&
            !Array.isArray(subCondition) &&
            subCondition !== null
          ) {
            const key = Object.keys(subCondition)[0]
            const condition = subCondition[key]

            // Adiciona o tratamento de unaccent nas condições de JOINS
            processCondition(key, condition)
            return whereParts.pop()
          }
          return ''
        })
        .filter((part) => part)

      whereParts.push(`(${subWhereParts.join(` ${logicalOperator} `)})`)
    }
  } else {
    Object.entries(conditions).forEach(([key, value]) =>
      processCondition(key, value as Condition<T>)
    )
  }

  if ('OR' in conditions || 'AND' in conditions) {
    const logicalOperator = conditions.OR ? 'OR' : 'AND'
    const compositeConditions = conditions.OR || conditions.AND

    if (Array.isArray(compositeConditions)) {
      const subWhereParts = compositeConditions
        .map((subCondition: any) => {
          if (
            typeof subCondition === 'object' &&
            !Array.isArray(subCondition) &&
            subCondition !== null
          ) {
            const key = Object.keys(subCondition)[0]
            const condition = subCondition[key]
            processCondition(key, condition) // Certifica que o unaccent é processado aqui também
            return whereParts.pop()
          }

          return ''
        })
        .filter((part) => part)

      whereParts.push(`(${subWhereParts.join(` ${logicalOperator} `)})`)
    }
  }

  const whereClause =
    whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : ''
  return [whereClause, values, index]
}

/**
 * Creates an ORDER BY clause for a query
 *
 * This function creates an ORDER BY clause for a query. It takes an array of
 * order by fields and returns a string with the fields separated by commas.
 *
 * @param orderBy - The array of order by fields
 * @returns A string with the fields separated by commas
 *
 * @example
 * const orderBy = [{ field: 'created_at', direction: 'DESC' }]
 * const result = createOrderByClause(orderBy)
 * // result will be: "ORDER BY created_at DESC"
 */
export const createOrderByClause = (orderBy?: OrderBy) => {
  if (!orderBy || orderBy.length === 0) return ''
  const clause = orderBy.map((o) => `${o.field} ${o.direction}`).join(', ')
  return ` ORDER BY ${clause}`
}

/**
 * Creates a GROUP BY clause for a query
 *
 * This function creates a GROUP BY clause for a query. It takes an array of
 * group by fields and returns a string with the fields separated by commas.
 *
 * @param groupBy - The array of group by fields
 * @returns A string with the fields separated by commas
 *
 * @example
 * const groupBy = ['status']
 * const result = createGroupByClause(groupBy)
 * // result will be: "GROUP BY status"
 */
export const createGroupByClause = (groupBy?: string[]) => {
  if (!groupBy || groupBy.length === 0) return ''
  return ` GROUP BY ${groupBy.join(', ')}`
}

/**
 * Creates a LIMIT clause for a query
 *
 * This function creates a LIMIT clause for a query. It takes a limit number
 * and returns a string with the limit.
 *
 * @param limit - The limit number
 * @returns A string with the limit
 *
 * @example
 * const limit = 10
 * const result = createLimitClause(limit)
 * // result will be: "LIMIT 10"
 */
export const createLimitClause = (limit?: number) => {
  if (!limit) return ''
  return ` LIMIT ${limit}`
}

/**
 * Creates an OFFSET clause for a query
 *
 * This function creates an OFFSET clause for a query. It takes an offset number
 * and returns a string with the offset.
 *
 * @param offset - The offset number
 * @returns A string with the offset
 *
 * @example
 * const offset = 10
 * const result = createOffsetClause(offset)
 * // result will be: "OFFSET 10"
 */
export const createOffsetClause = (offset?: number) => {
  if (!offset) return ''
  return ` OFFSET ${offset}`
}
