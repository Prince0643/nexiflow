import { Task, CreateTaskData, UpdateTaskData, TaskStatus, TaskPriority } from '../types'

// API Configuration
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

// Get auth token for authentication
const getAuthToken = async (): Promise<string | null> => {
  try {
    // In a real implementation, you would get the token from your auth context
    // For now, we'll return a placeholder - in practice, this would come from your auth system
    return localStorage.getItem('authToken') || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

// Generic API request function
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getAuthToken()
  
  const url = `${API_BASE_URL}${endpoint}`
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // If the error is due to an invalid or expired token, redirect to login
      if (response.status === 401 || response.status === 403) {
        // Clear the expired token from localStorage
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentCompany')

        // Notify the app so it can handle logout without forcing a full page reload
        window.dispatchEvent(new CustomEvent('auth:expired'))

        throw new Error('Session expired. Please log in again.')
      }
      
      // If it's a bad request due to invalid company ID format, redirect to login
      if (response.status === 400 && errorData.error && errorData.error.includes('Invalid company ID format')) {
        // Clear the invalid data from localStorage
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentCompany')

        window.dispatchEvent(new CustomEvent('auth:expired'))

        throw new Error('Invalid user data. Please log in again.')
      }
      
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error)
    throw error
  }
}

// Task API Service
export const taskApiService = {
  // Get tasks
  async getTasks(projectId?: string, userId?: string, companyId?: string | null): Promise<Task[]> {
    const queryParams = new URLSearchParams();
    if (projectId) queryParams.append('projectId', projectId);
    if (userId) queryParams.append('userId', userId);
    
    const queryString = queryParams.toString();
    const endpoint = `/tasks${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{
      success: boolean
      data: Task[]
      count: number
    }>(endpoint)
    
    if (!response.success) {
      throw new Error('Failed to get tasks')
    }
    
    return response.data
  },

  // Create a new task
  async createTask(taskData: CreateTaskData): Promise<Task> {
    const response = await apiRequest<{
      success: boolean
      data: Task
      message: string
    }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to create task')
    }
    
    return response.data
  },

  // Update a task
  async updateTask(taskId: string, updates: UpdateTaskData): Promise<void> {
    // Validate taskId
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to update task')
    }
  },

  // Delete a task
  async deleteTask(taskId: string): Promise<void> {
    // Validate taskId
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/tasks/${taskId}`, {
      method: 'DELETE',
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete task')
    }
  },

  // Get task statuses
  async getTaskStatuses(): Promise<TaskStatus[]> {
    const response = await apiRequest<{
      success: boolean
      data: TaskStatus[]
    }>('/task-statuses')
    
    if (!response.success) {
      throw new Error('Failed to get task statuses')
    }
    
    return response.data
  },

  // Get task priorities
  async getTaskPriorities(): Promise<TaskPriority[]> {
    const response = await apiRequest<{
      success: boolean
      data: TaskPriority[]
    }>('/task-priorities')
    
    if (!response.success) {
      throw new Error('Failed to get task priorities')
    }
    
    return response.data
  }
}

// Export default
export default taskApiService