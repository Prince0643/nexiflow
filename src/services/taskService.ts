import { Task, CreateTaskData, UpdateTaskData, TaskStatus, TaskPriority } from '../types'
import { taskApiService } from './taskApiService'

// Default statuses and priorities for UI
const defaultStatuses: TaskStatus[] = [
  { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
  { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
  { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
  { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
]

const defaultPriorities: TaskPriority[] = [
  { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
  { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
  { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
  { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
]

export const taskService = {
  // Tasks
  async createTask(taskData: CreateTaskData, userId: string, userName: string, companyId?: string | null): Promise<Task> {
    // Find the actual status and priority objects based on the IDs provided
    const status = defaultStatuses.find(s => s.id === taskData.status) || defaultStatuses[0]
    const priority = defaultPriorities.find(p => p.id === taskData.priority) || defaultPriorities[0]

    const newTaskData: CreateTaskData = {
      ...taskData,
      status: status.id,
      priority: priority.id,
      tags: taskData.tags || []
    }

    return taskApiService.createTask(newTaskData)
  },

  async getTasks(projectId?: string, userId?: string, companyId?: string | null): Promise<Task[]> {
    const tasks = await taskApiService.getTasks(projectId, userId, companyId)

    // Filter by user - users can only see tasks assigned to them
    if (userId) {
      return tasks.filter(task => task.assigneeId === userId)
    }

    return tasks
  },

  // Get tasks for team members (for team leaders)
  async getTeamTasks(teamId: string, projectId?: string, companyId?: string | null): Promise<Task[]> {
    const { teamService } = await import('./teamService')
    const teamMembers = await teamService.getTeamMembers(teamId)
    const teamMemberIds = teamMembers.map(member => member.userId)

    const tasks = await taskApiService.getTasks(projectId, undefined, companyId)

    // Filter by team members (tasks assigned to team members)
    return tasks.filter(task => task.assigneeId && teamMemberIds.includes(task.assigneeId))
  },

  async updateTask(taskId: string, updates: UpdateTaskData): Promise<void> {
    return taskApiService.updateTask(taskId, updates)
  },

  async deleteTask(taskId: string): Promise<void> {
    return taskApiService.deleteTask(taskId)
  },

  // Task Statuses
  async getTaskStatuses(): Promise<TaskStatus[]> {
    // Try to get from API first, fallback to defaults
    try {
      return await taskApiService.getTaskStatuses()
    } catch {
      return defaultStatuses
    }
  },

  // Task Priorities
  async getTaskPriorities(): Promise<TaskPriority[]> {
    // Try to get from API first, fallback to defaults
    try {
      return await taskApiService.getTaskPriorities()
    } catch {
      return defaultPriorities
    }
  }
}
