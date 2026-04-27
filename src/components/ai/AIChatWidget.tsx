import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Send, AlertCircle, Wallet } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { openaiService } from '../../services/openaiService'
import { projectApiService } from '../../services/projectApiService'
import { timeEntryApiService } from '../../services/timeEntryApiService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { Client, Project } from '../../types'
import { canAccessFeature } from '../../utils/permissions'

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

type AIResponseResult = {
  reply: string
  actionRequest?: StopTimerRequirementsRequest
  shouldDelay: boolean
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

interface PendingStopFormState {
  request: StopTimerRequirementsRequest
  clientId: string
  projectId: string
  description: string
  summary: string
}

const AI_EXAMPLE_PROMPTS = [
  'Start my timer',
  'Where is the calendar?',
  'How do I create a project?'
]

const AI_REPLY_DELAY_MS = 2000

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [widgetHeight, setWidgetHeight] = useState<number>(400)
  const [isTeaserDismissed, setIsTeaserDismissed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Position state - fixed at bottom right
  const [position, setPosition] = useState({ x: 0, y: 0 })
  // Visibility state
  const [isHidden, setIsHidden] = useState(false)
  const [pendingStopForm, setPendingStopForm] = useState<PendingStopFormState | null>(null)
  const [stopFormClients, setStopFormClients] = useState<Client[]>([])
  const [stopFormProjects, setStopFormProjects] = useState<Project[]>([])
  const [isStopFormSubmitting, setIsStopFormSubmitting] = useState(false)
  const [stopFormError, setStopFormError] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { currentUser, currentCompany } = useMySQLAuth()
  const { isDarkMode } = useTheme()
  const location = useLocation()

  // NOTE: Do not early-return before all hooks run; plan changes (solo -> office) would break hook order.
  const shouldHideForPlan =
    currentUser?.role !== 'root' && (!currentCompany || currentCompany.pricingLevel === 'solo')

  const stopFormFilteredProjects = useMemo(() => {
    if (!pendingStopForm?.clientId) return stopFormProjects
    return stopFormProjects.filter((project) => project.clientId === pendingStopForm.clientId)
  }, [pendingStopForm?.clientId, stopFormProjects])

  const appendAssistantMessage = (content: string) => {
    const aiMessage: AIChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content,
      timestamp: new Date()
    }
    setMessages((prev) => [...prev, aiMessage])
  }

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const focusInputSoon = () => {
    window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  const handleExamplePromptClick = (prompt: string) => {
    setIsOpen(true)
    setMessageText(prompt)
    focusInputSoon()
  }

  const getCurrentPageLabel = (pathname: string) => {
    if (pathname === '/' || pathname === '/root') return 'Dashboard'
    if (pathname.startsWith('/tracker')) return 'Time Tracker'
    if (pathname.startsWith('/calendar')) return 'Calendar'
    if (pathname.startsWith('/projects')) return 'Projects'
    if (pathname === '/clients') return 'Clients'
    if (pathname.startsWith('/clients/edit/')) return 'Edit Client'
    if (pathname.startsWith('/clients/')) return 'Client Details'
    if (pathname.startsWith('/reports')) return 'Reports'
    if (pathname.startsWith('/management')) return 'Project Management'
    if (pathname === '/teams') return 'Teams'
    if (pathname.startsWith('/teams/')) return 'Team Details'
    if (pathname.startsWith('/admin')) return 'Admin Dashboard'
    if (pathname.startsWith('/settings')) return 'Settings'
    if (pathname.startsWith('/pdf-settings')) return 'PDF Settings'
    if (pathname.startsWith('/chat')) return 'Team Chat'
    if (pathname === '/invoicing') return 'Invoicing'
    if (pathname.startsWith('/invoicing/new')) return 'New Invoice'
    if (pathname.startsWith('/upgrade')) return 'Upgrade'
    if (pathname.startsWith('/system')) return 'System Settings'
    return 'NexiFlow'
  }

  const getVisibleNavigationItems = () => {
    if (currentUser?.role === 'root') {
      return [
        { name: 'Root Dashboard', href: '/root' },
        { name: 'System Settings', href: '/system' }
      ]
    }

    let items = [
      { name: 'Dashboard', href: '/', requiredFeature: null },
      { name: 'Time Tracker', href: '/tracker', requiredFeature: null },
      { name: 'Calendar', href: '/calendar', requiredFeature: null },
      { name: 'Projects', href: '/projects', requiredFeature: 'projects' },
      { name: 'Clients', href: '/clients', requiredFeature: 'clients' },
      { name: 'Task Management', href: '/management', requiredFeature: null },
      { name: 'Teams', href: '/teams', requiredFeature: 'teams' },
      { name: 'Reports', href: '/reports', requiredFeature: null },
      { name: 'Invoicing', href: '/invoicing', requiredFeature: null },
      { name: 'Admin Dashboard', href: '/admin', requiredFeature: 'admin-dashboard' },
      { name: 'Settings', href: '/settings', requiredFeature: null }
    ]

    if (currentCompany?.pricingLevel === 'solo') {
      items = items.filter((item) => !['Task Management', 'Teams', 'Reports', 'Invoicing'].includes(item.name))
      items.push({ name: 'Upgrade', href: '/upgrade', requiredFeature: null })
    }

    return items
      .filter((item) => !item.requiredFeature || (currentUser?.role && canAccessFeature(currentUser.role, item.requiredFeature)))
      .map(({ name, href }) => ({ name, href }))
  }

  const buildStopRequirementSummary = (request: StopTimerRequirementsRequest) => {
    const missingFields = Array.isArray(request.missingFields)
      ? request.missingFields.filter((field): field is string => typeof field === 'string' && field.trim().length > 0)
      : []

    if (!missingFields.length) {
      return 'I found your running timer, but it cannot be stopped yet because required details are missing.'
    }

    return `I found your running timer, but it cannot be stopped yet because these required fields are missing: ${missingFields.join(', ')}.`
  }

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
      setPosition({
        x: window.innerWidth - widgetWidth - 20,
        y: window.innerHeight - widgetHeight - 20
      });
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

  const loadStopFormOptions = async () => {
    if (!currentUser) {
      throw new Error('Session expired. Please log in again.')
    }

    const [clients, projects] = await Promise.all([
      currentUser.companyId
        ? projectApiService.getClientsForCompany(currentUser.companyId)
        : projectApiService.getClients(),
      currentUser.companyId
        ? projectApiService.getProjectsForCompany(currentUser.companyId)
        : projectApiService.getProjects()
    ])

    setStopFormClients(clients)
    setStopFormProjects(projects)
    return { clients, projects }
  }

  const hydrateStopRequirementsForm = async (request: StopTimerRequirementsRequest) => {
    setStopFormError(null)
    const { clients, projects } = await loadStopFormOptions()

    if (!clients.length) {
      setPendingStopForm(null)
      appendAssistantMessage('You do not have any clients yet. Please create a client first, then I can help stop the timer with required details.')
      return
    }

    if (!projects.length) {
      setPendingStopForm(null)
      appendAssistantMessage('You do not have any projects yet. Please create a project and assign it to a client, then I can stop the timer.')
      return
    }

    const prefilledClientId = request.runningTimer?.clientId || ''
    const prefilledProjectId = request.runningTimer?.projectId || ''
    const prefilledDescription = request.runningTimer?.description || ''
    const selectedProject = projects.find((project) => project.id === prefilledProjectId)
    const resolvedClientId = prefilledClientId || selectedProject?.clientId || clients[0]?.id || ''
    const selectedClientExists = !resolvedClientId || clients.some((client) => client.id === resolvedClientId)
    const selectedProjectExists = !prefilledProjectId || projects.some((project) => project.id === prefilledProjectId)
    const projectsForSelectedClient = projects.filter((project) => project.clientId === resolvedClientId)
    const defaultProjectId = selectedProjectExists
      ? prefilledProjectId
      : (projectsForSelectedClient[0]?.id || '')

    setPendingStopForm({
      request,
      clientId: selectedClientExists ? resolvedClientId : '',
      projectId: defaultProjectId,
      description: prefilledDescription,
      summary: buildStopRequirementSummary(request)
    })
  }

  const callOpenAI = async (
    prompt: string,
    contextMessages: AIChatMessage[] = []
  ): Promise<AIResponseResult> => {
    try {
      setIsAIProcessing(true)
      setError(null)

      // Call the OpenAI service
      const context = contextMessages.map((message) => ({
        role: message.role,
        content: message.content
      }))
      const response = await openaiService.generateResponseWithContextDetailed(prompt, context, {
        currentPath: location.pathname,
        currentPage: getCurrentPageLabel(location.pathname),
        visibleNavigation: getVisibleNavigationItems()
      })
      const actionRequest = response.meta?.actionRequest
      const normalizedActionRequest = actionRequest?.type === 'stop_timer_requirements'
        ? actionRequest as StopTimerRequirementsRequest
        : undefined
      const timerAction = response.meta?.timerSync?.action
      const isAutomatedTimerReply = timerAction === 'started' || timerAction === 'stopped'
      const shouldDelay = isAutomatedTimerReply

      if (shouldDelay) {
        await sleep(AI_REPLY_DELAY_MS)
      }

      return { reply: response.reply, actionRequest: normalizedActionRequest, shouldDelay }
    } catch (error: any) {
      console.error('Error calling OpenAI:', error)
      setError(error.message || 'Failed to get response from Nexie.')
      return { reply: 'Sorry, I encountered an error processing your request.', shouldDelay: false }
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
      const response = await callOpenAI(messageText, messages)

      if (response.actionRequest?.type === 'stop_timer_requirements') {
        await hydrateStopRequirementsForm(response.actionRequest)
        setMessages((prev) => {
          if (pendingStopForm) {
            return prev
          }

          const aiMessage: AIChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.reply,
            timestamp: new Date()
          }

          return [...prev, aiMessage]
        })
      } else {
        // Add AI response to chat
        const aiMessage: AIChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.reply,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, aiMessage])
      }
    } catch (error) {
      console.error('Error processing message:', error)
    }
    
    setMessageText('')
  }

  const updatePendingStopForm = (updates: Partial<Omit<PendingStopFormState, 'request'>>) => {
    setPendingStopForm((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  const handleStopFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !pendingStopForm || isStopFormSubmitting) return

    setStopFormError(null)

    if (!pendingStopForm.clientId || !pendingStopForm.projectId || !pendingStopForm.description.trim()) {
      setStopFormError('Client, project, and description are required to stop the timer.')
      return
    }

    setIsStopFormSubmitting(true)

    try {
      const runningEntry = await timeEntryApiService.getRunningTimeEntry(currentUser.uid)
      if (!runningEntry?.id) {
        throw new Error('No running timer found. Please start a timer first.')
      }

      const selectedProject = stopFormProjects.find((project) => project.id === pendingStopForm.projectId)
      const selectedClient = stopFormClients.find((client) => client.id === pendingStopForm.clientId)

      await timeEntryApiService.updateTimeEntry(runningEntry.id, {
        projectId: pendingStopForm.projectId,
        projectName: selectedProject?.name,
        clientId: pendingStopForm.clientId,
        clientName: selectedClient?.name,
        description: pendingStopForm.description.trim()
      })

      await timeEntryApiService.stopTimeEntry(runningEntry.id)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('timeEntry:changed', {
          detail: {
            source: 'ai',
            action: 'stopped'
          }
        }))
      }

      setPendingStopForm(null)
      appendAssistantMessage('Timer stopped successfully.')
    } catch (error: any) {
      const message = error?.message || 'Failed to stop timer from the form.'
      setStopFormError(message)
      appendAssistantMessage(`I could not stop the timer: ${message}`)
    } finally {
      setIsStopFormSubmitting(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
    setPendingStopForm(null)
    setStopFormClients([])
    setStopFormProjects([])
    setStopFormError(null)
  }

  // Check if the error is related to quota/billing
  const isQuotaError = error && error.includes('quota exceeded')

  // Don't render anything if the widget is hidden
  if (isHidden) {
    return null
  }

  // Hide AI chat for Solo plan companies (and when company context is missing).
  // Root users are exempt (no company context, but need access for admin/testing).
  if (shouldHideForPlan) {
    return null
  }

  return (
    <>
      {/* Widget Toggle Button - Fixed at bottom right */}
      <div
        className="fixed z-40 flex items-end gap-3"
        style={{
          right: '20px',
          bottom: '20px'
        }}
      >
        {!isOpen && !isTeaserDismissed && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true)
              focusInputSoon()
            }}
            className={`relative hidden sm:flex max-w-[220px] flex-col rounded-2xl border px-4 py-3 text-left shadow-lg transition-transform hover:-translate-y-0.5 ${
              isDarkMode
                ? 'border-gray-700 bg-gray-800 text-gray-100'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            <button
              type="button"
              aria-label="Dismiss help"
              onClick={(e) => {
                e.stopPropagation()
                setIsTeaserDismissed(true)
              }}
              className={`absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full transition-colors sm:flex ${
                isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">Need help?</span>
            <span className={`mt-1 text-xs leading-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Ask AI to start your timer, find a page, or explain a workflow.
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {AI_EXAMPLE_PROMPTS.slice(0, 2).map((prompt) => (
                <span
                  key={prompt}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExamplePromptClick(prompt)
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {prompt}
                </span>
              ))}
            </div>
          </button>
        )}

        <button
          ref={toggleButtonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors ${isDarkMode ? 'bg-white text-gray-800' : 'bg-white text-gray-800'}`}
          title="Nexie"
          style={{
            cursor: 'pointer'
          }}
        >
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          )}
          <div className="relative">
            <CustomLogo className="h-6 w-6" />
          </div>
        </button>
      </div>

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
                Nexie
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
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-2 scrollbar-visible">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-6 text-center">
                <div className="w-full max-w-[280px]">
                  <CustomLogo className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <h4 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Nexie</h4>
                  <p className={`mx-auto max-w-[260px] leading-7 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Ask AI to start or stop your timer, find a page, or show you how something works.
                  </p>
                  <div className="mt-5 space-y-2.5 text-left">
                    {AI_EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleExamplePromptClick(prompt)}
                        className={`block w-full rounded-xl px-3.5 py-2.5 text-left text-xs transition-colors ${
                          isDarkMode
                            ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {`Try: "${prompt}"`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full px-1`}
                  >
                    <div className={`flex max-w-[92%] w-auto ${message.role === 'user' ? 'justify-end' : 'items-start'}`}>
                      {message.role === 'assistant' && (
                        <CustomLogo className="mr-2 h-8 w-8 flex-shrink-0 self-start" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`mb-1 flex items-baseline gap-1.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {message.role === 'user' ? 'You' : 'Nexie'}
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

                {pendingStopForm && (
                  <div className="group flex justify-start w-full px-1">
                    <div className="flex flex-row max-w-[92%] w-auto">
                      <CustomLogo className="mr-2 h-8 w-8 flex-shrink-0 self-start" />
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-baseline gap-1.5">
                          <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Nexie</h4>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Action Required
                          </span>
                        </div>
                        <div className={`p-3 rounded-2xl rounded-tl-none ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
                          <p className="text-sm mb-3">
                            {pendingStopForm.summary}
                          </p>

                          {pendingStopForm.request.missingFields && pendingStopForm.request.missingFields.length > 0 && (
                            <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              Missing: {pendingStopForm.request.missingFields.join(', ')}
                            </p>
                          )}

                          <form onSubmit={handleStopFormSubmit} className="space-y-2">
                            <select
                              value={pendingStopForm.clientId}
                              onChange={(e) => {
                                const nextClientId = e.target.value
                                const currentProject = stopFormProjects.find((project) => project.id === pendingStopForm.projectId)
                                updatePendingStopForm({
                                  clientId: nextClientId,
                                  projectId: currentProject?.clientId === nextClientId ? pendingStopForm.projectId : ''
                                })
                              }}
                              className={`w-full border rounded px-2 py-2 text-sm ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              required
                            >
                              <option value="">Select client</option>
                              {stopFormClients.map((client) => (
                                <option key={client.id} value={client.id}>
                                  {client.name}
                                </option>
                              ))}
                            </select>

                            <select
                              value={pendingStopForm.projectId}
                              onChange={(e) => updatePendingStopForm({ projectId: e.target.value })}
                              className={`w-full border rounded px-2 py-2 text-sm ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              required
                            >
                              <option value="">Select project</option>
                              {stopFormFilteredProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>

                            <textarea
                              value={pendingStopForm.description}
                              onChange={(e) => updatePendingStopForm({ description: e.target.value })}
                              placeholder="Enter description"
                              className={`w-full border rounded px-2 py-2 text-sm resize-none ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              rows={2}
                              required
                            />

                            {stopFormError && (
                              <p className={`text-xs ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                                {stopFormError}
                              </p>
                            )}

                            <button
                              type="submit"
                              disabled={isStopFormSubmitting}
                              className="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {isStopFormSubmitting ? 'Stopping timer...' : 'Save and stop timer'}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Display AI Processing Indicator */}
                {isAIProcessing && (
                  <div className="group flex justify-start w-full px-1">
                    <div className="flex flex-row max-w-[92%] w-auto">
                      <CustomLogo className="mr-2 h-8 w-8 flex-shrink-0 self-start" />
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-baseline gap-1.5">
                          <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Nexie</h4>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Typing...
                          </span>
                        </div>
                        <div className="relative">
                          <div className="float-left clear-left">
                            <div className={`text-sm whitespace-pre-wrap break-words p-3 rounded-2xl ${
                              `${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'} rounded-tl-none`
                            }`}>
                              <div className="flex space-x-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                              </div>
                            </div>
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
          <form onSubmit={handleSendMessage} className={`border-t px-4 py-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex space-x-2">
              <textarea
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Ask AI to start a timer or show you how to do something..."
                className={`flex-grow resize-none border rounded-xl px-3.5 py-2.5 text-sm leading-6 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:cursor-not-allowed ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100 disabled:bg-gray-800' : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100'}`}
                rows={2}
                disabled={isAIProcessing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isAIProcessing}
                className={`px-3 py-2 rounded-xl hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-[38px] self-center ${isDarkMode ? 'bg-gray-200 text-gray-800' : 'bg-gray-200 text-gray-800'}`}
              >
                {isAIProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {/* AI Instructions */}
            <div className={`text-xs mt-2 px-1 leading-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Try: "Start my timer", "Where is Reports?", or "How do I create a client?"
            </div>
          </form>
        </div>
      )}
    </>
  )
}
