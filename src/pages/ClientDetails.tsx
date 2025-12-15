import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  Building2, 
  Calendar, 
  Globe, 
  Clock, 
  TrendingUp,
  FileText,
  DollarSign,
  ArrowLeft,
  Edit,
  Trash2,
  Search,
  Filter
} from 'lucide-react'
import { format, isAfter, isBefore, isSameDay } from 'date-fns'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { projectService } from '../services/projectService'
import { timeEntryService } from '../services/timeEntryService'
import { userService } from '../services/userService'
import { Client, Project, TimeEntry, User } from '../types'
import { canViewHourlyRates } from '../utils/permissions'
import { formatSecondsToHHMMSS, formatCurrency } from '../utils'

// Add this helper function to format duration
const formatDurationToHHMMSS = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function ClientDetails() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [filteredTimeEntries, setFilteredTimeEntries] = useState<TimeEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filter states
  const [userFilter, setUserFilter] = useState<string>('all')
  const [startDateFilter, setStartDateFilter] = useState<string>('')
  const [endDateFilter, setEndDateFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadClientData()
  }, [clientId])

  useEffect(() => {
    applyFilters()
  }, [timeEntries, userFilter, startDateFilter, endDateFilter, searchTerm])

  const loadClientData = async () => {
    if (!clientId) return

    setLoading(true)
    try {
      // Load client data
      const clientData = await projectService.getClientById(clientId)
      if (!clientData) {
        setError('Client not found')
        setLoading(false)
        return
      }
      setClient(clientData)

      // Load projects for this client
      const projectsData = await projectService.getProjects()
      const clientProjects = projectsData.filter(project => project.clientId === clientId)
      setProjects(clientProjects)

      // Load all users for filtering
      const usersData = await userService.getAllUsers()
      setUsers(usersData)

      // Load time entries for this client's projects
      if (clientProjects.length > 0) {
        // Get all time entries and filter by project IDs
        const allEntries = await timeEntryService.getAllTimeEntries()
        const projectIds = clientProjects.map(project => project.id)
        const entries = allEntries.filter(entry => 
          entry.projectId && projectIds.includes(entry.projectId)
        )
        setTimeEntries(entries)
      }
    } catch (error) {
      console.error('Error loading client data:', error)
      setError('Failed to load client data')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...timeEntries]

    // User filter
    if (userFilter !== 'all') {
      filtered = filtered.filter(entry => entry.userId === userFilter)
    }

    // Date range filter
    if (startDateFilter) {
      const startDate = new Date(startDateFilter)
      filtered = filtered.filter(entry => 
        entry.startTime && isAfter(new Date(entry.startTime), startDate) || isSameDay(new Date(entry.startTime), startDate)
      )
    }

    if (endDateFilter) {
      const endDate = new Date(endDateFilter)
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(entry => 
        entry.startTime && isBefore(new Date(entry.startTime), endDate) || isSameDay(new Date(entry.startTime), endDate)
      )
    }

    // Search term filter
    if (searchTerm) {
      filtered = filtered.filter(entry => 
        (entry.description && entry.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.projectName && entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredTimeEntries(filtered)
  }

  const handleDeleteClient = async () => {
    if (!client) return

    if (window.confirm(`Are you sure you want to delete "${client.name}"? This action cannot be undone.`)) {
      try {
        await projectService.deleteClient(client.id)
        navigate('/clients')
      } catch (error) {
        setError('Failed to delete client')
      }
    }
  }

  const getClientTypeColor = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300'
      case 'part-time':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
      case 'custom':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300'
      case 'gig':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
  }

  const getClientTypeIcon = (type: string) => {
    switch (type) {
      case 'full-time':
        return '🕐'
      case 'part-time':
        return '⏰'
      case 'custom':
        return '⚙️'
      case 'gig':
        return '📅'
      default:
        return '👤'
    }
  }

  const getClientTimeData = () => {
    if (!client) return null

    const clientProjects = projects
    const clientProjectIds = clientProjects.map(project => project.id)
    
    const clientTimeEntries = timeEntries.filter(entry => 
      entry.projectId && clientProjectIds.includes(entry.projectId)
    )

    const totalSeconds = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
    const totalHours = totalSeconds / 3600
    const billableAmount = totalHours * (client.hourlyRate || 0)

    return {
      totalHours,
      totalSeconds,
      billableAmount,
      timeEntries: clientTimeEntries.length,
      formattedTime: formatSecondsToHHMMSS(totalSeconds)
    }
  }

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user ? user.name : 'Unknown User'
  }

  const clearFilters = () => {
    setUserFilter('all')
    setStartDateFilter('')
    setEndDateFilter('')
    setSearchTerm('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => navigate('/clients')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Clients
          </button>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-900 dark:text-gray-100">Client not found</p>
          <button
            onClick={() => navigate('/clients')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Clients
          </button>
        </div>
      </div>
    )
  }

  const timeData = getClientTimeData()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Back to clients"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{client.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">Client Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/clients/edit/${client.id}`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Edit className="h-4 w-4" />
            <span>Edit Client</span>
          </button>
          <button
            onClick={handleDeleteClient}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Building2 className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{client.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{client.company || 'No company specified'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Email</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Phone</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Address</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.address || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Billing Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Client Type</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.clientType || 'full-time')}`}>
                      {getClientTypeIcon(client.clientType || 'full-time')} {(client.clientType || 'full-time').replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Hourly Rate</span>
                    {currentUser && canViewHourlyRates(currentUser.role) ? (
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(client.hourlyRate || 0, client.currency)}</span>
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-gray-100">--</span>
                    )}
                  </div>
                  {(client.clientType || 'full-time') === 'custom' && client.hoursPerWeek && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Hours/Week</span>
                      <span className="text-gray-900 dark:text-gray-100">{client.hoursPerWeek}h</span>
                    </div>
                  )}
                  {(client.clientType || 'full-time') === 'gig' && client.startDate && client.endDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Contract Duration</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {format(client.startDate, 'MMM dd, yyyy')} - {format(client.endDate, 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Location Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Country</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.country || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Timezone</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.timezone || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {timeData && timeData.totalHours > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Time Tracking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Total Time</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{timeData.formattedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Billable Amount</span>
                      {currentUser && canViewHourlyRates(currentUser.role) ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(timeData.billableAmount, client.currency)}</span>
                      ) : (
                        <span className="font-semibold text-green-600 dark:text-green-400">--</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Time Entries</span>
                      <span className="text-gray-900 dark:text-gray-100">{timeData.timeEntries}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Time Entries */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Time Entries ({filteredTimeEntries.length})
                  </h2>
                </div>
                
                {/* Filters */}
                <div className="mt-4 md:mt-0 flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="all">All Users</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                  
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Start Date"
                  />
                  
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="End Date"
                  />
                  
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
            
            {filteredTimeEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700">
                        Billable
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTimeEntries.map((entry) => {
                      const project = projects.find(p => p.id === entry.projectId)
                      
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {getUserName(entry.userId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {project?.name || 'Unknown Project'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {entry.startTime ? format(new Date(entry.startTime), 'MMM dd, yyyy') : 'No Date'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatDurationToHHMMSS(entry.duration)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {entry.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {entry.isBillable ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No time entries</h3>
                <p className="text-gray-500">No time entries match the current filters.</p>
              </div>
            )}
            
            {timeData && timeData.totalHours > 0 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{filteredTimeEntries.length}</span> time entries • 
                  <span className="font-medium ml-1">{formatDurationToHHMMSS(
                    filteredTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
                  )}</span> total time • 
                  <span className="font-medium ml-1">{formatDurationToHHMMSS(
                    filteredTimeEntries.filter(e => e.isBillable).reduce((sum, e) => sum + e.duration, 0)
                  )}</span> billable time
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}