import type { LogEntry } from '../types'

interface LogItemProps {
  entry: LogEntry
  formattedDuration: string
  onLabelChange: (id: string, value: string) => void
  onLabelBlur: (id: string) => void
  onDelete: (id: string) => void
}

export const LogItem = ({
  entry,
  formattedDuration,
  onLabelChange,
  onLabelBlur,
  onDelete,
}: LogItemProps) => {
  return (
    <div className="log-item" data-timer={entry.timerId}>
      <span className="log-item__dot" aria-hidden="true" />
      <input
        className="log-item__input"
        value={entry.label}
        onChange={(event) => onLabelChange(entry.id, event.target.value)}
        onBlur={() => onLabelBlur(entry.id)}
      />
      <span className="log-item__duration">{formattedDuration}</span>
      <button
        className="log-item__delete"
        type="button"
        onClick={() => onDelete(entry.id)}
        aria-label={`Delete ${entry.label}`}
      >
        &times;
      </button>
    </div>
  )
}
