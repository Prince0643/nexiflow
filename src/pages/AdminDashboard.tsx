import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, 
  Calendar, 
  Clock, 
  BarChart3, 
  Users, 
  FolderOpen, 
  Building2, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Filter, 
  Download, 
  Play, 
  Square, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  X,
  User as UserIcon,
  StopCircle,
  Info,
  RefreshCw
} from 'lucide-react'
import { format, parseISO, isValid, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, eachDayOfInterval } from 'date-fns'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
// Replace the direct MySQL service imports with API service imports
import { adminUsersAPI as userService } from '../services/adminApiService'
import { adminTimeEntriesAPI as timeEntryService } from '../services/adminApiService'
import { adminProjectsAPI as projectService } from '../services/adminApiService'
import { adminClientsAPI as clientService } from '../services/adminApiService'
import { adminTeamsAPI as teamService } from '../services/adminApiService'
import { User as UserType, TimeEntry, Project, Client, Team } from '../types'
import UserDetailsModal from '../components/admin/UserDetailsModal'
import TimeEntryEditModal from '../components/admin/TimeEntryEditModal'
import UserCreateModal from '../components/admin/UserCreateModal'
import UserEditModal from '../components/admin/UserEditModal'
import StopTimerModal from '../components/admin/StopTimerModal'
import SimpleChart from '../components/charts/SimpleChart'
import { formatDurationToHHMMSS } from '../utils'
import { getRoleDisplayName, canAccessFeature } from '../utils/permissions'

// Add interface for undo actions
interface UndoAction {
  id: string;
  type: 'delete-user' | 'delete-time-entry' | 'edit-user' | 'edit-time-entry';
  data: any;
  timeoutId: NodeJS.Timeout;
}

export default function AdminDashboard() {
  const { currentUser, currentCompany } = useMySQLAuth()
  const navigate = useNavigate()

  // Redirect root users to the root dashboard
  useEffect(() => {
    if (currentUser?.role === 'root') {
      navigate('/root')
    }
  }, [currentUser, navigate])
  const [users, setUsers] = useState<UserType[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [runningTimeEntries, setRunningTimeEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'all' | 'custom'>('week')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'time-entries' | 'projects' | 'billing'>('overview')
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserType | null>(null)
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null)
  const [isTimeEntryEditModalOpen, setIsTimeEntryEditModalOpen] = useState(false)
  const [stoppingTimeEntry, setStoppingTimeEntry] = useState<TimeEntry | null>(null)
  const [isStopTimerModalOpen, setIsStopTimerModalOpen] = useState(false)
  const [error, setError] = useState('')
  // Add undo state
  const [undoActions, setUndoActions] = useState<UndoAction[]>([])
  const [showUndoNotification, setShowUndoNotification] = useState(false)
  const [currentUndoAction, setCurrentUndoAction] = useState<UndoAction | null>(null)

  useEffect(() => {
    if (currentUser?.role && ['admin', 'hr', 'super_admin', 'root'].includes(currentUser.role)) {
      loadData()
    }
  }, [currentUser])

  // Periodically refresh running timers
  useEffect(() => {
    if (currentUser?.role && ['admin', 'hr', 'super_admin', 'root'].includes(currentUser.role)) {
      const interval = setInterval(() => {
        // Only refresh running timers periodically
        loadRunningTimeEntries()
      }, 30000) // Refresh every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [currentUser])

  const loadRunningTimeEntries = async () => {
    try {
      const runningEntries = await timeEntryService.getAllRunningTimeEntries(currentUser?.companyId || null)
      setRunningTimeEntries(runningEntries)
    } catch (error) {
      console.error('Error refreshing running timers:', error)
    }
  }

  const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>()
    const result: T[] = []
    for (const item of items) {
      if (!item?.id) continue
      if (seen.has(item.id)) continue
      seen.add(item.id)
      result.push(item)
    }
    return result
  }

  const loadData = async () => {
    try {
      setLoading(true)
      console.log('Loading admin data...')
      
      // Use company-scoped user fetching for proper multi-tenancy
      let usersData: UserType[]
      if (currentUser?.role === 'root') {
        // Root can see all users across all companies
        usersData = await userService.getAllUsers()
      } else {
        // Company admins can only see users from their company
        usersData = await userService.getUsersForCompany(currentUser?.companyId || null)
      }
      
      const [timeEntriesData, runningTimeEntriesData, projectsData, clientsData, teamsData] = await Promise.all([
        timeEntryService.getAllTimeEntries(),
        timeEntryService.getAllRunningTimeEntries(currentUser?.companyId || null),
        projectService.getProjectsForCompany(currentUser?.companyId || null),
        clientService.getClientsForCompany(currentUser?.companyId || null), // Fixed: use clientService instead of projectService
        teamService.getTeamsForCompany(currentUser?.companyId || null)
      ])
      
      // Company scoping for non-root roles: restrict to same company data
      let scopedTimeEntries = timeEntriesData
      let scopedRunningTimeEntries = runningTimeEntriesData
      let scopedProjects = projectsData
      let scopedClients = clientsData
      let scopedTeams = teamsData
      if (currentUser?.role !== 'root' && currentUser?.companyId) {
        const allowedUsers = new Set(usersData.map(u => u.id))
        scopedTimeEntries = timeEntriesData.filter((te: TimeEntry) => te.userId && allowedUsers.has(te.userId))
        scopedRunningTimeEntries = runningTimeEntriesData.filter((te: TimeEntry) => te.userId && allowedUsers.has(te.userId))
        // Filter by company
        scopedProjects = projectsData.filter((p: Project) => (p as any).companyId === currentUser?.companyId)
        scopedClients = clientsData.filter((client: Client) => (client as any).companyId === currentUser?.companyId)
        scopedTeams = teamsData.filter((team: Team) => (team as any).companyId === currentUser?.companyId)
      }

      // Filter out time entries with invalid dates
      const validTimeEntries = scopedTimeEntries.filter((entry: any) => {
        // Use startTime as the date field since that's what exists in the data
        const dateField = entry.startTime || entry.createdAt
        if (!dateField) return false
        try {
          // Handle both string and Date object formats
          const date = typeof dateField === 'string' ? parseISO(dateField) : new Date(dateField)
          return isValid(date)
        } catch (error) {
          return false
        }
      })
      
      console.log('Loaded data:', { 
        users: usersData.length, 
        timeEntries: scopedTimeEntries.length,
        validTimeEntries: validTimeEntries.length,
        projects: scopedProjects.length,
        clients: scopedClients.length,
        teams: scopedTeams.length
      })
      
      const uniqueUsers = dedupeById<UserType>(usersData)
      const uniqueProjects = dedupeById<Project>(scopedProjects)
      const uniqueClients = dedupeById<Client>(scopedClients)
      const uniqueTeams = dedupeById<Team>(scopedTeams)

      setUsers(uniqueUsers)
      setTimeEntries(validTimeEntries)
      setRunningTimeEntries(scopedRunningTimeEntries)
      setProjects(uniqueProjects)
      setClients(uniqueClients)
      setTeams(uniqueTeams)
    } catch (error) {
      console.error('Error loading admin data:', error)
      // Set empty arrays as fallback
      setUsers([])
      setTimeEntries([])
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const getFilteredTimeEntries = () => {
    let filtered = timeEntries

    // Filter by user
    if (selectedUser) {
      filtered = filtered.filter((entry: TimeEntry) => entry.userId === selectedUser)
    }
    
    // Filter by client
    if (selectedClient) {
      filtered = filtered.filter((entry: TimeEntry) => entry.clientId === selectedClient)
    }
    
    // Filter by project
    if (selectedProject) {
      filtered = filtered.filter((entry: TimeEntry) => entry.projectId === selectedProject)
    }
    
    // Filter by team (filter users in the team and then filter entries by those users)
    if (selectedTeam) {
      const teamMembers = users.filter(user => user.teamId === selectedTeam).map(user => user.id)
      filtered = filtered.filter((entry: TimeEntry) => entry.userId && teamMembers.includes(entry.userId))
    }
    
    // Filter by date range
    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date
      let endDate: Date
      
      if (dateFilter === 'week') {
        startDate = startOfWeek(now)
        endDate = endOfWeek(now)
      } else if (dateFilter === 'month') {
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
      } else { // custom
        startDate = customStartDate ? new Date(customStartDate) : new Date()
        endDate = customEndDate ? new Date(customEndDate) : new Date()
        // Add one day to include the end date
        endDate = addDays(endDate, 1)
      }
      
      filtered = filtered.filter((entry: TimeEntry) => {
        const entryDate = new Date(entry.startTime)
        return entryDate >= startDate && entryDate <= endDate
      })
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((entry: TimeEntry) => {
        const user = users.find(u => u.id === entry.userId)
        const project = projects.find(p => p.id === entry.projectId)
        const client = clients.find(c => c.id === entry.clientId)
        
        return (
          (user?.name && user.name.toLowerCase().includes(term)) ||
          (project?.name && project.name.toLowerCase().includes(term)) ||
          (client?.name && client.name.toLowerCase().includes(term)) ||
          (entry.description && entry.description.toLowerCase().includes(term))
        )
      })
    }
    
    return filtered
  }

  const getFilteredUsers = () => {
    let filtered = users
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(term) || 
        user.email.toLowerCase().includes(term) ||
        (user.role && user.role.toLowerCase().includes(term))
      )
    }
    
    return filtered
  }

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'No Client'
    const client = clients.find(c => c.id === clientId)
    return client ? client.name : 'Unknown Client'
  }

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'No Project'
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  const getUserById = (userId: string) => {
    return users.find(u => u.id === userId)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const calculateTotalDuration = (entries: TimeEntry[]) => {
    return entries.reduce((total, entry) => total + (entry.duration || 0), 0)
  }

  const calculateBillableAmount = (entries: TimeEntry[], hourlyRate: number) => {
    const billableEntries = entries.filter(entry => entry.isBillable)
    const totalBillableDuration = billableEntries.reduce((total, entry) => total + (entry.duration || 0), 0)
    // Convert seconds to hours and multiply by hourly rate
    return (totalBillableDuration / 3600) * hourlyRate
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      await userService.deleteUser(userId)
      setUsers(users.filter(user => user.id !== userId))
      
      // Add to undo actions
      const undoAction: UndoAction = {
        id: Date.now().toString(),
        type: 'delete-user',
        data: { userId },
        timeoutId: setTimeout(() => {
          setUndoActions(prev => prev.filter(action => action.id !== undoAction.id))
        }, 10000) // 10 seconds
      }
      
      setUndoActions(prev => [...prev, undoAction])
      setShowUndoNotification(true)
      setCurrentUndoAction(undoAction)
      
      // Auto-hide notification after 10 seconds
      setTimeout(() => {
        setShowUndoNotification(false)
      }, 10000)
    } catch (error) {
      console.error('Error deleting user:', error)
      setError('Failed to delete user')
    }
  }

  const handleDeleteTimeEntry = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to delete this time entry? This action cannot be undone.')) {
      return
    }

    try {
      await timeEntryService.deleteTimeEntry(entryId)
      setTimeEntries(timeEntries.filter(entry => entry.id !== entryId))
      
      // Add to undo actions
      const undoAction: UndoAction = {
        id: Date.now().toString(),
        type: 'delete-time-entry',
        data: { entryId },
        timeoutId: setTimeout(() => {
          setUndoActions(prev => prev.filter(action => action.id !== undoAction.id))
        }, 10000) // 10 seconds
      }
      
      setUndoActions(prev => [...prev, undoAction])
      setShowUndoNotification(true)
      setCurrentUndoAction(undoAction)
      
      // Auto-hide notification after 10 seconds
      setTimeout(() => {
        setShowUndoNotification(false)
      }, 10000)
    } catch (error) {
      console.error('Error deleting time entry:', error)
      setError('Failed to delete time entry')
    }
  }

  const handleStopTimer = async (entryId: string) => {
    try {
      await timeEntryService.stopTimeEntry(entryId)
      // Reload data to reflect the stopped timer
      await loadData()
    } catch (error) {
      console.error('Error stopping timer:', error)
      setError('Failed to stop timer')
    }
  }

  const handleUndo = (action: UndoAction) => {
    // Clear the timeout
    clearTimeout(action.timeoutId)
    
    // Remove from undo actions
    setUndoActions(prev => prev.filter(a => a.id !== action.id))
    setShowUndoNotification(false)
    
    // TODO: Implement actual undo functionality
    console.log('Undo action:', action)
  }

  const getChartData = () => {
    const filteredEntries = getFilteredTimeEntries()
    const now = new Date()
    let startDate: Date
    let endDate: Date
    
    if (dateFilter === 'week') {
      startDate = startOfWeek(now)
      endDate = endOfWeek(now)
    } else if (dateFilter === 'month') {
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      // Default to last 7 days
      startDate = addDays(now, -6)
      endDate = now
    }
    
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    const data = days.map(day => {
      const dayEntries = filteredEntries.filter(entry => {
        const entryDate = new Date(entry.startTime)
        return entryDate.toDateString() === day.toDateString()
      })
      
      const duration = dayEntries.reduce((total, entry) => total + (entry.duration || 0), 0)
      
      return {
        date: format(day, 'MMM dd'),
        duration: duration / 3600 // Convert to hours
      }
    })
    
    // Convert to the format expected by SimpleChart
    return {
      labels: data.map(item => item.date),
      datasets: [{
        label: 'Hours',
        data: data.map(item => item.duration),
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6'
      }]
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="ml-3 text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  const filteredTimeEntries = getFilteredTimeEntries()
  const filteredUsers = getFilteredUsers()
  const totalDuration = calculateTotalDuration(filteredTimeEntries)
  const chartData = getChartData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your team, time entries, and projects
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('time-entries')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'time-entries'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Clock className="h-4 w-4 inline mr-2" />
            Time Entries ({filteredTimeEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'projects'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <FolderOpen className="h-4 w-4 inline mr-2" />
            Projects ({projects.length})
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-primary-100 dark:bg-primary-900 rounded-md p-3">
                    <Users className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Users
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {users.length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 rounded-md p-3">
                    <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Hours
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {(totalDuration / 3600).toFixed(1)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 rounded-md p-3">
                    <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Active Projects
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {projects.filter(p => !p.isArchived).length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900 rounded-md p-3">
                    <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Active Clients
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {clients.filter(c => !c.isArchived).length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Time Tracking Overview</h3>
            <SimpleChart data={chartData} type="bar" />
          </div>

          {/* Running Timers */}
          {runningTimeEntries.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Running Timers</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          User
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Project
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Description
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Duration
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {runningTimeEntries.map((entry) => {
                        const user = getUserById(entry.userId)
                        return (
                          <tr key={entry.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {user?.name || 'Unknown User'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {getProjectName(entry.projectId)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                              {entry.description || 'No description'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatDurationToHHMMSS(entry.duration)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => {
                                  setStoppingTimeEntry(entry)
                                  setIsStopTimerModalOpen(true)
                                }}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Square className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="sm:flex-none">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="h-10 w-full sm:w-auto inline-flex items-center justify-center px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Team
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.map((user) => {
                    const team = teams.find(t => t.id === user.teamId)
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {user.avatar ? (
                                <img className="h-10 w-10 rounded-full" src={user.avatar} alt="" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  <UserIcon className="h-6 w-6 text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {getRoleDisplayName(user.role)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {team ? team.name : 'No Team'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserForDetails(user)
                                setIsUserDetailsModalOpen(true)
                              }}
                              className="p-1.5 rounded text-primary-600 hover:text-primary-900 hover:bg-primary-50 dark:text-primary-400 dark:hover:text-primary-300 dark:hover:bg-gray-700"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingUser(user)
                                setIsEditModalOpen(true)
                              }}
                              className="p-1.5 rounded text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-gray-700"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 rounded text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-gray-700"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Time Entries Tab */}
      {activeTab === 'time-entries' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="user-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User
                </label>
                <select
                  id="user-filter"
                  className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value || null)}
                >
                  <option value="">All Users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="client-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client
                </label>
                <select
                  id="client-filter"
                  className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={selectedClient || ''}
                  onChange={(e) => setSelectedClient(e.target.value || null)}
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project
                </label>
                <select
                  id="project-filter"
                  className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={selectedProject || ''}
                  onChange={(e) => setSelectedProject(e.target.value || null)}
                >
                  <option value="">All Projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="team-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team
                </label>
                <select
                  id="team-filter"
                  className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={selectedTeam || ''}
                  onChange={(e) => setSelectedTeam(e.target.value || null)}
                >
                  <option value="">All Teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Range
                </label>
                <select
                  id="date-filter"
                  className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {dateFilter === 'custom' && (
                <>
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start-date"
                      className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end-date"
                      className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    placeholder="Search time entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="sm:flex-none">
                <button
                  onClick={loadData}
                  className="h-10 w-full sm:w-auto inline-flex items-center justify-center px-4 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Time Entries Table */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Project
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Duration
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Billable
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTimeEntries.map((entry) => {
                    const user = getUserById(entry.userId)
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {user?.name || 'Unknown User'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {format(new Date(entry.startTime), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {getClientName(entry.clientId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {getProjectName(entry.projectId)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-[28rem]">
                          <div className="truncate" title={entry.description || 'No description'}>
                            {entry.description || 'No description'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDurationToHHMMSS(entry.duration)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {entry.isBillable ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTimeEntry(entry)
                                setIsTimeEntryEditModalOpen(true)
                              }}
                              className="p-1.5 rounded text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-gray-700"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTimeEntry(entry.id)}
                              className="p-1.5 rounded text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-gray-700"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Project
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Priority
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      End Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="h-3 w-3 rounded-full mr-3" 
                            style={{ backgroundColor: project.color || '#3B82F6' }}
                          ></div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {project.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {project.clientName || 'No Client'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          !project.isArchived 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {!project.isArchived ? 'active' : 'archived'}
                        </span>
                      </td>                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          project.priority === 'high' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : project.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {project.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {project.startDate ? format(new Date(project.startDate), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {project.endDate ? format(new Date(project.endDate), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <UserDetailsModal
        isOpen={isUserDetailsModalOpen}
        onClose={() => setIsUserDetailsModalOpen(false)}
        user={selectedUserForDetails}
        allTimeEntries={timeEntries}
        allProjects={projects}
      />

      <UserEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={editingUser}
        currentUserRole={currentUser?.role || 'employee'}
        onSave={async (updatedUser) => {
          try {
            // Update user in database
            await userService.updateUser(updatedUser.id, updatedUser)
            
            // Update user in state
            setUsers(users.map(user => 
              user.id === updatedUser.id ? updatedUser : user
            ))
            
            setIsEditModalOpen(false)
          } catch (error) {
            console.error('Error updating user:', error)
            setError('Failed to update user')
          }
        }}
      />

      <UserCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentUserRole={currentUser?.role || 'employee'}
        onSave={async (newUser) => {
          try {
            // Create user in database
            const createdUser = await userService.createUser(newUser)
            
            // Add user to state
            setUsers([...users, createdUser])
            
            setIsCreateModalOpen(false)
          } catch (error) {
            console.error('Error creating user:', error)
            setError('Failed to create user')
          }
        }}
      />

      <TimeEntryEditModal
        isOpen={isTimeEntryEditModalOpen}
        onClose={() => setIsTimeEntryEditModalOpen(false)}
        timeEntry={editingTimeEntry}
        onSave={async (updatedEntry) => {
          try {
            // Update time entry in database
            await timeEntryService.updateTimeEntry(updatedEntry.id, updatedEntry)
            
            // Update time entry in state
            setTimeEntries(timeEntries.map(entry => 
              entry.id === updatedEntry.id ? updatedEntry : entry
            ))
            
            setIsTimeEntryEditModalOpen(false)
          } catch (error) {
            console.error('Error updating time entry:', error)
            setError('Failed to update time entry')
          }
        }}
        onDelete={(entryId) => {
          setTimeEntries(timeEntries.filter(entry => entry.id !== entryId))
        }}
      />

      <StopTimerModal
        isOpen={isStopTimerModalOpen}
        onClose={() => setIsStopTimerModalOpen(false)}
        timeEntry={stoppingTimeEntry}
        projects={projects}
        clients={clients}
        onStopTimer={async (entryId, updates) => {
          if (stoppingTimeEntry) {
            await handleStopTimer(stoppingTimeEntry.id)
            setIsStopTimerModalOpen(false)
          }
        }}
      />

      {/* Undo Notification */}
      {showUndoNotification && currentUndoAction && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-sm text-gray-900 dark:text-white">
              {currentUndoAction.type === 'delete-user' ? 'User deleted' : 'Time entry deleted'}
            </span>
            <button
              onClick={() => handleUndo(currentUndoAction)}
              className="ml-4 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Undo
            </button>
            <button
              onClick={() => setShowUndoNotification(false)}
              className="ml-4 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}