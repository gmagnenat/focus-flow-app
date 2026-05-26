import { useMemo, useState, useCallback } from 'react'
import { startOfDay, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TimerCard } from './components/TimerCard'
import { LogList } from './components/LogList'
import { ManualEntryForm } from './components/ManualEntryForm'
import { formatSeconds } from './utils/format'
import { useLogContext } from './context/LogContext'
import type { LogEntry } from './types'
import './App.css'

const ARCHIVE_KEY = 'focusflow-archive'

interface ArchivedDay {
  date: string
  dateLabel: string
  totalSeconds: number
  logs: LogEntry[]
}

function loadArchive(): ArchivedDay[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveArchive(archive: ArchivedDay[]) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive))
}

function App() {
  const {
    timerState, logs, displayLogs, totalSeconds,
    toggleTimer, updateTimerLabel, updateLogLabel,
    validateLogLabel, deleteLog, getTimerSeconds, clearAll,
  } = useLogContext()

  const [archive, setArchive] = useState<ArchivedDay[]>(loadArchive)
  const [showArchive, setShowArchive] = useState(false)

  const todayKey = startOfDay(new Date()).getTime()

  const todayLogs = useMemo(
    () => logs.filter((log) => log.startTime >= todayKey),
    [logs, todayKey],
  )

  const todayDisplayLogs = useMemo(
    () => displayLogs.filter((log) => log.startTime >= todayKey),
    [displayLogs, todayKey],
  )

  const todayTotalSeconds = useMemo(
    () => todayLogs.reduce((sum, log) => sum + log.duration, 0),
    [todayLogs],
  )

  const handleArchive = useCallback(() => {
    if (todayLogs.length === 0) return

    const dateStr = new Date().toISOString().slice(0, 10)
    const dateLabel = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })

    const updated = loadArchive()
    const existingIdx = updated.findIndex((d) => d.date === dateStr)

    const entry: ArchivedDay = {
      date: dateStr,
      dateLabel,
      totalSeconds: todayTotalSeconds,
      logs: [...todayLogs],
    }

    if (existingIdx >= 0) {
      updated[existingIdx] = entry
    } else {
      updated.unshift(entry)
    }

    saveArchive(updated)
    setArchive(updated)
  }, [todayLogs, todayTotalSeconds])

  const handleDeleteArchiveDay = useCallback((date: string) => {
    const updated = loadArchive().filter((d) => d.date !== date)
    saveArchive(updated)
    setArchive(updated)
  }, [])

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">FocusFlow</p>
      </header>

      <section className="app__global-timer" aria-label="Daily total">
        <span className="app__global-timer-label">Daily Total</span>
        <span className="app__global-timer-time">{formatSeconds(totalSeconds)}</span>
      </section>

      <section className="app__timers" aria-label="Timers">
        <TimerCard timerId={1} label={timerState.timerLabels[1]} isActive={timerState.activeTimerId === 1} formattedTime={formatSeconds(getTimerSeconds(1))} onToggle={toggleTimer} onLabelChange={updateTimerLabel} />
        <TimerCard timerId={2} label={timerState.timerLabels[2]} isActive={timerState.activeTimerId === 2} formattedTime={formatSeconds(getTimerSeconds(2))} onToggle={toggleTimer} onLabelChange={updateTimerLabel} />
        <TimerCard timerId={3} label={timerState.timerLabels[3]} isActive={timerState.activeTimerId === 3} formattedTime={formatSeconds(getTimerSeconds(3))} onToggle={toggleTimer} onLabelChange={updateTimerLabel} />
      </section>

      <ManualEntryForm />

      <section className="app__logs" aria-label="Activity log">
        <div className="app__logs-header">
          <h2 className="app__section-title">Activity Log</h2>
          <button
            className="app__archive-button"
            type="button"
            onClick={handleArchive}
            disabled={todayLogs.length === 0}
          >
            Archive today
          </button>
        </div>
        {todayLogs.length === 0 ? (
          <div className="app__placeholder">No sessions yet.</div>
        ) : (
          <LogList logs={todayDisplayLogs} formatDuration={formatSeconds} onLabelChange={updateLogLabel} onLabelBlur={validateLogLabel} onDelete={deleteLog} />
        )}
      </section>

      {archive.length > 0 && (
        <section className="app__archive" aria-label="Archive">
          <button
            className="app__archive-toggle"
            type="button"
            onClick={() => setShowArchive(!showArchive)}
          >
            Archive ({archive.length} day{archive.length !== 1 ? 's' : ''}) {showArchive ? '▲' : '▼'}
          </button>

          {showArchive && (
            <div className="archive__list">
              {archive.map((day) => (
                <details key={day.date} className="archive__day">
                  <summary className="archive__day-header">
                    <span className="archive__day-date">{day.dateLabel}</span>
                    <span className="archive__day-total">{formatSeconds(day.totalSeconds)}</span>
                  </summary>
                  <div className="archive__day-logs">
                    {day.logs.map((log) => (
                      <div key={log.id} className="archive__log-item" data-timer={log.timerId}>
                        <span className="log-item__dot" />
                        <span className="archive__log-label">{log.label}</span>
                        <span className="log-item__duration">{formatSeconds(log.duration)}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="archive__day-delete"
                    type="button"
                    onClick={() => handleDeleteArchiveDay(day.date)}
                  >
                    Remove from archive
                  </button>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="app__footer">
        <span>Active timer: {timerState.activeTimerId ?? 'None'}</span>
        <button className="app__clear-button" type="button" onClick={clearAll}>
          Clear All Data
        </button>
      </footer>
    </main>
  )
}

export default App
