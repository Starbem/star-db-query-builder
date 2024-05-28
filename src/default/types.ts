import { IDatabaseClient } from '../db/IDatabaseClient'

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
  JOINS?: Conditions<object>
}

export type Conditions<T> = {
  [P in keyof T]?: Condition<T[P]>
} & LogicalCondition<T>

export type DBClients = 'pg' | 'mysql'

export type OrderBy = { field: string; direction: 'ASC' | 'DESC' }[]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface QueryParams<T> {
  tableName: string
  dbClient: IDatabaseClient
  id?: string
  select?: string[]
  where?: Conditions<T>
  orderBy?: OrderBy
  groupBy?: string[]
  limit?: number
  offset?: number
  joins?: JoinClause[]
}

interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: string
}

export interface QueryBuilder {
  select: string[]
  from?: string
  joins?: JoinClause[]
  where?: string
  groupBy?: string[]
  orderBy?: string
}
