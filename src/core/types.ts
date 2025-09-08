import { IDatabaseClient } from '../db/IDatabaseClient'

export interface RetryOptions {
  retries?: number
  factor?: number
  minTimeout?: number
  maxTimeout?: number
  randomize?: boolean
}

export interface QueryExec {
  text: string
  values?: any[]
}

type SimpleValue = string | number | boolean | Date

export interface OperatorCondition {
  operator:
    | 'ILIKE'
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
    | 'IS NULL'
    | 'IS NOT NULL'
    | 'NOT EXISTS'
  value: SimpleValue | SimpleValue[]
}

export type LogicalOperator = 'OR' | 'AND'

export type Condition<T> = OperatorCondition | LogicalCondition<T>

interface LogicalCondition<T> {
  OR?: Conditions<T>[]
  AND?: Conditions<T>[]
  JOINS?: Conditions<object>
  notExists?: OperatorCondition
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
  offset?: number
  joins?: JoinClause[]
  unaccent?: boolean
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
  limit?: string
  offset?: string
}

export interface RawQueryParams {
  dbClient: IDatabaseClient
  sql: string
  params?: any[]
}

export interface TransactionParams {
  dbClient: IDatabaseClient
}
