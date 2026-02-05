import type { LogEntry } from '../types'

const DEFAULT_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2-flash'
const API_HOST = 'https://generativelanguage.googleapis.com/v1beta/models'
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

const parseGeminiResponse = async (response: Response): Promise<string> => {
  if (!response.ok) {
    throw new Error('Failed to generate summary.')
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('No summary returned.')
  }

  return text.trim()
}

const fetchDirect = async (prompt: string, model: string, apiKey: string) => {
  const response = await fetch(
    `${API_HOST}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  )

  return parseGeminiResponse(response)
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

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (apiKey) {
    return fetchDirect(prompt, model, apiKey)
  }

  return fetchViaProxy(prompt, model)
}
