import { useMutation } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { generateReviewNarrative } from '../services/geminiClient'
import type { PeriodInsights } from '../utils/insights'
import type { Period } from '../utils/insights'
import type { LogEntry } from '../types'

interface AiNarrativeProps {
  insights: PeriodInsights
  logs: LogEntry[]
  period: Period
}

function getCacheKey(period: Period, totalSeconds: number): string {
  return `ai-narrative:${period}:${totalSeconds}`
}

function getCached(period: Period, totalSeconds: number): string | null {
  try {
    return sessionStorage.getItem(getCacheKey(period, totalSeconds))
  } catch {
    return null
  }
}

function setCache(period: Period, totalSeconds: number, text: string): void {
  try {
    sessionStorage.setItem(getCacheKey(period, totalSeconds), text)
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export const AiNarrative = ({ insights, logs, period }: AiNarrativeProps) => {
  const [cached] = useState(() => getCached(period, insights.totalSeconds))

  const mutation = useMutation({
    mutationFn: () => generateReviewNarrative(insights, logs),
    onSuccess: (text) => setCache(period, insights.totalSeconds, text),
  })

  const narrative = mutation.data ?? cached

  const handleGenerate = useCallback(() => {
    mutation.mutate()
  }, [mutation])

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

  if (narrative) {
    return (
      <div className="ai-narrative">
        <div className="ai-narrative__header">
          <div className="ai-narrative__icon">✦ Revue IA</div>
          <button
            className="ai-narrative__regenerate"
            type="button"
            onClick={handleGenerate}
            title="Regenerer la revue"
          >
            ↻
          </button>
        </div>
        <p className="ai-narrative__text">{narrative}</p>
      </div>
    )
  }

  return (
    <div className="ai-narrative ai-narrative--idle">
      <div className="ai-narrative__icon">✦</div>
      <button
        className="ai-narrative__generate"
        type="button"
        onClick={handleGenerate}
      >
        Generer la revue IA
      </button>
    </div>
  )
}
