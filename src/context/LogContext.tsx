import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LogEntry, TimerState } from '../types'
import { usePersistence } from '../hooks/usePersistence'
import { useTimerState } from '../hooks/useTimerState'

const defaultTimerLabels: TimerState['timerLabels'] = {
  1: 'Timer 1',
  2: 'Timer 2',
  3: 'Timer 3',
}

const initialTimerState: TimerState = {
  activeTimerId: null,
  activeStartTime: null,
  timerLabels: defaultTimerLabels,
  timerValues: { 1: 0, 2: 0, 3: 0 },
  lastSavedAt: Date.now(),
}

interface LogContextValue {
  timerState: TimerState
  logs: LogEntry[]
  now: number
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>
  toggleTimer: (timerId: 1 | 2 | 3) => void
  updateTimerLabel: (timerId: 1 | 2 | 3, value: string) => void
  updateLogLabel: (logId: string, value: string) => void
  validateLogLabel: (logId: string) => void
  deleteLog: (logId: string) => void
  getTimerSeconds: (timerId: 1 | 2 | 3) => number
  displayLogs: LogEntry[]
  totalSeconds: number
  clearAll: () => void
}

const LogContext = createContext<LogContextValue | null>(null)

export const useLogContext = (): LogContextValue => {
  const ctx = useContext(LogContext)
  if (!ctx) throw new Error('useLogContext must be used within LogProvider')
  return ctx
}

export const LogProvider = ({ children }: { children: ReactNode }) => {
  const [now, setNow] = useState(() => Date.now())
  const {
    timerState,
    logs,
    setTimerState,
    setLogs,
    toggleTimer: rawToggle,
    updateTimerLabel,
    updateLogLabel,
    validateLogLabel,
    deleteLog,
    getTimerSeconds: rawGetTimerSeconds,
    getDisplayLogs,
  } = useTimerState(initialTimerState, [])

  usePersistence(timerState, logs, setTimerState, setLogs, setNow, defaultTimerLabels)

  useEffect(() => {
    if (timerState.activeTimerId === null) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [timerState.activeTimerId])

  const toggleTimer = useCallback(
    (timerId: 1 | 2 | 3) => {
      const timestamp = Date.now()
      setNow(timestamp)
      rawToggle(timerId, timestamp)
    },
    [rawToggle]
  )

  const getTimerSeconds = useCallback(
    (timerId: 1 | 2 | 3) => rawGetTimerSeconds(timerId, now),
    [rawGetTimerSeconds, now]
  )

  const displayLogs = useMemo(() => getDisplayLogs(now), [getDisplayLogs, now])

  const totalSeconds = useMemo(() => {
    const t1 = rawGetTimerSeconds(1, now)
    const t2 = rawGetTimerSeconds(2, now)
    const t3 = rawGetTimerSeconds(3, now)
    return t1 + t2 + t3
  }, [rawGetTimerSeconds, now])

  const clearAll = useCallback(() => {
    const timestamp = Date.now()
    import('../utils/storage').then(({ clearState }) => {
      clearState()
      setTimerState({ ...initialTimerState, lastSavedAt: timestamp })
      setLogs([])
      setNow(timestamp)
    })
  }, [setTimerState, setLogs])

  const value = useMemo(
    () => ({
      timerState, logs, now, setTimerState, setLogs,
      toggleTimer, updateTimerLabel, updateLogLabel, validateLogLabel,
      deleteLog, getTimerSeconds, displayLogs, totalSeconds, clearAll,
    }),
    [timerState, logs, now, setTimerState, setLogs, toggleTimer,
     updateTimerLabel, updateLogLabel, validateLogLabel, deleteLog,
     getTimerSeconds, displayLogs, totalSeconds, clearAll]
  )

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>
}
