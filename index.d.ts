import { QueryParams } from './src/default/types'

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
