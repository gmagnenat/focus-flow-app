import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from './types'
import { TimerCard } from './components/TimerCard'
import { LogList } from './components/LogList.tsx'
import { formatSeconds } from './utils/format'
import { buildLogEntry, buildLogLabel, getLatestLogIndex } from './utils/logHelpers'
import { loadState, saveState } from './utils/storage'
import { timerService } from './services/TimerService'
import './App.css'

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

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [now, setNow] = useState(() => Date.now())
  const hasHydrated = useRef(false)
  const activeStartRef = useRef<number | null>(null)

  useEffect(() => {
    const stored = loadState(defaultTimerLabels)
    const timestamp = Date.now()

    if (stored) {
      if (stored.activeTimerId !== null) {
        const gapSeconds = Math.max(
          0,
          timerService.calculateElapsedSeconds(stored.lastSavedAt, timestamp)
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

  const handleToggleTimer = useCallback(
    (timerId: 1 | 2 | 3) => {
      const timestamp = Date.now()
      setNow(timestamp)

      // Capture the current ref value before the setState updater runs
      const previousActiveStart = activeStartRef.current

      setState((prev) => {
        const result = timerService.commitActiveTimer(
          prev.activeTimerId,
          previousActiveStart,
          prev.logs,
          prev.timerValues,
          prev.timerLabels,
          timestamp
        )

        if (prev.activeTimerId === timerId) {
          // Stopping the timer
          return {
            ...prev,
            activeTimerId: null,
            logs: result.logs,
            timerValues: result.timerValues,
          }
        }

        // Starting a new timer
        return {
          ...prev,
          activeTimerId: timerId,
          logs: [
            ...result.logs,
            buildLogEntry(timerId, prev.timerLabels[timerId], timestamp),
          ],
          timerValues: result.timerValues,
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
    [state.activeTimerId]
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
      return timerService.calculateTimerSeconds(
        timerId,
        state.timerValues,
        state.activeTimerId,
        activeStartRef.current,
        now
      )
    },
    [now, state.activeTimerId, state.timerValues]
  )

  const displayLogs = timerService.calculateDisplayLogs(
    state.logs,
    state.activeTimerId,
    activeStartRef.current,
    now
  )

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
