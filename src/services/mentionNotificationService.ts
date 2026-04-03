import { MentionNotification } from '../types'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

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

    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

const NOTIFICATION_POLL_INTERVAL_MS = 3000

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

    const loadNotifications = async () => {
      try {
        const notifications = await this.refreshNotifications(userId)
        if (isActive) {
          callback(notifications)
        }
      } catch (error) {
        console.error('Error loading mention notifications:', error)
        if (isActive) {
          callback([])
        }
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, NOTIFICATION_POLL_INTERVAL_MS)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }
}

export default MentionNotificationService
