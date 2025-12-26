import { Project, Client, CreateProjectData } from '../types'

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
      
      // If it's a bad request due to invalid company ID format, do not treat as auth-expired
      if (response.status === 400 && errorData.error && errorData.error.includes('Invalid company ID format')) {
        throw new Error('Invalid company ID format')
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

// Project API Service
export const projectApiService = {
  // Get projects for company
  async getProjectsForCompany(companyId: string | null, includeArchived: boolean = false): Promise<Project[]> {
    if (!companyId) return []

    // During Firebase -> MySQL migration, some users/companies may still have Firebase-style IDs.
    // Backend company-scoped routes reject those. Fall back to non-param endpoints.
    const endpointBase = companyId.startsWith('-') ? '/projects' : `/projects/company/${companyId}`
    const endpoint = includeArchived ? `${endpointBase}?archived=1` : endpointBase

    const response = await apiRequest<{
      success: boolean
      data: Project[]
      count: number
    }>(endpoint)
    
    if (!response.success) {
      throw new Error('Failed to get projects for company')
    }
    
    return response.data
  },

  // Get all projects (fallback for when no company ID)
  async getProjects(includeArchived: boolean = false): Promise<Project[]> {
    const endpoint = includeArchived ? '/projects?archived=1' : '/projects'
    const response = await apiRequest<{
      success: boolean
      data: Project[]
      count: number
    }>(endpoint)
    
    if (!response.success) {
      throw new Error('Failed to get projects')
    }
    
    return response.data
  },

  async createProject(projectData: CreateProjectData): Promise<Project> {
    const response = await apiRequest<{
      success: boolean
      data: Project
      message?: string
    }>('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    })

    if (!response.success) {
      throw new Error('Failed to create project')
    }

    return response.data
  },

  async updateProject(projectId: string, projectData: CreateProjectData): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(projectData)
    })

    if (!response.success) {
      throw new Error('Failed to update project')
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/projects/${projectId}`, {
      method: 'DELETE'
    })

    if (!response.success) {
      throw new Error('Failed to delete project')
    }
  },

  async archiveProject(projectId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/projects/${projectId}/archive`, {
      method: 'PUT'
    })

    if (!response.success) {
      throw new Error('Failed to archive project')
    }
  },

  async unarchiveProject(projectId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/projects/${projectId}/unarchive`, {
      method: 'PUT'
    })

    if (!response.success) {
      throw new Error('Failed to unarchive project')
    }
  },

  // Get clients for company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    if (!companyId) return []

    const endpoint = companyId.startsWith('-') ? '/clients' : `/clients/company/${companyId}`

    const response = await apiRequest<{
      success: boolean
      data: Client[]
      count: number
    }>(endpoint)
    
    if (!response.success) {
      throw new Error('Failed to get clients for company')
    }
    
    return response.data
  },

  // Get all clients (fallback for when no company ID)
  async getClients(): Promise<Client[]> {
    const response = await apiRequest<{
      success: boolean
      data: Client[]
      count: number
    }>('/clients')
    
    if (!response.success) {
      throw new Error('Failed to get clients')
    }
    
    return response.data
  }
}

// Export default
export default projectApiService