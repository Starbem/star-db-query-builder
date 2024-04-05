import { createSelectFields, createWhereClause } from '../../default/utils'
import { QueryParams } from '../../default/types'

export const getByUserAndSubscription = async <T>({
  tableName,
  dbClient,
  select,
  where,
}: QueryParams<T>): Promise<T | null> => {
  if (!tableName) throw new Error('Table name is required')
  if (!dbClient) throw new Error('DB client is required')

  const fields = createSelectFields(select, dbClient.clientType)
  const [whereClause, params] = createWhereClause<T>(
    where,
    1,
    dbClient.clientType
  )

  const rows = await dbClient.query<T>(
    `SELECT 
        ${fields}
      FROM payments.plan_association_users pa
      INNER JOIN payments.plans ON pa.plan_id = plans.id
        ${whereClause}
        AND pa.status IN ('active', 'cancelation_requested', 'blocked')`,
    params
  )

  return rows[0] || null
}
