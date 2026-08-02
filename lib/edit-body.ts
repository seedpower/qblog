import { openRouterChat } from './openrouter'

export type BodyEditAction =
  | 'polish'
  | 'shorten'
  | 'expand'
  | 'casual'
  | 'professional'
  | 'continue'
  | 'custom'

const ACTION_PROMPTS: Record<Exclude<BodyEditAction, 'custom'>, string> = {
  polish: '润色文字：更清晰、更有节奏，保留原意与事实，不要虚构新信息。',
  shorten: '精简篇幅：删掉冗余，保留核心观点与关键句，目标约为原文 60%。',
  expand: '扩写：补充例子、过渡与具体细节，仍贴合原文观点，不要跑题。',
  casual: '改成更口语、像真人说话的风格，保持真诚，避免营销腔。',
  professional: '改成更专业、克制的表达，结构更清楚，少用感叹与空话。',
  continue: '在原文末尾自然续写 1-3 段，语气与上文一致，不要重复已有内容。',
}

function stripCodeFences(text: string) {
  return text.replace(/^```(?:markdown|mdx|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
}

function parseContent(raw: string): string {
  const trimmed = raw.trim()
  try {
    const parsed = JSON.parse(trimmed) as { content?: string }
    if (parsed.content) return String(parsed.content).trim()
  } catch {
    // fall through
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]) as { content?: string }
      if (parsed.content) return String(parsed.content).trim()
    } catch {
      // fall through
    }
  }
  const plain = stripCodeFences(trimmed)
  if (plain && !plain.startsWith('{')) return plain
  return ''
}

export async function editPostBody(opts: {
  content: string
  title?: string
  action: BodyEditAction
  instruction?: string
  selection?: string
  locale?: 'zh-CN' | 'en'
}): Promise<{ content: string; mode: 'full' | 'selection' | 'append' }> {
  const content = opts.content.trim()
  if (!content && opts.action !== 'custom') {
    throw new Error('content is required')
  }
  if (content.length > 12000) {
    throw new Error('Body is too long. Shorten to about 12,000 characters before AI edit.')
  }

  const language = opts.locale === 'en' ? 'English' : 'Simplified Chinese'
  const selection = (opts.selection || '').trim()
  const custom = (opts.instruction || '').trim()
  const action = opts.action || 'polish'

  let task: string
  if (action === 'custom') {
    if (!custom) throw new Error('instruction is required')
    task = custom
  } else {
    task = ACTION_PROMPTS[action]
    if (custom) task = `${task}\nExtra: ${custom}`
  }

  const mode: 'full' | 'selection' | 'append' =
    action === 'continue'
      ? 'append'
      : selection && content.includes(selection)
        ? 'selection'
        : 'full'

  const system =
    mode === 'selection'
      ? `You are an editing assistant for a Markdown/MDX blog post body.
Edit ONLY the selected excerpt per the task.
Return ONLY JSON: {"content":"..."} as Markdown/MDX (headings, lists, bold/italic as needed).
Keep the same language as the excerpt (${language}).
Do NOT translate code blocks, URLs, file paths, or component names.
Do not wrap the answer in markdown code fences.`
      : mode === 'append'
        ? `You are an editing assistant for a Markdown/MDX blog post body.
Write a natural continuation in Markdown/MDX.
Return ONLY JSON: {"content":"..."} where content is ONLY the new continuation (not the original).
Keep the same language (${language}).
Do not wrap the answer in markdown code fences.`
        : `You are an editing assistant for a Markdown/MDX blog post body.
Revise the full draft per the task.
Return ONLY JSON: {"content":"..."} as Markdown/MDX.
Preserve useful structure (## headings, lists, quotes, links, mermaid/code fences) when present.
Keep the same language (${language}) unless asked otherwise.
Do NOT translate code blocks, URLs, file paths, or component names.
Do not wrap the answer in markdown code fences.`

  const userParts = [
    `Task: ${task}`,
    opts.title ? `Title: ${opts.title.trim()}` : '',
    mode === 'selection'
      ? `Selected excerpt to edit:\n"""\n${selection}\n"""\n\nFull document (context only, do not rewrite wholly):\n"""\n${content.slice(0, 6000)}\n"""`
      : `Document:\n"""\n${content}\n"""`,
  ].filter(Boolean)

  const raw = await openRouterChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n\n') },
    ],
    temperature: action === 'continue' ? 0.65 : 0.45,
    responseFormat: 'json_object',
  })

  const next = parseContent(raw)
  if (!next) {
    throw new Error(`AI edit failed: ${raw.slice(0, 160)}`)
  }

  return { content: next, mode }
}
