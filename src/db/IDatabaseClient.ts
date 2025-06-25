import { DBClients } from '../default/types'

/**
 * Database client interface
 */
export type IDatabaseClient = {
  clientType: DBClients
  query: <T>(sql: string, params?: any[]) => Promise<T>
}
