import type { AppState } from '../types'
import { isValidLogs, isValidTimerLabels, isValidTimerValues } from './validators'

const STORAGE_KEY = 'focusflow-state'
const SCHEMA_VERSION_KEY = 'focusflow_schema_version'
const BACKUP_KEY = 'focusflow_backup'

type Migration = (state: AppState) => AppState

const migrations: Migration[] = [
  // v0 → v1: add endTime, source to LogEntry
  (state) => ({
    ...state,
    logs: state.logs.map((log) => ({
      ...log,
      endTime:
        'endTime' in log && typeof log.endTime === 'number'
          ? log.endTime
          : log.startTime + log.duration * 1000,
      source: 'source' in log ? (log.source as 'timer' | 'manual') : ('timer' as const),
    })),
  }),
]

const getSchemaVersion = (): number => {
  const raw = localStorage.getItem(SCHEMA_VERSION_KEY)
  if (raw === null) return 0
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

const setSchemaVersion = (version: number): void => {
  localStorage.setItem(SCHEMA_VERSION_KEY, String(version))
}

export const runMigrations = (state: AppState): AppState => {
  const currentVersion = getSchemaVersion()
  if (currentVersion >= migrations.length) return state

  // Backup before migrating
  localStorage.setItem(BACKUP_KEY, JSON.stringify(state))

  let migrated = state
  try {
    for (let i = currentVersion; i < migrations.length; i++) {
      migrated = migrations[i](migrated)
    }
    setSchemaVersion(migrations.length)
    localStorage.removeItem(BACKUP_KEY)
  } catch (error) {
    // Restore from backup on failure
    const backup = localStorage.getItem(BACKUP_KEY)
    if (backup) {
      try {
        migrated = JSON.parse(backup) as AppState
      } catch {
        // backup is also corrupt, return what we have
      }
    }
    console.error('Migration failed, restored from backup:', error)
  }

  return migrated
}

export const loadState = (
  fallbackTimerLabels: AppState['timerLabels']
): AppState | null => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    const activeTimerId = parsed.activeTimerId ?? null

    if (
      ![null, 1, 2, 3].includes(activeTimerId) ||
      !isValidTimerValues(parsed.timerValues) ||
      !isValidLogs(parsed.logs) ||
      typeof parsed.lastSavedAt !== 'number'
    ) {
      return null
    }

    const timerLabels = isValidTimerLabels(parsed.timerLabels)
      ? parsed.timerLabels
      : fallbackTimerLabels

    const state: AppState = {
      activeTimerId,
      timerLabels,
      timerValues: parsed.timerValues,
      logs: parsed.logs,
      lastSavedAt: parsed.lastSavedAt,
    }

    return runMigrations(state)
  } catch {
    return null
  }
}

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save state:', error)
  }
}

export const clearState = (): void => {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SCHEMA_VERSION_KEY)
  localStorage.removeItem(BACKUP_KEY)
}

export { STORAGE_KEY, SCHEMA_VERSION_KEY, BACKUP_KEY, migrations }
