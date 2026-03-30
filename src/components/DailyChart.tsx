import type { PeriodInsights } from '../utils/insights'
import { formatSeconds } from '../utils/format'

interface DailyChartProps {
  insights: PeriodInsights
  timerLabels: Record<number, string>
}

const TIMER_COLORS: Record<string, string> = {}
const COLOR_PALETTE = ['var(--timer-1)', 'var(--timer-2)', 'var(--timer-3)']

const getColor = (label: string, allLabels: string[]): string => {
  if (!TIMER_COLORS[label]) {
    const index = allLabels.indexOf(label) % COLOR_PALETTE.length
    TIMER_COLORS[label] = COLOR_PALETTE[index]
  }
  return TIMER_COLORS[label]
}

export const DailyChart = ({ insights }: DailyChartProps) => {
  const maxSeconds = Math.max(...insights.dailyBreakdown.map((d) => d.seconds), 1)
  const allLabels = Object.keys(insights.labelDistribution).sort(
    (a, b) => (insights.labelDistribution[b] ?? 0) - (insights.labelDistribution[a] ?? 0)
  )

  return (
    <div className="daily-chart">
      <h3 className="daily-chart__title">Repartition journaliere</h3>

      <div className="daily-chart__rows">
        {insights.dailyBreakdown.map((day) => (
          <div className="daily-chart__row" key={day.day}>
            <span className="daily-chart__label">{day.day}</span>
            <div className="daily-chart__bar-bg">
              {allLabels.map((label) => {
                const seconds = day.byLabel[label] ?? 0
                if (seconds === 0) return null
                const pct = (seconds / maxSeconds) * 100
                return (
                  <div
                    key={label}
                    className="daily-chart__bar"
                    style={{
                      width: `${Math.max(pct, 0.5)}%`,
                      minWidth: seconds > 0 ? '2px' : '0',
                      background: getColor(label, allLabels),
                    }}
                    title={`${label}: ${formatSeconds(seconds)}`}
                  />
                )
              })}
            </div>
            <span className="daily-chart__time">
              {day.seconds > 0 ? formatSeconds(day.seconds) : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="daily-chart__legend">
        {allLabels.map((label) => (
          <span className="daily-chart__legend-item" key={label}>
            <span
              className="daily-chart__legend-dot"
              style={{ background: getColor(label, allLabels) }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
