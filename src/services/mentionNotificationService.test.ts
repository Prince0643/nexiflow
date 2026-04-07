import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import MentionNotificationService from './mentionNotificationService'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const createJsonResponse = (body: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: async () => body
} as Response)

describe('MentionNotificationService', () => {
  const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    ;(global as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
    localStorage.clear()
    localStorage.setItem('authToken', 'test-token')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('posts a mention notification payload to the API', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({ success: true, data: { id: 'notif-1' } })
    )

    await MentionNotificationService.createMentionNotification(
      'user-1',
      'Jane Doe',
      'comment',
      'Task Title',
      'task-1',
      'project-1',
      'task-1'
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/mention-notifications',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        })
      })
    )
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined

    expect(JSON.parse(requestInit?.body as string)).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        type: 'mention',
        message: 'Jane Doe mentioned you in a comment',
        taskId: 'task-1',
        projectId: 'project-1'
      })
    )
  })

  it('filters notification reads to the current user and maps dates', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        success: true,
        data: [
          {
            id: 'notif-1',
            title: 'A',
            message: 'A message',
            type: 'mention',
            isRead: false,
            mentionedUserId: 'user-1',
            createdAt: '2026-04-07T00:00:00.000Z'
          },
          {
            id: 'notif-2',
            title: 'B',
            message: 'B message',
            type: 'mention',
            isRead: true,
            mentionedUserId: 'user-2',
            createdAt: '2026-04-07T01:00:00.000Z'
          }
        ]
      })
    )

    const notifications = await MentionNotificationService.getMentionNotifications('user-1')

    expect(notifications).toHaveLength(1)
    expect(notifications[0].id).toBe('notif-1')
    expect(notifications[0].createdAt).toBeInstanceOf(Date)
  })

  it('does not fetch while the document is hidden and refreshes once visible', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    })
    fetchMock.mockResolvedValue(
      createJsonResponse({ success: true, data: [] })
    )

    const callback = jest.fn()
    const unsubscribe = MentionNotificationService.subscribeToNotifications('user-1', callback)

    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith([])

    unsubscribe()
  })

  it('backs off after a 429 response and retries with the longer delay', async () => {
    const rateLimitError = Object.assign(new Error('Too many requests'), { status: 429 })

    fetchMock
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(createJsonResponse({ success: true, data: [] }))

    const callback = jest.fn()
    const unsubscribe = MentionNotificationService.subscribeToNotifications('user-1', callback)

    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callback).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(120000)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith([])

    unsubscribe()
  })
})
