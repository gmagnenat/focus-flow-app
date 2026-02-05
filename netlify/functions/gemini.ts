const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2-flash'
const API_HOST = 'https://generativelanguage.googleapis.com/v1beta/models'

type NetlifyEvent = {
  httpMethod: string
  body?: string | null
}

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: 'Missing GEMINI_API_KEY',
    }
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : null
    const prompt = payload?.prompt
    const model = payload?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL

    if (!prompt) {
      return {
        statusCode: 400,
        body: 'Missing prompt',
      }
    }

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

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: 'Failed to generate summary',
      }
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return {
        statusCode: 500,
        body: 'No summary returned',
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.trim() }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: error instanceof Error ? error.message : 'Unexpected error',
    }
  }
}
