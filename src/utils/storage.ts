import type { AppState } from '../types'
import { isValidLogs, isValidTimerLabels, isValidTimerValues } from './validators'

const STORAGE_KEY = 'focusflow-state'

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

    return {
      activeTimerId,
      timerLabels,
      timerValues: parsed.timerValues,
      logs: parsed.logs,
      lastSavedAt: parsed.lastSavedAt,
    }
  } catch {
    return null
  }
}

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
  }
}
