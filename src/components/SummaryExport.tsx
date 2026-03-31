import { useState, useMemo, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { generateSummary } from '../services/geminiClient'
import type { LogEntry } from '../types'

interface SummaryExportProps {
  logs: LogEntry[]
  filenamePrefix: string
}

export const SummaryExport = ({ logs, filenamePrefix }: SummaryExportProps) => {
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

  const handleDownload = useCallback(() => {
    if (!summaryText) return
    const payload = buildExportPayload()
    const blob = new Blob([payload.content], { type: payload.type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${filenamePrefix}.${payload.extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [buildExportPayload, filenamePrefix, summaryText])

  const summaryError = summaryMutation.error
    ? summaryMutation.error instanceof Error
      ? summaryMutation.error.message
      : 'Failed to generate summary.'
    : null

  return (
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
        <button className="summary__button summary__button--ghost" type="button" onClick={handleDownload} disabled={!summaryText}>
          Download
        </button>
        {logs.length === 0 ? (
          <span className="summary__status">Add sessions to summarize.</span>
        ) : summaryMutation.isPending ? (
          <span className="summary__status">Building grouped bullets.</span>
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
  )
}
