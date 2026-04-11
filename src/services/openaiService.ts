import { getApiBaseUrl } from '../utils/env'

const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('authToken')
  } catch {
    return null
  }
}

type AIContextMessage = { role: string, content: string }

type AIHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AIPageContext = {
  currentPath?: string
  currentPage?: string
  visibleNavigation?: Array<{
    name: string
    href: string
  }>
}

type TimerSyncMeta = {
  changed?: boolean
  action?: string
  source?: string
}

type StopTimerRequirementsRequest = {
  type: 'stop_timer_requirements'
  missingFields?: string[]
  runningTimer?: {
    id?: string
    clientId?: string
    projectId?: string
    description?: string
  } | null
}

export type AIResponseMeta = {
  timerSync?: TimerSyncMeta
  actionRequest?: StopTimerRequirementsRequest
}

export type AIResponsePayload = {
  reply: string
  meta?: AIResponseMeta
}

const emitTimeEntryChangedEvent = (action?: string): void => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent('timeEntry:changed', {
    detail: {
      source: 'ai',
      action: action || 'updated'
    }
  }))
}

const parseAIResponsePayload = (payload: any): AIResponsePayload => {
  const reply = payload?.reply
  const meta = payload?.meta && typeof payload.meta === 'object' ? payload.meta as AIResponseMeta : undefined

  if (!payload?.success || typeof reply !== 'string') {
    throw new Error('Invalid AI response from server.')
  }

  const timerSync = meta?.timerSync
  if (timerSync?.changed === true) {
    emitTimeEntryChangedEvent(typeof timerSync.action === 'string' ? timerSync.action : undefined)
  }

  return { reply, meta }
}

const normalizeHistory = (context: AIContextMessage[]): AIHistoryMessage[] => {
  return context
    .filter((msg): msg is AIHistoryMessage => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .slice(-10)
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const payload = await response.json().catch(() => null)
  return payload?.error || `HTTP error ${response.status}`
}

const requestAIReplyPayload = async (
  prompt: string,
  history: AIHistoryMessage[] = [],
  pageContext?: AIPageContext
): Promise<AIResponsePayload> => {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Session expired. Please log in again.')
  }

  const response = await fetch(`${getApiBaseUrl()}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, history, pageContext })
  })

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response)

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.')
    }

    if (response.status === 429) {
      throw new Error('Too many AI requests. Please wait a moment and try again.')
    }

    if (response.status === 503) {
      throw new Error('AI is not configured on the server.')
    }

    throw new Error(errorMessage)
  }

  const payload = await response.json().catch(() => ({}))
  return parseAIResponsePayload(payload)
}

const requestAIReply = async (prompt: string, history: AIHistoryMessage[] = [], pageContext?: AIPageContext): Promise<string> => {
  const payload = await requestAIReplyPayload(prompt, history, pageContext)
  return payload.reply
}

export const openaiService = {
  // Check if the service is properly configured
  isConfigured: (): boolean => {
    return true
  },

  // Generate a response from OpenAI
  async generateResponse(prompt: string, _systemMessage?: string, pageContext?: AIPageContext): Promise<string> {
    try {
      return await requestAIReply(prompt, [], pageContext)
    } catch (error: any) {
      console.error('Error calling AI endpoint:', error)
      throw new Error(error?.message || 'Failed to generate AI response.')
    }
  },

  // Generate a response with conversation history
  async generateResponseWithContext(
    prompt: string,
    context: Array<{role: string, content: string}>,
    pageContext?: AIPageContext
  ): Promise<string> {
    try {
      return await requestAIReply(prompt, normalizeHistory(context), pageContext)
    } catch (error: any) {
      console.error('Error calling AI endpoint:', error)
      throw new Error(error?.message || 'Failed to generate AI response.')
    }
  },

  async generateResponseWithContextDetailed(
    prompt: string,
    context: Array<{role: string, content: string}>,
    pageContext?: AIPageContext
  ): Promise<AIResponsePayload> {
    try {
      return await requestAIReplyPayload(prompt, normalizeHistory(context), pageContext)
    } catch (error: any) {
      console.error('Error calling AI endpoint:', error)
      throw new Error(error?.message || 'Failed to generate AI response.')
    }
  }
}
