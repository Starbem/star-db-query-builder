import { IDatabaseClient } from './src/db/IDatabaseClient'
import { DBClients, QueryParams } from './src/default/types'

export declare function initDb<T>(config: { type: DBClients; options: T }): void
export declare function getDbClient(): IDatabaseClient

export declare function findFirst<T>({
  tableName,
  dbClient,
  select,
  where,
  groupBy,
  orderBy,
}: QueryParams): Promise<T>

export declare function findMany<T>({
  tableName,
  dbClient,
  select,
  where,
  groupBy,
  orderBy,
  limit,
}: QueryParams): Promise<T[]>

export declare function insert<T>({
  tableName,
  dbClient,
  data,
  returning,
}: QueryParams & { data: T; returning?: string[] }): Promise<T | void>

export declare function update<T>({
  tableName,
  dbClient,
  id,
  data,
  returning,
}: QueryParams & { data: T; returning?: string[] }): Promise<T | void>

export declare function deleteOne({
  tableName,
  dbClient,
  id,
  permanently,
}: QueryParams & { permanently?: boolean }): Promise<void>
