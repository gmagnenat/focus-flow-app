import { formatSeconds } from '../utils/format'
import type { PeriodInsights } from '../utils/insights'

interface StatsGridProps {
  insights: PeriodInsights
}

const formatDelta = (seconds: number): string => {
  const prefix = seconds >= 0 ? '+' : ''
  return `${prefix}${formatSeconds(Math.abs(seconds))}`
}

export const StatsGrid = ({ insights }: StatsGridProps) => {
  const isPositive = insights.periodOverPeriodDelta >= 0
  const switchesWarning = insights.contextSwitchesPerDay > 4

  return (
    <div className="stats-grid">
      <div className="stats-grid__card">
        <span className="stats-grid__value">{formatSeconds(insights.totalSeconds)}</span>
        <span className="stats-grid__label">Total suivi</span>
        <span className={`stats-grid__delta ${isPositive ? 'stats-grid__delta--positive' : 'stats-grid__delta--negative'}`}>
          {formatDelta(insights.periodOverPeriodDelta)} vs precedent
        </span>
      </div>

      <div className="stats-grid__card">
        <span className="stats-grid__value">{formatSeconds(insights.avgSessionSeconds)}</span>
        <span className="stats-grid__label">Session moyenne</span>
      </div>

      <div className="stats-grid__card">
        <span className="stats-grid__value">{formatSeconds(insights.longestSession.duration)}</span>
        <span className="stats-grid__label">Plus longue session</span>
        {insights.longestSession.label && (
          <span className="stats-grid__detail">
            {insights.longestSession.day}, {insights.longestSession.label}
          </span>
        )}
      </div>

      <div className="stats-grid__card">
        <span className="stats-grid__value">{insights.contextSwitchesPerDay}</span>
        <span className="stats-grid__label">Changements/jour</span>
        {switchesWarning && <span className="stats-grid__delta stats-grid__delta--warning">Eleve</span>}
      </div>
    </div>
  )
}
