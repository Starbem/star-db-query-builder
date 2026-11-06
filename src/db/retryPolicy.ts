import { RetryOptions } from '../core/types'

/**
 * Applied when `initDb` gets no `retryOptions`. `promise-retry`'s own default
 * is 10 retries with an unbounded backoff (~17 minutes per query), which
 * multiplies load on a database that is already failing over. An explicit
 * `retryOptions` replaces this object as a whole, it is never merged into it.
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 2,
  maxTimeout: 2000,
}

/**
 * Errors raised before the statement reaches the server: the query was never
 * executed, so retrying it is safe even for a write.
 */
const notSentErrorCodes = new Set(['ECONNREFUSED'])

const readOnlySqlPattern = /^\s*(SELECT|SHOW|EXPLAIN)\b/i

/**
 * Whether a statement is a plain read and can be re-sent after a dropped
 * connection without risking a duplicated write.
 *
 * Deliberately conservative: `WITH ...` is treated as a write because a CTE
 * can wrap an `INSERT`/`UPDATE`/`DELETE`, and anything that does not start
 * with a read keyword (including a leading comment) is treated as a write.
 * A `SELECT` that calls a function with side effects is still classified as a
 * read — don't route such calls through an auto-retrying client.
 */
export function isReadOnlyQuery(sql: string): boolean {
  return readOnlySqlPattern.test(sql)
}

/**
 * Decides whether a failed query should be retried.
 *
 * A transient connection error mid-query (`ECONNRESET`, `ETIMEDOUT`, ...)
 * leaves it unknown whether a write was applied, so writes are only retried
 * when the caller opts in with `retryOptions.retryWrites`.
 *
 * @param error - The error thrown by the driver
 * @param sql - The statement that failed
 * @param transientErrorCodes - Driver-specific codes considered transient
 * @param retryOptions - The retry options in effect for the client
 */
export function shouldRetry(
  error: any,
  sql: string,
  transientErrorCodes: Set<string>,
  retryOptions: RetryOptions
): boolean {
  if (!error || !error.code || !transientErrorCodes.has(error.code)) {
    return false
  }

  return (
    notSentErrorCodes.has(error.code) ||
    retryOptions.retryWrites === true ||
    isReadOnlyQuery(sql)
  )
}

/**
 * Strips the library-only flags before handing the options to `promise-retry`.
 */
export function toPromiseRetryOptions(
  retryOptions: RetryOptions
): Omit<RetryOptions, 'retryWrites'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { retryWrites, ...operationOptions } = retryOptions
  return operationOptions
}
