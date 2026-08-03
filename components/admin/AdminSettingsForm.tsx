'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { OpenRouterPublicSettings } from '@/lib/settings'

const btnPrimary =
  'rounded-full bg-gradient-to-b from-[#3d9dff] via-primary-500 to-[#0a76e6] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(10,132,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-60'
const btnGlass =
  'glass glass-pill px-4 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] disabled:opacity-60'
const fieldClass =
  'mt-1.5 w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-primary-400 dark:border-white/10 dark:bg-white/5'
const labelClass = 'block text-sm font-medium text-[var(--ink)]'

const CUSTOM = '__custom__'

export default function AdminSettingsForm() {
  const [settings, setSettings] = useState<OpenRouterPublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [modelSelect, setModelSelect] = useState('')
  const [customModel, setCustomModel] = useState('')

  function applySettings(next: OpenRouterPublicSettings) {
    setSettings(next)
    setApiKeyInput('')
    const isPreset = next.presets.some((p) => p.id === next.model)
    if (isPreset) {
      setModelSelect(next.model)
      setCustomModel('')
    } else {
      setModelSelect(CUSTOM)
      setCustomModel(next.model)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings/')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load settings')
      applySettings(data.settings as OpenRouterPublicSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const model = modelSelect === CUSTOM ? customModel.trim() : modelSelect.trim()
      if (!model) throw new Error('Model is required')

      const body: Record<string, unknown> = {
        openRouterModel: model,
      }
      if (apiKeyInput.trim()) {
        body.openRouterApiKey = apiKeyInput.trim()
      }

      const res = await fetch('/api/admin/settings/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      applySettings(data.settings)
      setStatus('Settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function clearApiKey() {
    if (!confirm('Clear the admin API key and fall back to OPENROUTER_API_KEY env?')) return
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const res = await fetch('/api/admin/settings/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearApiKey: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Clear failed')
      applySettings(data.settings)
      setStatus('Admin API key cleared. Using env default if set.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed')
    } finally {
      setSaving(false)
    }
  }

  async function resetModelToEnv() {
    if (!confirm('Clear the admin model override and use OPENROUTER_MODEL / default?')) return
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const res = await fetch('/api/admin/settings/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearModel: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      applySettings(data.settings)
      setStatus('Model override cleared.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !settings) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-[var(--ink-soft)]">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Configure OpenRouter for auto-translation and AI body edits. Environment variables are
          used as defaults when admin overrides are empty.
        </p>
      </div>

      <form onSubmit={save} className="glass glass-card space-y-6 p-5 sm:p-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">OpenRouter API key</h2>
          <p className="text-xs text-[var(--ink-soft)]">
            Current source:{' '}
            <span className="font-medium text-[var(--ink)]">
              {settings?.apiKeySource === 'admin'
                ? `Admin override (${settings.apiKeyHint})`
                : settings?.apiKeySource === 'env'
                  ? `Environment (${settings.apiKeyHint})`
                  : 'Not configured'}
            </span>
            {settings?.envApiKeyConfigured ? ' · env key is set' : ' · env key missing'}
          </p>
          <label className={labelClass}>
            New API key
            <input
              type="password"
              autoComplete="off"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={
                settings?.apiKeyConfigured
                  ? 'Leave blank to keep current key'
                  : 'sk-or-v1-…'
              }
              className={fieldClass}
            />
          </label>
          {settings?.apiKeySource === 'admin' && (
            <button type="button" onClick={clearApiKey} disabled={saving} className={btnGlass}>
              Clear admin key (use env)
            </button>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">Model</h2>
          <p className="text-xs text-[var(--ink-soft)]">
            Current source:{' '}
            <span className="font-medium text-[var(--ink)]">{settings?.modelSource}</span>
            {' · '}
            env default:{' '}
            <code className="rounded bg-black/5 px-1 py-0.5 text-[11px] dark:bg-white/10">
              {settings?.envModel || settings?.defaultModel}
            </code>
          </p>
          <label className={labelClass}>
            Preset
            <select
              value={modelSelect}
              onChange={(e) => setModelSelect(e.target.value)}
              className={fieldClass}
            >
              {(settings?.presets || []).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} ({preset.id})
                </option>
              ))}
              <option value={CUSTOM}>Custom model ID…</option>
            </select>
          </label>
          {modelSelect === CUSTOM && (
            <label className={labelClass}>
              Custom model ID
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="provider/model-name"
                className={`${fieldClass} font-mono`}
                required
              />
            </label>
          )}
          {settings?.modelSource === 'admin' && (
            <button type="button" onClick={resetModelToEnv} disabled={saving} className={btnGlass}>
              Reset model to env / default
            </button>
          )}
        </section>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {status && <p className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button type="button" onClick={() => void load()} disabled={saving} className={btnGlass}>
            Reload
          </button>
        </div>
      </form>
    </div>
  )
}
