// Mock Firebase
jest.mock('../config/firebase', () => ({
  database: {}
}))

// Mock Firebase database functions
jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  get: jest.fn(),
  child: jest.fn(),
  set: jest.fn(),
  push: jest.fn(() => ({ key: 'test-key' })),
  onValue: jest.fn(),
  update: jest.fn()
}))

import MentionNotificationService from './mentionNotificationService'

describe('MentionNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(MentionNotificationService).toBeDefined()
  })

  it('should have createMentionNotification method', () => {
    expect(typeof MentionNotificationService.createMentionNotification).toBe('function')
  })

  it('should have getMentionNotifications method', () => {
    expect(typeof MentionNotificationService.getMentionNotifications).toBe('function')
  })

  it('should have markAsRead method', () => {
    expect(typeof MentionNotificationService.markAsRead).toBe('function')
  })

  it('should have markAllAsRead method', () => {
    expect(typeof MentionNotificationService.markAllAsRead).toBe('function')
  })

  it('should have sendNotificationToUser method', () => {
    expect(typeof MentionNotificationService.sendNotificationToUser).toBe('function')
  })

  it('should have subscribeToNotifications method', () => {
    expect(typeof MentionNotificationService.subscribeToNotifications).toBe('function')
  })

  it('should create mention notification with correct context type for comments', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    await MentionNotificationService.createMentionNotification(
      'user123',
      'John Doe',
      'comment',
      'Test Task',
      'task456',
      'project789',
      'task456'
    )
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Mention notification created for user:',
      'user123',
      expect.objectContaining({
        message: 'John Doe mentioned you in a comment'
      })
    )
    
    consoleSpy.mockRestore()
  })

  it('should create mention notification with correct context type for notes', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    await MentionNotificationService.createMentionNotification(
      'user123',
      'John Doe',
      'note',
      'Test Task',
      'task456',
      'project789',
      'task456'
    )
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Mention notification created for user:',
      'user123',
      expect.objectContaining({
        message: 'John Doe mentioned you in notes'
      })
    )
    
    consoleSpy.mockRestore()
  })

  it('should create mention notification with correct context type for notes', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    await MentionNotificationService.createMentionNotification(
      'user123',
      'John Doe',
      'note',
      'Test Task',
      'task456',
      'project789',
      'task456'
    )
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Mention notification created for user:',
      'user123',
      expect.objectContaining({
        message: 'John Doe mentioned you in notes'
      })
    )
    
    consoleSpy.mockRestore()
  })

  it('should create mention notification with correct context type for messages', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    await MentionNotificationService.createMentionNotification(
      'user123',
      'John Doe',
      'message',
      'Team Alpha: Hello everyone!',
      'team456',
      undefined,
      undefined
    )
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Mention notification created for user:',
      'user123',
      expect.objectContaining({
        message: 'John Doe mentioned you in a team message'
      })
    )
    
    consoleSpy.mockRestore()
  })

  it('should send notification to correct user', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    await MentionNotificationService.sendNotificationToUser(
      'targetUser123',
      {
        type: 'mention',
        title: 'You were mentioned',
        message: 'John Doe mentioned you in a comment',
        mentionedBy: 'John Doe',
        mentionedByName: 'John Doe',
        contextType: 'comment',
        contextId: 'task456',
        contextTitle: 'Test Task',
        projectId: 'project789',
        taskId: 'task456',
        actionUrl: '/tasks/task456'
      }
    )
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Notification sent to user:',
      'targetUser123'
    )
    
    consoleSpy.mockRestore()
  })
})