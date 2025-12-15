import { database } from '../config/firebase'
import { ref, get, child, set, push, onValue, update } from 'firebase/database'
import { MentionNotification } from '../types'

export class MentionNotificationService {
  /**
   * Create a mention notification for a user
   * @param mentionedUserId - The ID of the user who was mentioned
   * @param mentionedByName - The name of the user who mentioned them
   * @param contextType - The type of context where the mention occurred
   * @param contextTitle - The title of the context (e.g., task title, message content)
   * @param contextId - The ID of the context
   * @param projectId - The project ID (optional)
   * @param taskId - The task ID (optional)
   */
  static async createMentionNotification(
    mentionedUserId: string,
    mentionedByName: string,
    contextType: 'comment' | 'note' | 'message' | 'task',
    contextTitle: string,
    contextId: string,
    projectId?: string,
    taskId?: string
  ): Promise<void> {
    console.log('=== createMentionNotification called ===');
    console.log('Parameters:', { mentionedUserId, mentionedByName, contextType, contextTitle, contextId, projectId, taskId });
    
    try {
      // Format the notification message based on context type
      let message = ''
      let contextDescription = ''
      let actionUrl = ''
      
      switch (contextType) {
        case 'comment':
          message = `${mentionedByName} mentioned you in a comment`
          contextDescription = 'a comment'
          actionUrl = taskId ? `/tasks/${taskId}` : '/tasks'
          break
        case 'note':
          message = `${mentionedByName} mentioned you in notes`
          contextDescription = 'notes'
          actionUrl = taskId ? `/tasks/${taskId}` : '/tasks'
          break
        case 'message':
          message = `${mentionedByName} mentioned you in a team message`
          contextDescription = 'a team message'
          actionUrl = '/messages'
          break
        case 'task':
          message = `${mentionedByName} mentioned you in a task`
          contextDescription = 'a task'
          actionUrl = taskId ? `/tasks/${taskId}` : '/tasks'
          break
        default:
          message = `${mentionedByName} mentioned you`
          contextDescription = 'a context'
          actionUrl = '/tasks'
      }
      
      // Create the notification object
      const notificationData: Omit<MentionNotification, 'id' | 'createdAt'> = {
        type: 'mention',
        title: 'You were mentioned',
        message: message,
        mentionedBy: mentionedByName,
        mentionedByName: mentionedByName,
        mentionedUserId: mentionedUserId,
        contextType: contextType,
        contextId: contextId,
        contextTitle: contextTitle,
        projectId: projectId,
        taskId: taskId,
        isRead: false,
        actionUrl: actionUrl
      }
      
      // Store the notification in Firebase under the mentioned user's notifications
      const notificationsRef = ref(database, `mentionNotifications/${mentionedUserId}`)
      const newNotificationRef = push(notificationsRef)
      
      // Filter out undefined values before storing in Firebase
      const filteredNotificationData = Object.fromEntries(
        Object.entries({
          ...notificationData,
          id: newNotificationRef.key,
          createdAt: new Date().toISOString()
        }).filter(([_, value]) => value !== undefined)
      );
      
      await set(newNotificationRef, filteredNotificationData);
      
      console.log('Notification data to be stored:', filteredNotificationData);
      
      console.log('Mention notification created for user:', mentionedUserId, notificationData)
      
    } catch (error) {
      console.error('Error creating mention notification:', error)
    }
  }
  
  /**
   * Get mention notifications for a user
   * @param userId - The ID of the user to get notifications for
   */
  static async getMentionNotifications(userId: string): Promise<MentionNotification[]> {
    try {
      const notificationsRef = ref(database, `mentionNotifications/${userId}`)
      const snapshot = await get(notificationsRef)
      
      if (snapshot.exists()) {
        const notifications = snapshot.val()
        return Object.values(notifications)
          .map((notification: any) => ({
            ...notification,
            createdAt: new Date(notification.createdAt)
          }))
          .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()) as MentionNotification[]
      }
      
      return []
    } catch (error) {
      console.error('Error getting mention notifications:', error)
      return []
    }
  }
  
  /**
   * Mark a mention notification as read
   * @param notificationId - The ID of the notification to mark as read
   * @param userId - The ID of the user who owns the notification
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = ref(database, `mentionNotifications/${userId}/${notificationId}`)
      await update(notificationRef, {
        isRead: true
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }
  
  /**
   * Mark all mention notifications as read for a user
   * @param userId - The ID of the user to mark all notifications as read for
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const notifications = await this.getMentionNotifications(userId)
      const updates: { [key: string]: any } = {}
      
      notifications.forEach(notification => {
        updates[`${notification.id}/isRead`] = true
      })
      
      if (Object.keys(updates).length > 0) {
        const notificationsRef = ref(database, `mentionNotifications/${userId}`)
        await update(notificationsRef, updates)
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }
  
  /**
   * Send a notification to a specific user
   * This is a helper method to send notifications to other users
   * @param userId - The ID of the user to send the notification to
   * @param notification - The notification to send
   */
  static async sendNotificationToUser(
    userId: string,
    notification: Omit<MentionNotification, 'id' | 'isRead' | 'createdAt' | 'mentionedUserId'>
  ): Promise<void> {
    try {
      // Create the full notification object
      const notificationWithDefaults = {
        ...notification,
        mentionedUserId: userId, // Add mentionedUserId for Firebase security rules
        id: '',
        isRead: false,
        createdAt: new Date()
      }
      
      // Store the notification in Firebase under the user's notifications
      const notificationsRef = ref(database, `mentionNotifications/${userId}`)
      const newNotificationRef = push(notificationsRef)
      
      // Filter out undefined values before storing in Firebase
      const filteredNotificationData = Object.fromEntries(
        Object.entries({
          ...notificationWithDefaults,
          id: newNotificationRef.key,
          createdAt: notificationWithDefaults.createdAt.toISOString()
        }).filter(([_, value]) => value !== undefined)
      );
      
      await set(newNotificationRef, filteredNotificationData);
      
      console.log('Notification sent to user:', userId)
      
    } catch (error) {
      console.error('Error sending notification to user:', error)
    }
  }
  
  /**
   * Subscribe to real-time notifications for a user
   * @param userId - The ID of the user to subscribe to notifications for
   * @param callback - The callback function to call when notifications change
   */
  static subscribeToNotifications(userId: string, callback: (notifications: MentionNotification[]) => void): () => void {
    console.log('=== subscribeToNotifications called ===');
    console.log('User ID:', userId);
    
    const notificationsRef = ref(database, `mentionNotifications/${userId}`)
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      console.log('=== Firebase onValue callback ===');
      console.log('Snapshot exists:', snapshot.exists());
      
      if (snapshot.exists()) {
        const notifications = snapshot.val()
        console.log('Raw notifications from Firebase:', notifications);
        
        const notificationList = Object.values(notifications)
          .map((notification: any) => ({
            ...notification,
            createdAt: new Date(notification.createdAt)
          }))
          .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()) as MentionNotification[]
          
        console.log('Converted notifications:', notificationList);
        callback(notificationList)
      } else {
        console.log('No notifications found');
        callback([])
      }
    })
    
    return unsubscribe
  }
}

export default MentionNotificationService