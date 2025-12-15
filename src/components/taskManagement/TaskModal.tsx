import { useState, useEffect } from 'react'
import { X, Users, Building2 } from 'lucide-react'
import { Task, TaskStatus, TaskPriority, CreateTaskData, UpdateTaskData, Project, User, Team } from '../../types'
import { projectService } from '../../services/projectService'
import { userService } from '../../services/userService'
import { teamService } from '../../services/teamService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (taskData: CreateTaskData | UpdateTaskData) => void
  task?: Task | null
  statuses: TaskStatus[]
  priorities: TaskPriority[]
}

// const PRIORITY_OPTIONS = [
//   { value: 'low', label: 'Low', color: 'text-gray-600' },
//   { value: 'medium', label: 'Medium', color: 'text-blue-600' },
//   { value: 'high', label: 'High', color: 'text-orange-600' },
//   { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
// ]

export default function TaskModal({ 
  isOpen, 
  onClose, 
  onSave, 
  task, 
  statuses, 
  priorities 
}: TaskModalProps) {
  const { currentUser } = useMySQLAuth()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    statusId: statuses[0]?.id || '',
    priorityId: priorities[0]?.id || '',
    assigneeId: '',
    assigneeName: '',
    teamId: '',
    dueDate: '',
    estimatedHours: '',
    tags: [] as string[]
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [userTeams, setUserTeams] = useState<Team[]>([]) // Teams the current user belongs to
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [assigneeType, setAssigneeType] = useState<'user' | 'team'>('user')

  useEffect(() => {
    if (isOpen) {
      loadData()
      if (task) {
        setFormData({
          title: task.title,
          description: task.description || '',
          projectId: task.projectId,
          statusId: task.status.id,
          priorityId: task.priority.id,
          assigneeId: task.assigneeId || '',
          assigneeName: task.assigneeName || '',
          teamId: '',
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
          estimatedHours: task.estimatedHours?.toString() || '',
          tags: task.tags || []
        })
      } else {
        // For employees, automatically assign to themselves
        const defaultAssigneeId = currentUser?.role === 'employee' ? currentUser.uid : ''
        const defaultAssigneeName = currentUser?.role === 'employee' ? currentUser.name : ''
        
        setFormData({
          title: '',
          description: '',
          projectId: '',
          statusId: statuses[0]?.id || '',
          priorityId: priorities[0]?.id || '',
          assigneeId: defaultAssigneeId,
          assigneeName: defaultAssigneeName,
          teamId: '',
          dueDate: '',
          estimatedHours: '',
          tags: []
        })
      }
    }
  }, [isOpen, task, statuses, priorities, currentUser])

  const loadData = async () => {
    try {
      console.log('TaskModal - Loading data for user:', {
        userId: currentUser?.uid,
        role: currentUser?.role,
        companyId: currentUser?.companyId
      })
      
      // Load projects - all authenticated users can access projects
      const projectsData = currentUser?.companyId 
        ? await projectService.getProjectsForCompany(currentUser.companyId)
        : await projectService.getProjects()
      
      let usersData: User[] = []
      let teamsData: Team[] = []
      let userTeamsData: Team[] = []
      
      // Only load users and teams if user has permission (not regular employees)
      if (currentUser?.role && ['admin', 'super_admin', 'hr', 'root'].includes(currentUser.role) || currentUser?.teamRole === 'leader') {
        try {
          [usersData, teamsData] = await Promise.all([
            currentUser?.companyId 
              ? userService.getUsersForCompany(currentUser.companyId)
              : userService.getAllUsers(),
            currentUser?.companyId 
              ? teamService.getTeamsForCompany(currentUser.companyId)
              : teamService.getTeams()
          ])
        } catch (error) {
          console.warn('Could not load users/teams (insufficient permissions):', error)
          // For employees, only include their own user data if available
          if (currentUser) {
            usersData = [{
              id: currentUser.uid,
              name: currentUser.name,
              email: currentUser.email,
              role: currentUser.role,
              companyId: currentUser.companyId,
              teamId: currentUser.teamId,
              teamRole: currentUser.teamRole,
              timezone: 'GMT+0 (Greenwich Mean Time)',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }]
          }
        }
      } else {
        // For employees, only include their own user data
        if (currentUser) {
          usersData = [{
            id: currentUser.uid,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            companyId: currentUser.companyId,
            teamId: currentUser.teamId,
            teamRole: currentUser.teamRole,
            timezone: 'GMT+0 (Greenwich Mean Time)',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        }
        console.log('Employee user - skipping team/user loading, creating self-assignment data')
      }
      
      // Load teams the current user belongs to (for all user types)
      if (currentUser) {
        try {
          userTeamsData = await teamService.getUserTeams(currentUser.uid)
          console.log('User teams data:', userTeamsData)
        } catch (error) {
          console.warn('Could not load user teams:', error)
          userTeamsData = []
        }
      }
      
      console.log('TaskModal - Loaded data:', {
        projects: projectsData.length,
        users: usersData.length,
        teams: teamsData.length,
        userTeams: userTeamsData.length,
        projectsList: projectsData.map(p => ({ id: p.id, name: p.name, companyId: (p as any).companyId })),
        userHasCompanyId: !!currentUser?.companyId,
        userRole: currentUser?.role
      })
      
      setProjects(projectsData)
      setUsers(usersData)
      setTeams(teamsData)
      setUserTeams(userTeamsData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Handle team assignment - if team is selected, add assignee to team
      if (assigneeType === 'team' && formData.teamId && formData.assigneeId) {
        try {
          const selectedUser = users.find(u => u.id === formData.assigneeId)
          const selectedTeam = teams.find(t => t.id === formData.teamId)
          
          if (selectedUser && selectedTeam) {
            // Check if user is already in the team
            const teamMembers = await teamService.getTeamMembers(formData.teamId)
            const isUserInTeam = teamMembers.some(member => member.userId === formData.assigneeId)
            
            if (!isUserInTeam) {
              // Add user to team
              await teamService.addTeamMember(
                formData.teamId,
                { userId: formData.assigneeId, role: 'member' },
                selectedUser.name,
                selectedUser.email
              )
            }
          }
        } catch (error) {
          console.error('Error adding user to team:', error)
          // Continue with task creation even if team assignment fails
        }
      }

      const taskData: any = {
        ...formData,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        status: statuses.find(s => s.id === formData.statusId)!,
        priority: priorities.find(p => p.id === formData.priorityId)!,
        projectName: projects.find(p => p.id === formData.projectId)?.name || ''
      }

      // Only include dueDate if a valid date was selected
      if (formData.dueDate && formData.dueDate.trim() !== '') {
        const dueDateObj = new Date(formData.dueDate)
        // Check if the date is valid
        if (!isNaN(dueDateObj.getTime())) {
          taskData.dueDate = dueDateObj
        }
      }

      // Clean the taskData to remove undefined values before saving
      const cleanTaskData: any = {
        ...taskData,
        status: taskData.status.id,
        priority: taskData.priority.id
      }
      
      // Remove undefined values to prevent Firebase errors
      Object.keys(cleanTaskData).forEach(key => {
        if (cleanTaskData[key] === undefined) {
          delete cleanTaskData[key]
        }
      })

      await onSave(cleanTaskData)
      onClose()
    } catch (error) {
      console.error('Error saving task:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder="Enter task description"
            />
          </div>

          {/* Project and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project *
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={formData.statusId}
                onChange={(e) => setFormData(prev => ({ ...prev, statusId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {statuses.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              value={formData.priorityId}
              onChange={(e) => setFormData(prev => ({ ...prev, priorityId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {priorities.map(priority => (
                <option key={priority.id} value={priority.id}>
                  {priority.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignment Type Selection - Only show for non-employees */}
          {currentUser?.role !== 'employee' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assignment Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="assigneeType"
                    value="user"
                    checked={assigneeType === 'user'}
                    onChange={(e) => setAssigneeType(e.target.value as 'user' | 'team')}
                    className="mr-2"
                  />
                  <Users className="h-4 w-4 mr-1" />
                  Assign to User
                </label>
                <label className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="assigneeType"
                    value="team"
                    checked={assigneeType === 'team'}
                    onChange={(e) => setAssigneeType(e.target.value as 'user' | 'team')}
                    className="mr-2"
                  />
                  <Building2 className="h-4 w-4 mr-1" />
                  Assign to Team
                </label>
              </div>
            </div>
          )}

          {/* Assignee Selection - Only show for non-employees */}
          {currentUser?.role !== 'employee' && (
            <div className="grid grid-cols-2 gap-4">
              {assigneeType === 'user' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assignee
                  </label>
                  <select
                    value={formData.assigneeId}
                    onChange={(e) => {
                      const selectedUser = users.find(u => u.id === e.target.value)
                      setFormData(prev => ({ 
                        ...prev, 
                        assigneeId: e.target.value,
                        assigneeName: selectedUser?.name || ''
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a user</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Team
                    </label>
                    <select
                      value={formData.teamId}
                      onChange={(e) => setFormData(prev => ({ ...prev, teamId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select a team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      User to Add to Team
                    </label>
                    <select
                      value={formData.assigneeId}
                      onChange={(e) => {
                        const selectedUser = users.find(u => u.id === e.target.value)
                        setFormData(prev => ({ 
                          ...prev, 
                          assigneeId: e.target.value,
                          assigneeName: selectedUser?.name || ''
                        }))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={!formData.teamId}
                    >
                      <option value="">Select a user</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Show assigned user info for employees */}
          {currentUser?.role === 'employee' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assigned To
              </label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-700 dark:text-gray-200">
                {currentUser.name} (You)
              </div>
            </div>
          )}

          {/* Team Selection for Employees */}
          {currentUser?.role === 'employee' && userTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team *
              </label>
              <select
                value={formData.teamId}
                onChange={(e) => setFormData(prev => ({ ...prev, teamId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required={currentUser?.role === 'employee'}
              >
                <option value="">Select a team</option>
                {userTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select the team this task belongs to. You can only select teams you're a member of.
              </p>
            </div>
          )}

          {/* Due Date and Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estimated Hours
              </label>
              <input
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Add a tag"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
