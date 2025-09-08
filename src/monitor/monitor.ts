import { EventEmitter } from 'stream'

/**
 * Monitor events
 */
export enum MonitorEvents {
  CONNECTION_CREATED = 'connection_created',
  QUERY_START = 'query_start',
  QUERY_END = 'query_end',
  QUERY_ERROR = 'query_error',
  RETRY_ATTEMPT = 'retry_attempt',
  TRANSACTION_COMMIT = 'transaction_commit',
  TRANSACTION_ROLLBACK = 'transaction_rollback',
}

export const monitor = new EventEmitter()
