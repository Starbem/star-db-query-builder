import { DBClients } from '../default/types'

export type IDatabaseClient = {
  clientType: DBClients
  query: <T>(sql: string, params?: any[]) => Promise<T>
}
