import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { generateReviewNarrative } from '../services/geminiClient'
import type { PeriodInsights } from '../utils/insights'
import type { LogEntry } from '../types'

interface AiNarrativeProps {
  insights: PeriodInsights
  logs: LogEntry[]
}

export const AiNarrative = ({ insights, logs }: AiNarrativeProps) => {
  const mutation = useMutation({
    mutationFn: () => generateReviewNarrative(insights, logs),
  })

  useEffect(() => {
    if (insights.totalSeconds > 0) {
      mutation.mutate()
    }
  // Only re-trigger when insights change meaningfully
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights.totalSeconds, insights.periodOverPeriodDelta])

  if (insights.totalSeconds === 0) {
    return (
      <div className="ai-narrative ai-narrative--empty">
        <div className="ai-narrative__icon">✦</div>
        <p className="ai-narrative__text">Aucune session suivie pour cette periode.</p>
      </div>
    )
  }

  if (mutation.isPending) {
    return (
      <div className="ai-narrative ai-narrative--loading">
        <div className="ai-narrative__icon">✦</div>
        <p className="ai-narrative__text">Generation de la revue en cours...</p>
      </div>
    )
  }

  if (mutation.isError) {
    return (
      <div className="ai-narrative ai-narrative--error">
        <div className="ai-narrative__icon">✦</div>
        <p className="ai-narrative__text">Revue IA indisponible — voici vos statistiques.</p>
      </div>
    )
  }

  return (
    <div className="ai-narrative">
      <div className="ai-narrative__icon">✦ Revue IA</div>
      <p className="ai-narrative__text">{mutation.data}</p>
    </div>
  )
}
