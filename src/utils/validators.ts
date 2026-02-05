import type { AppState } from '../types'

export const isValidTimerValues = (
  value: unknown
): value is AppState['timerValues'] => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<number, unknown>
  return [1, 2, 3].every((id) => typeof record[id] === 'number')
}

export const isValidLogs = (value: unknown): value is AppState['logs'] => {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every((entry) =>
    Boolean(
      entry &&
        typeof entry === 'object' &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { timerId?: unknown }).timerId === 'number' &&
        typeof (entry as { label?: unknown }).label === 'string' &&
        typeof (entry as { startTime?: unknown }).startTime === 'number' &&
        typeof (entry as { duration?: unknown }).duration === 'number'
    )
  )
}

export const isValidTimerLabels = (
  value: unknown
): value is AppState['timerLabels'] => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<number, unknown>
  return [1, 2, 3].every((id) => typeof record[id] === 'string')
}
