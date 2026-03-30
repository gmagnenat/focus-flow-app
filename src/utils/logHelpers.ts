import type { LogEntry } from '../types'

export const getLatestLogIndex = (logs: LogEntry[], timerId: number): number => {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    if (logs[index].timerId === timerId) {
      return index
    }
  }

  return -1
}

export const buildLogLabel = (label: string, timerId: number): string => {
  const trimmed = label.trim()
  return trimmed.length > 0 ? trimmed : `Unnamed Task [${timerId}]`
}

export const buildLogEntry = (
  timerId: number,
  label: string,
  startTime: number
): LogEntry => {
  return {
    id: crypto.randomUUID(),
    timerId,
    label: buildLogLabel(label, timerId),
    startTime,
    endTime: startTime,
    duration: 0,
    source: 'timer',
  }
}

export const finalizeLogEntry = (
  entry: LogEntry,
  endTime: number
): LogEntry => {
  const duration = Math.max(0, Math.floor((endTime - entry.startTime) / 1000))
  return { ...entry, endTime, duration }
}
