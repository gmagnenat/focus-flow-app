import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import type { LogEntry, TimerState } from '../types'
import { timerService } from '../services/TimerService'
import { buildLogEntry, buildLogLabel } from '../utils/logHelpers'

interface UseTimerStateReturn {
  timerState: TimerState
  logs: LogEntry[]
  setTimerState: Dispatch<SetStateAction<TimerState>>
  setLogs: Dispatch<SetStateAction<LogEntry[]>>
  toggleTimer: (timerId: 1 | 2 | 3, timestamp?: number) => void
  updateTimerLabel: (timerId: 1 | 2 | 3, value: string) => void
  updateLogLabel: (logId: string, value: string) => void
  validateLogLabel: (logId: string) => void
  getTimerSeconds: (timerId: 1 | 2 | 3, now: number) => number
  getDisplayLogs: (now: number) => LogEntry[]
}

export const useTimerState = (
  initialTimerState: TimerState,
  initialLogs: LogEntry[]
): UseTimerStateReturn => {
  const [timerState, setTimerState] = useState(initialTimerState)
  const [logs, setLogs] = useState(initialLogs)

  const toggleTimer = useCallback(
    (timerId: 1 | 2 | 3, timestamp: number = Date.now()) => {
      const previousActiveStart = timerState.activeStartTime

      if (timerState.activeTimerId === timerId) {
        const result = timerService.commitActiveTimer(
          timerState.activeTimerId,
          previousActiveStart,
          logs,
          timerState.timerValues,
          timerState.timerLabels,
          timestamp
        )

        setLogs(result.logs)
        setTimerState({
          ...timerState,
          activeTimerId: null,
          activeStartTime: null,
          timerValues: result.timerValues,
          lastSavedAt: timestamp,
        })
      } else {
        const result = timerService.commitActiveTimer(
          timerState.activeTimerId,
          previousActiveStart,
          logs,
          timerState.timerValues,
          timerState.timerLabels,
          timestamp
        )
        const newLog = buildLogEntry(
          timerId,
          timerState.timerLabels[timerId],
          timestamp
        )

        setLogs([...result.logs, newLog])
        setTimerState({
          ...timerState,
          activeTimerId: timerId,
          activeStartTime: timestamp,
          timerValues: result.timerValues,
          lastSavedAt: timestamp,
        })
      }
    },
    [timerState, logs]
  )

  const updateTimerLabel = useCallback(
    (timerId: 1 | 2 | 3, value: string) => {
      setTimerState({
        ...timerState,
        timerLabels: {
          ...timerState.timerLabels,
          [timerId]: value,
        },
        lastSavedAt: Date.now(),
      })
    },
    [timerState]
  )

  const updateLogLabel = useCallback(
    (logId: string, value: string) => {
      const timestamp = Date.now()

      setLogs(
        logs.map((log) =>
          log.id === logId ? { ...log, label: value } : log
        )
      )
      setTimerState((prev) => ({
        ...prev,
        lastSavedAt: timestamp,
      }))
    },
    [logs]
  )

  const validateLogLabel = useCallback(
    (logId: string) => {
      const timestamp = Date.now()

      setLogs(
        logs.map((log) => {
          if (log.id === logId && !log.label.trim()) {
            return { ...log, label: buildLogLabel(log.label, log.timerId) }
          }
          return log
        })
      )
      setTimerState((prev) => ({
        ...prev,
        lastSavedAt: timestamp,
      }))
    },
    [logs]
  )

  const getTimerSeconds = useCallback(
    (timerId: 1 | 2 | 3, now: number) =>
      timerService.calculateTimerSeconds(
        timerId,
        timerState.timerValues,
        timerState.activeTimerId,
        timerState.activeStartTime,
        now
      ),
    [timerState]
  )

  const getDisplayLogs = useCallback(
    (now: number) =>
      timerService.calculateDisplayLogs(
        logs,
        timerState.activeTimerId,
        timerState.activeStartTime,
        now
      ),
    [logs, timerState.activeTimerId, timerState.activeStartTime]
  )

  return {
    timerState,
    logs,
    setTimerState,
    setLogs,
    toggleTimer,
    updateTimerLabel,
    updateLogLabel,
    validateLogLabel,
    getTimerSeconds,
    getDisplayLogs,
  }
}
