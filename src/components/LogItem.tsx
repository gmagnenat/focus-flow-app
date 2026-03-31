import { useState } from 'react'
import { startOfDay } from 'date-fns'
import type { LogEntry } from '../types'
import { LogItemEdit } from './LogItemEdit'

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
  const [isEditing, setIsEditing] = useState(false)

  const isToday =
    startOfDay(new Date(entry.startTime)).getTime() ===
    startOfDay(new Date()).getTime()

  if (isEditing) {
    return <LogItemEdit entry={entry} onCancel={() => setIsEditing(false)} />
  }

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
      {isToday && (
        <button
          className="log-item__edit"
          type="button"
          onClick={() => setIsEditing(true)}
          aria-label={`Modifier ${entry.label}`}
        >
          &#9998;
        </button>
      )}
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
