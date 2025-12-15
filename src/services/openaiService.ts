import OpenAI from 'openai'

// Check if API key is available
const apiKey = import.meta.env.VITE_OPENAI_API_KEY

if (!apiKey) {
  console.warn('OpenAI API key not found in environment variables. AI features will not work.')
}

// Initialize OpenAI client
// Note: In production, you should use a backend proxy for security
const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true
}) : null

export const openaiService = {
  // Check if the service is properly configured
  isConfigured: (): boolean => {
    return !!apiKey && !!openai
  },

  // Generate a response from OpenAI
  async generateResponse(prompt: string, systemMessage?: string): Promise<string> {
    // Check if the service is configured
    if (!openai) {
      throw new Error('OpenAI service is not configured. Please check your environment variables.')
    }

    try {
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = []
      
      if (systemMessage) {
        messages.push({ role: 'system', content: systemMessage })
      }
      
      messages.push({ role: 'user', content: prompt })

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })

      return response.choices[0]?.message?.content || 'No response generated'
    } catch (error: any) {
      console.error('Error calling OpenAI API:', error)
      
      // Handle specific error cases
      if (error.status === 429) {
        throw new Error('OpenAI quota exceeded. Please check your plan and billing details.')
      } else if (error.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your configuration.')
      } else if (error.status === 403) {
        throw new Error('Access denied to OpenAI API. Please check your account permissions.')
      } else if (error.status === 500) {
        throw new Error('OpenAI service is temporarily unavailable. Please try again later.')
      }
      
      throw new Error(`Failed to generate AI response: ${error.message}`)
    }
  },

  // Generate a response with conversation history
  async generateResponseWithContext(prompt: string, context: Array<{role: string, content: string}>): Promise<string> {
    // Check if the service is configured
    if (!openai) {
      throw new Error('OpenAI service is not configured. Please check your environment variables.')
    }

    try {
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        { role: 'system', content: 'You are a helpful assistant in a productivity application. Provide concise, helpful responses.' },
        ...context.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: prompt }
      ]

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })

      return response.choices[0]?.message?.content || 'No response generated'
    } catch (error: any) {
      console.error('Error calling OpenAI API:', error)
      
      // Handle specific error cases
      if (error.status === 429) {
        throw new Error('OpenAI quota exceeded. Please check your plan and billing details.')
      } else if (error.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your configuration.')
      } else if (error.status === 403) {
        throw new Error('Access denied to OpenAI API. Please check your account permissions.')
      } else if (error.status === 500) {
        throw new Error('OpenAI service is temporarily unavailable. Please try again later.')
      }
      
      throw new Error(`Failed to generate AI response: ${error.message}`)
    }
  }
}