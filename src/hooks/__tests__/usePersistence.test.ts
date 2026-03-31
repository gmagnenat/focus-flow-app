import { describe, it, expect } from 'vitest'
import { endOfDay } from 'date-fns'
import { handleDayBoundary } from '../usePersistence'
import type { AppState } from '../../types'

// Fixed timestamps for deterministic tests
// "yesterday" = 2026-03-30 12:00:00 UTC
const YESTERDAY_NOON = new Date('2026-03-30T12:00:00.000Z').getTime()
// "today" = 2026-03-31 10:00:00 UTC
const TODAY_10AM = new Date('2026-03-31T10:00:00.000Z').getTime()

// Midnight at end of 2026-03-30 in local time
const YESTERDAY_MIDNIGHT = endOfDay(YESTERDAY_NOON).getTime()
// Gap in seconds from YESTERDAY_NOON to end of that day
const GAP_TO_MIDNIGHT = Math.floor(
  (YESTERDAY_MIDNIGHT - YESTERDAY_NOON) / 1000
)

const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  activeTimerId: null,
  timerLabels: { 1: 'Work', 2: 'Break', 3: 'Learn' },
  timerValues: { 1: 0, 2: 0, 3: 0 },
  logs: [],
  lastSavedAt: YESTERDAY_NOON,
  ...overrides,
})

describe('handleDayBoundary', () => {
  describe('returns null when no boundary was crossed', () => {
    it('returns null when lastSavedAt is today and no active timer', () => {
      const stored = makeState({ lastSavedAt: TODAY_10AM })
      expect(handleDayBoundary(stored, TODAY_10AM + 1000)).toBeNull()
    })

    it('returns null when lastSavedAt is today and timer is active', () => {
      const stored = makeState({
        lastSavedAt: TODAY_10AM,
        activeTimerId: 1,
        logs: [
          {
            id: 'log-1',
            timerId: 1,
            label: 'Work',
            startTime: TODAY_10AM,
            endTime: TODAY_10AM,
            duration: 0,
            source: 'timer',
          },
        ],
      })
      expect(handleDayBoundary(stored, TODAY_10AM + 5000)).toBeNull()
    })

    it('returns null when day boundary crossed but no active timer', () => {
      const stored = makeState({
        lastSavedAt: YESTERDAY_NOON,
        activeTimerId: null,
      })
      expect(handleDayBoundary(stored, TODAY_10AM)).toBeNull()
    })
  })

  describe('patches state when day boundary is crossed with active timer', () => {
    const makeActiveState = (): AppState =>
      makeState({
        activeTimerId: 1,
        timerValues: { 1: 100, 2: 0, 3: 0 },
        logs: [
          {
            id: 'log-1',
            timerId: 1,
            label: 'Work',
            startTime: YESTERDAY_NOON,
            endTime: YESTERDAY_NOON,
            duration: 0,
            source: 'timer',
          },
        ],
      })

    it('returns a non-null patched state', () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)
      expect(result).not.toBeNull()
    })

    it("sets the log entry's endTime to midnight of lastSavedAt day", () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)!
      expect(result.logs[0].endTime).toBe(YESTERDAY_MIDNIGHT)
    })

    it("adds gap-to-midnight seconds to the log entry's duration", () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)!
      expect(result.logs[0].duration).toBe(GAP_TO_MIDNIGHT)
    })

    it('resets timerValues to { 1: 0, 2: 0, 3: 0 }', () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)!
      expect(result.timerValues).toEqual({ 1: 0, 2: 0, 3: 0 })
    })

    it('sets activeTimerId to null', () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)!
      expect(result.activeTimerId).toBeNull()
    })

    it('sets lastSavedAt to now', () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)!
      expect(result.lastSavedAt).toBe(TODAY_10AM)
    })

    it('preserves timerLabels', () => {
      const result = handleDayBoundary(makeActiveState(), TODAY_10AM)!
      expect(result.timerLabels).toEqual({ 1: 'Work', 2: 'Break', 3: 'Learn' })
    })

    it('preserves other log entries', () => {
      const stored = makeState({
        activeTimerId: 1,
        timerValues: { 1: 50, 2: 0, 3: 0 },
        logs: [
          {
            id: 'log-prev',
            timerId: 2,
            label: 'Break',
            startTime: YESTERDAY_NOON - 3600_000,
            endTime: YESTERDAY_NOON,
            duration: 3600,
            source: 'timer',
          },
          {
            id: 'log-1',
            timerId: 1,
            label: 'Work',
            startTime: YESTERDAY_NOON,
            endTime: YESTERDAY_NOON,
            duration: 0,
            source: 'timer',
          },
        ],
      })
      const result = handleDayBoundary(stored, TODAY_10AM)!
      expect(result.logs).toHaveLength(2)
      expect(result.logs[0].id).toBe('log-prev')
      expect(result.logs[0].duration).toBe(3600)
    })

    it('uses the latest log for the active timer (not an earlier one)', () => {
      const stored = makeState({
        activeTimerId: 1,
        timerValues: { 1: 200, 2: 0, 3: 0 },
        logs: [
          {
            id: 'log-old',
            timerId: 1,
            label: 'Work',
            startTime: YESTERDAY_NOON - 7200_000,
            endTime: YESTERDAY_NOON - 3600_000,
            duration: 3600,
            source: 'timer',
          },
          {
            id: 'log-new',
            timerId: 1,
            label: 'Work',
            startTime: YESTERDAY_NOON,
            endTime: YESTERDAY_NOON,
            duration: 0,
            source: 'timer',
          },
        ],
      })
      const result = handleDayBoundary(stored, TODAY_10AM)!
      // old log unchanged
      expect(result.logs[0].duration).toBe(3600)
      // new (latest) log patched
      expect(result.logs[1].endTime).toBe(YESTERDAY_MIDNIGHT)
      expect(result.logs[1].duration).toBe(GAP_TO_MIDNIGHT)
    })
  })

  describe('edge case: no existing log for the active timer', () => {
    it('returns null when there is no log entry for the active timer', () => {
      // If there is no log entry, nothing to close — return null so caller
      // handles the gap via the regular hydration path (or simply resets).
      // This is a graceful-degradation case.
      const stored = makeState({
        activeTimerId: 1,
        timerValues: { 1: 0, 2: 0, 3: 0 },
        logs: [],
      })
      // No log to close → return null; caller resets instead.
      expect(handleDayBoundary(stored, TODAY_10AM)).toBeNull()
    })
  })
})
