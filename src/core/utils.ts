import { Conditions, Condition, OrderBy, DBClients } from './types'

/**
 * Matches a bare SQL identifier, optionally schema/table-qualified
 * (e.g. "id", "users", "users.id"). Used to validate table names,
 * GROUP BY / ORDER BY fields, join tables and delete-by fields, since
 * those are always plain identifiers and never need SQL expressions.
 */
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/

/**
 * Matches characters that have no legitimate use inside a SELECT
 * expression or a JOIN ON condition (statement terminators, comment
 * markers, backticks) but that are the building blocks of classic
 * SQL injection (stacked queries, comment-based truncation).
 */
const DANGEROUS_SQL_PATTERN = /(;|--|\/\*|\*\/|`)/

/**
 * Every operator `createWhereClause` knows how to render. Kept in sync with
 * `OperatorCondition['operator']` in `types.ts` — this is the runtime side of
 * that compile-time union, since `key`/`operator` reach this function as
 * plain strings regardless of what TypeScript enforced at the call site.
 */
/**
 * Maximum number of values accepted in a single `IN`/`NOT IN`/`BETWEEN`
 * condition array.
 *
 * This guards two real failure modes, both triggered by callers building a
 * WHERE condition from an unbounded list (e.g. forwarding a large search
 * result as an `IN` filter): pg's own wire protocol rejects a query with more
 * than 65535 total bound parameters, and — well before that limit — building
 * the values array with `values.push(...value)` throws
 * `RangeError: Maximum call stack size exceeded` once `value.length` is large
 * enough to overflow the JS engine's function-call argument limit. Chunk the
 * list (e.g. multiple `IN` queries unioned, or a temp table / `= ANY($1::type[])`
 * for pg) instead of growing a single condition past this size.
 */
const MAX_IN_LIST_SIZE = 10_000

const WHERE_OPERATOR_WHITELIST = new Set([
  'ILIKE',
  'LIKE',
  '=',
  '>',
  '<',
  'IN',
  'BETWEEN',
  '!=',
  '<=',
  '>=',
  'NOT IN',
  'NOT LIKE',
  'IS NULL',
  'IS NOT NULL',
  'NOT EXISTS',
])

/**
 * Validates that a value is a safe, bare SQL identifier
 *
 * This function throws when the value is anything other than a plain
 * identifier (letters, digits, underscore, optionally schema/table-qualified
 * with a single dot). It exists to stop identifiers coming from untrusted
 * input (table names, column names) from being used to inject arbitrary SQL,
 * since this library interpolates identifiers directly into the query string.
 *
 * @param value - The identifier to validate
 * @param label - A human-readable label used in the error message
 * @throws {Error} When the value is not a valid identifier
 *
 * @example
 * assertValidIdentifier('users', 'table name') // ok
 * assertValidIdentifier('users; DROP TABLE users', 'table name') // throws
 */
export const assertValidIdentifier = (value: string, label: string): void => {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". Only letters, numbers, underscores and a single dot (schema.table or table.column) are allowed.`
    )
  }
}

/**
 * Validates that a raw SQL fragment does not contain statement terminators,
 * comment markers or backticks
 *
 * Some parts of a query (SELECT fields, JOIN ON conditions) are allowed to
 * be full SQL expressions (e.g. "COUNT(*) as total"), so they cannot be
 * restricted to bare identifiers. This function instead blocks the
 * characters that have no legitimate use in those positions and that are
 * the building blocks of stacked-query and comment-based SQL injection.
 *
 * @param value - The SQL fragment to validate
 * @param label - A human-readable label used in the error message
 * @throws {Error} When the fragment contains disallowed characters
 *
 * @example
 * assertSafeSqlFragment('COUNT(*) as total', 'select field') // ok
 * assertSafeSqlFragment('id; DROP TABLE users; --', 'select field') // throws
 */
export const assertSafeSqlFragment = (value: string, label: string): void => {
  if (typeof value !== 'string' || DANGEROUS_SQL_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}" contains disallowed characters (; -- /* */ \`).`
    )
  }
}

/**
 * Quotes a column identifier using the target database's quoting convention
 *
 * This wraps a validated identifier in double quotes for PostgreSQL or
 * backticks for MySQL, so reserved words (e.g. "order", "group", "user",
 * "authorization") can be used as column names without a per-column special
 * case.
 *
 * @param identifier - The already-validated column identifier
 * @param clientType - The type of database client
 * @returns The quoted identifier
 *
 * @example
 * quoteIdentifier('order', 'pg') // '"order"'
 * quoteIdentifier('order', 'mysql') // '`order`'
 */
export const quoteIdentifier = (
  identifier: string,
  clientType: DBClients
): string => (clientType === 'pg' ? `"${identifier}"` : `\`${identifier}\``)

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
  if (!fields || fields.length === 0) return '*'

  fields.forEach((field) => assertSafeSqlFragment(field, 'select field'))

  return arrayToStringWithQuotes(fields, clientType)
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

        assertValidIdentifier(key, 'where field')
        if (!WHERE_OPERATOR_WHITELIST.has(operator)) {
          throw new Error(
            `Invalid where operator: "${operator}". Only ${[...WHERE_OPERATOR_WHITELIST].join(', ')} are allowed.`
          )
        }

        if (operator === 'NOT EXISTS' && typeof value === 'string') {
          assertSafeSqlFragment(value, 'where NOT EXISTS subquery')
          whereParts.push(`NOT EXISTS (${value})`)
        } else if (operator.includes('NULL')) {
          whereParts.push(`${key} ${operator}`)
        } else if (Array.isArray(value)) {
          if (value.length > MAX_IN_LIST_SIZE) {
            throw new Error(
              `Where condition on "${key}" has ${value.length} values for operator "${operator}", exceeding the maximum of ${MAX_IN_LIST_SIZE}. Chunk the query instead of growing a single condition this large.`
            )
          }

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
          // Not `values.push(...value)`: spreading a large array into a
          // function call can itself throw `RangeError: Maximum call stack
          // size exceeded` (V8's function-call argument limit), independent
          // of the MAX_IN_LIST_SIZE guard above catching merely-large lists.
          for (const item of value) {
            values.push(item)
          }
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

  Object.entries(conditions).forEach(([key, value]) => {
    if (key === 'JOINS' || key === 'OR' || key === 'AND') return
    processCondition(key, value as Condition<T>)
  })

  if ('JOINS' in conditions) {
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

      whereParts.push(`(${subWhereParts.join(' AND ')})`)
    }
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
  const clause = orderBy
    .map((o) => {
      assertSafeSqlFragment(o.field, 'orderBy field')
      if (o.direction !== 'ASC' && o.direction !== 'DESC') {
        throw new Error(
          `Invalid orderBy direction: "${o.direction}". Only ASC or DESC are allowed.`
        )
      }
      return `${o.field} ${o.direction}`
    })
    .join(', ')
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
  groupBy.forEach((field) => assertSafeSqlFragment(field, 'groupBy field'))
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
