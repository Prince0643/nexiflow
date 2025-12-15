import { ref, set, get, push, remove, update, query, orderByChild, equalTo } from 'firebase/database'
import { database } from '../config/firebase'
import { 
  Team, 
  TeamMember, 
  CreateTeamData, 
  UpdateTeamData, 
  AddTeamMemberData, 
  TeamStats,
  TeamRole 
} from '../types'

// Use the second TeamMember interface (the one with teamId, userId, etc.)
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
  // Add cache as a module-level variable
  _mentionableUsersCache: new Map<string, { users: any[], timestamp: number }>(),
  _CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache

  // Teams
  async createTeam(teamData: CreateTeamData, createdBy: string, leaderName: string, leaderEmail: string, companyId?: string | null): Promise<string> {
    const teamRef = push(ref(database, 'teams'))
    const newTeam: Team = {
      ...teamData,
      id: teamRef.key!,
      leaderName,
      leaderEmail,
      companyId: companyId ?? null,
      isActive: true,
      memberCount: 1, // Leader is automatically a member
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await set(teamRef, {
      ...newTeam,
      createdAt: newTeam.createdAt.toISOString(),
      updatedAt: newTeam.updatedAt.toISOString()
    })
    
    // Add the leader as a team member
    await this.addTeamMember(teamRef.key!, {
      userId: teamData.leaderId,
      role: 'leader'
    }, leaderName, leaderEmail)
    
    return teamRef.key!
  },

  async getTeams(): Promise<Team[]> {
    const teamsRef = ref(database, 'teams')
    const snapshot = await get(teamsRef)
    
    if (snapshot.exists()) {
      const teams = snapshot.val()
      return Object.values(teams)
        .map((team: any) => ({
          ...team,
          createdAt: new Date(team.createdAt),
          updatedAt: new Date(team.updatedAt)
        }))
        .filter((team: Team) => team.isActive)
        .sort((a: Team, b: Team) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get teams for specific company (multi-tenant safe)
  async getTeamsForCompany(companyId: string | null): Promise<Team[]> {
    const teamsRef = ref(database, 'teams')
    const snapshot = await get(teamsRef)
    
    if (snapshot.exists()) {
      const teams = snapshot.val()
      return Object.values(teams)
        .map((team: any) => ({
          ...team,
          createdAt: new Date(team.createdAt),
          updatedAt: new Date(team.updatedAt)
        }))
        .filter((team: Team) => {
          // Filter by company and active status
          return team.isActive && (team as any).companyId === companyId
        })
        .sort((a: Team, b: Team) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  async getTeamById(teamId: string): Promise<Team | null> {
    const teamRef = ref(database, `teams/${teamId}`)
    const snapshot = await get(teamRef)
    
    if (snapshot.exists()) {
      const team = snapshot.val()
      return {
        ...team,
        createdAt: new Date(team.createdAt),
        updatedAt: new Date(team.updatedAt)
      }
    }
    
    return null
  },

  async updateTeam(teamId: string, updates: UpdateTeamData): Promise<void> {
    const teamRef = ref(database, `teams/${teamId}`)
    await update(teamRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    })
  },

  async deleteTeam(teamId: string): Promise<void> {
    const teamRef = ref(database, `teams/${teamId}`)
    await update(teamRef, {
      isActive: false,
      updatedAt: new Date().toISOString()
    })
  },

  // Team Members
  async addTeamMember(teamId: string, memberData: AddTeamMemberData, userName: string, userEmail: string): Promise<string> {
    const memberRef = push(ref(database, 'teamMembers'))
    const newMember: TeamMemberData = {
      id: memberRef.key!,
      teamId,
      userId: memberData.userId,
      userName,
      userEmail,
      teamRole: memberData.role,
      joinedAt: new Date(),
      isActive: true
    }
    
    await set(memberRef, {
      ...newMember,
      joinedAt: newMember.joinedAt.toISOString()
    })
    
    // Update user's team information
    const { userService } = await import('./userService')
    await userService.updateUserTeam(memberData.userId, teamId, memberData.role)
    
    // Update team member count
    await this.updateTeamMemberCount(teamId)
    
    return memberRef.key!
  },

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    try {
      console.log('=== getTeamMembers called ===');
      console.log('teamId:', teamId);
      
      const membersRef = ref(database, 'teamMembers')
      const q = query(membersRef, orderByChild('teamId'), equalTo(teamId))
      const snapshot = await get(q)
      
      if (snapshot.exists()) {
        const members = snapshot.val()
        console.log('Team members raw data:', members)
        const result = Object.values(members)
          .map((member: any) => {
            // Ensure we're properly parsing the date
            const joinedAt = member.joinedAt ? new Date(member.joinedAt) : new Date()
            return {
              ...member,
              joinedAt
            }
          })
          .filter((member: TeamMember) => {
            console.log(`Checking member ${member.userName} (${member.userId}): isActive=${member.isActive}, teamId=${member.teamId}`);
            // Additional check to ensure the member belongs to the correct team
            const correctTeam = member.teamId === teamId;
            const isActive = member.isActive !== false; // Default to true if undefined
            console.log(`Member ${member.userName}: correctTeam=${correctTeam}, isActive=${isActive}`);
            return correctTeam && isActive;
          })
          .sort((a: TeamMember, b: TeamMember) => {
            // Leaders first, then by join date
            if (a.teamRole === 'leader' && b.teamRole !== 'leader') return -1
            if (b.teamRole === 'leader' && a.teamRole !== 'leader') return 1
            return a.joinedAt.getTime() - b.joinedAt.getTime()
          })
        console.log('Team members result:', result)
        return result
      }
      
      console.log('No team members found for teamId:', teamId)
      return []
    } catch (error) {
      console.error('Error getting team members:', error)
      return []
    }
  },

  async getUserTeams(userId: string): Promise<Team[]> {
    const membersRef = ref(database, 'teamMembers')
    const q = query(membersRef, orderByChild('userId'), equalTo(userId))
    const snapshot = await get(q)
    
    if (snapshot.exists()) {
      const members = snapshot.val()
      const teamIds = Object.values(members)
        .filter((member: any) => member.isActive)
        .map((member: any) => member.teamId)
      
      const teams = await Promise.all(
        teamIds.map(teamId => this.getTeamById(teamId))
      )
      
      return teams.filter(team => team !== null) as Team[]
    }
    
    return []
  },

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const membersRef = ref(database, 'teamMembers')
    const q = query(membersRef, orderByChild('teamId'), equalTo(teamId))
    const snapshot = await get(q)
    
    if (snapshot.exists()) {
      const members = snapshot.val()
      const memberEntry = Object.entries(members).find(
        ([_, member]: [string, any]) => member.userId === userId && member.teamId === teamId
      )
      
      if (memberEntry) {
        const [memberId] = memberEntry
        const memberRef = ref(database, `teamMembers/${memberId}`)
        await update(memberRef, {
          isActive: false,
          leftAt: new Date().toISOString()
        })
        
        // Clear user's team information
        const { userService } = await import('./userService')
        await userService.updateUserTeam(userId, null, null)
        
        // Update team member count
        await this.updateTeamMemberCount(teamId)
      }
    }
  },

  async updateTeamMemberRole(teamId: string, userId: string, newRole: TeamRole): Promise<void> {
    const membersRef = ref(database, 'teamMembers')
    const q = query(membersRef, orderByChild('teamId'), equalTo(teamId))
    const snapshot = await get(q)
    
    if (snapshot.exists()) {
      const members = snapshot.val()
      const memberEntry = Object.entries(members).find(
        ([_, member]: [string, any]) => member.userId === userId && member.teamId === teamId
      )
      
      if (memberEntry) {
        const [memberId] = memberEntry
        const memberRef = ref(database, `teamMembers/${memberId}`)
        await update(memberRef, {
          teamRole: newRole
        })
        
        // Update user's team role
        const { userService } = await import('./userService')
        await userService.updateUserTeam(userId, teamId, newRole)
        
        // If promoting to leader, update team leader info
        if (newRole === 'leader') {
          const member = memberEntry[1] as any
          await this.updateTeam(teamId, {
            leaderId: userId
          })
        }
      }
    }
  },

  async updateTeamMemberCount(teamId: string): Promise<void> {
    const members = await this.getTeamMembers(teamId)
    const teamRef = ref(database, `teams/${teamId}`)
    await update(teamRef, {
      memberCount: members.length,
      updatedAt: new Date().toISOString()
    })
  },

  // Team Stats
  async getTeamStats(teamId: string, startDate?: Date, endDate?: Date): Promise<TeamStats> {
    const members = await this.getTeamMembers(teamId)
    const activeMembers = members.filter(member => member.isActive).length
    
    // If no date range provided, calculate for current week (Sunday to Saturday)
    let actualStartDate = startDate
    let actualEndDate = endDate
    
    if (!startDate && !endDate) {
      // Calculate current week (Sunday to Saturday)
      const now = new Date()
      const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.
      
      // Start of week (Sunday)
      actualStartDate = new Date(now)
      actualStartDate.setDate(now.getDate() - dayOfWeek)
      actualStartDate.setHours(0, 0, 0, 0)
      
      // End of week (Saturday)
      actualEndDate = new Date(actualStartDate)
      actualEndDate.setDate(actualStartDate.getDate() + 6)
      actualEndDate.setHours(23, 59, 59, 999)
    }
    
    // Get tasks for all team members
    const { taskService } = await import('./taskService')
    const allTasks = await taskService.getTasks()
    const teamMemberIds = members.map(member => member.userId)
    const teamTasks = allTasks.filter(task => teamMemberIds.includes(task.createdBy))
    
    const totalTasks = teamTasks.length
    const completedTasks = teamTasks.filter(task => task.isCompleted).length
    const inProgressTasks = teamTasks.filter(task => 
      task.status && typeof task.status === 'object' && task.status.name === 'In Progress'
    ).length
    const overdueTasks = teamTasks.filter(task => 
      task.dueDate && new Date(task.dueDate) < new Date() && !task.isCompleted
    ).length
    
    // Get time entries for all team members
    const { timeEntryService } = await import('./timeEntryService')
    const { projectService } = await import('./projectService')
    
    let timeEntries = []
    if (actualStartDate && actualEndDate) {
      timeEntries = await timeEntryService.getAllTimeEntriesByDateRange(actualStartDate, actualEndDate)
    } else {
      timeEntries = await timeEntryService.getAllTimeEntries()
    }
    
    // Filter time entries for team members only
    const teamTimeEntries = timeEntries.filter(entry => teamMemberIds.includes(entry.userId))
    
    // Calculate time statistics with proportional billable allocation
    const totalSeconds = teamTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
    const totalHours = totalSeconds / 3600
    
    // Calculate billable hours proportionally for each team member
    let totalBillableSeconds = 0
    
    // For each team member, calculate their proportional billable contribution
    for (const memberId of teamMemberIds) {
      // Get all time entries for this member (across all teams)
      const memberAllEntries = timeEntries.filter(entry => entry.userId === memberId)
      const memberTeamEntries = teamTimeEntries.filter(entry => entry.userId === memberId)
      
      if (memberAllEntries.length > 0 && memberTeamEntries.length > 0) {
        // Calculate member's total billable time across all teams
        const memberTotalBillableSeconds = memberAllEntries
          .filter(entry => entry.isBillable)
          .reduce((sum, entry) => sum + entry.duration, 0)
        
        // Calculate member's total time across all teams
        const memberTotalSeconds = memberAllEntries.reduce((sum, entry) => sum + entry.duration, 0)
        
        // Calculate member's time for this specific team
        const memberTeamSeconds = memberTeamEntries.reduce((sum, entry) => sum + entry.duration, 0)
        
        // Calculate proportional billable time for this team
        // Formula: (member's team hours / member's total hours) * member's total billable hours
        if (memberTotalSeconds > 0) {
          const proportionalBillableSeconds = (memberTeamSeconds / memberTotalSeconds) * memberTotalBillableSeconds
          totalBillableSeconds += proportionalBillableSeconds
        }
      }
    }
    
    const billableHours = totalBillableSeconds / 3600
    const nonBillableHours = totalHours - billableHours
    const totalTimeEntries = teamTimeEntries.length
    
    // Debug logging to identify billable hours calculation issue
    console.log('Debug Team Stats Calculation (Fixed):', {
      teamId,
      teamMemberIds,
      totalTimeEntries: teamTimeEntries.length,
      allTimeEntries: timeEntries.length,
      totalSeconds,
      totalHours,
      totalBillableSeconds,
      billableHours,
      nonBillableHours,
      memberBreakdown: teamMemberIds.map(memberId => {
        const memberAllEntries = timeEntries.filter(entry => entry.userId === memberId)
        const memberTeamEntries = teamTimeEntries.filter(entry => entry.userId === memberId)
        const memberTotalBillableSeconds = memberAllEntries.filter(entry => entry.isBillable).reduce((sum, entry) => sum + entry.duration, 0)
        const memberTotalSeconds = memberAllEntries.reduce((sum, entry) => sum + entry.duration, 0)
        const memberTeamSeconds = memberTeamEntries.reduce((sum, entry) => sum + entry.duration, 0)
        const proportionalBillableSeconds = memberTotalSeconds > 0 ? (memberTeamSeconds / memberTotalSeconds) * memberTotalBillableSeconds : 0
        
        return {
          memberId,
          memberTotalHours: memberTotalSeconds / 3600,
          memberTeamHours: memberTeamSeconds / 3600,
          memberTotalBillableHours: memberTotalBillableSeconds / 3600,
          proportionalBillableHours: proportionalBillableSeconds / 3600
        }
      })
    })
    
    // Calculate average hours per member
    const averageHoursPerMember = activeMembers > 0 ? totalHours / activeMembers : 0
    
    // Find most active member
    const memberHours: { [userId: string]: { userName: string; hours: number } } = {}
    teamTimeEntries.forEach(entry => {
      const member = members.find(m => m.userId === entry.userId)
      if (member) {
        if (!memberHours[entry.userId]) {
          memberHours[entry.userId] = { userName: member.userName, hours: 0 }
        }
        memberHours[entry.userId].hours += entry.duration / 3600
      }
    })
    
    const mostActiveMember = Object.entries(memberHours)
      .sort(([,a], [,b]) => b.hours - a.hours)[0]
    
    // Get time by project
    const projectTime: { [projectId: string]: { projectName: string; hours: number } } = {}
    teamTimeEntries.forEach(entry => {
      if (entry.projectId) {
        if (!projectTime[entry.projectId]) {
          projectTime[entry.projectId] = { projectName: entry.projectName || 'Unknown Project', hours: 0 }
        }
        projectTime[entry.projectId].hours += entry.duration / 3600
      }
    })
    
    const timeByProject = Object.entries(projectTime)
      .map(([projectId, data]) => ({
        projectId,
        projectName: data.projectName,
        hours: data.hours,
        percentage: totalHours > 0 ? (data.hours / totalHours) * 100 : 0
      }))
      .sort((a, b) => b.hours - a.hours)
    
    const averageTaskCompletion = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    
    return {
      totalMembers: members.length,
      activeMembers,
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      totalTimeLogged: totalSeconds, // Keep for backward compatibility
      averageTaskCompletion,
      // New time tracking data
      totalHours,
      billableHours,
      nonBillableHours,
      totalTimeEntries,
      averageHoursPerMember,
      mostActiveMember: mostActiveMember ? {
        userId: mostActiveMember[0],
        userName: mostActiveMember[1].userName,
        hours: mostActiveMember[1].hours
      } : undefined,
      timeByProject
    }
  },

  // Utility functions
  async isUserTeamLeader(userId: string, teamId: string): Promise<boolean> {
    // Get team members and check if the user is a leader in the team members collection
    const members = await this.getTeamMembers(teamId);
    const member = members.find(m => m.userId === userId);
    return member?.teamRole === 'leader';
  },

  async getUserTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
    const members = await this.getTeamMembers(teamId)
    const member = members.find(m => m.userId === userId)
    return member?.teamRole || null
  },

  // Get users who can be mentioned in a specific project context
  async getMentionableUsers(teamId: string, currentUserId: string): Promise<any[]> {
    try {
      // Check cache first
      const cacheKey = `${teamId}-${currentUserId}`;
      const cached = this._mentionableUsersCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this._CACHE_DURATION) {
        console.log('Returning cached mentionable users');
        return cached.users;
      }
      
      console.log('=== getMentionableUsers called ===');
      console.log('teamId:', teamId);
      console.log('currentUserId:', currentUserId);
      
      // Get the current user to determine their team
      const { userService } = await import('./userService');
      const currentUser = await userService.getUserById(currentUserId);
      console.log('Current user:', currentUser);
      
      if (!currentUser) {
        console.log('No current user found for ID:', currentUserId);
        return [];
      }
      
      // If user has a team, get team members
      let mentionableUsers: any[] = [];
      // Use teamId as the primary team ID
      const effectiveTeamId = teamId || currentUser.teamId;
      
      if (effectiveTeamId) {
        console.log('Using effective team ID:', effectiveTeamId);
        try {
          // Get team members directly - this is what we'll use for mentions
          // since we can't read individual user records due to Firebase permissions
          const teamMembers = await this.getTeamMembers(effectiveTeamId);
          console.log('Team members:', teamMembers);
          
          // Filter out the current user and inactive members, then map to the expected format
          mentionableUsers = teamMembers
            .filter(member => {
              const isNotCurrentUser = member.userId !== currentUserId;
              const isActive = member.isActive !== false;
              console.log(`Team member ${member.userName}: isNotCurrentUser=${isNotCurrentUser}, isActive=${isActive}`);
              return isNotCurrentUser && isActive;
            })
            .map(member => ({
              id: member.userId,
              name: member.userName,
              email: member.userEmail,
              role: member.teamRole
            }));
          
          console.log('Mentionable users (team-based):', mentionableUsers);
        } catch (error) {
          console.error('Error getting team members:', error);
          mentionableUsers = [];
        }
      } else {
        console.log('No team context available, returning empty array');
        console.log('currentUser.teamId:', currentUser.teamId);
        console.log('teamId:', teamId);
        mentionableUsers = [];
      }
      
      // Cache the results
      this._mentionableUsersCache.set(cacheKey, {
        users: mentionableUsers,
        timestamp: Date.now()
      });
      
      console.log('Final mentionable users:', mentionableUsers);
      return mentionableUsers;
    } catch (error) {
      console.error('Error getting mentionable users:', error);
      return [];
    }
  },

  // Get users who can be mentioned in task management context
  // Only super admins, admins, and the task assignee can be mentioned
  async getTaskMentionableUsers(currentUserId: string, assigneeId: string, companyId: string | null): Promise<any[]> {
    try {
      console.log('=== getTaskMentionableUsers called ===');
      console.log('currentUserId:', currentUserId);
      console.log('assigneeId:', assigneeId);
      console.log('companyId:', companyId);
      
      // Validate inputs
      if (!currentUserId) {
        console.log('No current user ID provided');
        return [];
      }
      
      // Get the current user to determine their role
      const { userService } = await import('./userService');
      const currentUser = await userService.getUserById(currentUserId);
      console.log('Current user:', currentUser);
      
      if (!currentUser) {
        console.log('No current user found for ID:', currentUserId);
        return [];
      }
      
      // Get all users in the same company
      let allUsers: any[] = [];
      try {
        allUsers = companyId 
          ? await userService.getUsersForCompany(companyId)
          : await userService.getAllUsers();
        console.log('All users in company:', allUsers.length);
      } catch (error) {
        console.warn('Permission denied when getting users for company, falling back to individual user lookups:', error);
        // Fallback: Get users individually if we can't get the full list
        // This is for cases where employees don't have permission to access the full user list
        const usersToCheck = [];
        
        // Add the assignee if different from current user
        if (assigneeId && assigneeId !== currentUserId) {
          try {
            const assignee = await userService.getUserById(assigneeId);
            if (assignee) {
              usersToCheck.push(assignee);
            }
          } catch (assigneeError) {
            console.warn('Could not load assignee:', assigneeError);
          }
        }
        
        // Try to get project managers for the company
        try {
          const projectManagers = await userService.getProjectManagersForCompany(companyId);
          usersToCheck.push(...projectManagers);
        } catch (pmError) {
          console.warn('Could not load project managers:', pmError);
        }
        
        allUsers = usersToCheck;
      }
      
      // Filter users who can be mentioned:
      // 1. Super admins
      // 2. Admins
      // 3. The assignee of the task (if different from current user)
      const mentionableUsers = allUsers.filter(user => {
        // Don't include the current user (can't mention yourself)
        if (user.id === currentUserId) {
          return false;
        }
        
        // Include super admins and admins
        if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'root') {
          return true;
        }
        
        // Include the assignee if they're different from current user
        if (assigneeId && user.id === assigneeId) {
          return true;
        }
        
        return false;
      }).map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }));
      
      console.log('Mentionable users for task:', mentionableUsers);
      return mentionableUsers;
    } catch (error) {
      console.error('Error getting task mentionable users:', error);
      return [];
    }
  }

}
