import { describe, it, expect } from 'vitest'
import { computeInsights, getPeriodDates } from '../insights'
import type { LogEntry } from '../../types'

const makeLog = (
  overrides: Partial<LogEntry> & { startTime: number; duration: number }
): LogEntry => ({
  id: crypto.randomUUID(),
  timerId: 1,
  label: 'Work',
  endTime: overrides.startTime + overrides.duration * 1000,
  source: 'timer',
  ...overrides,
})

describe('computeInsights', () => {
  it('returns zero values for empty logs', () => {
    const { start, end, priorStart, priorEnd } = getPeriodDates('week', new Date('2026-03-30'))
    const result = computeInsights([], start, end, priorStart, priorEnd)

    expect(result.totalSeconds).toBe(0)
    expect(result.avgSessionSeconds).toBe(0)
    expect(result.longestSession.duration).toBe(0)
    expect(result.contextSwitchesPerDay).toBe(0)
    expect(result.periodOverPeriodDelta).toBe(0)
  })

  it('computes totals for single day', () => {
    const dayStart = new Date('2026-03-30T09:00:00').getTime()
    const logs: LogEntry[] = [
      makeLog({ startTime: dayStart, duration: 3600, label: 'Work' }),
      makeLog({ startTime: dayStart + 3600000, duration: 1800, label: 'Break', timerId: 2 }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('today', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.totalSeconds).toBe(5400)
    expect(result.avgSessionSeconds).toBe(2700)
    expect(result.longestSession.label).toBe('Work')
    expect(result.longestSession.duration).toBe(3600)
  })

  it('counts context switches correctly', () => {
    const dayStart = new Date('2026-03-30T09:00:00').getTime()
    const logs: LogEntry[] = [
      makeLog({ startTime: dayStart, duration: 3600, label: 'Work' }),
      makeLog({ startTime: dayStart + 3600000, duration: 1800, label: 'Break', timerId: 2 }),
      makeLog({ startTime: dayStart + 5400000, duration: 3600, label: 'Work' }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('today', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.contextSwitchesPerDay).toBe(2)
  })

  it('computes period-over-period delta', () => {
    const thisWeekDay = new Date('2026-03-30T10:00:00').getTime()
    const lastWeekDay = new Date('2026-03-23T10:00:00').getTime()

    const logs: LogEntry[] = [
      makeLog({ startTime: thisWeekDay, duration: 7200, label: 'Work' }),
      makeLog({ startTime: lastWeekDay, duration: 3600, label: 'Work' }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('week', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.periodOverPeriodDelta).toBe(3600)
  })

  it('builds label distribution', () => {
    const dayStart = new Date('2026-03-30T09:00:00').getTime()
    const logs: LogEntry[] = [
      makeLog({ startTime: dayStart, duration: 3600, label: 'Work' }),
      makeLog({ startTime: dayStart + 3600000, duration: 1800, label: 'Learn', timerId: 3 }),
      makeLog({ startTime: dayStart + 5400000, duration: 1800, label: 'Work' }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('today', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.labelDistribution['Work']).toBe(5400)
    expect(result.labelDistribution['Learn']).toBe(1800)
  })
})

describe('getPeriodDates', () => {
  it('week starts on Monday (fr locale)', () => {
    const { start } = getPeriodDates('week', new Date('2026-03-30'))
    expect(start.getDay()).toBe(1) // Monday
  })
})
