import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { TimerState } from './types'
import { TimerCard } from './components/TimerCard'
import { LogList } from './components/LogList.tsx'
import { formatSeconds } from './utils/format'
import { usePersistence } from './hooks/usePersistence'
import { useTimerState } from './hooks/useTimerState'
import { generateSummary } from './services/geminiClient'
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
  const [exportFormat, setExportFormat] = useState<'txt' | 'csv' | 'json'>('txt')
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

  const summaryMutation = useMutation({
    mutationFn: () => generateSummary(logs),
  })

  const hasApiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY)
  const summaryText = useMemo(() => {
    if (!summaryMutation.data) {
      return ''
    }

    return summaryMutation.data.replace(/\*\*/g, '').trim()
  }, [summaryMutation.data])

  const parsedSummary = useMemo(() => {
    if (!summaryText) {
      return []
    }

    const lines = summaryText.split(/\n+/).map((line) => line.trim())
    const entries: Array<{ name: string; totalTime: string; details: string[] }> = []
    let current: { name: string; totalTime: string; details: string[] } | null = null

    lines.forEach((line) => {
      const headerMatch = line.match(/^(.*)\s+-\s+(\d{2}:\d{2}(?::\d{2})?)$/)
      if (headerMatch) {
        current = {
          name: headerMatch[1].trim(),
          totalTime: headerMatch[2],
          details: [],
        }
        entries.push(current)
        return
      }

      if (line.startsWith('-')) {
        const detail = line.replace(/^-\s*/, '').trim()
        if (detail && current) {
          current.details.push(detail)
        }
      }
    })

    return entries
  }, [summaryText])

  const buildExportPayload = useCallback(() => {
    if (!summaryText) {
      return { content: '', extension: 'txt', type: 'text/plain;charset=utf-8' }
    }

    if (exportFormat === 'json') {
      const payload = {
        generatedAt: new Date().toISOString(),
        rawText: summaryText,
        projects: parsedSummary,
      }
      return {
        content: JSON.stringify(payload, null, 2),
        extension: 'json',
        type: 'application/json;charset=utf-8',
      }
    }

    if (exportFormat === 'csv') {
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
      const rows = ['project,total_time,detail']

      parsedSummary.forEach((project) => {
        if (project.details.length === 0) {
          rows.push(
            [project.name, project.totalTime, '']
              .map(escapeCsv)
              .join(',')
          )
          return
        }

        project.details.forEach((detail) => {
          rows.push(
            [project.name, project.totalTime, detail]
              .map(escapeCsv)
              .join(',')
          )
        })
      })

      return {
        content: rows.join('\n'),
        extension: 'csv',
        type: 'text/csv;charset=utf-8',
      }
    }

    return {
      content: summaryText,
      extension: 'txt',
      type: 'text/plain;charset=utf-8',
    }
  }, [exportFormat, parsedSummary, summaryText])

  const summaryError = summaryMutation.error
    ? summaryMutation.error instanceof Error
      ? summaryMutation.error.message
      : 'Failed to generate summary.'
    : null

  const handleDownloadSummary = useCallback(() => {
    if (!summaryText) {
      return
    }

    const payload = buildExportPayload()
    const blob = new Blob([payload.content], { type: payload.type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `focusflow-summary.${payload.extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [buildExportPayload, summaryText])

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
        <div className="summary__actions">
          <button
            className="summary__button"
            type="button"
            onClick={() => summaryMutation.mutate()}
            disabled={logs.length === 0 || summaryMutation.isPending}
          >
            {summaryMutation.isPending ? 'Generating...' : 'Generate Summary'}
          </button>
          <div className="summary__formats" role="group" aria-label="Export format">
            {(['txt', 'csv', 'json'] as const).map((format) => (
              <button
                key={format}
                className={`summary__format${
                  exportFormat === format ? ' summary__format--active' : ''
                }`}
                type="button"
                onClick={() => setExportFormat(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="summary__button summary__button--ghost"
            type="button"
            onClick={handleDownloadSummary}
            disabled={!summaryText}
          >
            Download
          </button>
          {logs.length === 0 ? (
            <span className="summary__status">Add sessions to summarize.</span>
          ) : summaryMutation.isPending ? (
            <span className="summary__status">Building grouped bullets.</span>
          ) : !hasApiKey ? (
            <span className="summary__status">
              Using proxy (or add VITE_GEMINI_API_KEY for direct mode).
            </span>
          ) : (
            <span className="summary__status">Ready to summarize.</span>
          )}
        </div>
        {summaryError ? (
          <div className="summary__error">{summaryError}</div>
        ) : summaryText ? (
          <div className="summary__text">{summaryText}</div>
        ) : (
          <div className="app__placeholder">
            Summary output will appear here.
          </div>
        )}
      </section>

      <footer className="app__footer">
        <span>Active timer: {timerState.activeTimerId ?? 'None'}</span>
      </footer>
    </main>
  )
}

export default App
