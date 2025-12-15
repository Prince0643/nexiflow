import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Users, 
  Crown, 
  UserPlus,
  Edit,
  Trash2,
  BarChart3,
  Clock,
  TrendingUp,
  Calendar,
  DollarSign,
  Activity,
  ArrowLeft,
  Filter,
  Search,
  Tag,
  FileText
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { teamService } from '../services/teamService'
import { timeEntryService } from '../services/timeEntryService'
import { Team, TeamMember, TeamStats, TimeEntry } from '../types'
import TeamMemberModal from '../components/teams/TeamMemberModal'
import SimpleChart from '../components/charts/SimpleChart'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import { formatSecondsToHHMMSS } from '../utils'

export default function TeamDetails() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [timeFilter, setTimeFilter] = useState<'this-week' | 'last-week' | 'this-month' | 'custom'>('this-week')
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [isLeader, setIsLeader] = useState(false);
  
  // Time entries states
  const [teamTimeEntries, setTeamTimeEntries] = useState<TimeEntry[]>([])
  const [filteredTimeEntries, setFilteredTimeEntries] = useState<TimeEntry[]>([])
  const [timeEntriesLoading, setTimeEntriesLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [billableFilter, setBillableFilter] = useState<'all' | 'billable' | 'non-billable'>('all')

  useEffect(() => {
    if (teamId && currentUser?.uid) {
      checkTeamLeadership();
    }
  }, [teamId, currentUser?.uid]);

  const checkTeamLeadership = async () => {
    if (!teamId || !currentUser?.uid) return;
    
    const isTeamLeader = await teamService.isUserTeamLeader(currentUser.uid, teamId);
    setIsLeader(isTeamLeader);
  };

  useEffect(() => {
    if (teamId) {
      loadData()
    }
  }, [teamId])

  useEffect(() => {
    if (teamId && teamMembers.length > 0) {
      loadTeamTimeEntries()
    }
  }, [teamId, teamMembers])

  useEffect(() => {
    applyFilters()
  }, [teamTimeEntries, searchTerm, projectFilter, memberFilter, billableFilter])

  // Add this useEffect to update team stats and time entries when time filter changes
  useEffect(() => {
    if (teamId && team) {
      updateTeamStatsAndTimeEntries()
    }
  }, [timeFilter, customStartDate, customEndDate])

  const loadData = async () => {
    if (!teamId) return
    
    setLoading(true)
    try {
      // Load team details
      const teamData = await teamService.getTeamById(teamId)
      setTeam(teamData)
      
      // Load team members
      const members = await teamService.getTeamMembers(teamId)
      setTeamMembers(members)
      
      // Load team stats
      const { startDate, endDate } = getDateRange()
      const stats = await teamService.getTeamStats(teamId, startDate, endDate)
      setTeamStats(stats)
    } catch (error) {
      setError('Failed to load team details')
      console.error('Error loading team details:', error)
    } finally {
      setLoading(false)
    }
  }

  // Add this function to update team stats and time entries when time filter changes
  const updateTeamStatsAndTimeEntries = async () => {
    if (!teamId || !team) return
    
    try {
      // Update team stats
      const { startDate, endDate } = getDateRange()
      const stats = await teamService.getTeamStats(teamId, startDate, endDate)
      setTeamStats(stats)
      
      // Update time entries
      await loadTeamTimeEntries()
    } catch (error) {
      console.error('Error updating team stats and time entries:', error)
    }
  }

  const loadTeamTimeEntries = async () => {
    if (!teamId || teamMembers.length === 0) return
    
    setTimeEntriesLoading(true)
    try {
      // Get all time entries for the date range
      const { startDate, endDate } = getDateRange()
      const allTimeEntries = await timeEntryService.getAllTimeEntriesByDateRange(startDate, endDate)
      
      // Filter time entries for team members only
      const teamMemberIds = teamMembers.map(member => member.userId)
      const entries = allTimeEntries.filter(entry => teamMemberIds.includes(entry.userId))
      
      setTeamTimeEntries(entries)
    } catch (error) {
      console.error('Error loading team time entries:', error)
    } finally {
      setTimeEntriesLoading(false)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (timeFilter) {
      case 'this-week':
        startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'last-week':
        const lastWeek = subWeeks(now, 1)
        startDate = startOfWeek(lastWeek, { weekStartsOn: 1 })
        endDate = endOfWeek(lastWeek, { weekStartsOn: 1 })
        break
      case 'this-month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'custom':
        startDate = customStartDate
        endDate = customEndDate
        // Fix for date range filtering: set start date to beginning of day and end date to end of day
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        startDate = startOfWeek(now, { weekStartsOn: 1 })
        endDate = endOfWeek(now, { weekStartsOn: 1 })
    }

    return { startDate, endDate }
  }

  const applyFilters = () => {
    let filtered = [...teamTimeEntries]
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(entry => 
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.projectName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(entry => entry.projectId === projectFilter)
    }
    
    // Member filter
    if (memberFilter !== 'all') {
      filtered = filtered.filter(entry => entry.userId === memberFilter)
    }
    
    // Billable filter
    if (billableFilter !== 'all') {
      filtered = filtered.filter(entry => 
        billableFilter === 'billable' ? entry.isBillable : !entry.isBillable
      )
    }
    
    setFilteredTimeEntries(filtered)
  }

  const handleAddMember = () => {
    setSelectedMember(null)
    setShowMemberModal(true)
  }

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member)
    setShowMemberModal(true)
  }

  const handleRemoveMember = async (member: TeamMember) => {
    if (!teamId) return
    
    if (window.confirm(`Are you sure you want to remove "${member.userName}" from the team?`)) {
      try {
        await teamService.removeTeamMember(teamId, member.userId)
        loadData()
      } catch (error) {
        setError('Failed to remove team member')
      }
    }
  }

  const isUserSuperAdmin = () => {
    return currentUser?.role === 'root' || currentUser?.role === 'admin';
  };

  const canManageTeam = () => {
    return isLeader;
  };

  const canViewTeamDetails = () => {
    return isLeader || isUserSuperAdmin();
  };

  const getMemberName = (userId: string) => {
    const member = teamMembers.find(m => m.userId === userId)
    return member ? member.userName : 'Unknown User'
  }

  const getUniqueProjects = () => {
    const projects = new Map<string, string>()
    teamTimeEntries.forEach(entry => {
      if (entry.projectId && entry.projectName) {
        projects.set(entry.projectId, entry.projectName)
      }
    })
    return Array.from(projects.entries())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading team details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="p-4 bg-red-50 dark:bg-red-900 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/teams')}
            className="btn-primary"
          >
            Back to Teams
          </button>
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Team Not Found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">The requested team could not be found.</p>
          <button
            onClick={() => navigate('/teams')}
            className="btn-primary"
          >
            Back to Teams
          </button>
        </div>
      </div>
    )
  }

  const timeData = teamStats || {
    totalMembers: 0,
    activeMembers: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    totalTimeLogged: 0,
    averageTaskCompletion: 0,
    totalHours: 0,
    billableHours: 0,
    nonBillableHours: 0,
    totalTimeEntries: 0,
    averageHoursPerMember: 0,
    mostActiveMember: undefined,
    timeByProject: []
  }

  const uniqueProjects = getUniqueProjects()
  const totalFilteredTime = filteredTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/teams')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{team.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Team details and analytics</p>
          </div>
        </div>
        
        {canManageTeam() && (
          <button
            onClick={() => navigate(`/teams/${team.id}/edit`)}
            className="btn-primary flex items-center space-x-2"
          >
            <Edit className="h-4 w-4" />
            <span>Edit Team</span>
          </button>
        )}
      </div>

      {/* Team Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Led by {team.leaderName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Crown className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Team Leader</span>
          </div>
        </div>
        
        {team.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {team.description}
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{timeData.totalMembers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{timeData.activeMembers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatSecondsToHHMMSS(timeData.totalHours * 3600)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <DollarSign className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Billable Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatSecondsToHHMMSS(timeData.billableHours * 3600)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Time Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col lg:flex-row gap-4 flex-1">
            {/* Time Period Filter */}
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="this-week">This Week</option>
                <option value="last-week">Last Week</option>
                <option value="this-month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Range */}
            {timeFilter === 'custom' && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={customStartDate.toISOString().split('T')[0]}
                  onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <span className="text-gray-500 dark:text-gray-400">to</span>
                <input
                  type="date"
                  value={customEndDate.toISOString().split('T')[0]}
                  onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            )}
          </div>

          {/* Period Display */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {timeFilter === 'this-week' && 'This Week'}
            {timeFilter === 'last-week' && 'Last Week'}
            {timeFilter === 'this-month' && 'This Month'}
            {timeFilter === 'custom' && `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd, yyyy')}`}
          </div>
        </div>
      </div>

      {/* Time Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Time Analytics</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Total Hours</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Billable Hours</span>
            </div>
          </div>
        </div>
        <SimpleChart
          data={{
            labels: ['Total Hours', 'Billable Hours', 'Non-Billable Hours'],
            datasets: [
              {
                label: 'Hours',
                data: [timeData.totalHours, timeData.billableHours, timeData.nonBillableHours],
                backgroundColor: [
                  'rgba(59, 130, 246, 0.5)',
                  'rgba(34, 197, 94, 0.5)',
                  'rgba(251, 191, 36, 0.5)'
                ],
                borderColor: [
                  'rgba(59, 130, 246, 1)',
                  'rgba(34, 197, 94, 1)',
                  'rgba(251, 191, 36, 1)'
                ],
              }
            ]
          }}
          type="bar"
          height={300}
        />
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Members</h3>
          {isLeader && (
            <button
              onClick={handleAddMember}
              className="btn-primary flex items-center space-x-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Member</span>
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-800 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-300">
                    {member.userName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{member.userName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{member.userEmail}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {member.teamRole === 'leader' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                    <Crown className="h-3 w-3 mr-1" />
                    Leader
                  </span>
                )}
                {isLeader && (
                  <button
                    onClick={() => handleEditMember(member)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
                {isLeader && member.teamRole !== 'leader' && (
                  <>
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Time Entries Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Time Entries</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total: {formatSecondsToHHMMSS(totalFilteredTime)}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search descriptions or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>

          {/* Project Filter */}
          <div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Projects</option>
              {uniqueProjects.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Member Filter */}
          <div>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Members</option>
              {teamMembers.map(member => (
                <option key={member.userId} value={member.userId}>{member.userName}</option>
              ))}
            </select>
          </div>

          {/* Billable Filter */}
          <div>
            <select
              value={billableFilter}
              onChange={(e) => setBillableFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Entries</option>
              <option value="billable">Billable Only</option>
              <option value="non-billable">Non-Billable Only</option>
            </select>
          </div>
        </div>

        {/* Time Entries List */}
        {timeEntriesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading time entries...</p>
            </div>
          </div>
        ) : filteredTimeEntries.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Clock className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No time entries found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {teamTimeEntries.length === 0 
                ? "No time entries recorded for this team in the selected period" 
                : "No time entries match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Member</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Project</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Billable</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                      {getMemberName(entry.userId)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {entry.projectName ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          <FileText className="h-3 w-3 mr-1" />
                          {entry.projectName}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">No Project</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                      {entry.description || <span className="text-gray-500 dark:text-gray-400">No description</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(entry.startTime), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatSecondsToHHMMSS(entry.duration)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {entry.isBillable ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Member Modal */}
      <TeamMemberModal
        isOpen={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        onSuccess={loadData}
        teamId={team.id}
        member={selectedMember}
      />
    </div>
  )
}