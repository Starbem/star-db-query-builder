import { IDatabaseClient } from '../../db/IDatabaseClient'

export interface QueryExec {
  text: string
  values?: any[]
}

type SimpleValue = string | number | boolean | Date

export interface OperatorCondition {
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

export type LogicalOperator = 'OR' | 'AND'

export type Condition<T> = OperatorCondition | LogicalCondition<T>

interface LogicalCondition<T> {
  OR?: Conditions<T>[]
  AND?: Conditions<T>[]
}

export type Conditions<T> = {
  [P in keyof T]?: Condition<T[P]>
} & LogicalCondition<T>

export type DBClients = 'pg' | 'mysql'

export type OrderBy = { field: string; direction: 'ASC' | 'DESC' }[]

export interface QueryParams<T> {
  tableName: string
  dbClient: IDatabaseClient
  id?: string
  select?: string[]
  where?: Conditions<T>
  orderBy?: OrderBy
  groupBy?: string[]
  limit?: number
}
