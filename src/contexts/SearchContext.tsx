import { createContext, useContext, useState, ReactNode } from 'react'
import { TimeEntry, Project, Task } from '../types'
import { timeEntryService } from '../services/timeEntryService'
import { projectService } from '../services/projectService'
import { taskService } from '../services/taskService'
import { useMySQLAuth } from './MySQLAuthContext'

interface SearchResult {
  type: 'project' | 'task' | 'timeEntry'
  id: string
  title: string
  description?: string
  url: string
  metadata?: any
}

interface SearchContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SearchResult[]
  isSearching: boolean
  performSearch: (query: string) => Promise<void>
  clearSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

interface SearchProviderProps {
  children: ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { currentUser } = useMySQLAuth()

  const performSearch = async (query: string) => {
    if (!query.trim() || !currentUser) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const [timeEntries, projects, tasks] = await Promise.all([
        timeEntryService.getTimeEntries(currentUser.uid),
        projectService.getProjects(),
        taskService.getTasks()
      ])

      const results: SearchResult[] = []

      // Search in time entries
      timeEntries
        .filter(entry => 
          entry.description?.toLowerCase().includes(query.toLowerCase()) ||
          entry.projectName?.toLowerCase().includes(query.toLowerCase())
        )
        .forEach(entry => {
          results.push({
            type: 'timeEntry',
            id: entry.id,
            title: entry.description || 'Time Entry',
            description: `Project: ${entry.projectName || 'No Project'} • ${new Date(entry.startTime).toLocaleDateString()}`,
            url: `/tracker`,
            metadata: { duration: entry.duration, isBillable: entry.isBillable }
          })
        })

      // Search in projects
      projects
        .filter(project => 
          project.name.toLowerCase().includes(query.toLowerCase()) ||
          project.description?.toLowerCase().includes(query.toLowerCase()) ||
          project.clientName?.toLowerCase().includes(query.toLowerCase())
        )
        .forEach(project => {
          results.push({
            type: 'project',
            id: project.id,
            title: project.name,
            description: project.description || `Client: ${project.clientName || 'No Client'}`,
            url: `/projects`,
            metadata: { status: project.status, priority: project.priority }
          })
        })

      // Search in tasks
      tasks
        .filter(task => 
          task.title.toLowerCase().includes(query.toLowerCase()) ||
          task.description?.toLowerCase().includes(query.toLowerCase()) ||
          task.projectName.toLowerCase().includes(query.toLowerCase())
        )
        .forEach(task => {
          results.push({
            type: 'task',
            id: task.id,
            title: task.title,
            description: `Project: ${task.projectName} • Status: ${task.status.name}`,
            url: `/management`,
            metadata: { status: task.status, priority: task.priority }
          })
        })

      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
  }

  const value = {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    performSearch,
    clearSearch
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}