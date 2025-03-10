import { EventEmitter } from 'stream'

export enum MonitorEvents {
  CONNECTION_CREATED = 'connection_created',
  QUERY_START = 'query_start',
  QUERY_END = 'query_end',
  QUERY_ERROR = 'query_error',
  RETRY_ATTEMPT = 'retry_attempt',
}

export const monitor = new EventEmitter()
