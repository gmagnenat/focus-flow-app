import { useState, useCallback, type FormEvent } from 'react'
import { useLogContext } from '../context/LogContext'
import { isValidTimeRange, findOverlappingLog } from '../utils/validators'
import { formatSeconds } from '../utils/format'
import type { LogEntry } from '../types'

interface LogItemEditProps {
  entry: LogEntry
  onCancel: () => void
}

export const LogItemEdit = ({ entry, onCancel }: LogItemEditProps) => {
  const { logs, setLogs } = useLogContext()
  const [label, setLabel] = useState(entry.label)
  const [startTime, setStartTime] = useState(
    new Date(entry.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
  const [endTime, setEndTime] = useState(
    new Date(entry.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
  const [note, setNote] = useState(entry.note ?? '')
  const [error, setError] = useState('')

  const parseTime = useCallback(
    (timeStr: string): number => {
      const dayStart = new Date(entry.startTime)
      dayStart.setHours(0, 0, 0, 0)
      const [hours, minutes] = timeStr.split(':').map(Number)
      return dayStart.getTime() + hours * 3600000 + minutes * 60000
    },
    [entry.startTime]
  )

  const handleSave = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError('')

      const newStart = parseTime(startTime)
      const newEnd = parseTime(endTime)

      if (!isValidTimeRange(newStart, newEnd)) {
        setError("L'heure de fin doit etre apres l'heure de debut.")
        return
      }

      const overlap = findOverlappingLog(logs, entry.timerId, newStart, newEnd, entry.id)
      if (overlap) {
        const oStart = new Date(overlap.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const oEnd = new Date(overlap.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        setError(`Chevauchement avec "${overlap.label}" (${oStart} - ${oEnd})`)
        return
      }

      setLogs((prev) =>
        prev.map((log) =>
          log.id === entry.id
            ? {
                ...log,
                label: label.trim() || log.label,
                startTime: newStart,
                endTime: newEnd,
                duration: Math.floor((newEnd - newStart) / 1000),
                note: note.trim() || undefined,
              }
            : log
        )
      )
      onCancel()
    },
    [startTime, endTime, label, note, logs, entry, parseTime, setLogs, onCancel]
  )

  const preview = (() => {
    const s = parseTime(startTime)
    const e = parseTime(endTime)
    return e > s ? formatSeconds(Math.floor((e - s) / 1000)) : ''
  })()

  return (
    <form className="log-item-edit" onSubmit={handleSave}>
      <input className="log-item-edit__label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="log-item-edit__times">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <span>&rarr;</span>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        {preview && <span className="log-item-edit__preview">{preview}</span>}
      </div>
      <input className="log-item-edit__note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note..." />
      {error && <div className="log-item-edit__error">{error}</div>}
      <div className="log-item-edit__actions">
        <button className="log-item-edit__save" type="submit">Sauvegarder</button>
        <button className="log-item-edit__cancel" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}
