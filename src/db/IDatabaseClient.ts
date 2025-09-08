import { DBClients } from '../core/types'

export interface ITransactionClient {
  query: <T>(sql: string, params?: any[]) => Promise<T>
  commit: () => Promise<void>
  rollback: () => Promise<void>
}

/**
 * Database client interface
 */
export type IDatabaseClient = {
  clientType: DBClients
  query: <T>(sql: string, params?: any[]) => Promise<T>
  beginTransaction: () => Promise<ITransactionClient>
}
