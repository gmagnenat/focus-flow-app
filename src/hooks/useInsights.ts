import { useMemo } from 'react'
import { computeInsights, getPeriodDates, type Period, type PeriodInsights } from '../utils/insights'
import type { LogEntry } from '../types'

export const useInsights = (logs: LogEntry[], period: Period): PeriodInsights => {
  return useMemo(() => {
    const { start, end, priorStart, priorEnd } = getPeriodDates(period)
    return computeInsights(logs, start, end, priorStart, priorEnd)
  }, [logs, period])
}
