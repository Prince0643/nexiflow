import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, AlertCircle, Wallet } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { openaiService } from '../../services/openaiService'

// Custom Logo Component
const CustomLogo = ({ className }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center bg-white rounded-lg`}>
    <img 
      src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
      alt="NexiFlow Logo" 
      className="w-full h-full object-contain p-1"
    />
  </div>
)

interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [widgetHeight, setWidgetHeight] = useState<number>(400)
  const [isResizing, setIsResizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Position state - fixed at bottom right
  const [position] = useState(() => {
    // Initial position at bottom right
    return { x: window.innerWidth - 350, y: window.innerHeight - 450 };
  });
  // Visibility state
  const [isHidden, setIsHidden] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const { isDarkMode } = useTheme()

  // Check if OpenAI is configured
  useEffect(() => {
    if (!openaiService.isConfigured()) {
      setError('OpenAI is not configured. Please check your environment variables.')
    }
  }, [])

  // Load saved widget height from localStorage
  useEffect(() => {
    const savedHeight = localStorage.getItem('aiChatWidgetHeight')
    if (savedHeight) {
      setWidgetHeight(parseInt(savedHeight, 10))
    }
  }, [])

  // Save widget height to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('aiChatWidgetHeight', widgetHeight.toString())
  }, [widgetHeight])

  // Load saved visibility state from localStorage
  useEffect(() => {
    const savedHidden = localStorage.getItem('aiChatWidgetHidden')
    if (savedHidden) {
      setIsHidden(JSON.parse(savedHidden))
    }
  }, [])

  // Listen for changes to the visibility state from the Header component
  useEffect(() => {
    const handleVisibilityChange = (e: CustomEvent) => {
      setIsHidden(e.detail)
    }

    window.addEventListener('aiWidgetVisibilityChange', handleVisibilityChange as EventListener)
    return () => window.removeEventListener('aiWidgetVisibilityChange', handleVisibilityChange as EventListener)
  }, [])

  // Set initial position to bottom right corner when component mounts
  useEffect(() => {
    // Use a small delay to ensure the DOM is ready
    const timer = setTimeout(() => {
      const widgetWidth = widgetRef.current ? widgetRef.current.offsetWidth : 350;
      const widgetHeight = widgetRef.current ? widgetRef.current.offsetHeight : 400;
      
      // Position at bottom right with some margin
      const newPosition = {
        x: window.innerWidth - widgetWidth - 20,
        y: window.innerHeight - widgetHeight - 20
      };
      
      // We're not using this anymore since we removed drag functionality
      // But keeping it for consistency with existing code structure
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, 10)
    }
  }, [messages])

  // Handle mouse events for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newHeight = window.innerHeight - e.clientY - 24
      const minHeight = 200
      const maxHeight = window.innerHeight - 100
      
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setWidgetHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  const callOpenAI = async (prompt: string): Promise<string> => {
    try {
      setIsAIProcessing(true)
      setError(null)
      
      // Enhanced system message with NexiFlow specific information
      const systemMessage = `You are an AI assistant integrated into NexiFlow, a comprehensive time tracking and project management application. 
      
Key features of NexiFlow include:
1. Time Tracking - Start/stop timers, manual entries, project/task association, tags, billable hours
2. Dashboard & Analytics - Overview statistics, earnings tracking, productivity insights, recent activity
3. Project Management - Project organization, task management, client management, color coding
4. Reports & Export - Time reports, data export, filtering, visual charts
5. Team Collaboration - Teams, team details, messaging (separate feature)
6. Settings & Customization - User profile, time & billing, notifications, appearance

Common user questions and how to respond:
- For "how do I start the time?" or similar time tracking questions:
  1. Go to the Time Tracker page (click the clock icon in the sidebar)
  2. Click the "Start Timer" button for quick time tracking
  3. Or click "Add Time Entry" for manual time entry
  4. Select project, task, and add description
  5. Click "Start" to begin timing or set time manually
  
- For "how do I do this?" or vague questions:
  1. Ask for clarification about what specific feature or task they need help with
  2. Provide step-by-step instructions once you understand their goal
  3. Reference the appropriate section of NexiFlow
  
- For navigation questions:
  1. Refer to the sidebar menu items and their icons
  2. Provide the exact path to find features
  
When helping users:
- Provide specific, step-by-step guidance
- Use the exact names and terminology from NexiFlow
- Include references to UI elements like buttons, icons, and menu items
- If users ask vague questions, ask clarifying questions to understand their goal
- Keep responses concise but complete
- Focus on helping users accomplish their specific tasks

Keep responses focused on helping users be more productive with NexiFlow.`;

      // Call the OpenAI service
      const response = await openaiService.generateResponse(
        prompt,
        systemMessage
      )
      
      return response
    } catch (error: any) {
      console.error('Error calling OpenAI:', error)
      setError(error.message || 'Failed to get response from AI assistant.')
      return 'Sorry, I encountered an error processing your request.'
    } finally {
      setIsAIProcessing(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim() || isAIProcessing) return

    // Add user message to chat
    const userMessage: AIChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    try {
      // Call OpenAI
      const response = await callOpenAI(messageText)
      
      // Add AI response to chat
      const aiMessage: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Error processing message:', error)
    }
    
    setMessageText('')
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  // Check if the error is related to quota/billing
  const isQuotaError = error && error.includes('quota exceeded')

  // Don't render anything if the widget is hidden
  if (isHidden) {
    return null
  }

  return (
    <>
      {/* Widget Toggle Button - Fixed at bottom right */}
      <button
        ref={toggleButtonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors z-40 ${isDarkMode ? 'bg-white text-gray-800' : 'bg-white text-gray-800'}`}
        title="AI Assistant"
        style={{ 
          right: '20px', 
          bottom: '20px',
          cursor: 'pointer'
        }}
      >
        <div className="relative">
          <CustomLogo className="h-6 w-6" />
        </div>
      </button>

      {/* AI Chat Widget - Fixed at bottom right */}
      {isOpen && (
        <div 
          ref={widgetRef}
          className={`fixed w-80 sm:w-96 rounded-lg shadow-xl border flex flex-col z-50 max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-6rem)] ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          style={{ 
            right: '20px', 
            bottom: '20px',
            height: `${widgetHeight}px`
          }}
        >
          {/* Resize Handle */}
          <div
            ref={resizeRef}
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center"
            onMouseDown={handleStartResize}
          >
            <div className={`w-8 h-1 rounded-full opacity-0 hover:opacity-100 transition-opacity ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          </div>

          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-t-lg pt-3`}>
            <div className="flex-1">
              <h3 className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                NexiFlow AI Assistant
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {messages.length} messages
              </p>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={clearChat}
                className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
              >
                <X className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`p-3 border-b ${isDarkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start">
                <AlertCircle className={`h-4 w-4 mr-2 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-red-200' : 'text-red-600'}`} />
                <div>
                  <span className={`text-sm ${isDarkMode ? 'text-red-200' : 'text-red-600'}`}>
                    {error}
                  </span>
                  {isQuotaError && (
                    <div className="mt-2">
                      <a 
                        href="https://platform.openai.com/account/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`text-xs inline-flex items-center ${isDarkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
                      >
                        <Wallet className="h-3 w-3 mr-1" />
                        Check billing details
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-1 py-2 space-y-2 scrollbar-visible">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <CustomLogo className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <h4 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>NexiFlow AI Assistant</h4>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                    Ask me about NexiFlow features and productivity tips!
                  </p>
                  {!openaiService.isConfigured() && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-50 text-red-600'}`}>
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      OpenAI is not configured. Please check your environment variables.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full px-1`}
                  >
                    <div className={`flex ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[92%] w-auto`}>
                      <div 
                        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${message.role === 'user' ? 'ml-2' : 'mr-2'} self-start`}
                        style={{ backgroundColor: message.role === 'user' ? '#3B82F6' : '#10B981' }}
                      >
                        {message.role === 'user' ? 'You' : 'AI'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-baseline ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-1 mb-1`}>
                          <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {message.role === 'user' ? 'You' : 'AI Assistant'}
                          </h4>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="relative">
                          <div className={`${message.role === 'user' ? 'float-right clear-right' : 'float-left clear-left'}`}>
                            <p className={`text-sm whitespace-pre-wrap break-words p-3 rounded-2xl ${
                              message.role === 'user' 
                                ? 'bg-blue-500 text-white rounded-tr-none' 
                                : `${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'} rounded-tl-none`
                            }`}>
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Display AI Processing Indicator */}
                {isAIProcessing && (
                  <div className="group flex justify-start w-full px-1">
                    <div className="flex flex-row max-w-[92%] w-auto">
                      <div 
                        className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-2 self-start"
                        style={{ backgroundColor: '#10B981' }}
                      >
                        AI
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline flex-row space-x-1 mb-1">
                          <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>AI Assistant</h4>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Typing...
                          </span>
                        </div>
                        <div className="relative">
                          <div className="float-left clear-left">
                            <p className={`text-sm whitespace-pre-wrap break-words p-3 rounded-2xl ${
                              `${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'} rounded-tl-none`
                            }`}>
                              <div className="flex space-x-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                              </div>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className={`border-t p-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex space-x-2">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Ask about NexiFlow features..."
                className={`flex-grow resize-none border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:cursor-not-allowed ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100 disabled:bg-gray-800' : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100'}`}
                rows={2}
                disabled={isAIProcessing || !openaiService.isConfigured()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isAIProcessing || !openaiService.isConfigured()}
                className={`px-3 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-[36px] ${isDarkMode ? 'bg-gray-200 text-gray-800' : 'bg-gray-200 text-gray-800'}`}
              >
                {isAIProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {/* AI Instructions */}
            <div className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Ask about features, productivity tips, or navigation help
            </div>
          </form>
        </div>
      )}
    </>
  )
}