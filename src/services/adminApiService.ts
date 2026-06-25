import { User, TimeEntry, Project, Client, Team, CreateTimeEntryData } from '../types'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
const ADMIN_TIME_ENTRIES_PAGE_SIZE = 200
const ADMIN_PROJECTS_PAGE_SIZE = 100

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

    // The MySQL API server (api/index.js) scopes /api/admin/users by the authenticated user's company.
    // Some older client state may still contain Firebase-style company IDs (e.g. starting with '-')
    // and some server variants may not implement /admin/users/company/:companyId at all.
    // In those cases, fall back to /admin/users.
    const shouldFallbackToScopedList = companyId.startsWith('-')

    try {
      const response = await apiRequest<{
        success: boolean
        data: User[]
        count: number
      }>(shouldFallbackToScopedList ? '/admin/users' : `/admin/users/company/${companyId}`)

      if (!response.success) {
        throw new Error('Failed to get users for company')
      }

      return response.data
    } catch (error: any) {
      const message = String(error?.message || '')
      if (shouldFallbackToScopedList || message.includes('404') || message.includes('Not Found')) {
        const response = await apiRequest<{
          success: boolean
          data: User[]
          count: number
        }>('/admin/users')

        if (!response.success) {
          throw new Error('Failed to get users')
        }

        return response.data
      }

      throw error
    }
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

export type PendingCompanyInvite = {
  inviteId: string
  companyId: string
  inviterUserId: string
  inviterName: string | null
  inviterEmail: string | null
  inviteeUserId: string | null
  inviteeEmail: string
  role: string
  expiresAt: string
  createdAt: string
}

export const adminCompanyInvitesAPI = {
  async getPendingInvites(): Promise<PendingCompanyInvite[]> {
    const response = await apiRequest<{
      success: boolean
      invites: PendingCompanyInvite[]
      count: number
    }>('/company-invites/pending')

    if (!response.success) {
      throw new Error('Failed to load pending invites')
    }

    return response.invites || []
  },

  async resendInvite(inviteId: string): Promise<{ success: boolean; inviteEmailSent?: boolean; inviteId?: string }> {
    const response = await apiRequest<{ success: boolean; inviteEmailSent?: boolean; inviteId?: string }>(
      '/company-invites/resend',
      { method: 'POST', body: JSON.stringify({ inviteId }) }
    )
    return response
  },

  async cancelInvite(inviteId: string): Promise<{ success: boolean; message?: string }> {
    const response = await apiRequest<{ success: boolean; message?: string }>(
      '/company-invites/cancel',
      { method: 'POST', body: JSON.stringify({ inviteId }) }
    )
    return response
  }
}

// Admin Time Entries API
export const adminTimeEntriesAPI = {
  // Get all time entries (for admin use)
  async getAllTimeEntries(companyId: string | null): Promise<TimeEntry[]> {
    const allEntries: TimeEntry[] = []
    let offset = 0

    while (true) {
      const queryParams = new URLSearchParams()
      if (companyId) {
        queryParams.append('companyId', companyId)
      }
      queryParams.append('limit', String(ADMIN_TIME_ENTRIES_PAGE_SIZE))
      queryParams.append('offset', String(offset))

      const queryString = queryParams.toString()
      const endpoint = `/admin/time-entries${queryString ? `?${queryString}` : ''}`

      const response = await apiRequest<{
        success: boolean
        data: TimeEntry[]
        count: number
      }>(endpoint)
      
      if (!response.success) {
        throw new Error('Failed to get time entries')
      }

      const pageEntries = response.data || []
      allEntries.push(...pageEntries)

      if (pageEntries.length < ADMIN_TIME_ENTRIES_PAGE_SIZE) {
        break
      }

      offset += pageEntries.length
    }

    return allEntries
  },

  async getTimeEntriesPage(companyId: string | null, offset: number = 0): Promise<TimeEntry[]> {
    const queryParams = new URLSearchParams()
    if (companyId) {
      queryParams.append('companyId', companyId)
    }
    queryParams.append('limit', String(ADMIN_TIME_ENTRIES_PAGE_SIZE))
    queryParams.append('offset', String(offset))

    const queryString = queryParams.toString()
    const endpoint = `/admin/time-entries${queryString ? `?${queryString}` : ''}`

    const response = await apiRequest<{
      success: boolean
      data: TimeEntry[]
      count: number
    }>(endpoint)
    
    if (!response.success) {
      throw new Error('Failed to get time entries')
    }
    
    return response.data
  },

  // Get all running time entries (for admin use)
  async getAllRunningTimeEntries(companyId: string | null): Promise<TimeEntry[]> {
    const queryParams = new URLSearchParams()
    if (companyId) {
      queryParams.append('companyId', companyId)
    }
    
    const queryString = queryParams.toString()
    const endpoint = `/admin/time-entries/running${queryString ? `?${queryString}` : ''}`
    
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

    const projects: Project[] = []
    let offset = 0
    let total = Number.POSITIVE_INFINITY

    while (projects.length < total) {
      const page = await this.getProjectsForCompanyPage(companyId, offset)
      projects.push(...page.data)
      total = page.count

      if (page.data.length === 0 || page.data.length < ADMIN_PROJECTS_PAGE_SIZE) {
        break
      }

      offset += page.data.length
    }

    return projects
  },

  async getProjectsForCompanyPage(companyId: string | null, offset: number = 0): Promise<{ data: Project[]; count: number }> {
    if (!companyId) return { data: [], count: 0 }

    // During Firebase -> MySQL migration, some users/companies may still have Firebase-style IDs.
    // Backend company-scoped routes reject those. Fall back to non-param endpoints.
    const endpointBase = companyId.startsWith('-') ? '/projects' : `/projects/company/${companyId}`
    const queryParams = new URLSearchParams()
    queryParams.append('limit', String(ADMIN_PROJECTS_PAGE_SIZE))
    queryParams.append('offset', String(offset))

    const response = await apiRequest<{
      success: boolean
      data: Project[]
      count: number
    }>(`${endpointBase}?${queryParams.toString()}`)

    if (!response.success) {
      throw new Error('Failed to get projects for company')
    }

    const data = response.data.map((project: Project) => ({
      ...project,
      startDate: (project as any).startDate ? new Date((project as any).startDate) : undefined,
      endDate: (project as any).endDate ? new Date((project as any).endDate) : undefined,
      createdAt: new Date((project as any).createdAt),
      updatedAt: new Date((project as any).updatedAt)
    }))

    return { data, count: response.count }
  },

  // Get clients for company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    if (!companyId) return []
    
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

// Admin Clients API
export const adminClientsAPI = {
  // Get clients for company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
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

// Admin Teams API
export const adminTeamsAPI = {
  // Get teams for company
  async getTeamsForCompany(companyId: string | null): Promise<Team[]> {
    const response = await apiRequest<{
      success: boolean
      data: Team[]
      count: number
    }>('/admin/teams')

    if (!response.success) {
      throw new Error('Failed to get teams')
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
