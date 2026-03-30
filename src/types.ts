export type TimerId = 1 | 2 | 3 | null

export type LogSource = 'timer' | 'manual'

export interface LogEntry {
  id: string
  timerId: number
  label: string
  startTime: number
  endTime: number
  duration: number
  source: LogSource
  note?: string
}

export interface TimerState {
  activeTimerId: TimerId
  activeStartTime: number | null
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  lastSavedAt: number
}

export interface AppState {
  activeTimerId: TimerId
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  logs: LogEntry[]
  lastSavedAt: number
}
