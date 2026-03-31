import { describe, it, expect } from 'vitest'
import { isValidTimeRange, findOverlappingLog } from '../validators'
import type { LogEntry } from '../../types'

describe('isValidTimeRange', () => {
  it('returns true for valid range', () => {
    expect(isValidTimeRange(1000, 2000)).toBe(true)
  })

  it('returns false when end <= start', () => {
    expect(isValidTimeRange(2000, 1000)).toBe(false)
    expect(isValidTimeRange(1000, 1000)).toBe(false)
  })

  it('returns false for zero start', () => {
    expect(isValidTimeRange(0, 1000)).toBe(false)
  })
})

describe('findOverlappingLog', () => {
  const logs: LogEntry[] = [
    {
      id: 'log-1', timerId: 1, label: 'Work',
      startTime: 1000, endTime: 2000, duration: 1, source: 'timer',
    },
    {
      id: 'log-2', timerId: 2, label: 'Break',
      startTime: 1500, endTime: 2500, duration: 1, source: 'timer',
    },
  ]

  it('finds overlap on same timer', () => {
    const result = findOverlappingLog(logs, 1, 1500, 3000)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('log-1')
  })

  it('allows overlap on different timer', () => {
    const result = findOverlappingLog(logs, 3, 1500, 3000)
    expect(result).toBeNull()
  })

  it('excludes self when editing', () => {
    const result = findOverlappingLog(logs, 1, 1000, 2000, 'log-1')
    expect(result).toBeNull()
  })

  it('returns null for non-overlapping range', () => {
    const result = findOverlappingLog(logs, 1, 3000, 4000)
    expect(result).toBeNull()
  })
})
