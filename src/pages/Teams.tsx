import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Users, 
  Crown, 
  MoreVertical, 
  Edit, 
  Trash2, 
  UserPlus,
  Settings,
  BarChart3,
  Clock,
  TrendingUp,
  Filter,
  Calendar,
  DollarSign,
  Activity
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { teamService } from '../services/teamService'
import { Team, TeamMember, TeamStats } from '../types'
import TeamModal from '../components/teams/TeamModal'
import TeamMemberModal from '../components/teams/TeamMemberModal'
import SimpleChart from '../components/charts/SimpleChart'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import { formatSecondsToHHMMSS } from '../utils'

export default function Teams() {
  const { currentUser } = useMySQLAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamMembers, setTeamMembers] = useState<{ [teamId: string]: TeamMember[] }>({})
  const [teamStats, setTeamStats] = useState<{ [teamId: string]: TeamStats }>({})
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false) // Add chart loading state
  const [searchTerm, setSearchTerm] = useState('')
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [error, setError] = useState('')
  
  // Time tracking states
  const [timeFilter, setTimeFilter] = useState<'this-week' | 'last-week' | 'this-month' | 'custom'>('this-week')
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [showTimeChart, setShowTimeChart] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const chartRef = useRef<HTMLDivElement>(null)
  
  // Team filter states
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [showTeamFilter, setShowTeamFilter] = useState(false)
  const [leaderFilter, setLeaderFilter] = useState<string>('all')
  const [memberCountFilter, setMemberCountFilter] = useState<string>('all')
  const [activityFilter, setActivityFilter] = useState<string>('all')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  
  // Team leadership states
  const [teamLeadership, setTeamLeadership] = useState<{ [teamId: string]: boolean }>({})

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (teams.length > 0 && currentUser?.uid) {
      // Load leadership status for all teams
      loadTeamLeadership()
    }
  }, [teams, currentUser?.uid])

  useEffect(() => {
    if (teams.length > 0) {
      // Only load stats automatically when the component first loads or when teams change
      // Don't load stats automatically when time filter changes
      if (Object.keys(teamStats).length === 0) {
        loadTeamStats()
      }
    }
  }, [teams])

  const loadData = async () => {
    setLoading(true)
    try {
      // Use company-scoped team loading for multi-tenant isolation
      const teamsData = currentUser?.companyId 
        ? await teamService.getTeamsForCompany(currentUser.companyId)
        : await teamService.getTeams()
      setTeams(teamsData)

      // Load members for each team
      const membersData: { [teamId: string]: TeamMember[] } = {}
      for (const team of teamsData) {
        const members = await teamService.getTeamMembers(team.id)
        membersData[team.id] = members
      }
      setTeamMembers(membersData)
    } catch (error) {
      setError('Failed to load teams')
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamLeadership = async () => {
    if (!currentUser?.uid) return;
    
    const leadershipData: { [teamId: string]: boolean } = {}
    for (const team of teams) {
      leadershipData[team.id] = await teamService.isUserTeamLeader(currentUser.uid, team.id)
    }
    setTeamLeadership(leadershipData)
  }

  const loadTeamStats = async () => {
    try {
      // Load stats for the current week by default (no date range specified)
      const statsData: { [teamId: string]: TeamStats } = {}

      for (const team of teams) {
        const stats = await teamService.getTeamStats(team.id)
        statsData[team.id] = stats
      }

      setTeamStats(statsData)
    } catch (error) {
      console.error('Error loading team stats:', error)
    }
  }

  // Create a separate function for loading chart data with loading state
  const loadChartStats = async () => {
    if (!showTimeChart) return;
    
    setChartLoading(true)
    try {
      const { startDate, endDate } = getDateRange()
      const statsData: { [teamId: string]: TeamStats } = {}

      for (const team of teams) {
        const stats = await teamService.getTeamStats(team.id, startDate, endDate)
        statsData[team.id] = stats
      }

      setTeamStats(statsData)
    } catch (error) {
      console.error('Error loading team stats:', error)
    } finally {
      setChartLoading(false)
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

  const handleCreateTeam = () => {
    setSelectedTeam(null)
    setShowTeamModal(true)
  }

  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team)
    setShowTeamModal(true)
  }

  const handleDeleteTeam = async (team: Team) => {
    if (window.confirm(`Are you sure you want to delete "${team.name}"?`)) {
      try {
        await teamService.deleteTeam(team.id)
        loadData()
      } catch (error) {
        setError('Failed to delete team')
      }
    }
  }

  const handleAddMember = (team: Team) => {
    setSelectedTeam(team)
    setSelectedMember(null)
    setShowMemberModal(true)
  }

  const handleEditMember = (team: Team, member: TeamMember) => {
    setSelectedTeam(team)
    setSelectedMember(member)
    setShowMemberModal(true)
  }

  const handleRemoveMember = async (team: Team, member: TeamMember) => {
    if (window.confirm(`Are you sure you want to remove "${member.userName}" from the team?`)) {
      try {
        await teamService.removeTeamMember(team.id, member.userId)
        loadData()
      } catch (error) {
        setError('Failed to remove team member')
      }
    }
  }

  const getTeamTimeData = (team: Team) => {
    const stats = teamStats[team.id]
    if (!stats) return { totalHours: 0, totalTimeEntries: 0 }
    
    return {
      totalHours: stats.totalHours,
      totalTimeEntries: stats.totalTimeEntries,
      averageHoursPerMember: stats.averageHoursPerMember,
      mostActiveMember: stats.mostActiveMember
    }
  }

  const getTimeChartData = () => {
    const chartData = teams.map(team => {
      const timeData = getTeamTimeData(team)
      return {
        name: team.name,
        hours: timeData.totalHours
      }
    }).filter(data => data.hours > 0)

    return {
      labels: chartData.map(item => item.name),
      datasets: [
        {
          label: 'Total Hours',
          data: chartData.map(item => item.hours),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
        }
      ]
    }
  }

  const getOverallStats = () => {
    const totalHours = teams.reduce((sum, team) => {
      const timeData = getTeamTimeData(team)
      return sum + timeData.totalHours
    }, 0)

    const totalTimeEntries = teams.reduce((sum, team) => {
      const timeData = getTeamTimeData(team)
      return sum + timeData.totalTimeEntries
    }, 0)

    const activeTeams = teams.filter(team => {
      const timeData = getTeamTimeData(team)
      return timeData.totalHours > 0
    }).length

    // Find the most active team (team with the most hours)
    let mostActiveTeam: Team | null = null
    let maxHours = 0
    teams.forEach(team => {
      const timeData = getTeamTimeData(team)
      if (timeData.totalHours > maxHours) {
        maxHours = timeData.totalHours
        mostActiveTeam = team
      }
    })

    return {
      totalHours,
      totalTimeEntries,
      activeTeams,
      mostActiveTeam,
      mostActiveTeamHours: maxHours
    }
  }

  const getPeriodText = () => {
    switch (timeFilter) {
      case 'this-week':
        return 'This Week'
      case 'last-week':
        return 'Last Week'
      case 'this-month':
        return 'This Month'
      case 'custom':
        return `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd, yyyy')}`
      default:
        return 'This Week'
    }
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (teamFilter !== 'all') count++
    if (leaderFilter !== 'all') count++
    if (memberCountFilter !== 'all') count++
    if (activityFilter !== 'all') count++
    if (searchTerm.trim() !== '') count++
    return count
  }

  const isUserTeamLeader = (teamId: string) => {
    return teamLeadership[teamId] || false;
  }

  const isUserSuperAdmin = () => {
    return currentUser?.role === 'root' || currentUser?.role === 'admin';
  }

  const canViewTeamDetails = (teamId: string) => {
    // Team leaders and super admins can view team details
    return isUserTeamLeader(teamId) || isUserSuperAdmin();
  }

  const canManageTeam = (teamId: string) => {
    // Only team leaders can manage teams (edit/delete)
    return isUserTeamLeader(teamId);
  }

  const toggleDropdown = (teamId: string) => {
    setOpenDropdown(openDropdown === teamId ? null : teamId);
  }

  const closeDropdown = () => {
    setOpenDropdown(null);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        const target = event.target as Element
        if (!target.closest('.dropdown-container')) {
          closeDropdown()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdown])

  const handleApplyFilters = () => {
    loadChartStats()
  }

  const filteredTeams = teams.filter(team => {
    // Search filter
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Team filter
    const matchesTeamFilter = teamFilter === 'all' || team.id === teamFilter
    
    // Leader filter
    const matchesLeaderFilter = leaderFilter === 'all' || team.leaderId === leaderFilter
    
    // Member count filter
    const members = teamMembers[team.id] || []
    const memberCount = members.length
    let matchesMemberCountFilter = true
    if (memberCountFilter === '1-3') {
      matchesMemberCountFilter = memberCount >= 1 && memberCount <= 3
    } else if (memberCountFilter === '4-6') {
      matchesMemberCountFilter = memberCount >= 4 && memberCount <= 6
    } else if (memberCountFilter === '7+') {
      matchesMemberCountFilter = memberCount >= 7
    }
    
    // Activity filter
    const timeData = getTeamTimeData(team)
    let matchesActivityFilter = true
    if (activityFilter === 'active') {
      matchesActivityFilter = timeData.totalHours > 0
    } else if (activityFilter === 'inactive') {
      matchesActivityFilter = timeData.totalHours === 0
    }
    
    return matchesSearch && matchesTeamFilter && matchesLeaderFilter && matchesMemberCountFilter && matchesActivityFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading teams...</p>
        </div>
      </div>
    )
  }

  const overallStats = getOverallStats()
  const chartData = getTimeChartData()

  return (
    <div className="p-6 space-y-6 scrollbar-visible">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Teams</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your teams and track their productivity</p>
        </div>
        
        <button
          onClick={handleCreateTeam}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create Team</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Teams</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{teams.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Teams</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overallStats.activeTeams}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Most Active Team</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {overallStats.mostActiveTeam ? (overallStats.mostActiveTeam as Team).name : 'N/A'}
              </p>
              {overallStats.mostActiveTeam && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatSecondsToHHMMSS(overallStats.mostActiveTeamHours * 3600)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Time Filter and Chart Toggle */}
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

            {/* Apply Filter Button */}
            {showTimeChart && (
              <button
                onClick={handleApplyFilters}
                disabled={chartLoading}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {chartLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Filter className="h-4 w-4" />
                    <span>Apply Filter</span>
                  </>
                )}
              </button>
            )}

            {/* Chart Toggle */}
            <button
              onClick={() => setShowTimeChart(!showTimeChart)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showTimeChart 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>{showTimeChart ? 'Hide Chart' : 'Show Time Chart'}</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
              >
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Period Display */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {getPeriodText()}
          </div>
        </div>
      </div>

      {/* Time Chart */}
      {showTimeChart && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" ref={chartRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Time Rendered</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Total Hours</span>
              </div>
            </div>
          </div>
          {chartLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading chart data...</p>
              </div>
            </div>
          ) : chartData.labels.length > 0 ? (
            <SimpleChart
              data={chartData}
              type="bar"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No time data available for the selected period
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Try selecting a different time period or check back later
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
          <Users className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search teams by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>

          {/* Team Filter */}
          <div className="lg:w-64">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowTeamFilter(!showTeamFilter)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              showTeamFilter 
                ? 'bg-primary-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {getActiveFilterCount()}
              </span>
            )}
          </button>
        </div>

        {/* Advanced Filters */}
        {showTeamFilter && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Team Leader Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Leader
                </label>
                <select 
                  value={leaderFilter}
                  onChange={(e) => setLeaderFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Leaders</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.leaderId}>
                      {team.leaderName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Count Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Member Count
                </label>
                <select 
                  value={memberCountFilter}
                  onChange={(e) => setMemberCountFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">Any Size</option>
                  <option value="1-3">1-3 Members</option>
                  <option value="4-6">4-6 Members</option>
                  <option value="7+">7+ Members</option>
                </select>
              </div>

              {/* Activity Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Activity Level
                </label>
                <select 
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Teams</option>
                  <option value="active">Active (with time entries)</option>
                  <option value="inactive">Inactive (no time entries)</option>
                </select>
              </div>
            </div>
            
            {/* Clear Filters Button */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredTeams.length} of {teams.length} teams
                </div>
                <button
                  onClick={() => {
                    setTeamFilter('all')
                    setLeaderFilter('all')
                    setMemberCountFilter('all')
                    setActivityFilter('all')
                    setSearchTerm('')
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No teams found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm 
              ? 'Try adjusting your search'
              : 'Get started by creating your first team'
            }
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreateTeam}
              className="btn-primary"
            >
              Create Team
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => {
            const members = teamMembers[team.id] || []
            const stats = teamStats[team.id]
            const isLeader = isUserTeamLeader(team.id)
            
            return (
              <div key={team.id} className="card hover:shadow-md transition-shadow">
                {/* Team Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{team.leaderName}</p>
                    </div>
                  </div>
                  <div className="relative dropdown-container">
                    <button 
                      onClick={() => toggleDropdown(team.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openDropdown === team.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
                        {canManageTeam(team.id) ? (
                          <>
                            <button
                              onClick={() => {
                                handleEditTeam(team);
                                closeDropdown();
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                            >
                              <Edit className="h-4 w-4" />
                              <span>Edit Team</span>
                            </button>
                            <div className="border-t border-gray-100 dark:border-gray-600 my-1"></div>
                            <button
                              onClick={() => {
                                handleDeleteTeam(team);
                                closeDropdown();
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition-colors flex items-center space-x-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete Team</span>
                            </button>
                          </>
                        ) : canViewTeamDetails(team.id) ? (
                          <button
                            onClick={() => {
                              // Navigate to team details page
                              navigate(`/teams/${team.id}`);
                              closeDropdown();
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                          >
                            <BarChart3 className="h-4 w-4" />
                            <span>View Details</span>
                          </button>
                        ) : (
                          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            Only team leaders can manage teams
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Description */}
                {team.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                    {team.description}
                  </p>
                )}

                {/* Team Stats */}
                {stats && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalMembers}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalTasks}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tasks</p>
                    </div>
                  </div>
                )}

                {/* Time Tracking Stats */}
                {(() => {
                  const timeData = getTeamTimeData(team)
                  return timeData.totalHours > 0 ? (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Time Rendered</h4>
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatSecondsToHHMMSS(timeData.totalHours * 3600)}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Total Time</p>
                      </div>
                      {timeData.mostActiveMember && (
                        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Most Active: <span className="font-medium">{timeData.mostActiveMember.userName}</span> ({formatSecondsToHHMMSS(timeData.mostActiveMember.hours * 3600)})
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Rendered</h4>
                        <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">No time tracked in selected period</p>
                    </div>
                  )
                })()}

                {/* Team Members */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Members</h4>
                    {isLeader && (
                      <button
                        onClick={() => handleAddMember(team)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center space-x-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {members.slice(0, 3).map((member) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-primary-100 dark:bg-primary-800 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-primary-600 dark:text-primary-300">
                              {member.userName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.userName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {member.teamRole === 'leader' && (
                            <Crown className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />
                          )}
                          {isLeader && (
                            <button
                              onClick={() => handleEditMember(team, member)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        +{members.length - 3} more members
                      </p>
                    )}
                  </div>
                </div>

                {/* Team Actions - View Details or Add Member */}
                <div className="flex space-x-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {isLeader && (
                    <button
                      onClick={() => handleAddMember(team)}
                      className="flex-1 px-3 py-2 text-sm border border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900 transition-colors flex items-center justify-center space-x-1"
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>Add Member</span>
                    </button>
                  )}
                  {(isLeader || isUserSuperAdmin()) && (
                    <button
                      onClick={() => {
                        // Navigate to team details page
                        navigate(`/teams/${team.id}`);
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center space-x-1"
                    >
                      <BarChart3 className="h-3 w-3" />
                      <span>View Details</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Team</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Members</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTeams.map((team) => {
                const members = teamMembers[team.id] || []
                const stats = teamStats[team.id]
                const isLeader = isUserTeamLeader(team.id)
                const timeData = getTeamTimeData(team)
                
                return (
                  <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: team.color }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{team.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Led by {team.leaderName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                        {team.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{members.length}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {formatSecondsToHHMMSS(timeData.totalHours * 3600)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => navigate(`/teams/${team.id}`)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-3"
                      >
                        View
                      </button>
                      {isLeader && (
                        <>
                          <button
                            onClick={() => handleEditTeam(team)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <TeamModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        onSuccess={loadData}
        team={selectedTeam}
        onAddMember={handleAddMember}
        onEditMember={handleEditMember}
      />
      
      <TeamMemberModal
        isOpen={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        onSuccess={loadData}
        teamId={selectedTeam?.id || ''}
        member={selectedMember}
      />
    </div>
  )
}

