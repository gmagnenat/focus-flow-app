import type { LogEntry } from '../types'
import { LogItem } from './LogItem.tsx'

interface LogListProps {
  logs: LogEntry[]
  formatDuration: (value: number) => string
  onLabelChange: (id: string, value: string) => void
  onLabelBlur: (id: string) => void
}

export const LogList = ({
  logs,
  formatDuration,
  onLabelChange,
  onLabelBlur,
}: LogListProps) => {
  return (
    <div className="log-list">
      {logs.map((entry) => (
        <LogItem
          key={entry.id}
          entry={entry}
          formattedDuration={formatDuration(entry.duration)}
          onLabelChange={onLabelChange}
          onLabelBlur={onLabelBlur}
        />
      ))}
    </div>
  )
}
