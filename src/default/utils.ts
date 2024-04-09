import { Conditions, Condition, OrderBy, DBClients } from './types'

const arrayToStringWithQuotes = (
  items: string[],
  clientType: DBClients
): string => {
  const itemsWithQuotes = items.map((item) =>
    clientType === 'pg' ? `"${item}"` : `${item}`
  )
  return itemsWithQuotes.join(', ')
}

const pgPlaceholderGenerator = (index: number) => `$${index}`
const mysqlPlaceholderGenerator = () => `?`

export const createSelectFields = (
  fields: string[] = [],
  clientType: DBClients
): string => {
  return fields && fields.length > 0
    ? arrayToStringWithQuotes(fields, clientType)
    : '*'
}

export const generatePlaceholders = (
  keys: any[],
  clientType: DBClients
): string => {
  return keys
    .map((_, index) => (clientType === 'pg' ? `$${index + 1}` : '?'))
    .join(', ')
}

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

export const createWhereClause = <T>(
  conditions: Conditions<T> = {},
  startIndex = 1,
  clientType: DBClients
): [string, any[], number] => {
  let index = startIndex
  const whereParts: string[] = []
  const values: any[] = []

  const processCondition = (key: string, condition: Condition<T>) => {
    if (typeof condition === 'object' && condition !== null) {
      if ('operator' in condition && 'value' in condition) {
        const { operator, value } = condition
        if (Array.isArray(value)) {
          const placeholders = value
            .map(() =>
              clientType === 'pg'
                ? pgPlaceholderGenerator(index++)
                : mysqlPlaceholderGenerator()
            )
            .join(', ')

          if (operator === 'BETWEEN') {
            whereParts.push(
              clientType === 'pg'
                ? `"${key}" ${operator} ${placeholders.replace(', ', ' AND ')}`
                : `${key} ${operator} ${placeholders.replace(', ', ' AND ')}`
            )
          } else if (operator === 'IN') {
            whereParts.push(
              clientType === 'pg'
                ? `"${key}" ${operator} ${placeholders.replace(', ', ' AND ')}`
                : `${key} ${operator} (${placeholders})`
            )
          } else {
            whereParts.push(
              clientType === 'pg'
                ? `"${key}" ${operator} (${placeholders})`
                : `${key} ${operator} ${placeholders}`
            )
          }
          values.push(...value)
        } else {
          whereParts.push(
            clientType === 'pg'
              ? `"${key}" ${operator} ${pgPlaceholderGenerator(index++)}`
              : `${key} ${operator} ${mysqlPlaceholderGenerator()}`
          )

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

            processCondition(key, condition)
            return whereParts.pop()
          }
          return ''
        })
        .filter((part) => part)
      whereParts.push(
        clientType === 'pg'
          ? `(${subWhereParts.join(` ${logicalOperator} `)})`
          : `${subWhereParts.join(` ${logicalOperator} `)}`
      )
    }
  } else {
    Object.entries(conditions).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      processCondition(key, value)
    })
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
            processCondition(key, condition)
            return whereParts.pop()
          }

          return ''
        })
        .filter((part) => part)

      whereParts.push(
        clientType === 'pg'
          ? `(${subWhereParts.join(` ${logicalOperator} `)})`
          : `${subWhereParts.join(` ${logicalOperator} `)}`
      )
    }
  } else {
    Object.entries(conditions).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      processCondition(key, value)
    })
  }

  const whereClause =
    whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : ''

  return [whereClause, values, index]
}

export const createOrderByClause = (orderBy?: OrderBy) => {
  if (!orderBy || orderBy.length === 0) return ''
  const clause = orderBy.map((o) => `${o.field} ${o.direction}`).join(', ')
  return ` ORDER BY ${clause}`
}

export const createGroupByClause = (groupBy?: string[]) => {
  if (!groupBy || groupBy.length === 0) return ''
  return ` GROUP BY ${groupBy.join(', ')}`
}

export const createLimitClause = (limit?: number) => {
  if (!limit) return ''
  return ` LIMIT ${limit}`
}
