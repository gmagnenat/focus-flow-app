import type { LogEntry } from '../types'
import type { PeriodInsights } from '../utils/insights'
import { formatSeconds } from '../utils/format'

const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3-flash-preview'
const PROXY_ENDPOINT = '/.netlify/functions/gemini'

const buildPrompt = (summaries: Array<{ label: string; totalSeconds: number; sessions: number }>): string => {
  const payload = summaries
    .map((item) =>
      `- ${item.label} | totalSeconds=${item.totalSeconds} | sessions=${item.sessions}`
    )
    .join('\n')

  return [
    'Tu es un assistant de productivite.',
    'Reponds en francais.',
    'Regroupe les projets similaires et structure la reponse ainsi :',
    'Nom du projet - HH:MM:SS',
    '- tache ou activite 1',
    '- tache ou activite 2',
    'Utilise des puces en une seule phrase courte par tache.',
    'Reste concis et utilise HH:MM ou HH:MM:SS pour le temps.',
    'Si plusieurs labels sont regroupes, additionne totalSeconds et decris le travail commun.',
    'Donnees:',
    payload,
  ].join('\n')
}

const buildLabelSummary = (logs: LogEntry[]): Array<{ label: string; totalSeconds: number; sessions: number }> => {
  const totals = new Map<string, { label: string; totalSeconds: number; sessions: number }>()

  logs.forEach((log) => {
    const label = log.label.trim() || `Timer ${log.timerId}`
    const current = totals.get(label)
    if (current) {
      current.totalSeconds += log.duration
      current.sessions += 1
    } else {
      totals.set(label, { label, totalSeconds: log.duration, sessions: 1 })
    }
  })

  return Array.from(totals.values()).sort(
    (a, b) => b.totalSeconds - a.totalSeconds
  )
}

const fetchViaProxy = async (prompt: string, model: string) => {
  const response = await fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, model }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to generate summary.')
  }

  const data = (await response.json()) as { text?: string }
  if (!data.text) {
    throw new Error('No summary returned.')
  }

  return data.text.trim()
}

export const generateSummary = async (logs: LogEntry[]): Promise<string> => {
  if (logs.length === 0) {
    return 'No sessions yet.'
  }

  const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL
  const trimmedLogs = logs.slice(-200)
  const summaries = buildLabelSummary(trimmedLogs)
  const prompt = buildPrompt(summaries)

  // Always use proxy - never expose API key to client
  return fetchViaProxy(prompt, model)
}

const buildReviewPrompt = (insights: PeriodInsights, recentLogs: LogEntry[]): string => {
  const dailyLines = insights.dailyBreakdown
    .filter((d) => d.seconds > 0)
    .map((d) => {
      const labels = Object.entries(d.byLabel)
        .map(([label, secs]) => `${label}: ${formatSeconds(secs)}`)
        .join(', ')
      return `- ${d.day}: ${formatSeconds(d.seconds)} (${labels})`
    })
    .join('\n')

  const labelLines = Object.entries(insights.labelDistribution)
    .sort(([, a], [, b]) => b - a)
    .map(([label, secs]) => `- ${label}: ${formatSeconds(secs)}`)
    .join('\n')

  const sessionLines = recentLogs
    .slice(-20)
    .map((log) => {
      const start = new Date(log.startTime).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
      const end = new Date(log.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      return `- ${log.label} | ${start} - ${end} | ${formatSeconds(log.duration)}${log.source === 'manual' ? ' (manuel)' : ''}`
    })
    .join('\n')

  const deltaSign = insights.periodOverPeriodDelta >= 0 ? '+' : ''

  return [
    'Tu es un coach de productivite personnel qui analyse les donnees de suivi du temps.',
    '',
    'STATISTIQUES DE LA PERIODE :',
    `- Total : ${formatSeconds(insights.totalSeconds)}`,
    `- Session moyenne : ${formatSeconds(insights.avgSessionSeconds)}`,
    `- Plus longue session : ${formatSeconds(insights.longestSession.duration)} sur ${insights.longestSession.label} (${insights.longestSession.day})`,
    `- Changements de contexte/jour : ${insights.contextSwitchesPerDay}`,
    `- Evolution vs periode precedente : ${deltaSign}${formatSeconds(Math.abs(insights.periodOverPeriodDelta))}`,
    '',
    'REPARTITION JOURNALIERE :',
    dailyLines || '(aucune donnee)',
    '',
    'REPARTITION PAR PROJET :',
    labelLines || '(aucune donnee)',
    '',
    'SESSIONS RECENTES :',
    sessionLines || '(aucune session)',
    '',
    'Ecris une revue en 3-4 phrases. Sois specifique : nomme les jours, les projets, les tendances.',
    'Souligne un point fort et une suggestion concrete. Sois direct, pas generique. Reponds en francais.',
  ].join('\n')
}

export const generateReviewNarrative = async (
  insights: PeriodInsights,
  logs: LogEntry[]
): Promise<string> => {
  if (insights.totalSeconds === 0) {
    return 'Aucune session suivie pour cette periode.'
  }

  const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL
  const prompt = buildReviewPrompt(insights, logs)
  const text = await fetchViaProxy(prompt, model)
  return text.replace(/\*\*/g, '').trim()
}
