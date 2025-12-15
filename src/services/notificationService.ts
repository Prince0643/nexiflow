import { TimeEntry } from '../types'

export interface TimerNotificationData {
  entryId: string
  projectName: string
  description: string
  startTime: Date
  isBillable: boolean
}

class NotificationService {
  private notification: Notification | null = null
  private isSupported: boolean = false
  private permission: NotificationPermission = 'default'

  constructor() {
    this.isSupported = 'Notification' in window
    this.permission = this.isSupported ? Notification.permission : 'denied'
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Notifications are not supported in this browser')
      return false
    }

    if (this.permission === 'granted') {
      return true
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  async showTimerNotification(data: TimerNotificationData): Promise<void> {
    if (!this.isSupported || this.permission !== 'granted') {
      return
    }

    // Close existing notification
    this.closeNotification()

    try {
      this.notification = new Notification('NexiFlow - Timer Running', {
        body: `${data.projectName}: ${data.description}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'timer-widget',
        requireInteraction: true,
        silent: false,
        data: {
          entryId: data.entryId,
          projectName: data.projectName,
          description: data.description,
          startTime: data.startTime.toISOString(),
          isBillable: data.isBillable
        }
      })

      // Handle notification click
      this.notification.onclick = () => {
        window.focus()
        this.closeNotification()
      }

      // Handle notification close
      this.notification.onclose = () => {
        this.notification = null
      }

    } catch (error) {
      console.error('Error showing timer notification:', error)
    }
  }

  updateTimerNotification(elapsedTime: number, data: TimerNotificationData): void {
    if (!this.notification || this.permission !== 'granted') {
      return
    }

    const hours = Math.floor(elapsedTime / 3600)
    const minutes = Math.floor((elapsedTime % 3600) / 60)
    const seconds = Math.floor(elapsedTime % 60)
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

    try {
      // Close existing notification and create a new one with updated time
      this.closeNotification()
      this.showTimerNotification({
        ...data,
        description: `${data.description} - ${timeString}`
      })
    } catch (error) {
      console.error('Error updating notification:', error)
    }
  }

  closeNotification(): void {
    if (this.notification) {
      this.notification.close()
      this.notification = null
    }
  }

  isPermissionGranted(): boolean {
    return this.permission === 'granted'
  }

  isNotificationSupported(): boolean {
    return this.isSupported
  }
}

export const notificationService = new NotificationService()