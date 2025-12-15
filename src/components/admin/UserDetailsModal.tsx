import { useState, useEffect } from 'react'
import { X, User, Calendar, Clock, TrendingUp, Building2, Eye, Edit, Trash2, Save, Download, Filter, Search, Mail, Shield, Users, Activity, ChevronDown } from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, parseISO, isValid, isWithinInterval, addDays, eachDayOfInterval } from 'date-fns'
import { User as UserType, TimeEntry } from '../../types'
import { timeEntryService } from '../../services/timeEntryService'
import { formatDurationToHHMMSS } from '../../utils'
import SimpleChart from '../charts/SimpleChart'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { canViewHourlyRates } from '../../utils/permissions'

interface UserDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserType | null
  allTimeEntries: TimeEntry[]
  allProjects?: any[]
}

type FilterPeriod = 'all' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom'

export default function UserDetailsModal({ isOpen, onClose, user, allTimeEntries, allProjects = [] }: UserDetailsModalProps) {
  const [userTimeEntries, setUserTimeEntries] = useState<TimeEntry[]>([])
  const [filteredTimeEntries, setFilteredTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'time-entries' | 'stats'>('overview')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [dateRangeError, setDateRangeError] = useState('')
  const { currentUser } = useMySQLAuth()

  useEffect(() => {
    if (isOpen && user) {
      loadUserData()
    }
  }, [isOpen, user])

  useEffect(() => {
    applyFilter()
  }, [userTimeEntries, filterPeriod, customStartDate, customEndDate])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFilterDropdown) {
        const target = event.target as Element
        if (!target.closest('.filter-dropdown')) {
          setShowFilterDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown])

  const loadUserData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Get user's time entries
      const entries = await timeEntryService.getTimeEntries(user.id)
      setUserTimeEntries(entries)
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = () => {
    if (!userTimeEntries.length) {
      setFilteredTimeEntries([])
      return
    }

    let filtered: TimeEntry[] = []
    let startDate: Date
    let endDate: Date

    switch (filterPeriod) {
      case 'all':
        filtered = userTimeEntries
        break
      case 'this-week': {
        const now = new Date()
        const weekStart = startOfWeek(now)
        const weekEnd = endOfWeek(now)
        filtered = userTimeEntries.filter(entry => {
          const dateField = entry.createdAt
          if (!dateField) return false
          const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
          return isValid(entryDate) && isWithinInterval(entryDate, { start: weekStart, end: weekEnd })
        })
        break
      }
      case 'last-week': {
        const now = new Date()
        const lastWeekStart = startOfWeek(subWeeks(now, 1))
        const lastWeekEnd = endOfWeek(subWeeks(now, 1))
        filtered = userTimeEntries.filter(entry => {
          const dateField = entry.createdAt
          if (!dateField) return false
          const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
          return isValid(entryDate) && isWithinInterval(entryDate, { start: lastWeekStart, end: lastWeekEnd })
        })
        break
      }
      case 'this-month': {
        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)
        filtered = userTimeEntries.filter(entry => {
          const dateField = entry.createdAt
          if (!dateField) return false
          const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
          return isValid(entryDate) && isWithinInterval(entryDate, { start: monthStart, end: monthEnd })
        })
        break
      }
      case 'last-month': {
        const now = new Date()
        const lastMonthStart = startOfMonth(subMonths(now, 1))
        const lastMonthEnd = endOfMonth(subMonths(now, 1))
        filtered = userTimeEntries.filter(entry => {
          const dateField = entry.createdAt
          if (!dateField) return false
          const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
          return isValid(entryDate) && isWithinInterval(entryDate, { start: lastMonthStart, end: lastMonthEnd })
        })
        break
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          endDate = new Date(customEndDate)
          
          // Fix for date range filtering: set end date to end of day to include all entries for that day
          endDate.setHours(23, 59, 59, 999)
          
          filtered = userTimeEntries.filter(entry => {
            const dateField = entry.createdAt
            if (!dateField) return false
            const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
            return isValid(entryDate) && entryDate >= startDate && entryDate <= endDate
          })
        } else {
          // Fallback to last 7 days if no custom dates
          endDate = new Date()
          startDate = addDays(endDate, -6)
          
          filtered = userTimeEntries.filter(entry => {
            const dateField = entry.createdAt
            if (!dateField) return false
            const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
            return isValid(entryDate) && entryDate >= startDate && entryDate <= endDate
          })
        }
        break
      }
      default:
        filtered = userTimeEntries
    }

    setFilteredTimeEntries(filtered)
  }

  const handleFilterChange = (period: FilterPeriod) => {
    setFilterPeriod(period)
    setShowFilterDropdown(false)
    setDateRangeError('') // Clear any previous errors
    
    if (period === 'custom') {
      // Set default custom date range to last 30 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      setCustomStartDate(format(startDate, 'yyyy-MM-dd'))
      setCustomEndDate(format(endDate, 'yyyy-MM-dd'))
    }
  }

  const getFilterDisplayText = () => {
    switch (filterPeriod) {
      case 'all': return 'All Time'
      case 'this-week': return 'This Week'
      case 'last-week': return 'Last Week'
      case 'this-month': return 'This Month'
      case 'last-month': return 'Last Month'
      case 'custom': return 'Custom Range'
      default: return 'All Time'
    }
  }

  const getTimeStats = () => {
    const now = new Date()
    const thisWeekStart = startOfWeek(now)
    const thisWeekEnd = endOfWeek(now)
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastWeekStart = startOfWeek(subWeeks(now, 1))
    const lastWeekEnd = endOfWeek(subWeeks(now, 1))
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    const thisWeekEntries = userTimeEntries.filter(entry => {
      const dateField = entry.createdAt
      if (!dateField) return false
      const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
      return isValid(entryDate) && entryDate >= thisWeekStart && entryDate <= thisWeekEnd
    })

    const thisMonthEntries = userTimeEntries.filter(entry => {
      const dateField = entry.createdAt
      if (!dateField) return false
      const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
      return isValid(entryDate) && entryDate >= thisMonthStart && entryDate <= thisMonthEnd
    })

    const lastWeekEntries = userTimeEntries.filter(entry => {
      const dateField = entry.createdAt
      if (!dateField) return false
      const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
      return isValid(entryDate) && entryDate >= lastWeekStart && entryDate <= lastWeekEnd
    })

    const lastMonthEntries = userTimeEntries.filter(entry => {
      const dateField = entry.createdAt
      if (!dateField) return false
      const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
      return isValid(entryDate) && entryDate >= lastMonthStart && entryDate <= lastMonthEnd
    })

    return {
      totalHours: filteredTimeEntries.reduce((sum, entry) => sum + entry.duration, 0),
      thisWeekHours: thisWeekEntries.reduce((sum, entry) => sum + entry.duration, 0),
      thisMonthHours: thisMonthEntries.reduce((sum, entry) => sum + entry.duration, 0),
      lastWeekHours: lastWeekEntries.reduce((sum, entry) => sum + entry.duration, 0),
      lastMonthHours: lastMonthEntries.reduce((sum, entry) => sum + entry.duration, 0),
      totalEntries: filteredTimeEntries.length,
      thisWeekEntries: thisWeekEntries.length,
      thisMonthEntries: thisMonthEntries.length,
      lastWeekEntries: lastWeekEntries.length,
      lastMonthEntries: lastMonthEntries.length
    }
  }

  const getProjectBreakdown = () => {
    const projectStats = allProjects.map((project: any) => {
      const projectEntries = filteredTimeEntries.filter(entry => entry.projectId === project.id)
      const totalHours = projectEntries.reduce((sum: number, entry: TimeEntry) => sum + entry.duration, 0)
      return {
        ...project,
        totalHours,
        entryCount: projectEntries.length
      }
    }).filter((project: any) => project.totalHours > 0).sort((a: any, b: any) => b.totalHours - a.totalHours)

    return projectStats
  }

  const getRecentActivity = () => {
    return filteredTimeEntries
      .sort((a, b) => {
        const dateA = typeof a.createdAt === 'string' ?
          parseISO(a.createdAt) : new Date(a.createdAt)
        const dateB = typeof b.createdAt === 'string' ?
          parseISO(b.createdAt) : new Date(b.createdAt)
        return dateB.getTime() - dateA.getTime()
      })
      .slice(0, 10)
  }

  const getDailyTimeData = () => {
    if (!filteredTimeEntries.length) {
      return {
        labels: [],
        datasets: [{
          label: 'Hours',
          data: [],
          backgroundColor: '#3B82F6',
          borderColor: '#3B82F6'
        }]
      }
    }

    // Get the date range based on the current filter
    let startDate: Date
    let endDate: Date

    switch (filterPeriod) {
      case 'this-week': {
        const now = new Date()
        startDate = startOfWeek(now)
        endDate = endOfWeek(now)
        break
      }
      case 'last-week': {
        const now = new Date()
        startDate = startOfWeek(subWeeks(now, 1))
        endDate = endOfWeek(subWeeks(now, 1))
        break
      }
      case 'this-month': {
        const now = new Date()
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      }
      case 'last-month': {
        const now = new Date()
        startDate = startOfMonth(subMonths(now, 1))
        endDate = endOfMonth(subMonths(now, 1))
        break
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          endDate = new Date(customEndDate)
          
          // Fix for date range filtering: set end date to end of day to include all entries for that day
          endDate.setHours(23, 59, 59, 999)
        } else {
          // Fallback to last 7 days if no custom dates
          endDate = new Date()
          startDate = addDays(endDate, -6)
        }
        break
      }
      default: {
        // For 'all' or any other case, show last 30 days
        endDate = new Date()
        startDate = addDays(endDate, -29)
        break
      }
    }

    // Generate array of days in the range
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    // Create a map to store daily totals
    const dailyTotals = new Map<string, number>()
    
    // Initialize all days with 0
    days.forEach(day => {
      dailyTotals.set(format(day, 'yyyy-MM-dd'), 0)
    })

    // Sum up time entries for each day
    filteredTimeEntries.forEach(entry => {
      const dateField = entry.createdAt
      if (!dateField) return
      
      const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
      if (!isValid(entryDate)) return
      
      const dayKey = format(entryDate, 'yyyy-MM-dd')
      if (dailyTotals.has(dayKey)) {
        dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + entry.duration)
      }
    })

    // Convert to chart data format
    const labels = days.map(day => format(day, 'MMM dd'))
    const data = days.map(day => {
      const dayKey = format(day, 'yyyy-MM-dd')
      const totalSeconds = dailyTotals.get(dayKey) || 0
      // Convert seconds to hours for better chart display
      return totalSeconds / 3600
    })

    return {
      labels,
      datasets: [{
        label: 'Hours',
        data,
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6'
      }]
    }
  }

  if (!isOpen || !user) return null

  const stats = getTimeStats()
  const projectBreakdown = getProjectBreakdown()
  const recentActivity = getRecentActivity()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.name}</h2>
              <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', name: 'Overview', icon: Building2 },
              { id: 'time-entries', name: 'Time Entries', icon: Clock },
              { id: 'stats', name: 'Statistics', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">User Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Role</p>
                          <p className="font-medium text-gray-900 capitalize">{user.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium text-gray-900">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Shield className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <p className={`font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Users className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Team</p>
                          <p className="font-medium text-gray-900">
                            {user.teamId ? 'Team Member' : 'No Team'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Time Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <Clock className="h-8 w-8 text-blue-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500">Total Hours</p>
                          <p className="text-2xl font-bold text-gray-900">{formatDurationToHHMMSS(stats.totalHours)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <Calendar className="h-8 w-8 text-green-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500">This Week</p>
                          <p className="text-2xl font-bold text-gray-900">{formatDurationToHHMMSS(stats.thisWeekHours)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-purple-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500">This Month</p>
                          <p className="text-2xl font-bold text-gray-900">{formatDurationToHHMMSS(stats.thisMonthHours)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <Activity className="h-8 w-8 text-orange-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500">Total Entries</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.totalEntries}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Project Breakdown */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Project Breakdown</h3>
                    {projectBreakdown.length > 0 ? (
                      <div className="space-y-3">
                        {projectBreakdown.map((project: any) => (
                          <div key={project.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                            <div>
                              <p className="font-medium text-gray-900">{project.name}</p>
                              <p className="text-sm text-gray-500">{project.clientName}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">{formatDurationToHHMMSS(project.totalHours)}</p>
                              <p className="text-sm text-gray-500">{project.entryCount} entries</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No project activity yet</p>
                    )}
                  </div>
                </div>
              )}

              {/* Time Entries Tab */}
              {activeTab === 'time-entries' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Time Entries</h3>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">{filteredTimeEntries.length} entries</span>
                      
                      {/* Filter Dropdown */}
                      <div className="relative filter-dropdown">
                        <button
                          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                          className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          <Filter className="h-4 w-4" />
                          <span>{getFilterDisplayText()}</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        
                        {showFilterDropdown && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                            <div className="py-1">
                              {[
                                { value: 'all', label: 'All Time' },
                                { value: 'this-week', label: 'This Week' },
                                { value: 'last-week', label: 'Last Week' },
                                { value: 'this-month', label: 'This Month' },
                                { value: 'last-month', label: 'Last Month' },
                                { value: 'custom', label: 'Custom Range' }
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => handleFilterChange(option.value as FilterPeriod)}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                    filterPeriod === option.value ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Custom Date Range Inputs */}
                  {filterPeriod === 'custom' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              dateRangeError ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              dateRangeError ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      </div>
                      {dateRangeError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-600">{dateRangeError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Filter Summary */}
                  {filterPeriod !== 'all' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-blue-900">
                            {getFilterDisplayText()} Summary
                          </h4>
                          <p className="text-sm text-blue-700">
                            {filteredTimeEntries.length} entries • {formatDurationToHHMMSS(stats.totalHours)} total time
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-900">
                            {formatDurationToHHMMSS(stats.totalHours)}
                          </p>
                          <p className="text-xs text-blue-600">Total Hours</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {recentActivity.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Project
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Duration
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {recentActivity.map((entry) => {
                              const project = allProjects.find((p: any) => p.id === entry.projectId)
                              const dateField = entry.createdAt
                              const entryDate = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
                              
                              return (
                                <tr key={entry.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                      {project?.name || 'Unknown Project'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {project?.clientName || ''}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {isValid(entryDate) ? format(entryDate, 'MMM dd, yyyy') : 'Invalid Date'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {formatDurationToHHMMSS(entry.duration)}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-900">
                                    {entry.description || '-'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No time entries found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Statistics Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Time Tracking Report</h3>
                      <div className="text-sm text-gray-500">
                        {getFilterDisplayText()} • {filteredTimeEntries.length} entries
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{formatDurationToHHMMSS(stats.totalHours)}</div>
                        <div className="text-sm text-gray-500">Total Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{formatDurationToHHMMSS(stats.totalHours)}</div>
                        <div className="text-sm text-gray-500">Billable Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          ${(stats.totalHours * (user?.hourlyRate || 25)).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">Amount</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Daily Time Chart */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-900">Daily Hours</h4>
                      <p className="text-sm text-gray-500">Time tracked per day for {getFilterDisplayText().toLowerCase()}</p>
                    </div>
                    
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-full" style={{ minWidth: `${Math.max(400, getDailyTimeData().labels.length * 60)}px` }}>
                        <SimpleChart
                          data={getDailyTimeData()}
                          type="bar"
                          height={350}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
