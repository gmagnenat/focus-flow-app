import { useState, useCallback } from 'react'
import { useLogContext } from '../context/LogContext'
import { useInsights } from '../hooks/useInsights'
import { StatsGrid } from '../components/StatsGrid'
import { DailyChart } from '../components/DailyChart'
import { AiNarrative } from '../components/AiNarrative'
import type { Period } from '../utils/insights'

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
}

export const Review = () => {
  const { logs, timerState } = useLogContext()
  const [period, setPeriod] = useState<Period>('week')
  const insights = useInsights(logs, period)

  const handleBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [logs])

  return (
    <>
      <div className="review__tabs">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            className={`review__tab${period === p ? ' review__tab--active' : ''}`}
            type="button"
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <StatsGrid insights={insights} />
      <DailyChart insights={insights} timerLabels={timerState.timerLabels} />
      <AiNarrative insights={insights} logs={logs} />

      <div className="review__footer">
        <button className="review__backup" type="button" onClick={handleBackup} disabled={logs.length === 0}>
          Telecharger la sauvegarde (JSON)
        </button>
      </div>
    </>
  )
}
