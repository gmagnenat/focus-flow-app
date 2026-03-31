import { useState, useCallback, type FormEvent } from 'react'
import { startOfDay } from 'date-fns'
import { useLogContext } from '../context/LogContext'
import { isValidTimeRange, findOverlappingLog } from '../utils/validators'
import { formatSeconds } from '../utils/format'
import type { LogEntry } from '../types'

export const ManualEntryForm = () => {
  const { timerState, logs, setLogs } = useLogContext()
  const [isOpen, setIsOpen] = useState(false)
  const [timerId, setTimerId] = useState<1 | 2 | 3>(1)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const parseTimestamp = useCallback(
    (dateStr: string, timeStr: string): number => {
      const day = startOfDay(new Date(dateStr))
      const [hours, minutes] = timeStr.split(':').map(Number)
      return day.getTime() + hours * 3600000 + minutes * 60000
    },
    []
  )

  const durationPreview = useCallback(() => {
    const start = parseTimestamp(date, startTime)
    const end = parseTimestamp(date, endTime)
    if (end <= start) return ''
    return formatSeconds(Math.floor((end - start) / 1000))
  }, [date, startTime, endTime, parseTimestamp])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError('')

      const start = parseTimestamp(date, startTime)
      const end = parseTimestamp(date, endTime)

      if (!isValidTimeRange(start, end)) {
        setError("L'heure de fin doit etre apres l'heure de debut.")
        return
      }

      const overlap = findOverlappingLog(logs, timerId, start, end)
      if (overlap) {
        const overlapStart = new Date(overlap.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const overlapEnd = new Date(overlap.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        setError(`Chevauchement avec "${overlap.label}" (${overlapStart} - ${overlapEnd})`)
        return
      }

      const entry: LogEntry = {
        id: crypto.randomUUID(),
        timerId,
        label: timerState.timerLabels[timerId],
        startTime: start,
        endTime: end,
        duration: Math.floor((end - start) / 1000),
        source: 'manual',
        note: note.trim() || undefined,
      }

      setLogs((prev) => [...prev, entry])
      setStartTime('09:00')
      setEndTime('10:00')
      setNote('')
      setError('')
    },
    [date, startTime, endTime, timerId, note, logs, timerState.timerLabels, parseTimestamp, setLogs]
  )

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  if (!isOpen) {
    return (
      <button className="manual-entry__toggle" type="button" onClick={() => setIsOpen(true)}>
        + Ajouter une entree manuelle
      </button>
    )
  }

  return (
    <form className="manual-entry" onSubmit={handleSubmit}>
      <div className="manual-entry__header">
        <h3 className="manual-entry__title">Ajouter une entree manuelle</h3>
        <button className="manual-entry__close" type="button" onClick={() => setIsOpen(false)}>
          &times;
        </button>
      </div>

      <div className="manual-entry__row">
        <select
          className="manual-entry__select"
          value={timerId}
          onChange={(e) => setTimerId(Number(e.target.value) as 1 | 2 | 3)}
        >
          <option value={1}>{timerState.timerLabels[1]}</option>
          <option value={2}>{timerState.timerLabels[2]}</option>
          <option value={3}>{timerState.timerLabels[3]}</option>
        </select>

        <select className="manual-entry__select" value={date} onChange={(e) => setDate(e.target.value)}>
          <option value={today}>Aujourd'hui</option>
          <option value={yesterday}>Hier</option>
        </select>

        <input className="manual-entry__time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <span className="manual-entry__arrow">&rarr;</span>
        <input className="manual-entry__time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />

        <input className="manual-entry__note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)..." />
      </div>

      <div className="manual-entry__footer">
        {durationPreview() && <span className="manual-entry__preview">Duree : {durationPreview()}</span>}
        <button className="manual-entry__submit" type="submit">Ajouter</button>
      </div>

      {error && <div className="manual-entry__error">{error}</div>}
    </form>
  )
}
