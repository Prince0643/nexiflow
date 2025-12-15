import { ref, set, get, push, remove, update } from 'firebase/database'
import { database } from '../config/firebase'
import { Task, CreateTaskData, UpdateTaskData, TaskStatus, TaskPriority } from '../types'

export const taskService = {
  // Tasks
  async createTask(taskData: CreateTaskData, userId: string, userName: string, companyId?: string | null): Promise<Task> {
    const taskRef = push(ref(database, 'tasks'))
    
    // Get default statuses and priorities
    const defaultStatuses = [
      { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
      { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
      { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
      { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
    ]
    
    const defaultPriorities = [
      { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
      { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
      { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
      { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
    ]
    
    // Find the actual status and priority objects based on the IDs provided
    const status = defaultStatuses.find(s => s.id === taskData.status) || defaultStatuses[0]
    const priority = defaultPriorities.find(p => p.id === taskData.priority) || defaultPriorities[0]
    
    const newTask: Task = {
      ...taskData,
      id: taskRef.key!,
      projectName: '', // Will be set when project is loaded
      status,
      priority,
      isCompleted: false,
      createdBy: userId,
      createdByName: userName,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: taskData.tags || [],
      attachments: [],
      comments: [],
      timeEntries: [],
      // @ts-ignore optional in persisted record
      companyId: companyId ?? undefined
    }
    
    // Convert data for Firebase (handle Date objects and undefined values)
    const taskDataForFirebase: any = {
      ...newTask,
      // Save status and priority in the format that getTasks expects
      status: { statusId: status.id },
      priority: { priorityId: priority.id },
      createdAt: newTask.createdAt.toISOString(),
      updatedAt: newTask.updatedAt.toISOString()
    }
    
    // Handle optional date fields - convert to ISO string or omit if undefined
    if (newTask.dueDate && newTask.dueDate instanceof Date && !isNaN(newTask.dueDate.getTime())) {
      taskDataForFirebase.dueDate = newTask.dueDate.toISOString()
    }
    
    if (newTask.completedAt && newTask.completedAt instanceof Date && !isNaN(newTask.completedAt.getTime())) {
      taskDataForFirebase.completedAt = newTask.completedAt.toISOString()
    }
    
    // Remove undefined values to prevent Firebase errors
    Object.keys(taskDataForFirebase).forEach(key => {
      if (taskDataForFirebase[key] === undefined) {
        delete taskDataForFirebase[key]
      }
    })
    
    await set(taskRef, taskDataForFirebase)
    return newTask
  },

  async getTasks(projectId?: string, userId?: string, companyId?: string | null): Promise<Task[]> {
    const tasksRef = ref(database, 'tasks')
    const snapshot = await get(tasksRef)
    
    if (snapshot.exists()) {
      const tasks = snapshot.val()
      let taskList = Object.values(tasks).map((task: any) => {
        // Get default statuses and priorities
        const defaultStatuses = [
          { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
          { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
          { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
          { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
        ]
        
        const defaultPriorities = [
          { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
          { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
          { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
          { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
        ]
        
        // Convert status and priority from Firebase format to our format
        const statusId = task.status?.statusId || task.status
        const priorityId = task.priority?.priorityId || task.priority
        
        const status = defaultStatuses.find(s => s.id === statusId) || defaultStatuses[0]
        const priority = defaultPriorities.find(p => p.id === priorityId) || defaultPriorities[0]
        
        return {
          ...task,
          status,
          priority,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined
        }
      }) as Task[]
      
      // Company scope if provided by caller
      if (companyId) {
        // Only show tasks that explicitly belong to this company
        taskList = taskList.filter(task => (task as any).companyId === companyId)
      } else {
        // If no companyId filter specified, show tasks without companyId (legacy data)
        taskList = taskList.filter(task => !(task as any).companyId)
      }

      // Filter by user - users can only see tasks assigned to them
      if (userId) {
        taskList = taskList.filter(task => task.assigneeId === userId)
      }
      
      // Filter by project
      if (projectId) {
        taskList = taskList.filter(task => task.projectId === projectId)
      }
      
      return taskList
    }
    
    return []
  },

  // Get tasks for team members (for team leaders)
  async getTeamTasks(teamId: string, projectId?: string, companyId?: string | null): Promise<Task[]> {
    const { teamService } = await import('./teamService')
    const teamMembers = await teamService.getTeamMembers(teamId)
    const teamMemberIds = teamMembers.map(member => member.userId)
    
    const tasksRef = ref(database, 'tasks')
    const snapshot = await get(tasksRef)
    
    if (snapshot.exists()) {
      const tasks = snapshot.val()
      let taskList = Object.values(tasks).map((task: any) => {
        // Get default statuses and priorities
        const defaultStatuses = [
          { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
          { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
          { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
          { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
        ]
        
        const defaultPriorities = [
          { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
          { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
          { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
          { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
        ]
        
        // Convert status and priority from Firebase format to our format
        const statusId = task.status?.statusId || task.status
        const priorityId = task.priority?.priorityId || task.priority
        
        const status = defaultStatuses.find(s => s.id === statusId) || defaultStatuses[0]
        const priority = defaultPriorities.find(p => p.id === priorityId) || defaultPriorities[0]
        
        return {
          ...task,
          status,
          priority,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined
        }
      }) as Task[]
      
      // Company scope
      if (companyId) {
        // Only show tasks that explicitly belong to this company
        taskList = taskList.filter(task => (task as any).companyId === companyId)
      } else {
        // If no companyId filter specified, show tasks without companyId (legacy data)
        taskList = taskList.filter(task => !(task as any).companyId)
      }

      // Filter by team members (tasks assigned to team members)
      taskList = taskList.filter(task => task.assigneeId && teamMemberIds.includes(task.assigneeId))
      
      // Filter by project
      if (projectId) {
        taskList = taskList.filter(task => task.projectId === projectId)
      }
      
      return taskList
    }
    
    return []
  },

  async updateTask(taskId: string, updates: UpdateTaskData): Promise<void> {
    const taskRef = ref(database, `tasks/${taskId}`)
    
    // Convert status and priority objects to Firebase format
    const firebaseUpdates: any = { ...updates }
    
    // Remove status and priority from the main updates object
    delete firebaseUpdates.status
    delete firebaseUpdates.priority
    
    // Add them back in Firebase format if they exist
    if (updates.status) {
      firebaseUpdates.status = { statusId: updates.status }
    }
    
    if (updates.priority) {
      firebaseUpdates.priority = { priorityId: updates.priority }
    }
    
    // Filter out undefined values and convert dates to ISO strings
    const updatesToSave: any = {
      updatedAt: new Date().toISOString()
    }
    
    // Only include defined values
    Object.keys(firebaseUpdates).forEach(key => {
      const value = firebaseUpdates[key]
      if (value !== undefined) {
        if (key === 'dueDate') {
          // Convert date to ISO string or null
          updatesToSave[key] = value instanceof Date ? value.toISOString() : value
        } else {
          updatesToSave[key] = value
        }
      }
    })
    
    await update(taskRef, updatesToSave)
  },

  async deleteTask(taskId: string): Promise<void> {
    const taskRef = ref(database, `tasks/${taskId}`)
    await remove(taskRef)
  },

  // Task Statuses
  async getTaskStatuses(): Promise<TaskStatus[]> {
    // Return default statuses since Firebase doesn't have this collection yet
    return [
      { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
      { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
      { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
      { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
    ]
  },

  // Task Priorities
  async getTaskPriorities(): Promise<TaskPriority[]> {
    // Return default priorities since Firebase doesn't have this collection yet
    return [
      { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
      { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
      { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
      { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
    ]
  }
}
