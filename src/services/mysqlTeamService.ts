import pool from '../config/db';
import { Team, TeamMember, CreateTeamData, UpdateTeamData, AddTeamMemberData, TeamStats } from '../types';

export const mysqlTeamService = {
  // Teams
  async createTeam(teamData: CreateTeamData, createdBy: string, leaderName: string, leaderEmail: string, companyId?: string | null): Promise<string> {
    const connection = await pool.getConnection();
    try {
      const now = new Date().toISOString();
      const query = `
        INSERT INTO teams (
          name, description, leader_id, leader_name, leader_email, color,
          company_id, is_active, member_count, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result: any = await connection.execute(query, [
        teamData.name,
        teamData.description || null,
        teamData.leaderId,
        leaderName,
        leaderEmail,
        teamData.color,
        companyId || null,
        1, // is_active
        1, // member_count (leader is automatically a member)
        createdBy,
        now,
        now
      ]);
      
      const teamId = result[0].insertId.toString();
      
      // Add the leader as a team member
      await this.addTeamMember(teamId, {
        userId: teamData.leaderId,
        role: 'leader'
      }, leaderName, leaderEmail);
      
      return teamId;
    } finally {
      connection.release();
    }
  },

  async getTeams(): Promise<Team[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM teams 
        WHERE is_active = 1
        ORDER BY created_at DESC
      `;
      
      const [rows]: any = await connection.execute(query);
      
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        leaderId: row.leader_id,
        leaderName: row.leader_name,
        leaderEmail: row.leader_email,
        color: row.color,
        companyId: row.company_id,
        isActive: row.is_active === 1,
        memberCount: row.member_count,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get teams for specific company (multi-tenant safe)
  async getTeamsForCompany(companyId: string | null): Promise<Team[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM teams 
        WHERE is_active = 1 AND company_id = ?
        ORDER BY created_at DESC
      `;
      
      const [rows]: any = await connection.execute(query, [companyId]);
      
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        leaderId: row.leader_id,
        leaderName: row.leader_name,
        leaderEmail: row.leader_email,
        color: row.color,
        companyId: row.company_id,
        isActive: row.is_active === 1,
        memberCount: row.member_count,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  async getTeamById(teamId: string): Promise<Team | null> {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT * FROM teams WHERE id = ?`;
      const [rows]: any = await connection.execute(query, [teamId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        leaderId: row.leader_id,
        leaderName: row.leader_name,
        leaderEmail: row.leader_email,
        color: row.color,
        companyId: row.company_id,
        isActive: row.is_active === 1,
        memberCount: row.member_count,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } finally {
      connection.release();
    }
  },

  async updateTeam(teamId: string, updates: UpdateTeamData): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.leaderId !== undefined) {
        fields.push('leader_id = ?');
        values.push(updates.leaderId);
      }
      if (updates.color !== undefined) {
        fields.push('color = ?');
        values.push(updates.color);
      }
      if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.isActive ? 1 : 0);
      }
      
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      
      if (fields.length === 0) {
        return; // Nothing to update
      }
      
      values.push(teamId); // For the WHERE clause
      
      const query = `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
    } finally {
      connection.release();
    }
  },

  async deleteTeam(teamId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `UPDATE teams SET is_active = 0, updated_at = ? WHERE id = ?`;
      await connection.execute(query, [new Date().toISOString(), teamId]);
    } finally {
      connection.release();
    }
  },

  // Team Members
  async addTeamMember(teamId: string, memberData: AddTeamMemberData, userName: string, userEmail: string): Promise<string> {
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO team_members (
          team_id, user_id, user_name, user_email, team_role, joined_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const now = new Date().toISOString();
      const result: any = await connection.execute(query, [
        teamId,
        memberData.userId,
        userName,
        userEmail,
        memberData.role,
        now,
        1 // is_active
      ]);
      
      const memberId = result[0].insertId.toString();
      
      // Update user's team information
      // Note: This would typically be done in the user service, but we'll handle it here for simplicity
      // In a real implementation, you might want to call the mysqlUserService.updateUserTeam method
      
      // Update team member count
      await this.updateTeamMemberCount(teamId);
      
      return memberId;
    } finally {
      connection.release();
    }
  },

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM team_members 
        WHERE team_id = ? AND is_active = 1
        ORDER BY team_role = 'leader' DESC, joined_at ASC
      `;
      
      const [rows]: any = await connection.execute(query, [teamId]);
      
      return rows.map((row: any) => ({
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        teamRole: row.team_role,
        joinedAt: new Date(row.joined_at),
        isActive: row.is_active === 1
      }));
    } finally {
      connection.release();
    }
  },

  async getUserTeams(userId: string): Promise<Team[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT t.* FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ? AND tm.is_active = 1 AND t.is_active = 1
        ORDER BY t.created_at DESC
      `;
      
      const [rows]: any = await connection.execute(query, [userId]);
      
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        leaderId: row.leader_id,
        leaderName: row.leader_name,
        leaderEmail: row.leader_email,
        color: row.color,
        companyId: row.company_id,
        isActive: row.is_active === 1,
        memberCount: row.member_count,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `
        UPDATE team_members 
        SET is_active = 0, left_at = ?
        WHERE team_id = ? AND user_id = ?
      `;
      
      await connection.execute(query, [
        new Date().toISOString(),
        teamId,
        userId
      ]);
      
      // Update team member count
      await this.updateTeamMemberCount(teamId);
    } finally {
      connection.release();
    }
  },

  async updateTeamMemberRole(teamId: string, userId: string, newRole: 'member' | 'leader'): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `
        UPDATE team_members 
        SET team_role = ?
        WHERE team_id = ? AND user_id = ?
      `;
      
      await connection.execute(query, [
        newRole,
        teamId,
        userId
      ]);
      
      // If promoting to leader, update team leader info
      if (newRole === 'leader') {
        await this.updateTeam(teamId, {
          leaderId: userId
        });
      }
    } finally {
      connection.release();
    }
  },

  async updateTeamMemberCount(teamId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      // Get active member count
      const countQuery = `
        SELECT COUNT(*) as count FROM team_members 
        WHERE team_id = ? AND is_active = 1
      `;
      const [countRows]: any = await connection.execute(countQuery, [teamId]);
      const memberCount = countRows[0].count;
      
      // Update team member count
      const updateQuery = `
        UPDATE teams 
        SET member_count = ?, updated_at = ?
        WHERE id = ?
      `;
      
      await connection.execute(updateQuery, [
        memberCount,
        new Date().toISOString(),
        teamId
      ]);
    } finally {
      connection.release();
    }
  },

  // Team Stats
  async getTeamStats(teamId: string): Promise<TeamStats> {
    const connection = await pool.getConnection();
    try {
      // Get team members
      const members = await this.getTeamMembers(teamId);
      const activeMembers = members.filter(member => member.isActive).length;
      
      // For now, we'll return basic stats
      // In a full implementation, you would integrate with task and time entry services
      return {
        totalMembers: members.length,
        activeMembers,
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
      };
    } finally {
      connection.release();
    }
  },

  // Utility functions
  async isUserTeamLeader(userId: string, teamId: string): Promise<boolean> {
    const members = await this.getTeamMembers(teamId);
    const member = members.find(m => m.userId === userId);
    return member?.teamRole === 'leader' || false;
  },

  async getUserTeamRole(userId: string, teamId: string): Promise<'member' | 'leader' | null> {
    const members = await this.getTeamMembers(teamId);
    const member = members.find(m => m.userId === userId);
    return member?.teamRole || null;
  }
};