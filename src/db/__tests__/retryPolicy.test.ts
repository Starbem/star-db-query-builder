import {
  DEFAULT_RETRY_OPTIONS,
  isReadOnlyQuery,
  resolveRetryOptions,
  shouldRetry,
  toPromiseRetryOptions,
} from '../retryPolicy'

const transientErrorCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'])

const errorWithCode = (code: string) => Object.assign(new Error(code), { code })

describe('retryPolicy', () => {
  describe('DEFAULT_RETRY_OPTIONS', () => {
    it('bounds retries and backoff (promise-retry would default to 10 retries, unbounded)', () => {
      expect(DEFAULT_RETRY_OPTIONS).toEqual({ retries: 2, maxTimeout: 2000 })
    })

    it('cannot be mutated by a consumer', () => {
      expect(Object.isFrozen(DEFAULT_RETRY_OPTIONS)).toBe(true)
    })
  })

  describe('resolveRetryOptions', () => {
    it('returns the defaults when nothing is passed', () => {
      expect(resolveRetryOptions()).toEqual({ retries: 2, maxTimeout: 2000 })
    })

    it('keeps the bounded defaults when only retryWrites is passed', () => {
      expect(resolveRetryOptions({ retryWrites: true })).toEqual({
        retries: 2,
        maxTimeout: 2000,
        retryWrites: true,
      })
    })

    it('lets explicit values override the defaults', () => {
      expect(resolveRetryOptions({ retries: 5, maxTimeout: 10_000 })).toEqual({
        retries: 5,
        maxTimeout: 10_000,
      })
    })

    it('ignores keys explicitly set to undefined', () => {
      expect(resolveRetryOptions({ retries: undefined })).toEqual({
        retries: 2,
        maxTimeout: 2000,
      })
    })
  })

  describe('isReadOnlyQuery', () => {
    it.each([
      'SELECT * FROM users',
      '  select id from users',
      '\n\tSELECT 1',
      'SHOW TABLES',
      'EXPLAIN SELECT 1',
    ])('treats %p as a read', (sql) => {
      expect(isReadOnlyQuery(sql)).toBe(true)
    })

    it.each([
      'INSERT INTO users (name) VALUES ($1)',
      'UPDATE users SET name = $1',
      'DELETE FROM users',
      'WITH moved AS (DELETE FROM a RETURNING *) INSERT INTO b SELECT * FROM moved',
      '/* comment */ SELECT 1',
      'EXPLAIN ANALYZE DELETE FROM users',
      'EXPLAIN (ANALYZE, BUFFERS) UPDATE users SET name = $1',
      'explain analyse insert into users (name) values ($1)',
      'SELECT * INTO users_backup FROM users',
      'SELECT id INTO @last_id FROM users LIMIT 1',
      'SELECTED',
      '',
    ])('treats %p as a write', (sql) => {
      expect(isReadOnlyQuery(sql)).toBe(false)
    })
  })

  describe('shouldRetry', () => {
    it('retries a read on a transient error', () => {
      expect(
        shouldRetry(
          errorWithCode('ECONNRESET'),
          'SELECT 1',
          transientErrorCodes,
          {}
        )
      ).toBe(true)
    })

    it('does not retry a write on a transient error mid-query', () => {
      expect(
        shouldRetry(
          errorWithCode('ETIMEDOUT'),
          'INSERT INTO t VALUES (1)',
          transientErrorCodes,
          {}
        )
      ).toBe(false)
    })

    it('retries a write that never reached the server', () => {
      expect(
        shouldRetry(
          errorWithCode('ECONNREFUSED'),
          'INSERT INTO t VALUES (1)',
          transientErrorCodes,
          {}
        )
      ).toBe(true)
    })

    it('retries a write when retryWrites is enabled', () => {
      expect(
        shouldRetry(
          errorWithCode('ECONNRESET'),
          'INSERT INTO t VALUES (1)',
          transientErrorCodes,
          { retryWrites: true }
        )
      ).toBe(true)
    })

    it('never retries a non-transient error', () => {
      expect(
        shouldRetry(errorWithCode('23505'), 'SELECT 1', transientErrorCodes, {
          retryWrites: true,
        })
      ).toBe(false)
      expect(
        shouldRetry(new Error('no code'), 'SELECT 1', transientErrorCodes, {})
      ).toBe(false)
      expect(shouldRetry(undefined, 'SELECT 1', transientErrorCodes, {})).toBe(
        false
      )
    })
  })

  describe('toPromiseRetryOptions', () => {
    it('drops the library-only retryWrites flag', () => {
      expect(
        toPromiseRetryOptions({ retries: 1, minTimeout: 5, retryWrites: true })
      ).toEqual({ retries: 1, minTimeout: 5 })
    })
  })
})
