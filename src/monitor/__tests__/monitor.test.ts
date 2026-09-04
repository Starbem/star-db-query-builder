import { monitor, MonitorEvents } from '../monitor'

describe('monitor', () => {
  it('raises the max listeners cap above the default of 10', () => {
    expect(monitor.getMaxListeners()).toBe(20)
  })

  it('does not warn when more than 10 listeners are attached to the same event', () => {
    const warnSpy = jest.spyOn(process, 'emitWarning')

    const noop = () => {}
    for (let i = 0; i < 15; i++) {
      monitor.on(MonitorEvents.QUERY_START, noop)
    }

    expect(warnSpy).not.toHaveBeenCalled()

    monitor.removeAllListeners(MonitorEvents.QUERY_START)
    warnSpy.mockRestore()
  })

  it('exposes the expected event names', () => {
    expect(MonitorEvents).toEqual({
      CONNECTION_CREATED: 'connection_created',
      QUERY_START: 'query_start',
      QUERY_END: 'query_end',
      QUERY_ERROR: 'query_error',
      RETRY_ATTEMPT: 'retry_attempt',
      TRANSACTION_COMMIT: 'transaction_commit',
      TRANSACTION_ROLLBACK: 'transaction_rollback',
    })
  })

  it('emits and delivers events to listeners', () => {
    const listener = jest.fn()
    monitor.on(MonitorEvents.QUERY_ERROR, listener)

    monitor.emit(MonitorEvents.QUERY_ERROR, { sql: 'SELECT 1' })

    expect(listener).toHaveBeenCalledWith({ sql: 'SELECT 1' })
    monitor.removeAllListeners(MonitorEvents.QUERY_ERROR)
  })
})
