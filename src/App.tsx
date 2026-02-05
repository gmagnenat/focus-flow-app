import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from './types'
import { TimerCard } from './components/TimerCard'
import { LogList } from './components/LogList.tsx'
import { formatSeconds } from './utils/format'
import { buildLogEntry, buildLogLabel, getLatestLogIndex } from './utils/logHelpers'
import { isValidLogs, isValidTimerLabels, isValidTimerValues } from './utils/validators'
import './App.css'

const STORAGE_KEY = 'focusflow-state'

const defaultTimerLabels: AppState['timerLabels'] = {
  1: 'Timer 1',
  2: 'Timer 2',
  3: 'Timer 3',
}

const initialState: AppState = {
  activeTimerId: null,
  timerLabels: defaultTimerLabels,
  timerValues: { 1: 0, 2: 0, 3: 0 },
  logs: [],
  lastSavedAt: Date.now(),
}

const loadState = (): AppState | null => {
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
      : defaultTimerLabels

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

const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
  }
}

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [now, setNow] = useState(() => Date.now())
  const hasHydrated = useRef(false)
  const activeStartRef = useRef<number | null>(null)

  useEffect(() => {
    const stored = loadState()
    const timestamp = Date.now()

    if (stored) {
      if (stored.activeTimerId !== null) {
        const gapSeconds = Math.max(
          0,
          Math.floor((timestamp - stored.lastSavedAt) / 1000)
        )
        const logs = [...stored.logs]
        const logIndex = getLatestLogIndex(logs, stored.activeTimerId)

        if (logIndex === -1) {
          logs.push(
            buildLogEntry(
              stored.activeTimerId,
              stored.timerLabels[stored.activeTimerId],
              stored.lastSavedAt
            )
          )
          logs[logs.length - 1].duration += gapSeconds
        } else {
          logs[logIndex] = {
            ...logs[logIndex],
            duration: logs[logIndex].duration + gapSeconds,
          }
        }

        const updatedState: AppState = {
          ...stored,
          logs,
          timerValues: {
            ...stored.timerValues,
            [stored.activeTimerId]:
              stored.timerValues[stored.activeTimerId] + gapSeconds,
          },
          lastSavedAt: timestamp,
        }

        activeStartRef.current = timestamp
        setState(updatedState)
        setNow(timestamp)
      } else {
        activeStartRef.current = null
        setState(stored)
        setNow(timestamp)
      }
    } else {
      setNow(timestamp)
    }

    hasHydrated.current = true
  }, [])

  useEffect(() => {
    if (!hasHydrated.current) {
      return
    }

    saveState({ ...state, lastSavedAt: Date.now() })
  }, [state])

  useEffect(() => {
    if (state.activeTimerId === null) {
      return
    }

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [state.activeTimerId])

  const commitActiveTimer = useCallback(
    (draft: AppState, timestamp: number, startTime: number | null) => {
      if (draft.activeTimerId === null || startTime === null) {
        return draft
      }

      const elapsedSeconds = Math.floor(
        (timestamp - startTime) / 1000
      )
      const logs = [...draft.logs]
      const logIndex = getLatestLogIndex(logs, draft.activeTimerId)

      if (logIndex === -1) {
        const entry = buildLogEntry(
          draft.activeTimerId,
          draft.timerLabels[draft.activeTimerId],
          startTime
        )
        entry.duration += elapsedSeconds
        logs.push(entry)
      } else {
        logs[logIndex] = {
          ...logs[logIndex],
          duration: logs[logIndex].duration + elapsedSeconds,
        }
      }

      return {
        ...draft,
        logs,
        timerValues: {
          ...draft.timerValues,
          [draft.activeTimerId]:
            draft.timerValues[draft.activeTimerId] + elapsedSeconds,
        },
      }
    },
    []
  )

  const handleToggleTimer = useCallback(
    (timerId: 1 | 2 | 3) => {
      const timestamp = Date.now()
      setNow(timestamp)

      // Capture the current ref value before the setState updater runs
      const previousActiveStart = activeStartRef.current

      setState((prev) => {
        if (prev.activeTimerId === timerId) {
          // Stopping the timer
          const committed = commitActiveTimer(prev, timestamp, previousActiveStart)
          return {
            ...committed,
            activeTimerId: null,
          }
        }

        // Starting a new timer
        const committed = commitActiveTimer(prev, timestamp, previousActiveStart)
        return {
          ...committed,
          activeTimerId: timerId,
          logs: [
            ...committed.logs,
            buildLogEntry(timerId, committed.timerLabels[timerId], timestamp),
          ],
        }
      })
      
      // Update the ref after setState to avoid issues with multiple updater calls
      if (state.activeTimerId === timerId) {
        // We stopped the timer
        activeStartRef.current = null
      } else {
        // We started a new timer
        activeStartRef.current = timestamp
      }
    },
    [commitActiveTimer]
  )

  const handleTimerLabelChange = useCallback(
    (timerId: 1 | 2 | 3, value: string) => {
      setState((prev) => ({
        ...prev,
        timerLabels: {
          ...prev.timerLabels,
          [timerId]: value,
        },
      }))
    },
    []
  )

  const handleLogLabelChange = useCallback(
    (id: string, value: string) => {
      setState((prev) => ({
        ...prev,
        logs: prev.logs.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                label: value,
              }
            : entry
        ),
      }))
    },
    []
  )

  const handleLogLabelBlur = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        logs: prev.logs.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                label: buildLogLabel(entry.label, entry.timerId),
              }
            : entry
        ),
      }))
    },
    []
  )

  const getTimerSeconds = useCallback(
    (timerId: 1 | 2 | 3) => {
      const base = state.timerValues[timerId]
      if (state.activeTimerId !== timerId || activeStartRef.current === null) {
        return base
      }

      return base + (now - activeStartRef.current) / 1000
    },
    [now, state.activeTimerId, state.timerValues]
  )

  const activeLogIndex = state.activeTimerId
    ? getLatestLogIndex(state.logs, state.activeTimerId)
    : -1

  const displayLogs = state.logs.map((entry, index) => {
    if (
      index === activeLogIndex &&
      state.activeTimerId !== null &&
      activeStartRef.current !== null
    ) {
      return {
        ...entry,
        duration: entry.duration + (now - activeStartRef.current) / 1000,
      }
    }

    return entry
  })

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">FocusFlow MVP</p>
        <h1 className="app__title">Timer Dashboard</h1>
        <p className="app__subtitle">Skeleton layout for Phase 1 buildout.</p>
      </header>

      <section className="app__timers" aria-label="Timers">
        {[1, 2, 3].map((slot) => (
          <TimerCard
            key={slot}
            timerId={slot as 1 | 2 | 3}
            label={state.timerLabels[slot]}
            isActive={state.activeTimerId === slot}
            formattedTime={formatSeconds(getTimerSeconds(slot as 1 | 2 | 3))}
            onToggle={handleToggleTimer}
            onLabelChange={handleTimerLabelChange}
          />
        ))}
      </section>

      <section className="app__logs" aria-label="Activity log">
        <h2 className="app__section-title">Activity Log</h2>
        {state.logs.length === 0 ? (
          <div className="app__placeholder">No sessions yet.</div>
        ) : (
          <LogList
            logs={displayLogs}
            formatDuration={formatSeconds}
            onLabelChange={handleLogLabelChange}
            onLabelBlur={handleLogLabelBlur}
          />
        )}
      </section>

      <section className="app__summary" aria-label="LLM Summary">
        <h2 className="app__section-title">Summary Export</h2>
        <div className="app__placeholder">
          Summary output will appear here.
        </div>
      </section>

      <footer className="app__footer">
        <span>Active timer: {state.activeTimerId ?? 'None'}</span>
      </footer>
    </main>
  )
}

export default App
