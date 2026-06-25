import React, { useMemo, useState, useEffect } from 'react'
import { 
  Clock, 
  Calendar, 
  DollarSign,
  BarChart3,
  Target,
  Zap,
  Trash2
} from 'lucide-react'
import { startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import TimeTracker from '../components/TimeTracker'
import { Client, Project, TimeSummary, TimeEntry } from '../types'
import { timeEntryApiService as timeEntryService } from '../services/timeEntryApiService'
import { clientApiService } from '../services/clientApiService'
import { projectApiService } from '../services/projectApiService'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { formatTimeFromSeconds, formatDate } from '../utils'

export default function TimeTrackerPage() {
  const { currentUser, currentCompany } = useMySQLAuth()
  const [timeSummary, setTimeSummary] = useState<TimeSummary | null>(null)
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([])
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today')
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage] = useState(10)
  const [now, setNow] = useState(() => Date.now())
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    // Clear immediately so company switching doesn't show stale entries.
    setAllEntries([])
    setRecentEntries([])
    setTimeSummary(null)
    void loadTimeData()
  }, [currentCompany?.id, currentUser])

  useEffect(() => {
    const hasRunningEntry = allEntries.some((entry) => entry.isRunning)
    if (!hasRunningEntry) return undefined

    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(id)
  }, [allEntries])

  const loadTimeData = async () => {
    if (!currentUser) return
    
    setLoading(true)
    try {
      const companyId = currentCompany?.id || currentUser.companyId || null
      const [summary, entries, clientsData, projectsData] = await Promise.all([
        timeEntryService.getTimeSummary(currentUser.uid),
        timeEntryService.getTimeEntries(currentUser.uid),
        companyId ? clientApiService.getClientsForCompany(companyId) : clientApiService.getClients(),
        companyId ? projectApiService.getAllProjectsForCompany(companyId) : projectApiService.getAllProjects()
      ])
      setTimeSummary(summary)
      setClients(clientsData)
      setProjects(projectsData)
      // Filter out entries without valid IDs
      const validEntries = entries.filter(entry => entry.id)
      const uniqueEntries: TimeEntry[] = []
      const seen = new Set<string>()
      for (const entry of validEntries) {
        if (seen.has(entry.id)) continue
        seen.add(entry.id)
        uniqueEntries.push(entry)
      }
      setAllEntries(uniqueEntries)
    } catch (error) {
      console.error('Error loading time data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTimeUpdate = (summary: TimeSummary) => {
    setTimeSummary(summary)
    loadTimeData() // Refresh recent entries
  }

  const getDisplayDurationSeconds = (entry: TimeEntry) => {
    const baseDuration = typeof entry.duration === 'number' ? entry.duration : 0
    if (!entry.isRunning) return baseDuration

    const start = entry.startTime ? new Date(entry.startTime).getTime() : NaN
    if (Number.isNaN(start)) return baseDuration

    const elapsed = Math.max(0, Math.floor((now - start) / 1000))
    return Math.max(baseDuration, elapsed)
  }

  // Pagination
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  // Update displayed entries when page or all entries change
  useEffect(() => {
    const indexOfLastEntry = currentPage * entriesPerPage
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage
    setRecentEntries(allEntries.slice(indexOfFirstEntry, indexOfLastEntry))
  }, [allEntries, currentPage, entriesPerPage])

  useEffect(() => {
    if (!currentUser) return undefined

    const handleTimeEntryChanged = () => {
      void loadTimeData()
    }

    window.addEventListener('timeEntry:changed', handleTimeEntryChanged as EventListener)
    return () => {
      window.removeEventListener('timeEntry:changed', handleTimeEntryChanged as EventListener)
    }
  }, [currentUser])

  const getTimeStats = () => {
    if (!timeSummary) return { total: 0, billable: 0, entries: 0 }
    
    switch (activeTab) {
      case 'today':
        return timeSummary.today
      case 'week':
        return timeSummary.thisWeek
      case 'month':
        return timeSummary.thisMonth
      default:
        return timeSummary.today
    }
  }

  const getTabLabel = (tab: 'today' | 'week' | 'month') => {
    switch (tab) {
      case 'today':
        return 'Today'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
    }
  }

  const getTabIcon = (tab: 'today' | 'week' | 'month') => {
    switch (tab) {
      case 'today':
        return Clock
      case 'week':
        return Calendar
      case 'month':
        return BarChart3
    }
  }

  const clientRateById = useMemo(() => {
    const map = new Map<string, number>()
    for (const client of clients) {
      map.set(client.id, client.hourlyRate || 0)
    }
    return map
  }, [clients])

  const projectClientById = useMemo(() => {
    const map = new Map<string, string>()
    for (const project of projects) {
      if (project.clientId) map.set(project.id, project.clientId)
    }
    return map
  }, [projects])

  const getTabStartDate = (tab: 'today' | 'week' | 'month') => {
    const date = new Date(now)
    if (tab === 'today') return startOfDay(date)
    if (tab === 'week') return startOfWeek(date, { weekStartsOn: 1 })
    return startOfMonth(date)
  }

  const billableAmount = useMemo(() => {
    const start = getTabStartDate(activeTab).getTime()
    const end = now

    return allEntries
      .filter((entry) => {
        if (!entry.isBillable) return false
        const startTime = new Date(entry.startTime as any).getTime()
        return !Number.isNaN(startTime) && startTime >= start && startTime <= end
      })
      .reduce((sum, entry) => {
        const directClientId = entry.clientId
        const derivedClientId = entry.projectId ? projectClientById.get(entry.projectId) : undefined
        const clientId = directClientId || derivedClientId
        const rate = clientId ? (clientRateById.get(clientId) || 0) : 0
        return sum + (entry.duration / 3600) * rate
      }, 0)
  }, [activeTab, allEntries, now, clientRateById, projectClientById])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading time tracker...</p>
        </div>
      </div>
    )
  }

  const stats = getTimeStats()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Time Tracker</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your time and monitor productivity</p>
        </div>
      </div>

      {/* Time Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Daily Time */}
        <div 
          className={`card cursor-pointer transition-all duration-200 ${
            activeTab === 'today' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900' : 'hover:shadow-md'
          }`}
          onClick={() => setActiveTab('today')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatTimeFromSeconds(timeSummary?.today.total || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {timeSummary?.today.entries || 0} entries
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Weekly Time */}
        <div 
          className={`card cursor-pointer transition-all duration-200 ${
            activeTab === 'week' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900' : 'hover:shadow-md'
          }`}
          onClick={() => setActiveTab('week')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">This Week</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatTimeFromSeconds(timeSummary?.thisWeek.total || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {timeSummary?.thisWeek.entries || 0} entries
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Monthly Time */}
        <div 
          className={`card cursor-pointer transition-all duration-200 ${
            activeTab === 'month' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900' : 'hover:shadow-md'
          }`}
          onClick={() => setActiveTab('month')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatTimeFromSeconds(timeSummary?.thisMonth.total || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {timeSummary?.thisMonth.entries || 0} entries
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Tab Stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {getTabLabel(activeTab)} Overview
          </h2>
          <div className="flex items-center space-x-2">
            {React.createElement(getTabIcon(activeTab), {
              className: "h-5 w-5 text-primary-600 dark:text-primary-400"
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Time */}
          <div className="text-center">
            <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg w-14 h-14 mx-auto mb-2 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatTimeFromSeconds(stats.total)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Time</p>
          </div>

          {/* Billable Time */}
          <div className="text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg w-14 h-14 mx-auto mb-2 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatTimeFromSeconds(stats.billable)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Billable Time</p>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ${billableAmount.toFixed(2)} earned
            </p>
          </div>

          {/* Entries Count */}
          <div className="text-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg w-14 h-14 mx-auto mb-2 flex items-center justify-center">
              <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.entries}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Time Entries</p>
          </div>
        </div>
      </div>

      {/* Time Tracker Component */}
      <TimeTracker onTimeUpdate={handleTimeUpdate} />

      {/* Recent Entries with Pagination */}
      {allEntries.length > 0 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Entries</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {Math.min((currentPage - 1) * entriesPerPage + 1, allEntries.length)}-
              {Math.min(currentPage * entriesPerPage, allEntries.length)} of {allEntries.length} entries
            </span>
          </div>
          <div className="space-y-3">
            {recentEntries
              .filter(entry => entry.id) // Only show entries with valid IDs
              .map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {entry.isRunning ? (
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    ) : (
                      <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {entry.projectName || 'No project'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.clientName && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                        {entry.clientName}
                      </span>
                    )}
                    {entry.description && (
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
                        {entry.description}
                      </span>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs bg-primary-100 dark:bg-primary-800 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 pt-2 sm:pt-0">
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                    {formatTimeFromSeconds(getDisplayDurationSeconds(entry))}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(entry.startTime)}
                  </span>
                  <div className="flex items-center space-x-2">
                    {currentCompany?.pricingLevel === 'solo' ? (
                      <>
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={true}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Billable</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="checkbox"
                          checked={entry.isBillable || false}
                          onChange={async (e) => {
                            try {
                              await timeEntryService.updateTimeEntry(entry.id, {
                                isBillable: e.target.checked
                              });
                              // Refresh the data
                              loadTimeData();
                            } catch (error) {
                              console.error('Error updating billable status:', error);
                            }
                          }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Billable</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      // Validate entry ID before attempting to delete
                      if (!entry.id) {
                        console.error('Cannot delete time entry: Missing entry ID');
                        return;
                      }
                      
                      if (window.confirm('Are you sure you want to delete this time entry?')) {
                        try {
                          await timeEntryService.deleteTimeEntry(entry.id);
                          // Refresh the data
                          loadTimeData();
                        } catch (error) {
                          console.error('Error deleting time entry:', error);
                        }
                      }
                    }}
                    className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded self-start sm:self-center"
                    title="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {allEntries.length > entriesPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 gap-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {Math.ceil(allEntries.length / entriesPerPage)}
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md text-sm ${
                    currentPage === 1
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  Previous
                </button>
                
                {/* Page numbers - show up to 5 pages */}
                {Array.from({ length: Math.min(5, Math.ceil(allEntries.length / entriesPerPage)) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      className={`px-3 py-1 rounded-md text-sm ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === Math.ceil(allEntries.length / entriesPerPage)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    currentPage === Math.ceil(allEntries.length / entriesPerPage)
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Tips */}
      <div className="card bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900 dark:to-blue-900 border-primary-200 dark:border-primary-700">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-800 rounded-lg">
            <Zap className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Quick Tips</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Start a timer before beginning any task</li>
              <li>• Add descriptions to remember what you worked on</li>
              <li>• Use tags to categorize your work</li>
              <li>• Mark billable time to track earnings</li>
              <li>• Review your time patterns weekly for better productivity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
