import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { useMySQLAuth } from './MySQLAuthContext'
import { playMentionSound } from '../utils/soundUtils'
import { soundManager } from '../utils/soundManager'
import MentionNotificationService from '../services/mentionNotificationService'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'mention'
  timestamp: Date
  isRead: boolean
  actionUrl?: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  refreshNotifications: () => Promise<void>
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
  playTestMentionSound: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { currentUser } = useMySQLAuth()
  
  // Debounce timer for sound notifications
  const soundDebounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Ref to track previous notifications for comparison
  const previousNotificationsRef = useRef<Notification[]>([]);

  const applyNotifications = (mentionNotifications: Awaited<ReturnType<typeof MentionNotificationService.getMentionNotifications>>) => {
    const convertedNotifications = mentionNotifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      timestamp: notification.createdAt,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl
    }))

    const previousNotificationIds = new Set(previousNotificationsRef.current.map(n => n.id))
    const newMentionNotifications = mentionNotifications.filter(
      notification => !previousNotificationIds.has(notification.id) && notification.type === 'mention'
    )

    if (newMentionNotifications.length > 0 && soundManager.isSoundEnabled()) {
      setTimeout(() => {
        playMentionSound()
      }, 100)
    }

    setNotifications(convertedNotifications)
    previousNotificationsRef.current = convertedNotifications
  }

  const refreshNotifications = async () => {
    if (!currentUser) return

    try {
      const mentionNotifications = await MentionNotificationService.refreshNotifications(currentUser.uid)
      applyNotifications(mentionNotifications)
    } catch (error) {
      console.error('Error refreshing notifications:', error)
    }
  }

  // Load notifications from the API when user changes
  useEffect(() => {
    if (!currentUser) {
      setNotifications([])
      previousNotificationsRef.current = [];
      return
    }

    // Load any cached notifications first (offline / Firebase-disabled fallback)
    try {
      const cached = localStorage.getItem(`notifications_${currentUser.uid}`)
      if (cached) {
        const parsed = JSON.parse(cached) as any[]
        const hydrated = parsed.map((n: any) => ({
          ...n,
          timestamp: n.timestamp ? new Date(n.timestamp) : new Date()
        })) as Notification[]
        setNotifications(hydrated)
        previousNotificationsRef.current = hydrated
      }
    } catch (e) {
      console.warn('Failed to load cached notifications:', e)
    }

    const unsubscribe = MentionNotificationService.subscribeToNotifications(
      currentUser.uid,
      applyNotifications
    )

    return () => {
      unsubscribe()
    }
  }, [currentUser])

  // Save notifications to localStorage for offline access
  useEffect(() => {
    if (currentUser && notifications.length > 0) {
      localStorage.setItem(`notifications_${currentUser.uid}`, JSON.stringify(notifications))
    }
  }, [notifications, currentUser])

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
    console.log('=== addNotification called ===');
    console.log('Notification:', notification);
    
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      isRead: false
    }

    console.log('New notification:', newNotification);
    setNotifications(prev => [newNotification, ...prev])

    // Only play sounds for mention notifications, not for all notifications
    if (notification.type === 'mention' && soundManager.isSoundEnabled()) {
      console.log('Adding mention sound notification');
      // Play appropriate sound for notifications based on type
      // But debounce to prevent too many sounds
      // Clear any existing timer for this user
      const existingTimer = soundDebounceTimers.current.get(newNotification.id || 'system');
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer
      const timer = setTimeout(() => {
        console.log('Playing mention sound from addNotification');
        playMentionSound();
        soundDebounceTimers.current.delete(newNotification.id || 'system');
      }, 300); // Shorter debounce for mentions
      
      soundDebounceTimers.current.set(newNotification.id || 'system', timer);
    }

    // Auto-remove after 5 seconds for info notifications
    if (notification.type === 'info') {
      setTimeout(() => {
        removeNotification(newNotification.id)
      }, 5000)
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, isRead: true }
          : notification
      )
    )
    
    // Persist read state for mention notifications
    if (currentUser) {
      const notification = notifications.find(n => n.id === id)
      if (notification && notification.type === 'mention') {
        MentionNotificationService.markAsRead(id, currentUser.uid)
      }
    }
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    )
    
    // Persist read state for mention notifications
    if (currentUser) {
      MentionNotificationService.markAllAsRead(currentUser.uid)
    }
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
    if (currentUser) {
      localStorage.removeItem(`notifications_${currentUser.uid}`)
    }
  }

  // Test function to play mention sound
  const playTestMentionSound = () => {
    console.log('Playing test mention sound');
    playMentionSound();
  }

  // Add welcome notifications for major features
  const addWelcomeNotifications = () => {
    if (!currentUser) return

    // Check if user has already seen these notifications
    const hasSeenWelcome = localStorage.getItem(`welcome_notifications_${currentUser.uid}`)
    if (hasSeenWelcome) return

    // Add major feature announcements
    const welcomeNotifications = [
      {
        title: '🎉 Welcome to Clockistry!',
        message: 'Discover our new calendar system, API integration, and comprehensive user documentation. Click to explore!',
        type: 'success' as const,
        actionUrl: '/about'
      },
      {
        title: '📅 New Calendar Feature',
        message: 'Track your time entries visually with our new calendar system. Switch between month, week, and day views!',
        type: 'info' as const,
        actionUrl: '/calendar'
      },
      {
        title: '🔧 API Now Available',
        message: 'Full REST API is now live with Express.js and Firebase Functions. Perfect for integrations!',
        type: 'info' as const,
        actionUrl: '/about'
      }
    ]

    // Add each notification with a delay to create a staggered effect
    welcomeNotifications.forEach((notification, index) => {
      setTimeout(() => {
        addNotification(notification)
      }, index * 1000)
    })

    // Mark as seen
    localStorage.setItem(`welcome_notifications_${currentUser.uid}`, 'true')
  }

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    removeNotification,
    clearAllNotifications,
    playTestMentionSound
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
