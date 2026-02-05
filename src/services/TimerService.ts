import type { LogEntry } from '../types'
import { buildLogEntry, getLatestLogIndex } from '../utils/logHelpers'

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
    timerLabels: Record<number, string>,
    timestamp: number
  ): { logs: LogEntry[]; timerValues: Record<number, number> } {
    if (activeTimerId === null || startTime === null) {
      return { logs, timerValues }
    }

    const elapsedSeconds = this.calculateElapsedSeconds(startTime, timestamp)
    const updatedLogs = [...logs]
    const logIndex = getLatestLogIndex(updatedLogs, activeTimerId)

    if (logIndex === -1) {
      const entry = buildLogEntry(
        activeTimerId,
        timerLabels[activeTimerId],
        startTime
      )
      entry.duration += elapsedSeconds
      updatedLogs.push(entry)
    } else {
      updatedLogs[logIndex] = {
        ...updatedLogs[logIndex],
        duration: updatedLogs[logIndex].duration + elapsedSeconds,
      }
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
        return {
          ...entry,
          duration: entry.duration + (now - activeStartTime) / 1000,
        }
      }
      return entry
    })
  }
}

export const timerService = new TimerService()
