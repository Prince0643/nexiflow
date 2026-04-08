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

const normalizeHistory = (context: AIContextMessage[]): AIHistoryMessage[] => {
  return context
    .filter((msg): msg is AIHistoryMessage => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .slice(-10)
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const payload = await response.json().catch(() => null)
  return payload?.error || `HTTP error ${response.status}`
}

const requestAIReply = async (prompt: string, history: AIHistoryMessage[] = []): Promise<string> => {
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
    body: JSON.stringify({ prompt, history })
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
  const reply = payload?.reply

  if (!payload?.success || typeof reply !== 'string') {
    throw new Error('Invalid AI response from server.')
  }

  return reply
}

export const openaiService = {
  // Check if the service is properly configured
  isConfigured: (): boolean => {
    return true
  },

  // Generate a response from OpenAI
  async generateResponse(prompt: string, _systemMessage?: string): Promise<string> {
    try {
      return await requestAIReply(prompt)
    } catch (error: any) {
      console.error('Error calling AI endpoint:', error)
      throw new Error(error?.message || 'Failed to generate AI response.')
    }
  },

  // Generate a response with conversation history
  async generateResponseWithContext(prompt: string, context: Array<{role: string, content: string}>): Promise<string> {
    try {
      return await requestAIReply(prompt, normalizeHistory(context))
    } catch (error: any) {
      console.error('Error calling AI endpoint:', error)
      throw new Error(error?.message || 'Failed to generate AI response.')
    }
  }
}
