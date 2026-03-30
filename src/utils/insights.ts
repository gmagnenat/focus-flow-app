import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
  eachDayOfInterval, format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { LogEntry } from '../types'

export interface PeriodInsights {
  totalSeconds: number
  avgSessionSeconds: number
  longestSession: { duration: number; label: string; day: string }
  contextSwitchesPerDay: number
  dailyBreakdown: Array<{
    day: string
    seconds: number
    byLabel: Record<string, number>
  }>
  labelDistribution: Record<string, number>
  periodOverPeriodDelta: number
}

export type Period = 'today' | 'week' | 'month'

const emptyInsights: PeriodInsights = {
  totalSeconds: 0,
  avgSessionSeconds: 0,
  longestSession: { duration: 0, label: '', day: '' },
  contextSwitchesPerDay: 0,
  dailyBreakdown: [],
  labelDistribution: {},
  periodOverPeriodDelta: 0,
}

const filterLogsByRange = (
  logs: LogEntry[],
  start: number,
  end: number
): LogEntry[] =>
  logs.filter((log) => log.startTime >= start && log.startTime < end)

const computeForRange = (
  logs: LogEntry[],
  rangeStart: Date,
  rangeEnd: Date
): Omit<PeriodInsights, 'periodOverPeriodDelta'> => {
  const filtered = filterLogsByRange(
    logs,
    rangeStart.getTime(),
    rangeEnd.getTime()
  )

  if (filtered.length === 0) {
    return { ...emptyInsights }
  }

  const totalSeconds = filtered.reduce((sum, log) => sum + log.duration, 0)
  const avgSessionSeconds = Math.round(totalSeconds / filtered.length)

  // Longest session
  let longest = filtered[0]
  for (const log of filtered) {
    if (log.duration > longest.duration) longest = log
  }
  const longestSession = {
    duration: longest.duration,
    label: longest.label,
    day: format(new Date(longest.startTime), 'EEE', { locale: fr }),
  }

  // Daily breakdown
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const dailyBreakdown = days.map((dayDate) => {
    const dayStart = startOfDay(dayDate).getTime()
    const dayEnd = endOfDay(dayDate).getTime()
    const dayLogs = filtered.filter(
      (log) => log.startTime >= dayStart && log.startTime < dayEnd
    )
    const byLabel: Record<string, number> = {}
    let seconds = 0
    for (const log of dayLogs) {
      seconds += log.duration
      byLabel[log.label] = (byLabel[log.label] ?? 0) + log.duration
    }
    return {
      day: format(dayDate, 'EEE', { locale: fr }),
      seconds,
      byLabel,
    }
  })

  // Label distribution
  const labelDistribution: Record<string, number> = {}
  for (const log of filtered) {
    labelDistribution[log.label] = (labelDistribution[log.label] ?? 0) + log.duration
  }

  // Context switches
  const switchesByDay: number[] = []
  for (const dayDate of days) {
    const dayStart = startOfDay(dayDate).getTime()
    const dayEnd = endOfDay(dayDate).getTime()
    const dayLogs = filtered
      .filter((log) => log.startTime >= dayStart && log.startTime < dayEnd)
      .sort((a, b) => a.startTime - b.startTime)
    let switches = 0
    for (let i = 1; i < dayLogs.length; i++) {
      if (dayLogs[i].label !== dayLogs[i - 1].label) switches++
    }
    if (dayLogs.length > 0) switchesByDay.push(switches)
  }
  const contextSwitchesPerDay =
    switchesByDay.length > 0
      ? Math.round(
          (switchesByDay.reduce((a, b) => a + b, 0) / switchesByDay.length) * 10
        ) / 10
      : 0

  return {
    totalSeconds,
    avgSessionSeconds,
    longestSession,
    contextSwitchesPerDay,
    dailyBreakdown,
    labelDistribution,
  }
}

export const getPeriodDates = (
  period: Period,
  referenceDate: Date = new Date()
): { start: Date; end: Date; priorStart: Date; priorEnd: Date } => {
  switch (period) {
    case 'today':
      return {
        start: startOfDay(referenceDate),
        end: endOfDay(referenceDate),
        priorStart: startOfDay(subDays(referenceDate, 1)),
        priorEnd: endOfDay(subDays(referenceDate, 1)),
      }
    case 'week':
      return {
        start: startOfWeek(referenceDate, { locale: fr }),
        end: endOfWeek(referenceDate, { locale: fr }),
        priorStart: startOfWeek(subWeeks(referenceDate, 1), { locale: fr }),
        priorEnd: endOfWeek(subWeeks(referenceDate, 1), { locale: fr }),
      }
    case 'month':
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
        priorStart: startOfMonth(subMonths(referenceDate, 1)),
        priorEnd: endOfMonth(subMonths(referenceDate, 1)),
      }
  }
}

export const computeInsights = (
  logs: LogEntry[],
  start: Date,
  end: Date,
  priorStart: Date,
  priorEnd: Date
): PeriodInsights => {
  const current = computeForRange(logs, start, end)
  const prior = computeForRange(logs, priorStart, priorEnd)
  return {
    ...current,
    periodOverPeriodDelta: current.totalSeconds - prior.totalSeconds,
  }
}
