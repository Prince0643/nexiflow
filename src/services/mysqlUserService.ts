import pool from '../config/db';
import { User, UserRole } from '../types';

export const mysqlUserService = {
  // Get all users (for admin/team leader use)
  async getAllUsers(): Promise<User[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM users 
        WHERE is_active = 1
        ORDER BY name ASC
      `;

      const [rows]: any = await connection.execute(query);
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        companyId: row.company_id,
        teamId: row.team_id,
        teamRole: row.team_role,
        avatar: row.avatar,
        timezone: row.timezone,
        hourlyRate: row.hourly_rate,
        isActive: row.is_active === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get users for current company
  async getUsersForCompany(companyId: string | null): Promise<User[]> {
    if (!companyId) return [];

    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM users 
        WHERE company_id = ? AND is_active = 1
        ORDER BY name ASC
      `;

      const [rows]: any = await connection.execute(query, [companyId]);
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        companyId: row.company_id,
        teamId: row.team_id,
        teamRole: row.team_role,
        avatar: row.avatar,
        timezone: row.timezone,
        hourlyRate: row.hourly_rate,
        isActive: row.is_active === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT * FROM users WHERE id = ?`;

      const [rows]: any = await connection.execute(query, [userId]);
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        companyId: row.company_id,
        teamId: row.team_id,
        teamRole: row.team_role,
        avatar: row.avatar,
        timezone: row.timezone,
        hourlyRate: row.hourly_rate,
        isActive: row.is_active === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } finally {
      connection.release();
    }
  },

  // Update user information
  async updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'email' | 'role' | 'isActive' | 'timezone' | 'hourlyRate' | 'companyId'>>): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.role !== undefined) {
        fields.push('role = ?');
        values.push(updates.role);
      }
      if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.isActive ? 1 : 0);
      }
      if (updates.timezone !== undefined) {
        fields.push('timezone = ?');
        values.push(updates.timezone);
      }
      if (updates.hourlyRate !== undefined) {
        fields.push('hourly_rate = ?');
        values.push(updates.hourlyRate);
      }
      if (updates.companyId !== undefined) {
        fields.push('company_id = ?');
        values.push(updates.companyId);
      }

      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());

      if (fields.length === 0) {
        return; // Nothing to update
      }

      values.push(userId); // For the WHERE clause

      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
    } finally {
      connection.release();
    }
  },

  // Create user
  async createUser(userData: {
    name: string;
    email: string;
    role: UserRole;
    hourlyRate?: number;
    timezone: string;
    companyId?: string | null;
    passwordHash?: string;
  }): Promise<User> {
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO users (
          name, email, password_hash, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 1, ?, ?)
      `;

      const now = new Date();
      const result: any = await connection.execute(query, [
        userData.name,
        userData.email,
        userData.passwordHash || null,
        userData.role,
        userData.companyId || null,
        userData.timezone,
        userData.hourlyRate || 25,
        now,
        now
      ]);

      const newUser: User = {
        id: result[0].insertId.toString(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
        companyId: userData.companyId || null,
        teamId: null,
        teamRole: null,
        avatar: null,
        timezone: userData.timezone,
        hourlyRate: userData.hourlyRate || 25,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      return newUser;
    } finally {
      connection.release();
    }
  },

  // Delete user (soft delete by setting is_active to 0)
  async deleteUser(userId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?`;
      await connection.execute(query, [new Date(), userId]);
    } finally {
      connection.release();
    }
  }
};

export type { User };
