import {
  Conditions,
  Condition,
  CompositeCondition,
  OrderBy,
  DBClients,
} from './types'

const arrayToStringWithQuotes = (items: string[]): string => {
  const itemsWithQuotes = items.map((item) => `"${item}"`)
  return itemsWithQuotes.join(', ')
}

export const createSelectFields = (fields?: string[]): string => {
  return fields && fields.length > 0 ? arrayToStringWithQuotes(fields) : '*'
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

export const createWhereClause = (
  conditions: Conditions = {},
  startIndex: number = 1
): [string, any[], number] => {
  let index = startIndex
  const whereParts: string[] = []
  const values: any[] = []

  const processCondition = (key: string, condition: Condition): number => {
    if (typeof condition === 'object' && condition !== null) {
      if ('operator' in condition && 'value' in condition) {
        const { operator, value } = condition
        if (Array.isArray(value)) {
          const placeholders = value.map(() => `$${index++}`).join(', ')
          if (operator === 'BETWEEN') {
            whereParts.push(
              `"${key}" ${operator} ${placeholders.replace(', ', ' AND ')}`
            )
          } else {
            whereParts.push(`"${key}" ${operator} (${placeholders})`)
          }
          values.push(...value)
        } else {
          whereParts.push(`"${key}" ${operator} $${index++}`)
          values.push(value)
        }
      } else if ('type' in condition && 'conditions' in condition) {
        const compositeCondition: CompositeCondition = condition
        const subWhereParts: string[] = []
        compositeCondition.conditions.forEach((subCondition) => {
          // Recurso: criar uma chave fictícia, pois as condições compostas não necessitam de chave
          index = processCondition('', subCondition)
        })
        whereParts.push(
          `(${subWhereParts.join(` ${compositeCondition.type} `)})`
        )
      }
    } else if (key) {
      // Condição simples
      whereParts.push(`"${key}" = $${index}`)
      values.push(condition)
      index++
    }
    return index
  }

  Object.entries(conditions).forEach(([key, value]) => {
    index = processCondition(key, value)
  })

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
