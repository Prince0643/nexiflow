import { ref, set, get, push, remove, update, query, orderByChild, equalTo, onValue, off, limitToLast, Query as FirebaseQuery } from 'firebase/database'
import { database } from '../config/firebase'
import { TimeEntry, CreateTimeEntryData, TimeSummary } from '../types'

export const timeEntryService = {
  // Create a new time entry
  async createTimeEntry(entryData: CreateTimeEntryData, userId: string, projectName?: string, companyId?: string | null, clientName?: string): Promise<string> {
    // First check if user already has a running timer to prevent multiple concurrent timers
    const existingRunningEntry = await this.getRunningTimeEntry(userId)
    if (existingRunningEntry) {
      throw new Error('Cannot start a new timer: You already have a timer running. Please stop the current timer first.')
    }
    
    const entryRef = push(ref(database, 'timeEntries'))
    const now = new Date()
    const newEntry: TimeEntry = {
      ...entryData,
      id: entryRef.key!,
      userId,
      companyId: companyId || undefined,
      projectName: projectName,
      clientName: clientName, // Add clientName
      startTime: now,
      duration: 0,
      isRunning: true,
      isBillable: entryData.isBillable || false,
      createdAt: now,
      updatedAt: now
    }
    
    const dataToSave: any = {
      ...newEntry,
      startTime: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
    
    // Remove undefined values to avoid Firebase errors
    if (!dataToSave.companyId) {
      delete dataToSave.companyId
    }
    if (!dataToSave.projectId) {
      delete dataToSave.projectId
    }
    if (!dataToSave.projectName) {
      delete dataToSave.projectName
    }
    if (!dataToSave.clientId) {
      delete dataToSave.clientId
    }
    if (!dataToSave.clientName) {
      delete dataToSave.clientName
    }
    if (!dataToSave.description) {
      delete dataToSave.description
    }
    if (!dataToSave.tags || dataToSave.tags.length === 0) {
      delete dataToSave.tags
    }
    
    await set(entryRef, dataToSave)
    return entryRef.key!
  },

  // Get all time entries for a user
  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    const entriesRef = ref(database, 'timeEntries')
    const q = query(entriesRef, orderByChild('userId'), equalTo(userId))
    const snapshot = await get(q)
    
    if (snapshot.exists()) {
      const entries = snapshot.val()
      return Object.values(entries)
        .map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }))
        .sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get all time entries (for admin use)
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    const entriesRef = ref(database, 'timeEntries')
    const snapshot = await get(entriesRef)
    
    if (snapshot.exists()) {
      const entries = snapshot.val()
      return Object.values(entries)
        .map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }))
        .sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get time entries for a specific date range
  async getTimeEntriesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    const entriesRef = ref(database, 'timeEntries')
    const q = query(
      entriesRef, 
      orderByChild('userId'), 
      equalTo(userId)
    )
    const snapshot = await get(q)
    
    if (snapshot.exists()) {
      const entries = snapshot.val()
      
      // Fix for date range filtering: set end date to end of day to include all entries for that day
      const adjustedEndDate = new Date(endDate)
      adjustedEndDate.setHours(23, 59, 59, 999)
      
      return Object.values(entries)
        .map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }))
        .filter((entry: TimeEntry) => {
          const entryDate = new Date(entry.startTime)
          return entryDate >= startDate && entryDate <= adjustedEndDate
        })
        .sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get currently running time entry
  async getRunningTimeEntry(userId: string): Promise<TimeEntry | null> {
    const entriesRef = ref(database, 'timeEntries')
    const q = query(entriesRef, orderByChild('userId'), equalTo(userId))
    const snapshot = await get(q)
    
    if (snapshot.exists()) {
      const entries = snapshot.val()
      const runningEntry = Object.values(entries)
        .map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }))
        .find((entry: TimeEntry) => entry.isRunning && entry.userId === userId)
      
      return runningEntry || null
    }
    
    return null
  },

  // Stop a running time entry
  async stopTimeEntry(entryId: string): Promise<void> {
    const entryRef = ref(database, `timeEntries/${entryId}`)
    const snapshot = await get(entryRef)
    
    if (snapshot.exists()) {
      const entry = snapshot.val()
      const endTime = new Date()
      const duration = Math.floor((endTime.getTime() - new Date(entry.startTime).getTime()) / 1000)
      
      await update(entryRef, {
        endTime: endTime.toISOString(),
        duration,
        isRunning: false,
        updatedAt: new Date().toISOString()
      })
    }
  },

  // Stop a running time entry for another user (admin feature)
  async stopOtherUserTimeEntry(entryId: string): Promise<void> {
    const entryRef = ref(database, `timeEntries/${entryId}`)
    const snapshot = await get(entryRef)
    
    if (snapshot.exists()) {
      const entry = snapshot.val()
      const endTime = new Date()
      const duration = Math.floor((endTime.getTime() - new Date(entry.startTime).getTime()) / 1000)
      
      await update(entryRef, {
        endTime: endTime.toISOString(),
        duration,
        isRunning: false,
        updatedAt: new Date().toISOString()
      })
    }
  },

  // Update a time entry
  async updateTimeEntry(entryId: string, updates: Partial<CreateTimeEntryData & { projectName?: string, clientName?: string }>): Promise<void> {
    const entryRef = ref(database, `timeEntries/${entryId}`)
    
    const dataToUpdate: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    // Remove undefined values to avoid Firebase errors
    Object.keys(dataToUpdate).forEach(key => {
      if (dataToUpdate[key] === undefined) {
        delete dataToUpdate[key]
      }
    })
    
    // Handle empty tags array
    if (dataToUpdate.tags && Array.isArray(dataToUpdate.tags) && dataToUpdate.tags.length === 0) {
      delete dataToUpdate.tags
    }
    
    await update(entryRef, dataToUpdate)
  },

  // Delete a time entry
  async deleteTimeEntry(entryId: string): Promise<void> {
    const entryRef = ref(database, `timeEntries/${entryId}`)
    await remove(entryRef)
  },

  // Get all running time entries (for admin use)
  async getAllRunningTimeEntries(companyId?: string | null): Promise<TimeEntry[]> {
    const entriesRef = ref(database, 'timeEntries')
    const snapshot = await get(entriesRef)
    
    if (snapshot.exists()) {
      const entries = snapshot.val()
      let filteredEntries = Object.values(entries)
        .map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }))
        .filter((entry: TimeEntry) => entry.isRunning)
        
      // Apply company filtering if companyId is provided
      if (companyId) {
        filteredEntries = filteredEntries.filter((entry: TimeEntry) => entry.companyId === companyId)
      }
        
      return filteredEntries.sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get time summary for dashboard
  async getTimeSummary(userId: string): Promise<TimeSummary> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [todayEntries, weekEntries, monthEntries] = await Promise.all([
      this.getTimeEntriesByDateRange(userId, startOfDay, now),
      this.getTimeEntriesByDateRange(userId, startOfWeek, now),
      this.getTimeEntriesByDateRange(userId, startOfMonth, now)
    ])

    const calculateStats = (entries: TimeEntry[]) => {
      const total = entries.reduce((sum, entry) => sum + entry.duration, 0)
      const billable = entries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => sum + entry.duration, 0)
      return { total, billable, entries: entries.length }
    }

    return {
      today: calculateStats(todayEntries),
      thisWeek: calculateStats(weekEntries),
      thisMonth: calculateStats(monthEntries)
    }
  },

  // Get time entries for a specific project
  async getTimeEntriesByProject(userId: string, projectId: string): Promise<TimeEntry[]> {
    const entries = await this.getTimeEntries(userId)
    return entries.filter(entry => entry.projectId === projectId)
  },

  // Get time entries for all users by date range (for admin use)
  async getAllTimeEntriesByDateRange(startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    const entriesRef = ref(database, 'timeEntries')
    const snapshot = await get(entriesRef)
    
    if (snapshot.exists()) {
      const entries = snapshot.val()
      
      // Fix for date range filtering: set end date to end of day to include all entries for that day
      const adjustedEndDate = new Date(endDate)
      adjustedEndDate.setHours(23, 59, 59, 999)
      
      return Object.values(entries)
        .map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }))
        .filter((entry: TimeEntry) => {
          const entryDate = new Date(entry.startTime)
          return entryDate >= startDate && entryDate <= adjustedEndDate
        })
        .sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  }
}

// Real-time listeners
const realtimeListeners = {
  // Subscribe to time entries for a specific user
  subscribeToTimeEntries(userId: string, callback: (entries: TimeEntry[]) => void): () => void {
    const entriesRef = ref(database, 'timeEntries')
    const q = query(entriesRef, orderByChild('userId'), equalTo(userId))
    
    const unsubscribe = onValue(q, (snapshot) => {
      if (snapshot.exists()) {
        const entries = snapshot.val()
        const formattedEntries = Object.values(entries)
          .map((entry: any) => ({
            ...entry,
            startTime: new Date(entry.startTime),
            endTime: entry.endTime ? new Date(entry.endTime) : undefined,
            createdAt: new Date(entry.createdAt),
            updatedAt: new Date(entry.updatedAt)
          }))
          .sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
        
        callback(formattedEntries)
      } else {
        callback([])
      }
    })
    
    return unsubscribe
  },

  // Subscribe to all time entries (for admin use) - SCOPED VERSION
  subscribeToAllTimeEntries(
    callback: (entries: TimeEntry[]) => void, 
    companyId?: string | null,
    limit?: number
  ): () => void {
    // Start with base reference
    let entriesQuery: FirebaseQuery | ReturnType<typeof ref> = ref(database, 'timeEntries')
    
    // If companyId is provided, scope to that company
    if (companyId) {
      entriesQuery = query(entriesQuery, orderByChild('companyId'), equalTo(companyId))
    }
    
    // Add limit if provided
    if (limit) {
      entriesQuery = query(entriesQuery, limitToLast(limit))
    }
    
    const unsubscribe = onValue(entriesQuery, (snapshot) => {
      if (snapshot.exists()) {
        const entries = snapshot.val()
        const formattedEntries = Object.values(entries)
          .map((entry: any) => ({
            ...entry,
            startTime: new Date(entry.startTime),
            endTime: entry.endTime ? new Date(entry.endTime) : undefined,
            createdAt: new Date(entry.createdAt),
            updatedAt: new Date(entry.updatedAt)
          }))
          .sort((a: TimeEntry, b: TimeEntry) => b.createdAt.getTime() - a.createdAt.getTime())
        
        callback(formattedEntries)
      } else {
        callback([])
      }
    })
    
    return unsubscribe
  },

  // Subscribe to running time entry for real-time timer updates
  subscribeToRunningTimeEntry(userId: string, callback: (entry: TimeEntry | null) => void): () => void {
    const entriesRef = ref(database, 'timeEntries')
    const q = query(entriesRef, orderByChild('userId'), equalTo(userId))
    
    const unsubscribe = onValue(q, (snapshot) => {
      if (snapshot.exists()) {
        const entries = snapshot.val()
        const runningEntry = Object.values(entries)
          .map((entry: any) => ({
            ...entry,
            startTime: new Date(entry.startTime),
            endTime: entry.endTime ? new Date(entry.endTime) : undefined,
            createdAt: new Date(entry.createdAt),
            updatedAt: new Date(entry.updatedAt)
          }))
          .find((entry: TimeEntry) => entry.isRunning && entry.userId === userId)
        
        callback(runningEntry || null)
      } else {
        callback(null)
      }
    })
    
    return unsubscribe
  }
}

// Add real-time methods to the main service
Object.assign(timeEntryService, realtimeListeners)
