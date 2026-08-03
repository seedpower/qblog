import { getDb } from './mongodb'

export const SETTINGS_DOC_ID = 'app'

export const OPENROUTER_MODEL_PRESETS = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-opus-4.5', label: 'Claude Opus 4.5' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
] as const

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'

export type AppSettingsDocument = {
  _id: typeof SETTINGS_DOC_ID
  openRouterApiKey?: string
  openRouterModel?: string
  updatedAt?: Date
}

export type OpenRouterResolvedConfig = {
  apiKey: string
  model: string
  apiKeySource: 'admin' | 'env' | 'none'
  modelSource: 'admin' | 'env' | 'default'
}

export type OpenRouterPublicSettings = {
  apiKeyConfigured: boolean
  apiKeySource: 'admin' | 'env' | 'none'
  apiKeyHint: string
  model: string
  modelSource: 'admin' | 'env' | 'default'
  envModel: string
  envApiKeyConfigured: boolean
  presets: Array<{ id: string; label: string }>
  defaultModel: string
}

function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`
}

export async function getSettingsCollection() {
  const db = await getDb()
  return db.collection<AppSettingsDocument>('settings')
}

export async function getAppSettings(): Promise<AppSettingsDocument | null> {
  const collection = await getSettingsCollection()
  return collection.findOne({ _id: SETTINGS_DOC_ID })
}

export function getEnvOpenRouterApiKey(): string {
  return (process.env.OPENROUTER_API_KEY || '').trim()
}

export function getEnvOpenRouterModel(): string {
  return (process.env.OPENROUTER_MODEL || '').trim()
}

export async function resolveOpenRouterConfig(): Promise<OpenRouterResolvedConfig> {
  const settings = await getAppSettings()
  const adminKey = (settings?.openRouterApiKey || '').trim()
  const envKey = getEnvOpenRouterApiKey()
  const adminModel = (settings?.openRouterModel || '').trim()
  const envModel = getEnvOpenRouterModel()

  let apiKey = ''
  let apiKeySource: OpenRouterResolvedConfig['apiKeySource'] = 'none'
  if (adminKey) {
    apiKey = adminKey
    apiKeySource = 'admin'
  } else if (envKey) {
    apiKey = envKey
    apiKeySource = 'env'
  }

  let model = DEFAULT_OPENROUTER_MODEL
  let modelSource: OpenRouterResolvedConfig['modelSource'] = 'default'
  if (adminModel) {
    model = adminModel
    modelSource = 'admin'
  } else if (envModel) {
    model = envModel
    modelSource = 'env'
  }

  return { apiKey, model, apiKeySource, modelSource }
}

export async function getOpenRouterPublicSettings(): Promise<OpenRouterPublicSettings> {
  const resolved = await resolveOpenRouterConfig()
  const envKey = getEnvOpenRouterApiKey()
  const envModel = getEnvOpenRouterModel() || DEFAULT_OPENROUTER_MODEL
  const settings = await getAppSettings()
  const adminKey = (settings?.openRouterApiKey || '').trim()

  return {
    apiKeyConfigured: Boolean(resolved.apiKey),
    apiKeySource: resolved.apiKeySource,
    apiKeyHint: adminKey ? maskApiKey(adminKey) : envKey ? maskApiKey(envKey) : '',
    model: resolved.model,
    modelSource: resolved.modelSource,
    envModel,
    envApiKeyConfigured: Boolean(envKey),
    presets: OPENROUTER_MODEL_PRESETS.map((p) => ({ id: p.id, label: p.label })),
    defaultModel: DEFAULT_OPENROUTER_MODEL,
  }
}

export type UpdateOpenRouterSettingsInput = {
  /** New key; empty string clears admin override (falls back to env). Omit to leave unchanged. */
  openRouterApiKey?: string | null
  /** Model id; empty string clears admin override. Omit to leave unchanged. */
  openRouterModel?: string | null
}

export async function updateOpenRouterSettings(
  input: UpdateOpenRouterSettingsInput
): Promise<OpenRouterPublicSettings> {
  const collection = await getSettingsCollection()
  const existing = (await collection.findOne({ _id: SETTINGS_DOC_ID })) || {
    _id: SETTINGS_DOC_ID,
  }

  const next: AppSettingsDocument = {
    ...existing,
    _id: SETTINGS_DOC_ID,
    updatedAt: new Date(),
  }

  if ('openRouterApiKey' in input) {
    const value = typeof input.openRouterApiKey === 'string' ? input.openRouterApiKey.trim() : ''
    if (value) {
      next.openRouterApiKey = value
    } else {
      delete next.openRouterApiKey
    }
  }

  if ('openRouterModel' in input) {
    const value = typeof input.openRouterModel === 'string' ? input.openRouterModel.trim() : ''
    if (value) {
      next.openRouterModel = value
    } else {
      delete next.openRouterModel
    }
  }

  await collection.updateOne({ _id: SETTINGS_DOC_ID }, { $set: next }, { upsert: true })

  // If fields were cleared, also $unset so empty keys don't linger.
  const unset: Record<string, ''> = {}
  if ('openRouterApiKey' in input && !(next.openRouterApiKey || '').trim()) {
    unset.openRouterApiKey = ''
  }
  if ('openRouterModel' in input && !(next.openRouterModel || '').trim()) {
    unset.openRouterModel = ''
  }
  if (Object.keys(unset).length) {
    await collection.updateOne({ _id: SETTINGS_DOC_ID }, { $unset: unset })
  }

  return getOpenRouterPublicSettings()
}
