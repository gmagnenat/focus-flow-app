import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrations, loadState, STORAGE_KEY, SCHEMA_VERSION_KEY, BACKUP_KEY } from '../storage'
import type { AppState } from '../../types'

const makeV0State = (): AppState => ({
  activeTimerId: null,
  timerLabels: { 1: 'Work', 2: 'Break', 3: 'Learn' },
  timerValues: { 1: 3600, 2: 900, 3: 1800 },
  logs: [
    { id: 'log-1', timerId: 1, label: 'Work', startTime: 1711800000000, duration: 3600 },
    { id: 'log-2', timerId: 2, label: 'Break', startTime: 1711803600000, duration: 900 },
  ] as AppState['logs'],
  lastSavedAt: 1711804500000,
})

beforeEach(() => {
  localStorage.clear()
})

describe('runMigrations', () => {
  it('adds endTime and source to v0 logs', () => {
    const v0 = makeV0State()
    const result = runMigrations(v0)

    expect(result.logs[0].endTime).toBe(1711800000000 + 3600 * 1000)
    expect(result.logs[0].source).toBe('timer')
    expect(result.logs[1].endTime).toBe(1711803600000 + 900 * 1000)
    expect(result.logs[1].source).toBe('timer')
  })

  it('creates backup before migration', () => {
    const v0 = makeV0State()
    runMigrations(v0)
    expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe('1')
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it('skips migration if schema version is current', () => {
    localStorage.setItem(SCHEMA_VERSION_KEY, '1')
    const state = makeV0State()
    const result = runMigrations(state)
    expect(result).toBe(state)
  })

  it('handles already-migrated data (idempotent)', () => {
    const migratedState: AppState = {
      ...makeV0State(),
      logs: [
        {
          id: 'log-1', timerId: 1, label: 'Work',
          startTime: 1711800000000, endTime: 1711803600000,
          duration: 3600, source: 'timer' as const,
        },
      ],
    }
    const result = runMigrations(migratedState)
    expect(result.logs[0].endTime).toBe(1711803600000)
    expect(result.logs[0].source).toBe('timer')
  })

  it('handles empty logs array', () => {
    const state: AppState = { ...makeV0State(), logs: [] }
    const result = runMigrations(state)
    expect(result.logs).toEqual([])
  })
})

describe('loadState', () => {
  const fallbackLabels = { 1: 'Timer 1', 2: 'Timer 2', 3: 'Timer 3' }

  it('returns null when no stored state', () => {
    expect(loadState(fallbackLabels)).toBeNull()
  })

  it('migrates stored v0 state on load', () => {
    const v0 = makeV0State()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v0))
    const result = loadState(fallbackLabels)

    expect(result).not.toBeNull()
    expect(result!.logs[0].endTime).toBe(1711800000000 + 3600 * 1000)
    expect(result!.logs[0].source).toBe('timer')
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(loadState(fallbackLabels)).toBeNull()
  })
})
