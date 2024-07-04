import { IDatabaseClient } from './src/db/IDatabaseClient'
import { DBClients, QueryParams } from './src/default/types'

export declare function initDb<T>(config: { type: DBClients; options: T }): void
export declare function getDbClient(): IDatabaseClient

// Generic Methods
export declare function findFirst<T>({
  tableName,
  dbClient,
  select,
  where,
  groupBy,
  orderBy,
}: QueryParams<T>): Promise<T | null>

export declare function findMany<T>({
  tableName,
  dbClient,
  select,
  where,
  groupBy,
  orderBy,
  limit,
  offset,
}: QueryParams<T>): Promise<T[]>

export declare function insert<P, R>({
  tableName,
  dbClient,
  data,
  returning,
}: QueryParams<R> & { data: P; returning?: string[] }): Promise<R | void>

export declare function update<T>({
  tableName,
  dbClient,
  id,
  data,
  returning,
}: QueryParams<T> & { data: T; returning?: string[] }): Promise<T | void>

export declare function deleteOne<T>({
  tableName,
  dbClient,
  id,
  permanently,
}: QueryParams<T> & { permanently?: boolean }): Promise<void>

export declare function joins<T>({
  tableName,
  dbClient,
  select,
  joins,
  where,
  groupBy,
  orderBy,
  limit,
  offset,
}: QueryParams<T>): Promise<T[]>
