import { 
  Team, 
  TeamMember, 
  CreateTeamData, 
  UpdateTeamData, 
  AddTeamMemberData, 
  TeamStats,
  TeamRole 
} from '../types'
import { teamApiService } from './teamApiService'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('authToken')
  } catch {
    return null
  }
}

const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getAuthToken()
  if (!token) throw new Error('Authentication required')

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// TeamMember interface for API responses
type TeamMemberData = {
  id: string
  teamId: string
  userId: string
  userName: string
  userEmail: string
  teamRole: TeamRole
  joinedAt: Date
  isActive: boolean
}

export const teamService = {
  // Cache for mentionable users
  _mentionableUsersCache: new Map<string, { users: any[], timestamp: number }>(),
  _CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  // TODO: Backend needs POST /api/teams endpoint
  async createTeam(_teamData: CreateTeamData, _createdBy: string, _leaderName: string, _leaderEmail: string, _companyId?: string | null): Promise<string> {
    console.warn('[teamService] createTeam not implemented in API')
    throw new Error('Team creation not yet implemented in MySQL backend')
  },

  // Get all teams (admin only)
  async getTeams(): Promise<Team[]> {
    return teamApiService.getAllTeams()
  },

  // Get teams for specific company (admin only)
  async getTeamsForCompany(companyId: string | null): Promise<Team[]> {
    return teamApiService.getTeamsForCompany(companyId)
  },

  // TODO: Backend needs GET /api/teams/:id endpoint
  async getTeamById(_teamId: string): Promise<Team | null> {
    console.warn('[teamService] getTeamById not implemented in API')
    return null
  },

  // TODO: Backend needs PUT /api/teams/:id endpoint
  async updateTeam(_teamId: string, _updates: UpdateTeamData): Promise<void> {
    console.warn('[teamService] updateTeam not implemented in API')
    throw new Error('Team update not yet implemented in MySQL backend')
  },

  // TODO: Backend needs DELETE /api/teams/:id endpoint
  async deleteTeam(_teamId: string): Promise<void> {
    console.warn('[teamService] deleteTeam not implemented in API')
    throw new Error('Team deletion not yet implemented in MySQL backend')
  },

  // Team Members - API endpoints exist for these
  async addTeamMember(teamId: string, memberData: AddTeamMemberData, _userName: string, _userEmail: string): Promise<string> {
    const response = await apiRequest<{ success: boolean; data: { id: string }; message?: string }>(
      `/teams/${teamId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ userId: memberData.userId, role: memberData.role })
      }
    )
    if (!response.success) {
      throw new Error(response.message || 'Failed to add team member')
    }
    return response.data.id
  },

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    try {
      const response = await apiRequest<{ success: boolean; data: TeamMemberData[]; count: number }>(
        `/teams/${teamId}/members`
      )
      if (!response.success) return []
      
      return response.data
        .filter(m => m.isActive !== false)
        .map(m => ({
          ...m,
          joinedAt: new Date(m.joinedAt),
          // Include fields that some TeamMember consumers expect
          name: m.userName,
          email: m.userEmail,
          role: (m.teamRole === 'leader' ? 'admin' : m.teamRole) as 'admin' | 'member' | 'manager' | 'viewer',
          // Default values for stats fields
          taskCount: 0,
          completedTasks: 0
        }))
        .sort((a, b) => {
          if (a.teamRole === 'leader' && b.teamRole !== 'leader') return -1
          if (b.teamRole === 'leader' && a.teamRole !== 'leader') return 1
          return a.joinedAt.getTime() - b.joinedAt.getTime()
        })
    } catch (error) {
      console.error('[teamService] Error getting team members:', error)
      return []
    }
  },

  // TODO: Backend needs GET /api/users/:userId/teams endpoint
  async getUserTeams(_userId: string): Promise<Team[]> {
    console.warn('[teamService] getUserTeams not implemented in API')
    return []
  },

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    // Find member by teamId and userId, then delete
    const members = await this.getTeamMembers(teamId)
    const member = members.find(m => m.userId === userId)
    if (!member) {
      throw new Error('Team member not found')
    }
    
    const response = await apiRequest<{ success: boolean; message?: string }>(
      `/teams/${teamId}/members/${member.id}`,
      { method: 'DELETE' }
    )
    if (!response.success) {
      throw new Error(response.message || 'Failed to remove team member')
    }
    
    // Clear user's team information
    const { userService } = await import('./userService')
    await userService.updateUserTeam(userId, null, null)
  },

  async updateTeamMemberRole(teamId: string, userId: string, newRole: TeamRole): Promise<void> {
    // Find member by teamId and userId, then update
    const members = await this.getTeamMembers(teamId)
    const member = members.find(m => m.userId === userId)
    if (!member) {
      throw new Error('Team member not found')
    }
    
    const response = await apiRequest<{ success: boolean; message?: string }>(
      `/teams/${teamId}/members/${member.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      }
    )
    if (!response.success) {
      throw new Error(response.message || 'Failed to update team member role')
    }
    
    // Update user's team role
    const { userService } = await import('./userService')
    await userService.updateUserTeam(userId, teamId, newRole)
    
    // If promoting to leader, update team leader info
    if (newRole === 'leader') {
      await this.updateTeam(teamId, { leaderId: userId })
    }
  },

  // TODO: Backend needs to handle member count updates automatically
  async updateTeamMemberCount(_teamId: string): Promise<void> {
    // This is now handled by the backend automatically
  },

  // Team Stats - use API if available, otherwise calculate from other data
  async getTeamStats(teamId: string, _startDate?: Date, _endDate?: Date): Promise<TeamStats> {
    try {
      return await teamApiService.getTeamStats(teamId)
    } catch (e) {
      console.warn('[teamService] getTeamStats API failed, returning empty stats')
      return {
        totalMembers: 0,
        activeMembers: 0,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        totalTimeLogged: 0,
        averageTaskCompletion: 0,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        totalTimeEntries: 0,
        averageHoursPerMember: 0,
        timeByProject: []
      }
    }
  },

  // Utility functions
  async isUserTeamLeader(userId: string, teamId: string): Promise<boolean> {
    const members = await this.getTeamMembers(teamId)
    const member = members.find(m => m.userId === userId)
    return member?.teamRole === 'leader'
  },

  async getUserTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
    const members = await this.getTeamMembers(teamId)
    const member = members.find(m => m.userId === userId)
    return member?.teamRole || null
  },

  // Get users who can be mentioned in a specific project context
  async getMentionableUsers(teamId: string, currentUserId: string): Promise<any[]> {
    try {
      const cacheKey = `${teamId}-${currentUserId}`
      const cached = this._mentionableUsersCache.get(cacheKey)
      
      if (cached && Date.now() - cached.timestamp < this._CACHE_DURATION) {
        return cached.users
      }
      
      const teamMembers = await this.getTeamMembers(teamId)
      
      const mentionableUsers = teamMembers
        .filter(member => member.userId !== currentUserId && member.isActive !== false)
        .map(member => ({
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          role: member.teamRole
        }))
      
      this._mentionableUsersCache.set(cacheKey, {
        users: mentionableUsers,
        timestamp: Date.now()
      })
      
      return mentionableUsers
    } catch (error) {
      console.error('[teamService] Error getting mentionable users:', error)
      return []
    }
  },

  // Get users who can be mentioned in task management context
  async getTaskMentionableUsers(currentUserId: string, assigneeId: string, companyId: string | null): Promise<any[]> {
    try {
      const { userService } = await import('./userService')
      const currentUser = await userService.getUserById(currentUserId)
      
      if (!currentUser) return []
      
      let allUsers: any[] = []
      try {
        allUsers = companyId 
          ? await userService.getUsersForCompany(companyId)
          : await userService.getAllUsers()
      } catch (error) {
        // Fallback: Get users individually
        const usersToCheck = []
        if (assigneeId && assigneeId !== currentUserId) {
          try {
            const assignee = await userService.getUserById(assigneeId)
            if (assignee) usersToCheck.push(assignee)
          } catch {}
        }
        try {
          const projectManagers = await userService.getProjectManagersForCompany(companyId)
          usersToCheck.push(...projectManagers)
        } catch {}
        allUsers = usersToCheck
      }
      
      const mentionableUsers = allUsers
        .filter(user => {
          if (user.id === currentUserId) return false
          if (['super_admin', 'admin', 'root'].includes(user.role)) return true
          if (assigneeId && user.id === assigneeId) return true
          return false
        })
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }))
      
      return Array.from(new Map(mentionableUsers.map(u => [u.id, u])).values())
    } catch (error) {
      console.error('[teamService] Error getting task mentionable users:', error)
      return []
    }
  }
}
