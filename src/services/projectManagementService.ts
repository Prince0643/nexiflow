import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  equalTo, 
  onValue, 
  off,
  DataSnapshot 
} from 'firebase/database'
import { database } from '../config/firebase'
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  ProjectBoard, 
  BoardColumn,
  CreateTaskData, 
  UpdateTaskData, 
  CreateBoardData, 
  UpdateBoardData, 
  TaskFilter, 
  ProjectStats, 
  TeamMember, 
  ProjectTemplate,
  TaskComment,
  TaskAttachment
} from '../types'

class ProjectManagementService {
  // Default statuses and priorities
  private defaultStatuses: Omit<TaskStatus, 'id'>[] = [
    { name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
    { name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
    { name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
    { name: 'Done', color: '#10B981', order: 3, isCompleted: true }
  ]

  private defaultPriorities: Omit<TaskPriority, 'id'>[] = [
    { name: 'Low', color: '#6B7280', level: 1 },
    { name: 'Medium', color: '#F59E0B', level: 2 },
    { name: 'High', color: '#EF4444', level: 3 },
    { name: 'Urgent', color: '#DC2626', level: 4 }
  ]

  // Task Management
  async createTask(taskData: CreateTaskData, createdBy: string, createdByName: string): Promise<Task> {
    const taskRef = ref(database, 'tasks')
    const newTaskRef = push(taskRef)
    
    const status = await this.getTaskStatus(taskData.status)
    const priority = await this.getTaskPriority(taskData.priority)
    
    const newTask: Task = {
      id: newTaskRef.key!,
      title: taskData.title,
      description: taskData.description,
      projectId: taskData.projectId,
      projectName: '', // Will be populated by the calling function
      status,
      priority,
      assigneeId: taskData.assigneeId,
      assigneeName: '',
      assigneeEmail: '',
      dueDate: taskData.dueDate,
      estimatedHours: taskData.estimatedHours,
      actualHours: 0,
      tags: taskData.tags || [],
      isCompleted: false,
      createdBy,
      createdByName,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentTaskId: taskData.parentTaskId,
      subtasks: [],
      attachments: [],
      comments: [],
      timeEntries: []
    }

    await set(newTaskRef, {
      ...newTask,
      createdAt: newTask.createdAt.toISOString(),
      updatedAt: newTask.updatedAt.toISOString(),
      // Only include dueDate if it exists and is a valid date
      ...(newTask.dueDate && newTask.dueDate instanceof Date && !isNaN(newTask.dueDate.getTime()) && { dueDate: newTask.dueDate.toISOString() }),
      // Only include completedAt if it exists and is a valid date
      ...(newTask.completedAt && newTask.completedAt instanceof Date && !isNaN(newTask.completedAt.getTime()) && { completedAt: newTask.completedAt.toISOString() })
    })

    return newTask
  }

  async getTasks(projectId?: string, filters?: TaskFilter): Promise<Task[]> {
    const tasksRef = ref(database, 'tasks')
    let tasksQuery: any = tasksRef

    if (projectId) {
      tasksQuery = query(tasksRef, orderByChild('projectId'), equalTo(projectId))
    }

    const snapshot = await get(tasksQuery)
    if (!snapshot.exists()) return []

    const tasks: Task[] = []
    snapshot.forEach((childSnapshot: DataSnapshot) => {
      const task = childSnapshot.val()
      tasks.push({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        comments: task.comments?.map((comment: any) => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt)
        })) || [],
        attachments: task.attachments?.map((attachment: any) => ({
          ...attachment,
          uploadedAt: new Date(attachment.uploadedAt)
        })) || []
      })
    })

    // Apply filters
    return this.applyTaskFilters(tasks, filters)
  }

  async getTask(taskId: string): Promise<Task | null> {
    const taskRef = ref(database, `tasks/${taskId}`)
    const snapshot = await get(taskRef)
    
    if (!snapshot.exists()) return null

    const task = snapshot.val()
    return {
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
      comments: task.comments?.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt)
      })) || [],
      attachments: task.attachments?.map((attachment: any) => ({
        ...attachment,
        uploadedAt: new Date(attachment.uploadedAt)
      })) || []
    }
  }

  async updateTask(taskId: string, updates: UpdateTaskData): Promise<void> {
    const taskRef = ref(database, `tasks/${taskId}`)
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    }

    if (updates.status) {
      updateData.status = await this.getTaskStatus(updates.status)
    }
    if (updates.priority) {
      updateData.priority = await this.getTaskPriority(updates.priority)
    }
    if (updates.dueDate) {
      updateData.dueDate = updates.dueDate.toISOString()
    }
    if (updates.isCompleted !== undefined) {
      updateData.isCompleted = updates.isCompleted
      if (updates.isCompleted) {
        updateData.completedAt = new Date().toISOString()
      } else {
        updateData.completedAt = null
      }
    }

    await update(taskRef, updateData)
  }

  async deleteTask(taskId: string): Promise<void> {
    const taskRef = ref(database, `tasks/${taskId}`)
    await remove(taskRef)
  }

  // Board Management
  async createBoard(boardData: CreateBoardData, createdBy: string): Promise<ProjectBoard> {
    const boardRef = ref(database, 'boards')
    const newBoardRef = push(boardRef)
    
    const newBoard: ProjectBoard = {
      id: newBoardRef.key!,
      name: boardData.name,
      description: boardData.description,
      projectId: boardData.projectId,
      type: boardData.type,
      columns: boardData.columns.map((col, index) => ({
        ...col,
        id: `col_${Date.now()}_${index}`,
        order: index
      })),
      settings: boardData.settings,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await set(newBoardRef, {
      ...newBoard,
      createdAt: newBoard.createdAt.toISOString(),
      updatedAt: newBoard.updatedAt.toISOString()
    })

    return newBoard
  }

  async getBoards(projectId?: string): Promise<ProjectBoard[]> {
    const boardsRef = ref(database, 'boards')
    let boardsQuery: any = boardsRef

    if (projectId) {
      boardsQuery = query(boardsRef, orderByChild('projectId'), equalTo(projectId))
    }

    const snapshot = await get(boardsQuery)
    if (!snapshot.exists()) return []

    const boards: ProjectBoard[] = []
    snapshot.forEach((childSnapshot: DataSnapshot) => {
      const board = childSnapshot.val()
      boards.push({
        ...board,
        createdAt: new Date(board.createdAt),
        updatedAt: new Date(board.updatedAt)
      })
    })

    return boards.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  async updateBoard(boardId: string, updates: UpdateBoardData): Promise<void> {
    const boardRef = ref(database, `boards/${boardId}`)
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await update(boardRef, updateData)
  }

  async deleteBoard(boardId: string): Promise<void> {
    const boardRef = ref(database, `boards/${boardId}`)
    await remove(boardRef)
  }

  // Status and Priority Management
  async getTaskStatuses(): Promise<TaskStatus[]> {
    try {
      const statusesRef = ref(database, 'taskStatuses')
      const snapshot = await get(statusesRef)
      
      if (!snapshot.exists()) {
        // Create default statuses
        await this.createDefaultStatuses()
        return this.defaultStatuses.map((status, index) => ({
          ...status,
          id: `status_${index}`
        }))
      }

      const statuses: TaskStatus[] = []
      snapshot.forEach((childSnapshot: DataSnapshot) => {
        statuses.push(childSnapshot.val())
      })

      return statuses.sort((a, b) => a.order - b.order)
    } catch (error) {
      console.warn('Could not load task statuses from database, using defaults:', error)
      // Return default statuses if database access fails
      return this.defaultStatuses.map((status, index) => ({
        ...status,
        id: `status_${index}`
      }))
    }
  }

  async getTaskPriorities(): Promise<TaskPriority[]> {
    try {
      const prioritiesRef = ref(database, 'taskPriorities')
      const snapshot = await get(prioritiesRef)
      
      if (!snapshot.exists()) {
        // Create default priorities
        await this.createDefaultPriorities()
        return this.defaultPriorities.map((priority, index) => ({
          ...priority,
          id: `priority_${index}`
        }))
      }

      const priorities: TaskPriority[] = []
      snapshot.forEach((childSnapshot: DataSnapshot) => {
        priorities.push(childSnapshot.val())
      })

      return priorities.sort((a, b) => a.level - b.level)
    } catch (error) {
      console.warn('Could not load task priorities from database, using defaults:', error)
      // Return default priorities if database access fails
      return this.defaultPriorities.map((priority, index) => ({
        ...priority,
        id: `priority_${index}`
      }))
    }
  }

  async getTaskStatus(statusId: string): Promise<TaskStatus> {
    const statusRef = ref(database, `taskStatuses/${statusId}`)
    const snapshot = await get(statusRef)
    
    if (!snapshot.exists()) {
      // Return default status if not found
      return { id: statusId, name: 'To Do', color: '#6B7280', order: 0, isCompleted: false }
    }

    return snapshot.val()
  }

  async getTaskPriority(priorityId: string): Promise<TaskPriority> {
    const priorityRef = ref(database, `taskPriorities/${priorityId}`)
    const snapshot = await get(priorityRef)
    
    if (!snapshot.exists()) {
      // Return default priority if not found
      return { id: priorityId, name: 'Medium', color: '#F59E0B', level: 2 }
    }

    return snapshot.val()
  }

  // Project Statistics
  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const tasks = await this.getTasks(projectId)
    const boards = await this.getBoards(projectId)
    
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(task => task.isCompleted).length
    const inProgressTasks = tasks.filter(task => !task.isCompleted && task.status.name === 'In Progress').length
    const overdueTasks = tasks.filter(task => 
      task.dueDate && 
      !task.isCompleted && 
      new Date(task.dueDate) < new Date()
    ).length

    const totalEstimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0)
    const totalActualHours = tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0)
    
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const averageTaskDuration = completedTasks > 0 ? totalActualHours / completedTasks : 0

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      totalEstimatedHours,
      totalActualHours,
      completionRate,
      averageTaskDuration,
      teamMembers: 0, // Will be implemented with team management
      activeBoards: boards.length
    }
  }

  // Comments and Collaboration
  async addTaskComment(taskId: string, content: string, authorId: string, authorName: string, authorEmail: string): Promise<TaskComment> {
    const commentRef = ref(database, `tasks/${taskId}/comments`)
    const newCommentRef = push(commentRef)
    
    const newComment: TaskComment = {
      id: newCommentRef.key!,
      content,
      authorId,
      authorName,
      authorEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
      mentions: this.extractMentions(content)
    }

    await set(newCommentRef, {
      ...newComment,
      createdAt: newComment.createdAt.toISOString(),
      updatedAt: newComment.updatedAt.toISOString()
    })

    return newComment
  }

  // Helper Methods
  private async createDefaultStatuses(): Promise<void> {
    const statusesRef = ref(database, 'taskStatuses')
    const statuses = this.defaultStatuses.map((status, index) => ({
      id: `status_${index}`,
      ...status
    }))

    await set(statusesRef, statuses)
  }

  private async createDefaultPriorities(): Promise<void> {
    const prioritiesRef = ref(database, 'taskPriorities')
    const priorities = this.defaultPriorities.map((priority, index) => ({
      id: `priority_${index}`,
      ...priority
    }))

    await set(prioritiesRef, priorities)
  }

  private applyTaskFilters(tasks: Task[], filters?: TaskFilter): Task[] {
    if (!filters) return tasks

    return tasks.filter(task => {
      if (filters.projectId && task.projectId !== filters.projectId) return false
      if (filters.status && filters.status.length > 0 && !filters.status.includes(task.status.id)) return false
      if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(task.priority.id)) return false
      if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false
      if (filters.tags && filters.tags.length > 0 && !filters.tags.some(tag => task.tags.includes(tag))) return false
      if (filters.dueDateFrom && task.dueDate && task.dueDate < filters.dueDateFrom) return false
      if (filters.dueDateTo && task.dueDate && task.dueDate > filters.dueDateTo) return false
      if (filters.isCompleted !== undefined && task.isCompleted !== filters.isCompleted) return false
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase()) && 
          !task.description?.toLowerCase().includes(filters.search.toLowerCase())) return false

      return true
    })
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1])
    }

    return mentions
  }

  // Real-time listeners
  subscribeToTasks(projectId: string, callback: (tasks: Task[]) => void): () => void {
    const tasksRef = query(ref(database, 'tasks'), orderByChild('projectId'), equalTo(projectId))
    
    const listener = onValue(tasksRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([])
        return
      }

      const tasks: Task[] = []
      snapshot.forEach((childSnapshot: DataSnapshot) => {
        const task = childSnapshot.val()
        tasks.push({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          comments: task.comments?.map((comment: any) => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
            updatedAt: new Date(comment.updatedAt)
          })) || [],
          attachments: task.attachments?.map((attachment: any) => ({
            ...attachment,
            uploadedAt: new Date(attachment.uploadedAt)
          })) || []
        })
      })

      callback(tasks)
    })

    return () => off(tasksRef, 'value', listener)
  }
}

export const projectManagementService = new ProjectManagementService()
