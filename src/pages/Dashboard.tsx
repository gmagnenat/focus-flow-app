import { useMemo, useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { TimerCard } from '../components/TimerCard'
import { LogList } from '../components/LogList'
import { formatSeconds } from '../utils/format'
import { generateSummary } from '../services/geminiClient'
import { useLogContext } from '../context/LogContext'

export const Dashboard = () => {
  const {
    timerState, logs, displayLogs, totalSeconds,
    toggleTimer, updateTimerLabel, updateLogLabel,
    validateLogLabel, deleteLog, getTimerSeconds, clearAll,
  } = useLogContext()

  const [exportFormat, setExportFormat] = useState<'txt' | 'csv' | 'json'>('txt')

  const summaryMutation = useMutation({
    mutationFn: () => generateSummary(logs),
  })

  const summaryText = useMemo(() => {
    if (!summaryMutation.data) return ''
    return summaryMutation.data.replace(/\*\*/g, '').trim()
  }, [summaryMutation.data])

  const parsedSummary = useMemo(() => {
    if (!summaryText) return []
    const lines = summaryText.split(/\n+/).map((line) => line.trim())
    const entries: Array<{ name: string; totalTime: string; details: string[] }> = []
    let current: { name: string; totalTime: string; details: string[] } | null = null
    lines.forEach((line) => {
      const headerMatch = line.match(/^(.*)\s+-\s+(\d{2}:\d{2}(?::\d{2})?)$/)
      if (headerMatch) {
        current = { name: headerMatch[1].trim(), totalTime: headerMatch[2], details: [] }
        entries.push(current)
        return
      }
      if (line.startsWith('-')) {
        const detail = line.replace(/^-\s*/, '').trim()
        if (detail && current) current.details.push(detail)
      }
    })
    return entries
  }, [summaryText])

  const buildExportPayload = useCallback(() => {
    if (!summaryText) return { content: '', extension: 'txt', type: 'text/plain;charset=utf-8' }
    if (exportFormat === 'json') {
      const payload = { generatedAt: new Date().toISOString(), rawText: summaryText, projects: parsedSummary }
      return { content: JSON.stringify(payload, null, 2), extension: 'json', type: 'application/json;charset=utf-8' }
    }
    if (exportFormat === 'csv') {
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
      const rows = ['project,total_time,detail']
      parsedSummary.forEach((project) => {
        if (project.details.length === 0) {
          rows.push([project.name, project.totalTime, ''].map(escapeCsv).join(','))
          return
        }
        project.details.forEach((detail) => {
          rows.push([project.name, project.totalTime, detail].map(escapeCsv).join(','))
        })
      })
      return { content: rows.join('\n'), extension: 'csv', type: 'text/csv;charset=utf-8' }
    }
    return { content: summaryText, extension: 'txt', type: 'text/plain;charset=utf-8' }
  }, [exportFormat, parsedSummary, summaryText])

  const handleDownloadSummary = useCallback(() => {
    if (!summaryText) return
    const payload = buildExportPayload()
    const blob = new Blob([payload.content], { type: payload.type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `focusflow-summary.${payload.extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [buildExportPayload, summaryText])

  const summaryError = summaryMutation.error
    ? summaryMutation.error instanceof Error
      ? summaryMutation.error.message
      : 'Failed to generate summary.'
    : null

  const hasApiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY)

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

      <section className="app__logs" aria-label="Activity log">
        <h2 className="app__section-title">Activity Log</h2>
        {logs.length === 0 ? (
          <div className="app__placeholder">No sessions yet.</div>
        ) : (
          <LogList logs={displayLogs} formatDuration={formatSeconds} onLabelChange={updateLogLabel} onLabelBlur={validateLogLabel} onDelete={deleteLog} />
        )}
      </section>

      <section className="app__summary" aria-label="LLM Summary">
        <h2 className="app__section-title">Summary Export</h2>
        <div className="summary__actions">
          <button className="summary__button" type="button" onClick={() => summaryMutation.mutate()} disabled={logs.length === 0 || summaryMutation.isPending}>
            {summaryMutation.isPending ? 'Generating...' : 'Generate Summary'}
          </button>
          <div className="summary__formats" role="group" aria-label="Export format">
            {(['txt', 'csv', 'json'] as const).map((format) => (
              <button key={format} className={`summary__format${exportFormat === format ? ' summary__format--active' : ''}`} type="button" onClick={() => setExportFormat(format)}>
                {format.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="summary__button summary__button--ghost" type="button" onClick={handleDownloadSummary} disabled={!summaryText}>
            Download
          </button>
          {logs.length === 0 ? (
            <span className="summary__status">Add sessions to summarize.</span>
          ) : summaryMutation.isPending ? (
            <span className="summary__status">Building grouped bullets.</span>
          ) : !hasApiKey ? (
            <span className="summary__status">Using proxy (or add VITE_GEMINI_API_KEY for direct mode).</span>
          ) : (
            <span className="summary__status">Ready to summarize.</span>
          )}
        </div>
        {summaryError ? (
          <div className="summary__error">{summaryError}</div>
        ) : summaryText ? (
          <div className="summary__text">{summaryText}</div>
        ) : (
          <div className="app__placeholder">Summary output will appear here.</div>
        )}
      </section>

      <footer className="app__footer">
        <span>Active timer: {timerState.activeTimerId ?? 'None'}</span>
        <button className="app__clear-button" type="button" onClick={() => { clearAll(); summaryMutation.reset() }}>
          Clear All Data
        </button>
      </footer>
    </>
  )
}
