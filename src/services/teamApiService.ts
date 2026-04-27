import { Team, TeamStats } from '../types'

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
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      const errorData = isJson ? await response.json().catch(() => ({})) : {}

      // Allow callers to handle missing endpoints (migration period)
      if (response.status === 404) {
        // If the server returns a JSON error payload, treat it as a real 404 (e.g. "Team not found").
        if (errorData && (errorData.error || errorData.message)) {
          throw new Error(errorData.error || errorData.message)
        }
        throw new Error('API endpoint not found')
      }
      
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

// Team API Service
export const teamApiService = {
  // Get all teams (admin only)
  async getAllTeams(): Promise<Team[]> {
    const response = await apiRequest<{
      success: boolean
      data: Team[]
      count: number
    }>('/admin/teams')
    
    if (!response.success) {
      throw new Error('Failed to get all teams')
    }
    
    return response.data
  },

  // Get teams for company (admin only)
  async getTeamsForCompany(companyId: string | null): Promise<Team[]> {
    if (!companyId) return []

    // Legacy Firebase-style company IDs are not valid in MySQL routes.
    if (companyId.startsWith('-')) {
      return this.getAllTeams()
    }
    
    try {
      const response = await apiRequest<{
        success: boolean
        data: Team[]
        count: number
      }>(`/admin/teams/company/${companyId}`)

      if (!response.success) {
        throw new Error('Failed to get teams for company')
      }

      return response.data
    } catch (e: any) {
      if (String(e?.message || e).includes('API endpoint not found')) {
        return this.getAllTeams()
      }
      throw e
    }
  },

  async getTeamStats(teamId: string): Promise<TeamStats> {
    const response = await apiRequest<{
      success: boolean
      data: TeamStats
    }>(`/teams/${teamId}/stats`)

    if (!response.success) {
      throw new Error('Failed to get team stats')
    }

    return response.data
  },

  async createTeam(payload: {
    name: string
    description?: string | null
    leaderId: string
    color: string
  }): Promise<string> {
    const response = await apiRequest<{
      success: boolean
      data?: { id: string }
      message?: string
    }>(`/admin/teams`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (!response.success || !response.data?.id) {
      throw new Error(response.message || 'Failed to create team')
    }

    return response.data.id
  },

  async updateTeam(
    teamId: string,
    payload: { name?: string; description?: string | null; color?: string }
  ): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/admin/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to update team')
    }
  },

  async deleteTeam(teamId: string): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/admin/teams/${teamId}`, { method: 'DELETE' })

    if (!response.success) {
      throw new Error(response.message || 'Failed to delete team')
    }
  }
}

// Export default
export default teamApiService
