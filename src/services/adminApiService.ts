import { User, TimeEntry, Project, Client, Team, CreateTimeEntryData } from '../types'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

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
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error)
    throw error
  }
}

// Admin Users API
export const adminUsersAPI = {
  // Get all users (admin only)
  async getAllUsers(): Promise<User[]> {
    const response = await apiRequest<{
      success: boolean
      data: User[]
      count: number
    }>('/admin/users')
    
    if (!response.success) {
      throw new Error('Failed to get users')
    }
    
    return response.data
  },

  // Get users for company (admin only)
  async getUsersForCompany(companyId: string | null): Promise<User[]> {
    if (!companyId) return []
    
    const response = await apiRequest<{
      success: boolean
      data: User[]
      count: number
    }>(`/admin/users/company/${companyId}`)
    
    if (!response.success) {
      throw new Error('Failed to get users for company')
    }
    
    return response.data
  },

  // Update user (admin only)
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to update user')
    }
  },

  // Delete user (admin only) - soft delete
  async deleteUser(userId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete user')
    }
  },

  // Create user (admin only)
  async createUser(userData: any): Promise<User> {
    const response = await apiRequest<{
      success: boolean
      data: User
      message: string
    }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to create user')
    }
    
    return response.data
  }
}

// Admin Time Entries API
export const adminTimeEntriesAPI = {
  // Get all time entries (for admin use)
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    const response = await apiRequest<{
      success: boolean
      data: TimeEntry[]
      count: number
    }>('/admin/time-entries')
    
    if (!response.success) {
      throw new Error('Failed to get time entries')
    }
    
    return response.data
  },

  // Get all running time entries (for admin use)
  async getAllRunningTimeEntries(companyId: string | null): Promise<TimeEntry[]> {
    const queryParams = new URLSearchParams();
    if (companyId) {
      queryParams.append('companyId', companyId);
    }
    
    const queryString = queryParams.toString();
    const endpoint = `/admin/time-entries/running${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{
      success: boolean
      data: TimeEntry[]
      count: number
    }>(endpoint)
    
    if (!response.success) {
      throw new Error('Failed to get running time entries')
    }
    
    return response.data
  },

  // Delete time entry (admin only)
  async deleteTimeEntry(entryId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/admin/time-entries/${entryId}`, {
      method: 'DELETE',
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete time entry')
    }
  },

  // Stop time entry (admin only)
  async stopTimeEntry(entryId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/admin/time-entries/${entryId}/stop`, {
      method: 'POST',
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to stop time entry')
    }
  },

  // Update time entry (admin only)
  async updateTimeEntry(entryId: string, updates: Partial<CreateTimeEntryData & { projectName?: string, clientName?: string }>): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/admin/time-entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to update time entry')
    }
  }
}

// Admin Projects API
export const adminProjectsAPI = {
  // Get projects for company
  async getProjectsForCompany(companyId: string | null): Promise<Project[]> {
    if (!companyId) return []
    
    const response = await apiRequest<{
      success: boolean
      data: Project[]
      count: number
    }>(`/admin/projects/company/${companyId}`)
    
    if (!response.success) {
      throw new Error('Failed to get projects for company')
    }
    
    return response.data
  },

  // Get clients for company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    if (!companyId) return []
    
    const response = await apiRequest<{
      success: boolean
      data: Client[]
      count: number
    }>(`/admin/clients/company/${companyId}`)
    
    if (!response.success) {
      throw new Error('Failed to get clients for company')
    }
    
    return response.data
  }
}

// Admin Clients API
export const adminClientsAPI = {
  // Get clients for company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    if (!companyId) return []
    
    const response = await apiRequest<{
      success: boolean
      data: Client[]
      count: number
    }>(`/admin/clients/company/${companyId}`)
    
    if (!response.success) {
      throw new Error('Failed to get clients for company')
    }
    
    return response.data
  }
}

// Admin Teams API
export const adminTeamsAPI = {
  // Get teams for company
  async getTeamsForCompany(companyId: string | null): Promise<Team[]> {
    if (!companyId) return []
    
    const response = await apiRequest<{
      success: boolean
      data: Team[]
      count: number
    }>(`/admin/teams/company/${companyId}`)
    
    if (!response.success) {
      throw new Error('Failed to get teams for company')
    }
    
    return response.data
  }
}

// Export all APIs as a single object
export const adminAPI = {
  users: adminUsersAPI,
  timeEntries: adminTimeEntriesAPI,
  projects: adminProjectsAPI,
  clients: adminClientsAPI,
  teams: adminTeamsAPI,
}

// Export default
export default adminAPI