import { useMemo, useCallback } from 'react'
import { startOfDay } from 'date-fns'
import { TimerCard } from '../components/TimerCard'
import { LogList } from '../components/LogList'
import { ManualEntryForm } from '../components/ManualEntryForm'
import { SummaryExport } from '../components/SummaryExport'
import { formatSeconds } from '../utils/format'
import { useLogContext } from '../context/LogContext'

export const Dashboard = () => {
  const {
    timerState, logs, displayLogs, totalSeconds,
    toggleTimer, updateTimerLabel, updateLogLabel,
    validateLogLabel, deleteLog, getTimerSeconds, clearAll,
  } = useLogContext()

  const todayLogs = useMemo(() => {
    const dayStart = startOfDay(new Date()).getTime()
    return logs.filter((log) => log.startTime >= dayStart)
  }, [logs])

  const todayDisplayLogs = useMemo(() => {
    const dayStart = startOfDay(new Date()).getTime()
    return displayLogs.filter((log) => log.startTime >= dayStart)
  }, [displayLogs])

  return (
    <>
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
        <h2 className="app__section-title">Activity Log</h2>
        {todayLogs.length === 0 ? (
          <div className="app__placeholder">No sessions yet.</div>
        ) : (
          <LogList logs={todayDisplayLogs} formatDuration={formatSeconds} onLabelChange={updateLogLabel} onLabelBlur={validateLogLabel} onDelete={deleteLog} />
        )}
      </section>

      <SummaryExport logs={todayLogs} filenamePrefix="focusflow-daily" />

      <footer className="app__footer">
        <span>Active timer: {timerState.activeTimerId ?? 'None'}</span>
        <button className="app__clear-button" type="button" onClick={clearAll}>
          Clear All Data
        </button>
      </footer>
    </>
  )
}
