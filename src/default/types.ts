import { IDatabaseClient } from '../db/IDatabaseClient'

export interface QueryExec {
  text: string
  values?: any[]
}

type SimpleValue = string | number | boolean | Date

type ConditionOperator = 'AND' | 'OR'

interface OperatorCondition {
  operator:
    | 'LIKE'
    | '='
    | '>'
    | '<'
    | 'IN'
    | 'BETWEEN'
    | '!='
    | '<='
    | '>='
    | 'NOT IN'
    | 'LIKE'
    | 'NOT LIKE'
  value: SimpleValue | SimpleValue[]
}

export type DBClients = 'pg' | 'mysql'

export interface CompositeCondition {
  type: ConditionOperator
  conditions: Condition[]
}

export type Condition = SimpleValue | OperatorCondition | CompositeCondition

export interface Conditions {
  [key: string]: Condition
}

export type OrderBy = { field: string; direction: 'ASC' | 'DESC' }[]

export interface QueryParams {
  tableName: string
  dbClient: IDatabaseClient
  id?: string
  select?: string[]
  where?: Conditions
  orderBy?: OrderBy
  groupBy?: string[]
  limit?: number
}
