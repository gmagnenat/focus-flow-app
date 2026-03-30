import type { LogEntry } from '../types'
import { finalizeLogEntry, getLatestLogIndex } from '../utils/logHelpers'

export interface TimeProvider {
  now: () => number
}

export class TimerService {
  private timeProvider: TimeProvider

  constructor(timeProvider: TimeProvider = { now: () => Date.now() }) {
    this.timeProvider = timeProvider
  }

  now(): number {
    return this.timeProvider.now()
  }

  calculateElapsedSeconds(startTime: number, endTime: number): number {
    return Math.floor((endTime - startTime) / 1000)
  }

  commitActiveTimer(
    activeTimerId: number | null,
    startTime: number | null,
    logs: LogEntry[],
    timerValues: Record<number, number>,
    _timerLabels: Record<number, string>,
    timestamp: number
  ): { logs: LogEntry[]; timerValues: Record<number, number> } {
    if (activeTimerId === null || startTime === null) {
      return { logs, timerValues }
    }

    const elapsedSeconds = this.calculateElapsedSeconds(startTime, timestamp)
    const updatedLogs = [...logs]
    const logIndex = getLatestLogIndex(updatedLogs, activeTimerId)

    if (logIndex !== -1 && updatedLogs[logIndex].endTime === updatedLogs[logIndex].startTime) {
      // Finalize the open entry (endTime === startTime means it's still open)
      updatedLogs[logIndex] = finalizeLogEntry(updatedLogs[logIndex], timestamp)
    }

    return {
      logs: updatedLogs,
      timerValues: {
        ...timerValues,
        [activeTimerId]: timerValues[activeTimerId] + elapsedSeconds,
      },
    }
  }

  calculateTimerSeconds(
    timerId: number,
    timerValues: Record<number, number>,
    activeTimerId: number | null,
    activeStartTime: number | null,
    now: number
  ): number {
    const base = timerValues[timerId] || 0
    if (activeTimerId === timerId && activeStartTime !== null) {
      return base + Math.floor((now - activeStartTime) / 1000)
    }
    return base
  }

  calculateDisplayLogs(
    logs: LogEntry[],
    activeTimerId: number | null,
    activeStartTime: number | null,
    now: number
  ): LogEntry[] {
    if (activeTimerId === null || activeStartTime === null) {
      return logs
    }

    const activeLogIndex = getLatestLogIndex(logs, activeTimerId)
    if (activeLogIndex === -1) {
      return logs
    }

    return logs.map((entry, index) => {
      if (index === activeLogIndex) {
        const elapsed = Math.floor((now - activeStartTime) / 1000)
        return {
          ...entry,
          endTime: now,
          duration: elapsed,
        }
      }
      return entry
    })
  }
}

export const timerService = new TimerService()
