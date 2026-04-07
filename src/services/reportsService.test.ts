import { afterEach, describe, expect, it, jest } from '@jest/globals'
import type { ReportFilters, TimeEntry } from '../types'

const mockGetTimeEntries = jest.fn<() => Promise<TimeEntry[]>>()

jest.unstable_mockModule('./timeEntryService', () => ({
  timeEntryService: {
    getTimeEntries: mockGetTimeEntries
  }
}))

jest.unstable_mockModule('./projectService', () => ({
  projectService: {
    getProjects: jest.fn()
  }
}))

const { reportsService } = await import('./reportsService')

const createFilters = (): ReportFilters => ({
  startDate: new Date('2026-04-01T00:00:00'),
  endDate: new Date('2026-04-03T23:59:59'),
  userId: 'user-1',
  billableOnly: false
})

const createEntry = (overrides: Partial<TimeEntry>): TimeEntry => ({
  id: overrides.id || 'entry-1',
  userId: overrides.userId || 'user-1',
  startTime: overrides.startTime || new Date('2026-04-01T09:00:00'),
  duration: overrides.duration || 0,
  isRunning: overrides.isRunning || false,
  isBillable: overrides.isBillable || false,
  createdAt: overrides.createdAt || new Date('2026-04-01T09:00:00'),
  updatedAt: overrides.updatedAt || new Date('2026-04-01T09:00:00'),
  projectId: overrides.projectId,
  clientId: overrides.clientId,
  companyId: overrides.companyId,
  projectName: overrides.projectName,
  clientName: overrides.clientName,
  description: overrides.description,
  endTime: overrides.endTime,
  tags: overrides.tags
})

describe('reportsService', () => {
  afterEach(() => {
    mockGetTimeEntries.mockReset()
    jest.restoreAllMocks()
  })

  it('backfills zero-value days across the full requested range', async () => {
    mockGetTimeEntries.mockResolvedValue([
      createEntry({
        id: 'entry-1',
        startTime: new Date('2026-04-01T09:00:00'),
        duration: 7200,
        isBillable: true,
        projectId: 'project-a'
      }),
      createEntry({
        id: 'entry-2',
        startTime: new Date('2026-04-03T11:00:00'),
        duration: 3600,
        isBillable: false,
        projectId: 'project-b'
      })
    ])

    const dailyAnalytics = await reportsService.getDailyAnalytics(createFilters())

    expect(dailyAnalytics).toEqual([
      {
        date: '2026-04-01',
        totalTime: 7200,
        billableTime: 7200,
        entries: 1,
        projects: {
          'project-a': 7200
        }
      },
      {
        date: '2026-04-02',
        totalTime: 0,
        billableTime: 0,
        entries: 0,
        projects: {}
      },
      {
        date: '2026-04-03',
        totalTime: 3600,
        billableTime: 0,
        entries: 1,
        projects: {
          'project-b': 3600
        }
      }
    ])
  })

  it('keeps total and billable series aligned for the chart', () => {
    const chartData = reportsService.generateDailyChartData([
      {
        date: '2026-04-01',
        totalTime: 7200,
        billableTime: 3600,
        entries: 2,
        projects: {}
      },
      {
        date: '2026-04-02',
        totalTime: 0,
        billableTime: 0,
        entries: 0,
        projects: {}
      },
      {
        date: '2026-04-03',
        totalTime: 1800,
        billableTime: 1800,
        entries: 1,
        projects: {}
      }
    ])

    expect(chartData.labels).toEqual(['Apr 1', 'Apr 2', 'Apr 3'])
    expect(chartData.datasets).toHaveLength(2)
    expect(chartData.datasets[0].label).toBe('Total Time')
    expect(chartData.datasets[0].data).toEqual([2, 0, 0.5])
    expect(chartData.datasets[1].label).toBe('Billable Time')
    expect(chartData.datasets[1].data).toEqual([1, 0, 0.5])
  })
})
