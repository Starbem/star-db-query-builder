import { DBClients } from '../core/types'

/**
 * What every query-executing function in `repository.ts` (`findFirst`,
 * `insert`, `update`, ...) actually needs from a client: `clientType` (to
 * pick the right placeholder/quoting dialect) and `query`. Kept separate
 * from `IDatabaseClient` so a transaction client — which has no
 * `beginTransaction` of its own — can be passed as `dbClient` to these
 * functions too (`withTransaction(dbClient, (tx) => insert({ dbClient: tx, ... }))`,
 * the pattern documented in `docs/methods/transactions.md` and the README).
 */
export interface IQueryClient {
  clientType: DBClients
  query: <T>(sql: string, params?: any[]) => Promise<T>
}

export interface ITransactionClient extends IQueryClient {
  commit: () => Promise<void>
  rollback: () => Promise<void>
}

/**
 * Database client interface
 */
export type IDatabaseClient = IQueryClient & {
  beginTransaction: () => Promise<ITransactionClient>
}
