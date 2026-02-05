import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TimerState } from './types'
import { TimerCard } from './components/TimerCard'
import { LogList } from './components/LogList.tsx'
import { formatSeconds } from './utils/format'
import { usePersistence } from './hooks/usePersistence'
import { useTimerState } from './hooks/useTimerState'
import './App.css'

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

function App() {
  const [now, setNow] = useState(() => Date.now())
  const {
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
  } = useTimerState(initialTimerState, [])

  usePersistence(
    timerState,
    logs,
    setTimerState,
    setLogs,
    setNow,
    defaultTimerLabels
  )

  useEffect(() => {
    if (timerState.activeTimerId === null) {
      return
    }

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [timerState.activeTimerId])

  const handleToggleTimer = useCallback(
    (timerId: 1 | 2 | 3) => {
      const timestamp = Date.now()
      setNow(timestamp)
      toggleTimer(timerId, timestamp)
    },
    [toggleTimer]
  )

  const timer1Seconds = useMemo(
    () => getTimerSeconds(1, now),
    [getTimerSeconds, now]
  )

  const timer2Seconds = useMemo(
    () => getTimerSeconds(2, now),
    [getTimerSeconds, now]
  )

  const timer3Seconds = useMemo(
    () => getTimerSeconds(3, now),
    [getTimerSeconds, now]
  )

  const displayLogs = useMemo(
    () => getDisplayLogs(now),
    [getDisplayLogs, now]
  )

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">FocusFlow MVP</p>
        <h1 className="app__title">Timer Dashboard</h1>
        <p className="app__subtitle">Skeleton layout for Phase 1 buildout.</p>
      </header>

      <section className="app__timers" aria-label="Timers">
        <TimerCard
          timerId={1}
          label={timerState.timerLabels[1]}
          isActive={timerState.activeTimerId === 1}
          formattedTime={formatSeconds(timer1Seconds)}
          onToggle={handleToggleTimer}
          onLabelChange={updateTimerLabel}
        />
        <TimerCard
          timerId={2}
          label={timerState.timerLabels[2]}
          isActive={timerState.activeTimerId === 2}
          formattedTime={formatSeconds(timer2Seconds)}
          onToggle={handleToggleTimer}
          onLabelChange={updateTimerLabel}
        />
        <TimerCard
          timerId={3}
          label={timerState.timerLabels[3]}
          isActive={timerState.activeTimerId === 3}
          formattedTime={formatSeconds(timer3Seconds)}
          onToggle={handleToggleTimer}
          onLabelChange={updateTimerLabel}
        />
      </section>

      <section className="app__logs" aria-label="Activity log">
        <h2 className="app__section-title">Activity Log</h2>
        {logs.length === 0 ? (
          <div className="app__placeholder">No sessions yet.</div>
        ) : (
          <LogList
            logs={displayLogs}
            formatDuration={formatSeconds}
            onLabelChange={updateLogLabel}
            onLabelBlur={validateLogLabel}
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
        <span>Active timer: {timerState.activeTimerId ?? 'None'}</span>
      </footer>
    </main>
  )
}

export default App
