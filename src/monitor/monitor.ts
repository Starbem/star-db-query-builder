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

// This is a shared singleton: an app using multiple named db clients
// (see initDb's `name` option) can easily attach more than the default 10
// listeners per event (e.g. one logger/metrics/tracing consumer per client),
// without that being a real leak. Raise the cap instead of letting Node warn
// on a legitimate multi-client setup; still bounded (not 0/Infinity) so an
// actual listener leak keeps surfacing a warning.
monitor.setMaxListeners(20)
