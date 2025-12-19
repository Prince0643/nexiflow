import { useState, useEffect, useMemo } from 'react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { taskApiService as taskService } from '../services/taskApiService'
import { userApiService as userService } from '../services/userApiService'
import { teamApiService as teamService } from '../services/teamApiService'
import { Task, TaskStatus, TaskPriority, CreateTaskData, UpdateTaskData, User, Team } from '../types'
import TaskBoard from '../components/taskManagement/TaskBoard'
import TaskTable from '../components/taskManagement/TaskTable'
import TaskModal from '../components/taskManagement/TaskModal'
import TaskViewModal from '../components/taskManagement/TaskViewModal'
import { Filter, Users, User as UserIcon, Building2, Search, X, LayoutGrid, List } from 'lucide-react'
import { canDeleteTask } from '../utils/permissions'

interface TaskViewModalPropsWithDefaultTab extends React.ComponentProps<typeof TaskViewModal> {
  defaultActiveTab?: 'comments' | 'notes'
}

export default function TaskManagement() {
  const { currentUser } = useMySQLAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTaskViewModal, setShowTaskViewModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')
  const [defaultActiveTab, setDefaultActiveTab] = useState<'comments' | 'notes'>('comments')
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')

  // Parse query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      taskId: params.get('taskId'),
      tab: params.get('tab') as 'comments' | 'notes' | null,
      mentionId: params.get('mentionId')
    }
  }, [location.search])

  useEffect(() => {
    loadData()
  }, [])

  // Handle navigation to specific task when query parameters are present
  useEffect(() => {
    if (queryParams.taskId && tasks.length > 0) {
      const taskToOpen = tasks.find(task => task.id === queryParams.taskId)
      if (taskToOpen) {
        setSelectedTask(taskToOpen)
        setShowTaskViewModal(true)
        // Set the default active tab based on query parameter
        if (queryParams.tab) {
          setDefaultActiveTab(queryParams.tab)
        }
        // Remove query parameters from URL after processing
        navigate('/management', { replace: true })
      }
    }
  }, [queryParams, tasks, navigate])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load basic data that all users can access
      const [statusesData, prioritiesData] = await Promise.all([
        taskService.getTaskStatuses(),
        taskService.getTaskPriorities()
      ])
      
      setStatuses(statusesData)
      setPriorities(prioritiesData)
      
      // Load users and teams based on user role
      let usersData: User[] = []
      let teamsData: Team[] = []
      
      if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'hr' || currentUser?.role === 'root') {
        // Use company-scoped data loading for multi-tenant isolation
        try {
          [usersData, teamsData] = await Promise.all([
            currentUser?.companyId 
              ? userService.getUsersForCompany(currentUser.companyId)
              : userService.getAllUsers(),
            currentUser?.companyId 
              ? teamService.getTeamsForCompany(currentUser.companyId)
              : teamService.getAllTeams()
          ])
        } catch (error) {
          console.error('Error loading users or teams:', error)
          // Set empty arrays as fallback
          usersData = []
          teamsData = []
        }
      } else {
        // Regular employees - only load their own user data and teams they're part of
        try {
          const currentUserData = await userService.getUserById(currentUser?.uid || '')
          if (currentUserData) {
            usersData = [currentUserData]
          }
          
          // Try to get teams, but don't fail if permission denied
          try {
            teamsData = currentUser?.companyId 
              ? await teamService.getTeamsForCompany(currentUser.companyId)
              : await teamService.getAllTeams()
          } catch (teamError) {
            console.warn('Could not load teams:', teamError)
            teamsData = []
          }
        } catch (userError) {
          console.warn('Could not load user data:', userError)
          usersData = []
        }
      }
      
      setUsers(usersData)
      setTeams(teamsData)
      
      // Load tasks based on user role and company
      let tasksData: Task[] = []
      
      if (currentUser?.role === 'root') {
        // Root can see all tasks across all companies
        tasksData = await taskService.getTasks()
      } else if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
        // Admin/Super Admin can see all tasks within their company
        tasksData = await taskService.getTasks(undefined, undefined, currentUser?.companyId)
      } else if (currentUser?.role === 'hr' && currentUser?.teamId) {
        // HR can see team tasks within their company
        tasksData = await taskService.getTeamTasks(currentUser.teamId, undefined, currentUser?.companyId)
      } else {
        // Regular users see only their own tasks
        tasksData = await taskService.getTasks(undefined, currentUser?.uid, currentUser?.companyId)
      }
      
      setAllTasks(tasksData)
      setTasks(tasksData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Create updateData with only the fields that should be updated
      const updateData: UpdateTaskData = {}
      
      // Copy over non-status/priority fields that are in UpdateTaskData
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId
      if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate
      if (updates.estimatedHours !== undefined) updateData.estimatedHours = updates.estimatedHours
      if (updates.actualHours !== undefined) updateData.actualHours = updates.actualHours
      if (updates.tags !== undefined) updateData.tags = updates.tags
      if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted
      
      // Handle status and priority
      if (updates.status) {
        updateData.status = typeof updates.status === 'string' ? updates.status : updates.status.id
      }
      
      if (updates.priority) {
        updateData.priority = typeof updates.priority === 'string' ? updates.priority : updates.priority.id
      }
      
      await taskService.updateTask(taskId, updateData)
      
      // Update local state with the new status object
      setTasks(prev => 
        prev.map(task => {
          if (task.id === taskId) {
            const newStatus = updates.status || task.status
            const newPriority = updates.priority || task.priority
            
            return { 
              ...task, 
              ...updates, 
              status: newStatus,
              priority: newPriority,
              updatedAt: new Date() 
            }
          }
          return task
        })
      )
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleCreateTask = () => {
    setSelectedTask(null)
    setShowTaskModal(true)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setShowTaskViewModal(false) // Close the view modal
    setShowTaskModal(true)
  }

  const handleViewTask = (task: Task) => {
    setSelectedTask(task)
    setShowTaskViewModal(true)
    // Reset to default tab when opening a new task
    setDefaultActiveTab('comments')
  }

  const handleTaskSave = async (taskData: CreateTaskData | UpdateTaskData) => {
    try {
      if (selectedTask) {
        // Update existing task
        await taskService.updateTask(selectedTask.id, taskData as UpdateTaskData)
      } else {
        // Create new task with proper company scoping
        if (currentUser) {
          await taskService.createTask(
            taskData as CreateTaskData, 
            currentUser.uid, 
            currentUser.name || 'Unknown User',
            currentUser.companyId
          )
        }
      }
      
      await loadData()
      setShowTaskModal(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('Error saving task:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!currentUser) return;
    
    // Check permissions - only admins, super admins, and task creators can delete
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const canDelete = canDeleteTask(currentUser.role, task.createdBy, currentUser.uid);
    
    if (!canDelete) {
      alert('You do not have permission to delete this task.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      try {
        await taskService.deleteTask(taskId);
        await loadData();
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
      }
    }
  }

  // Filter tasks based on current filters
  const getFilteredTasks = () => {
    let filtered = [...allTasks]

    // Apply user permission filtering first
    if (canSeeAllTasks) {
      // Admins and super admins can see all tasks
      // No additional filtering needed
    } else if (canSeeTeamTasks && currentUser?.teamId) {
      // HR users can see tasks assigned to their team members
      const teamMembers = users.filter(user => user.teamId === currentUser.teamId).map(user => user.id)
      filtered = filtered.filter(task => task.assigneeId && teamMembers.includes(task.assigneeId))
    } else {
      // Regular employees can only see tasks assigned to them
      filtered = filtered.filter(task => task.assigneeId === currentUser?.uid)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.projectName.toLowerCase().includes(query) ||
        task.assigneeName?.toLowerCase().includes(query)
      )
    }

    // User filter
    if (selectedUserId !== 'all') {
      filtered = filtered.filter(task => task.assigneeId === selectedUserId)
    }

    // Team filter
    if (selectedTeamId !== 'all') {
      // Filter by teamId field if available, otherwise fall back to team members
      filtered = filtered.filter(task => {
        if (task.teamId) {
          // If task has a teamId, check if it matches the selected team
          return task.teamId === selectedTeamId
        } else {
          // Fall back to checking team members for backward compatibility
          const teamMembers = users.filter(user => user.teamId === selectedTeamId).map(user => user.id)
          return task.assigneeId && teamMembers.includes(task.assigneeId)
        }
      })
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(task => task.status.id === selectedStatus)
    }

    // Priority filter
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(task => task.priority.id === selectedPriority)
    }

    return filtered
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedUserId('all')
    setSelectedTeamId('all')
    setSelectedStatus('all')
    setSelectedPriority('all')
  }

  // Get user's team members for team leaders
  const getTeamMembers = () => {
    if (currentUser?.teamId) {
      return users.filter(user => user.teamId === currentUser.teamId)
    }
    return []
  }

  // Check if user can see all tasks
  const canSeeAllTasks = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const canSeeTeamTasks = currentUser?.role === 'hr' && currentUser?.teamId

  // Update filtered tasks when filters change
  useEffect(() => {
    const filtered = getFilteredTasks()
    setTasks(filtered)
  }, [searchQuery, selectedUserId, selectedTeamId, selectedStatus, selectedPriority, allTasks])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header with Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Task Management</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {canSeeAllTasks ? 'All Tasks' : canSeeTeamTasks ? 'Team Tasks' : 'My Tasks'} 
              ({tasks.length} of {allTasks.length})
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('board')}
                className={`p-2 rounded-md flex items-center ${
                  viewMode === 'board' 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="ml-1 text-sm">Board</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md flex items-center ${
                  viewMode === 'table' 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <List className="h-4 w-4" />
                <span className="ml-1 text-sm">Table</span>
              </button>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center space-x-2 ${
                showFilters ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ''
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>
            
            <button
              onClick={handleCreateTask}
              className="btn-primary flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search tasks by title, description, project, or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Overview */}
        {showFilters && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Filter Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Tasks */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{allTasks.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
                </div>
                
                {/* Filtered Tasks */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{tasks.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Filtered Tasks</div>
                </div>
                
                {/* Active Filters */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {[searchQuery, selectedUserId, selectedTeamId, selectedStatus, selectedPriority]
                      .filter(filter => filter !== 'all' && filter.trim() !== '').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active Filters</div>
                </div>
                
                {/* Completion Rate */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {allTasks.length > 0 ? Math.round((allTasks.filter(task => task.status.name === 'Done').length / allTasks.length) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</div>
                </div>
              </div>
            </div>
            
            {/* Task Distribution by Status */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-blue-800 dark:text-blue-200 mb-2">Task Distribution by Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {statuses.map(status => {
                  const count = allTasks.filter(task => task.status.id === status.id).length
                  const filteredCount = tasks.filter(task => task.status.id === status.id).length
                  return (
                    <div key={status.id} className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700 text-center">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{filteredCount}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{status.name}</div>
                      {count !== filteredCount && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">of {count}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Task Distribution by Priority */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-blue-800 dark:text-blue-200 mb-2">Task Distribution by Priority</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {priorities.map(priority => {
                  const count = allTasks.filter(task => task.priority.id === priority.id).length
                  const filteredCount = tasks.filter(task => task.priority.id === priority.id).length
                  const priorityColors = {
                    'Low': 'text-gray-600 dark:text-gray-400',
                    'Medium': 'text-yellow-600 dark:text-yellow-400',
                    'High': 'text-orange-600 dark:text-orange-400',
                    'Urgent': 'text-red-600 dark:text-red-400'
                  }
                  return (
                    <div key={priority.id} className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700 text-center">
                      <div className={`text-lg font-semibold ${priorityColors[priority.name as keyof typeof priorityColors] || 'text-gray-900 dark:text-gray-100'}`}>
                        {filteredCount}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{priority.name}</div>
                      {count !== filteredCount && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">of {count}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* User Filter */}
              {(canSeeAllTasks || canSeeTeamTasks) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <UserIcon className="h-4 w-4 inline mr-1" />
                    User
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Users</option>
                    {canSeeAllTasks ? (
                      users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))
                    ) : (
                      getTeamMembers().map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Team Filter */}
              {canSeeAllTasks && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Team
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Teams</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Statuses</option>
                  {statuses.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Priorities</option>
                  {priorities.map(priority => (
                    <option key={priority.id} value={priority.id}>
                      {priority.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {tasks.length} of {allTasks.length} tasks
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task Board or Table */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'board' ? (
          <TaskBoard
            tasks={tasks}
            statuses={statuses}
            priorities={priorities}
            teams={teams}
            onTaskUpdate={handleTaskUpdate}
            onCreateTask={handleCreateTask}
            onEditTask={handleEditTask}
            onViewTask={handleViewTask}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <div className="h-full">
            <TaskTable
              tasks={tasks}
              statuses={statuses}
              priorities={priorities}
              teams={teams}
              onTaskUpdate={handleTaskUpdate}
              onCreateTask={handleCreateTask}
              onEditTask={handleEditTask}
              onViewTask={handleViewTask}
              onDeleteTask={handleDeleteTask}
            />
          </div>
        )}
      </div>
      
      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false)
            setSelectedTask(null)
          }}
          onSave={handleTaskSave}
          task={selectedTask}
          statuses={statuses}
          priorities={priorities}
        />
      )}

      {/* Task View Modal */}
      <TaskViewModal
        isOpen={showTaskViewModal}
        onClose={() => {
          setShowTaskViewModal(false)
          setSelectedTask(null)
          // Reset to default tab when closing
          setDefaultActiveTab('comments')
        }}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        task={selectedTask}
        statuses={statuses}
        priorities={priorities}
        teams={teams}
        defaultActiveTab={defaultActiveTab}
        onTaskUpdate={(updatedTask) => {
          // Update the selected task state
          setSelectedTask(updatedTask);
          // Update the tasks list to reflect the changes
          setTasks(prev => prev.map(task => 
            task.id === updatedTask.id ? updatedTask : task
          ));
          // Update the allTasks list to reflect the changes
          setAllTasks(prev => prev.map(task => 
            task.id === updatedTask.id ? updatedTask : task
          ));
        }}
      />
    </div>
  )
}