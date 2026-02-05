import type { LogEntry } from '../types'

interface LogItemProps {
  entry: LogEntry
  formattedDuration: string
  onLabelChange: (id: string, value: string) => void
  onLabelBlur: (id: string) => void
}

export const LogItem = ({
  entry,
  formattedDuration,
  onLabelChange,
  onLabelBlur,
}: LogItemProps) => {
  return (
    <div className="log-item">
      <input
        className="log-item__input"
        value={entry.label}
        onChange={(event) => onLabelChange(entry.id, event.target.value)}
        onBlur={() => onLabelBlur(entry.id)}
      />
      <span className="log-item__duration">{formattedDuration}</span>
    </div>
  )
}
