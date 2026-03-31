import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { startOfDay, endOfDay } from 'date-fns'
import type { AppState, LogEntry, TimerState } from '../types'
import { buildLogEntry, getLatestLogIndex } from '../utils/logHelpers'
import { loadState, saveState } from '../utils/storage'
import { timerService } from '../services/TimerService'

/**
 * Handles the case where the app hydrates after midnight.
 *
 * If `lastSavedAt` is before the start of today AND a timer was active,
 * this function closes the open log entry at midnight and resets the timer
 * state so the new day starts clean.
 *
 * Returns `null` when no day boundary was crossed or when there is no active
 * timer (nothing to do), so the caller can fall through to its normal path.
 */
export const handleDayBoundary = (
  stored: AppState,
  now: number
): AppState | null => {
  // No active timer — nothing to close.
  if (stored.activeTimerId === null) {
    return null
  }

  // Day boundary only matters when lastSavedAt is strictly before today.
  const todayStart = startOfDay(now).getTime()
  if (stored.lastSavedAt >= todayStart) {
    return null
  }

  // Find the latest log entry for the active timer.
  const logIndex = getLatestLogIndex(stored.logs, stored.activeTimerId)
  if (logIndex === -1) {
    // No log to close — return null and let the caller handle the gap.
    return null
  }

  const midnight = endOfDay(stored.lastSavedAt).getTime()
  const gapToMidnight = timerService.calculateElapsedSeconds(
    stored.lastSavedAt,
    midnight
  )

  const updatedLogs = stored.logs.map((entry, index) => {
    if (index !== logIndex) return entry
    return {
      ...entry,
      duration: entry.duration + gapToMidnight,
      endTime: midnight,
    }
  })

  return {
    ...stored,
    logs: updatedLogs,
    timerValues: { 1: 0, 2: 0, 3: 0 },
    activeTimerId: null,
    lastSavedAt: now,
  }
}

interface UsePersistenceReturn {
  isHydrated: boolean
}

export const usePersistence = (
  timerState: TimerState,
  logs: LogEntry[],
  setTimerState: Dispatch<SetStateAction<TimerState>>,
  setLogs: Dispatch<SetStateAction<LogEntry[]>>,
  setNow: Dispatch<SetStateAction<number>>,
  fallbackTimerLabels: TimerState['timerLabels']
): UsePersistenceReturn => {
  const hasHydrated = useRef(false)

  useEffect(() => {
    const stored = loadState(fallbackTimerLabels)
    const timestamp = Date.now()

    if (stored) {
      const dayBoundaryResult = handleDayBoundary(stored, timestamp)
      if (dayBoundaryResult !== null) {
        setTimerState({
          activeTimerId: null,
          activeStartTime: null,
          timerLabels: dayBoundaryResult.timerLabels,
          timerValues: dayBoundaryResult.timerValues,
          lastSavedAt: timestamp,
        })
        setLogs(dayBoundaryResult.logs)
        setNow(timestamp)
        hasHydrated.current = true
        return
      }

      if (stored.activeTimerId !== null) {
        const gapSeconds = Math.max(
          0,
          timerService.calculateElapsedSeconds(stored.lastSavedAt, timestamp)
        )
        const updatedLogs = [...stored.logs]
        const logIndex = getLatestLogIndex(updatedLogs, stored.activeTimerId)

        if (logIndex === -1) {
          updatedLogs.push(
            buildLogEntry(
              stored.activeTimerId,
              stored.timerLabels[stored.activeTimerId],
              stored.lastSavedAt
            )
          )
          updatedLogs[updatedLogs.length - 1].duration += gapSeconds
        } else {
          updatedLogs[logIndex] = {
            ...updatedLogs[logIndex],
            duration: updatedLogs[logIndex].duration + gapSeconds,
          }
        }

        const updatedTimerValues = {
          ...stored.timerValues,
          [stored.activeTimerId]:
            stored.timerValues[stored.activeTimerId] + gapSeconds,
        }

        setTimerState({
          activeTimerId: stored.activeTimerId,
          activeStartTime: timestamp,
          timerLabels: stored.timerLabels,
          timerValues: updatedTimerValues,
          lastSavedAt: timestamp,
        })
        setLogs(updatedLogs)
        setNow(timestamp)
      } else {
        setTimerState({
          activeTimerId: null,
          activeStartTime: null,
          timerLabels: stored.timerLabels,
          timerValues: stored.timerValues,
          lastSavedAt: timestamp,
        })
        setLogs(stored.logs)
        setNow(timestamp)
      }
    } else {
      setTimerState((prev) => ({
        ...prev,
        lastSavedAt: timestamp,
      }))
      setNow(timestamp)
    }

    hasHydrated.current = true
  }, [fallbackTimerLabels, setLogs, setNow, setTimerState])

  useEffect(() => {
    if (!hasHydrated.current) {
      return
    }

    const combinedState: AppState = {
      activeTimerId: timerState.activeTimerId,
      timerLabels: timerState.timerLabels,
      timerValues: timerState.timerValues,
      logs,
      lastSavedAt: timerState.lastSavedAt,
    }

    saveState(combinedState)
  }, [timerState, logs])

  return { isHydrated: hasHydrated.current }
}
