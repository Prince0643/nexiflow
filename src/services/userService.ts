import { User, UserRole } from '../types'
import { adminUsersAPI } from './adminApiService'
import { userApiService } from './userApiService'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

const getAuthToken = async (): Promise<string | null> => {
  try {
    return localStorage.getItem('authToken') || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getAuthToken()

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('currentUser')
      localStorage.removeItem('currentCompany')
      window.dispatchEvent(new CustomEvent('auth:expired'))
      throw new Error('Session expired. Please log in again.')
    }

    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json() as Promise<T>
}

const dedupeUsers = (users: User[]): User[] => {
  const seen = new Set<string>()
  const deduped: User[] = []

  for (const user of users) {
    if (!user?.id || seen.has(user.id)) continue
    seen.add(user.id)
    deduped.push(user)
  }

  return deduped
}

export const userService = {
  async getAllUsers(): Promise<User[]> {
    try {
      return dedupeUsers(await userApiService.getAllUsers())
    } catch (error) {
      console.error('Error getting all users:', error)
      return []
    }
  },

  async getUsersForCompany(companyId: string | null): Promise<User[]> {
    if (!companyId) return []

    try {
      return dedupeUsers(await userApiService.getUsersForCompany(companyId))
    } catch (error) {
      console.error('Error getting users for company:', error)
      return []
    }
  },

  async getUsersNotInTeam(teamId: string, companyId?: string | null): Promise<User[]> {
    const { teamService } = await import('./teamService')
    const allUsers = companyId !== undefined
      ? await this.getUsersForCompany(companyId)
      : await this.getAllUsers()

    const teamMembers = await teamService.getTeamMembers(teamId)
    const teamMemberIds = new Set(teamMembers.map(member => member.userId))

    return allUsers.filter(user => !teamMemberIds.has(user.id))
  },

  async getUserById(userId: string): Promise<User | null> {
    try {
      return await userApiService.getUserById(userId)
    } catch (error) {
      console.error('Error getting user by ID:', error)
      return null
    }
  },

  async getUsersByRole(role: UserRole): Promise<User[]> {
    const users = await this.getAllUsers()
    return users.filter(user => user.role === role)
  },

  async getUsersByRoleInCompany(role: UserRole, companyId: string | null): Promise<User[]> {
    if (!companyId) return []

    const users = await this.getUsersForCompany(companyId)
    return users.filter(user => user.role === role)
  },

  async getProjectManagersForCompany(companyId: string | null): Promise<User[]> {
    if (!companyId) return []

    const users = await this.getUsersForCompany(companyId)
    return users.filter(user =>
      user.role === 'admin' || user.role === 'super_admin' || user.role === 'root'
    )
  },

  async updateUserTeam(userId: string, teamId: string | null, teamRole: 'member' | 'leader' | null): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        teamId,
        teamRole
      })
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to update user team')
    }
  },

  async updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'email' | 'role' | 'isActive' | 'timezone' | 'hourlyRate' | 'companyId' | 'teamId' | 'teamRole'>>): Promise<void> {
    const response = await apiRequest<{
      success: boolean
      message?: string
    }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to update user')
    }
  },

  async createUser(userData: {
    name: string
    email: string
    password: string
    role: UserRole
    hourlyRate?: number
    timezone: string
    companyId?: string | null
  }): Promise<User> {
    return adminUsersAPI.createUser(userData)
  },

  async deleteUser(userId: string): Promise<void> {
    await adminUsersAPI.deleteUser(userId)
  },

  async permanentlyDeleteUser(userId: string): Promise<void> {
    await adminUsersAPI.deleteUser(userId)
  },

  subscribeToAllUsers(
    callback: (users: User[]) => void,
    companyId?: string | null,
    limit?: number
  ): () => void {
    let cancelled = false

    const loadUsers = async () => {
      try {
        const users = companyId !== undefined
          ? await this.getUsersForCompany(companyId)
          : await this.getAllUsers()

        if (cancelled) return

        const sorted = dedupeUsers(users)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        callback(typeof limit === 'number' ? sorted.slice(0, limit) : sorted)
      } catch (error) {
        console.error('Error loading subscribed users:', error)
      }
    }

    loadUsers()
    const interval = window.setInterval(loadUsers, 30000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }
}

export default userService
