import { MentionNotification } from '../types'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
const NOTIFICATION_POLL_INTERVAL_MS = 30000
const MAX_NOTIFICATION_BACKOFF_MS = 5 * 60 * 1000

const getAuthToken = () => localStorage.getItem('authToken')

const getRequestHeaders = () => {
  const token = getAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

const handleAuthFailure = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('currentUser')
  localStorage.removeItem('currentCompany')
  window.dispatchEvent(new CustomEvent('auth:expired'))
}

const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getRequestHeaders(),
      ...options.headers
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 401 || response.status === 403) {
      handleAuthFailure()
      throw new Error('Session expired. Please log in again.')
    }

    const error = new Error(errorData.error || `HTTP error! status: ${response.status}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return response.json()
}

export class MentionNotificationService {
  static async createMentionNotification(
    mentionedUserId: string,
    mentionedByName: string,
    contextType: 'comment' | 'note' | 'message' | 'task',
    contextTitle: string,
    contextId: string,
    projectId?: string,
    taskId?: string
  ): Promise<void> {
    await this.sendNotificationToUser(mentionedUserId, {
      type: 'mention',
      title: 'You were mentioned',
      message: `${mentionedByName} mentioned you in ${contextType === 'note' ? 'notes' : `a ${contextType}`}`,
      mentionedBy: mentionedByName,
      mentionedByName,
      contextType,
      contextId,
      contextTitle,
      projectId,
      taskId,
      actionUrl: taskId ? `/management?taskId=${taskId}&tab=${contextType === 'comment' ? 'comments' : 'notes'}` : '/management'
    })
  }

  static async getMentionNotifications(userId: string): Promise<MentionNotification[]> {
    const response = await apiRequest<{
      success: boolean
      data: Array<Omit<MentionNotification, 'createdAt'> & { createdAt: string }>
    }>('/mention-notifications')

    if (!response.success) {
      return []
    }

    return response.data
      .filter((notification) => notification.mentionedUserId === userId)
      .map((notification) => ({
        ...notification,
        createdAt: new Date(notification.createdAt)
      }))
  }

  static async markAsRead(notificationId: string, _userId: string): Promise<void> {
    await apiRequest(`/mention-notifications/${notificationId}/read`, {
      method: 'PUT'
    })
  }

  static async markAllAsRead(_userId: string): Promise<void> {
    await apiRequest('/mention-notifications/read-all', {
      method: 'PUT'
    })
  }

  static async sendNotificationToUser(
    userId: string,
    notification: Omit<MentionNotification, 'id' | 'isRead' | 'createdAt' | 'mentionedUserId'>
  ): Promise<void> {
    await apiRequest('/mention-notifications', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        ...notification
      })
    })
  }

  static async refreshNotifications(userId: string): Promise<MentionNotification[]> {
    return this.getMentionNotifications(userId)
  }

  static subscribeToNotifications(userId: string, callback: (notifications: MentionNotification[]) => void): () => void {
    let isActive = true
    let isRequestInFlight = false
    let timeoutId: number | null = null
    let currentDelayMs = NOTIFICATION_POLL_INTERVAL_MS

    const clearScheduledPoll = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const scheduleNextPoll = (delayMs: number) => {
      clearScheduledPoll()
      if (!isActive) {
        return
      }

      timeoutId = window.setTimeout(() => {
        void loadNotifications()
      }, delayMs)
    }

    const loadNotifications = async () => {
      if (!isActive || isRequestInFlight || document.visibilityState !== 'visible' || !navigator.onLine) {
        scheduleNextPoll(currentDelayMs)
        return
      }

      isRequestInFlight = true

      try {
        const notifications = await this.refreshNotifications(userId)
        if (isActive) {
          callback(notifications)
        }
        currentDelayMs = NOTIFICATION_POLL_INTERVAL_MS
      } catch (error) {
        console.error('Error loading mention notifications:', error)
        if ((error as { status?: number })?.status !== 429 && isActive) {
          callback([])
        }
        currentDelayMs = Math.min(currentDelayMs * 2, MAX_NOTIFICATION_BACKOFF_MS)
      } finally {
        isRequestInFlight = false
        scheduleNextPoll(currentDelayMs)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        currentDelayMs = NOTIFICATION_POLL_INTERVAL_MS
        void loadNotifications()
        return
      }

      clearScheduledPoll()
    }

    const handleOnline = () => {
      currentDelayMs = NOTIFICATION_POLL_INTERVAL_MS
      void loadNotifications()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    void loadNotifications()

    return () => {
      isActive = false
      clearScheduledPoll()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }
}

export default MentionNotificationService
