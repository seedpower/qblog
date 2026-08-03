import { resolveOpenRouterConfig } from './settings'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export async function openRouterChat(options: {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  responseFormat?: 'json_object' | 'text'
}): Promise<string> {
  const config = await resolveOpenRouterConfig()
  const apiKey = config.apiKey
  if (!apiKey) {
    throw new Error(
      'Missing OpenRouter API key. Set it in Admin → Settings or OPENROUTER_API_KEY env.'
    )
  }

  const model = options.model || config.model
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://blog.seedpower.app',
      'X-OpenRouter-Title': 'Seedpower Blog',
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.2,
      messages: options.messages,
      ...(options.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    }),
  })

  const data = (await response.json()) as OpenRouterResponse
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter request failed (${response.status})`)
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('OpenRouter returned empty content')
  }
  return content
}
