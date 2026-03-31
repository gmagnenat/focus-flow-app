import { useMemo } from 'react'
import { startOfDay, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useLogContext } from '../context/LogContext'
import { LogList } from '../components/LogList'
import { formatSeconds } from '../utils/format'
import type { LogEntry } from '../types'

interface DayGroup {
  date: string
  totalSeconds: number
  logs: LogEntry[]
}

export const History = () => {
  const { logs, displayLogs, updateLogLabel, validateLogLabel, deleteLog } = useLogContext()

  const dayGroups = useMemo(() => {
    const groups = new Map<number, DayGroup>()

    displayLogs.forEach((log) => {
      const dayKey = startOfDay(new Date(log.startTime)).getTime()
      const existing = groups.get(dayKey)
      if (existing) {
        existing.totalSeconds += log.duration
        existing.logs.push(log)
      } else {
        groups.set(dayKey, {
          date: format(new Date(dayKey), 'EEEE d MMMM yyyy', { locale: fr }),
          totalSeconds: log.duration,
          logs: [log],
        })
      }
    })

    return Array.from(groups.entries())
      .sort(([a], [b]) => b - a)
      .map(([, group]) => group)
  }, [displayLogs])

  return (
    <>
      <h2 className="history__title">Historique</h2>
      {logs.length === 0 ? (
        <div className="app__placeholder">Aucune session enregistree.</div>
      ) : (
        dayGroups.map((group) => (
          <section key={group.date} className="history__day">
            <div className="history__day-header">
              <span className="history__day-date">{group.date}</span>
              <span className="history__day-total">{formatSeconds(group.totalSeconds)}</span>
            </div>
            <LogList
              logs={group.logs}
              formatDuration={formatSeconds}
              onLabelChange={updateLogLabel}
              onLabelBlur={validateLogLabel}
              onDelete={deleteLog}
            />
          </section>
        ))
      )}
    </>
  )
}
