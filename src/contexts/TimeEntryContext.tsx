import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TimeEntry } from '../types'
import { timeEntryService } from '../services/timeEntryService'
import { useMySQLAuth } from './MySQLAuthContext'

interface TimeEntryContextType {
  timeEntries: TimeEntry[]
  setTimeEntries: (entries: TimeEntry[]) => void
  updateTimeEntry: (entryId: string, updates: Partial<TimeEntry>) => void
  deleteTimeEntry: (entryId: string) => void
  addTimeEntry: (entry: TimeEntry) => void
  refreshTimeEntries: () => Promise<void>
  loading: boolean
}

const TimeEntryContext = createContext<TimeEntryContextType | undefined>(undefined)

export function useTimeEntries() {
  const context = useContext(TimeEntryContext)
  if (context === undefined) {
    throw new Error('useTimeEntries must be used within a TimeEntryProvider')
  }
  return context
}

interface TimeEntryProviderProps {
  children: ReactNode
}

export function TimeEntryProvider({ children }: TimeEntryProviderProps) {
  const { currentUser } = useMySQLAuth()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Set up real-time listener for time entries
  useEffect(() => {
    if (!currentUser?.uid) {
      setTimeEntries([])
      return
    }

    setLoading(true)
    
    // Subscribe to real-time updates
    const unsubscribe = (timeEntryService as any).subscribeToTimeEntries(
      currentUser.uid,
      (entries: TimeEntry[]) => {
        setTimeEntries(entries)
        setLoading(false)
      }
    )

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [currentUser?.uid])

  // Update a specific time entry
  const updateTimeEntry = (entryId: string, updates: Partial<TimeEntry>) => {
    setTimeEntries(prevEntries =>
      prevEntries.map(entry =>
        entry.id === entryId ? { ...entry, ...updates, updatedAt: new Date() } : entry
      )
    )
  }

  // Delete a time entry
  const deleteTimeEntry = (entryId: string) => {
    setTimeEntries(prevEntries =>
      prevEntries.filter(entry => entry.id !== entryId)
    )
  }

  // Add a new time entry
  const addTimeEntry = (entry: TimeEntry) => {
    setTimeEntries(prevEntries => [...prevEntries, entry])
  }

  // Refresh time entries from the server (for manual refresh)
  const refreshTimeEntries = async () => {
    if (!currentUser?.uid) return
    
    try {
      const entries = await timeEntryService.getTimeEntries(currentUser.uid)
      setTimeEntries(entries)
    } catch (error) {
      console.error('Error refreshing time entries:', error)
    }
  }

  const value = {
    timeEntries,
    setTimeEntries,
    updateTimeEntry,
    deleteTimeEntry,
    addTimeEntry,
    refreshTimeEntries,
    loading
  }

  return (
    <TimeEntryContext.Provider value={value}>
      {children}
    </TimeEntryContext.Provider>
  )
}