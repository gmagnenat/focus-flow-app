import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { AppState, LogEntry, TimerState } from '../types'
import { buildLogEntry, getLatestLogIndex } from '../utils/logHelpers'
import { loadState, saveState } from '../utils/storage'
import { timerService } from '../services/TimerService'

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
