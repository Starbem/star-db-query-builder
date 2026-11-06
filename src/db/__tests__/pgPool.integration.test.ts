import { EventEmitter } from 'events'
import { initDb, getDbClient, closeAllDbClients } from '../initDb'
import { withTransaction } from '../../core/repository'
import { monitor, MonitorEvents } from '../../monitor/monitor'

// Unlike the other db tests, `pg` is NOT mocked here: these run the real
// pg-pool against a fake `Client` (injected through the `Client` pool option),
// so a pg-pool upgrade that changes how it emits 'error', detaches listeners
// on checkout or handles `release(err)` breaks these tests instead of
// production.

let clients: FakeClient[] = []
let commitError: Error | undefined

class FakeClient extends EventEmitter {
  // pg-pool reads these private flags on release to decide whether to keep
  // the client.
  _queryable = true
  _ending = false
  ended = false
  sent: string[] = []

  constructor() {
    super()
    clients.push(this)
  }

  connect(callback: (error?: Error) => void) {
    setImmediate(() => callback())
  }

  query(sql: any, values?: any, callback?: any) {
    if (typeof values === 'function') {
      callback = values
      values = undefined
    }
    const text: string = typeof sql === 'string' ? sql : sql.text
    this.sent.push(text)

    const result = new Promise((resolve, reject) =>
      setImmediate(() => {
        if (!this._queryable) {
          return reject(new Error('Client is not queryable'))
        }
        if (text === 'COMMIT' && commitError) return reject(commitError)
        resolve({ rows: [{ ok: 1 }] })
      })
    )

    if (callback) {
      result.then(
        (value) => callback(null, value),
        (error) => callback(error)
      )
      return undefined
    }
    return result
  }

  end(callback?: () => void) {
    this.ended = true
    this._ending = true
    if (callback) setImmediate(callback)
    return Promise.resolve()
  }

  /** Simulates the server dropping this connection (failover, restart). */
  drop(error: Error) {
    this._queryable = false
    this.emit('error', error)
  }
}

describe('pg pool resilience (real pg-pool, fake connection)', () => {
  const poolErrors: any[] = []
  const onPoolError = (event: any) => poolErrors.push(event)

  beforeEach(async () => {
    clients = []
    commitError = undefined
    poolErrors.length = 0
    monitor.on(MonitorEvents.POOL_ERROR, onPoolError)
    await initDb({
      name: 'resilience',
      type: 'pg',
      options: { Client: FakeClient, max: 2 },
    })
  })

  afterEach(async () => {
    monitor.removeListener(MonitorEvents.POOL_ERROR, onPoolError)
    await closeAllDbClients()
  })

  it('survives an idle connection being terminated', async () => {
    const db = getDbClient('resilience')
    await db.query('SELECT 1')
    const error = new Error(
      'terminating connection due to administrator command'
    )

    // pg-pool re-emits this on the pool; with no listener it would throw.
    expect(() => clients[0].drop(error)).not.toThrow()

    expect(poolErrors).toEqual([
      expect.objectContaining({ clientName: 'resilience', error }),
    ])
    // The pool keeps working on a fresh connection.
    await expect(db.query('SELECT 1')).resolves.toEqual([{ ok: 1 }])
  })

  it('survives the connection dropping mid-transaction and discards it', async () => {
    const db = getDbClient('resilience')
    const error = new Error('Connection terminated unexpectedly')

    await expect(
      withTransaction(db, async (tx) => {
        await tx.query('SELECT 1')
        clients[clients.length - 1].drop(error)
        await tx.query('UPDATE t SET a = 1')
      })
    ).rejects.toThrow('Client is not queryable')

    expect(poolErrors).toEqual([
      expect.objectContaining({
        clientName: 'resilience',
        error,
        inTransaction: true,
      }),
    ])
    expect(clients[clients.length - 1].ended).toBe(true)
  })

  it('propagates a failed COMMIT without a ROLLBACK or a double release', async () => {
    const db = getDbClient('resilience')
    commitError = Object.assign(new Error('could not serialize access'), {
      code: '40001',
      severity: 'ERROR',
    })

    await expect(withTransaction(db, async () => 'ok')).rejects.toBe(
      commitError
    )

    const [client] = clients
    expect(client.sent).toEqual(['BEGIN', 'COMMIT'])
    // A plain SQL error leaves the connection usable: it goes back to the
    // pool and serves the next query.
    expect(client.ended).toBe(false)
    commitError = undefined
    await db.query('SELECT 1')
    expect(clients).toHaveLength(1)
  })
})
