import { TimeEntry, CreateTimeEntryData, TimeSummary } from '../types'
import { timeEntryApiService } from './timeEntryApiService'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

const getAuthToken = async (): Promise<string | null> => {
  try {
    return localStorage.getItem('authToken') || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

// Helper to fetch all time entries for admin use
const fetchAllTimeEntries = async (): Promise<TimeEntry[]> => {
  const token = await getAuthToken()
  const response = await fetch(`${API_BASE_URL}/time-entries`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!response.ok) return []
  const data = await response.json()
  if (!data.success) return []
  return data.data.map((entry: any) => ({
    ...entry,
    clientId: entry.client_id || entry.clientId,
    clientName: entry.client_name || entry.clientName,
    projectName: entry.project_name || entry.projectName,
    startTime: new Date(entry.startTime),
    endTime: entry.endTime ? new Date(entry.endTime) : undefined,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt)
  }))
}

export const timeEntryService = {
  // Create a new time entry
  async createTimeEntry(entryData: CreateTimeEntryData, userId: string, projectName?: string, companyId?: string | null, clientName?: string): Promise<string> {
    // First check if user already has a running timer to prevent multiple concurrent timers
    const existingRunningEntry = await this.getRunningTimeEntry(userId)
    if (existingRunningEntry) {
      throw new Error('Cannot start a new timer: You already have a timer running. Please stop the current timer first.')
    }

    return timeEntryApiService.createTimeEntry(entryData, userId, projectName, companyId, clientName)
  },

  // Get all time entries for a user
  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    return timeEntryApiService.getTimeEntries(userId)
  },

  // Get all time entries (for admin use)
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    return fetchAllTimeEntries()
  },

  // Get time entries for a specific date range
  async getTimeEntriesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    return timeEntryApiService.getTimeEntriesByDateRange(userId, startDate, endDate)
  },

  async getCompanyTimeEntriesByDateRangeForClient(args: {
    clientId: string
    startDate: Date
    endDate: Date
    billableOnly?: boolean
  }): Promise<TimeEntry[]> {
    return timeEntryApiService.getAdminTimeEntries({
      clientId: args.clientId,
      startDate: args.startDate,
      endDate: args.endDate,
      billableOnly: args.billableOnly !== false
    })
  },

  // Get currently running time entry
  async getRunningTimeEntry(userId: string): Promise<TimeEntry | null> {
    return timeEntryApiService.getRunningTimeEntry(userId)
  },

  // Stop a running time entry
  async stopTimeEntry(entryId: string, _userId: string): Promise<void> {
    await timeEntryApiService.stopTimeEntry(entryId)
  },

  // Stop a running time entry for another user (admin feature)
  async stopOtherUserTimeEntry(entryId: string): Promise<void> {
    await timeEntryApiService.stopTimeEntry(entryId)
  },

  // Update a time entry
  async updateTimeEntry(entryId: string, updates: Partial<CreateTimeEntryData & { projectName?: string, clientName?: string }>): Promise<void> {
    return timeEntryApiService.updateTimeEntry(entryId, updates)
  },

  // Update a time entry as admin (for editing other users' entries)
  async updateTimeEntryAsAdmin(entryId: string, updates: Partial<CreateTimeEntryData & { projectName?: string, clientName?: string }>): Promise<void> {
    return timeEntryApiService.updateTimeEntryAsAdmin(entryId, updates)
  },

  // Delete a time entry
  async deleteTimeEntry(entryId: string): Promise<void> {
    return timeEntryApiService.deleteTimeEntry(entryId)
  },

  // Get all running time entries (for admin use)
  async getAllRunningTimeEntries(companyId?: string | null): Promise<TimeEntry[]> {
    return timeEntryApiService.getAdminRunningTimeEntries(companyId)
  },

  // Get time summary for dashboard
  async getTimeSummary(userId: string): Promise<TimeSummary> {
    return timeEntryApiService.getTimeSummary(userId)
  },

  // Get time entries for a specific project
  async getTimeEntriesByProject(userId: string, projectId: string): Promise<TimeEntry[]> {
    const entries = await this.getTimeEntries(userId)
    return entries.filter(entry => entry.projectId === projectId)
  },

  // Get time entries for all users by date range (for admin use)
  async getAllTimeEntriesByDateRange(startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    const allEntries = await fetchAllTimeEntries()
    
    // Adjust end date to end of day to include all entries for that day
    const adjustedEndDate = new Date(endDate)
    adjustedEndDate.setHours(23, 59, 59, 999)
    
    return allEntries.filter((entry: TimeEntry) => {
      const entryDate = new Date(entry.startTime)
      return entryDate >= startDate && entryDate <= adjustedEndDate
    })
  }
}

// Polling-based "real-time" listeners (replaces Firebase onValue)
const POLLING_INTERVAL = 30000 // 30 seconds

const realtimeListeners = {
  // Subscribe to time entries for a specific user (polling-based)
  subscribeToTimeEntries(userId: string, callback: (entries: TimeEntry[]) => void): () => void {
    let cancelled = false
    
    const loadEntries = async () => {
      try {
        const entries = await timeEntryApiService.getTimeEntries(userId)
        if (!cancelled) callback(entries)
      } catch (error) {
        console.error('[timeEntryService] Failed to poll time entries:', error)
      }
    }
    
    loadEntries()
    const interval = window.setInterval(loadEntries, POLLING_INTERVAL)
    
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  },

  // Subscribe to all time entries (for admin use) - polling-based
  subscribeToAllTimeEntries(
    callback: (entries: TimeEntry[]) => void, 
    companyId?: string | null,
    _limit?: number
  ): () => void {
    let cancelled = false
    
    const loadEntries = async () => {
      try {
        let entries = await fetchAllTimeEntries()
        if (companyId) {
          entries = entries.filter(entry => entry.companyId === companyId)
        }
        if (!cancelled) callback(entries)
      } catch (error) {
        console.error('[timeEntryService] Failed to poll all time entries:', error)
      }
    }
    
    loadEntries()
    const interval = window.setInterval(loadEntries, POLLING_INTERVAL)
    
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  },

  // Subscribe to running time entry (polling-based)
  subscribeToRunningTimeEntry(userId: string, callback: (entry: TimeEntry | null) => void): () => void {
    let cancelled = false
    
    const loadRunning = async () => {
      try {
        const entry = await timeEntryApiService.getRunningTimeEntry(userId)
        if (!cancelled) callback(entry)
      } catch (error) {
        console.error('[timeEntryService] Failed to poll running entry:', error)
      }
    }
    
    loadRunning()
    const interval = window.setInterval(loadRunning, 10000) // 10 seconds for running timer
    
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }
}

// Add real-time methods to the main service
Object.assign(timeEntryService, realtimeListeners)
