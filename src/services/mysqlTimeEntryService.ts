import pool from '../config/db';
import { TimeEntry, CreateTimeEntryData, TimeSummary } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const mysqlTimeEntryService = {  // Create a new time entry
  async createTimeEntry(entryData: CreateTimeEntryData, userId: string, projectName?: string, companyId?: string | null, clientName?: string): Promise<string> {
    // First check if user already has a running timer to prevent multiple concurrent timers
    const existingRunningEntry = await this.getRunningTimeEntry(userId);
    if (existingRunningEntry) {
      throw new Error('Cannot start a new timer: You already have a timer running. Please stop the current timer first.');
    }

    const connection = await pool.getConnection();
    try {
      const now = new Date();
      const entryId = uuidv4(); // Generate a unique ID for the time entry
      const query = `
        INSERT INTO time_entries (
          id, user_id, company_id, project_id, project_name, client_id, client_name,
          description, start_time, duration, is_running, is_billable, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.execute(query, [
        entryId,
        userId,
        companyId || null,
        entryData.projectId || null,
        projectName || null,
        entryData.clientId || null,
        clientName || null,
        entryData.description || null,
        now,
        0,
        true,
        entryData.isBillable || false,
        now,
        now
      ]);

      return entryId;
    } finally {
      connection.release();
    }
  },

  // Get all time entries for a user
  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `;

      const [rows]: any = await connection.execute(query, [userId]);
      return rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get time entries for a specific date range
  async getTimeEntriesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    const connection = await pool.getConnection();
    try {
      // Adjust end date to end of day to include all entries for that day
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const query = `
        SELECT * FROM time_entries 
        WHERE user_id = ? AND start_time >= ? AND start_time <= ?
        ORDER BY created_at DESC
      `;

      const [rows]: any = await connection.execute(query, [userId, startDate, adjustedEndDate]);
      return rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get currently running time entry
  async getRunningTimeEntry(userId: string): Promise<TimeEntry | null> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        WHERE user_id = ? AND is_running = 1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const [rows]: any = await connection.execute(query, [userId]);
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } finally {
      connection.release();
    }
  },

  // Stop a running time entry
  async stopTimeEntry(entryId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      // First get the entry to calculate duration
      const selectQuery = `SELECT start_time FROM time_entries WHERE id = ?`;
      const [rows]: any = await connection.execute(selectQuery, [entryId]);

      if (rows.length === 0) {
        throw new Error('Time entry not found');
      }

      const startTime = new Date(rows[0].start_time);
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const updateQuery = `
        UPDATE time_entries 
        SET end_time = ?, duration = ?, is_running = 0, updated_at = ?
        WHERE id = ?
      `;

      await connection.execute(updateQuery, [endTime, duration, new Date(), entryId]);
    } finally {
      connection.release();
    }
  },

  // Update a time entry
  async updateTimeEntry(entryId: string, updates: Partial<CreateTimeEntryData & { projectName?: string, clientName?: string }>): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.projectId !== undefined) {
        fields.push('project_id = ?');
        values.push(updates.projectId || null);
      }
      if (updates.clientId !== undefined) {
        fields.push('client_id = ?');
        values.push(updates.clientId || null);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description || null);
      }
      if (updates.isBillable !== undefined) {
        fields.push('is_billable = ?');
        values.push(updates.isBillable ? 1 : 0);
      }
      if (updates.projectName !== undefined) {
        fields.push('project_name = ?');
        values.push(updates.projectName || null);
      }
      if (updates.clientName !== undefined) {
        fields.push('client_name = ?');
        values.push(updates.clientName || null);
      }
      
      // Handle tags update if provided
      if (updates.tags !== undefined) {
        // We'll handle tags in the time_entry_tags table separately
        // First, delete all existing tags for this time entry
        await connection.execute(
          'DELETE FROM time_entry_tags WHERE time_entry_id = ?',
          [entryId]
        );
        
        // Then insert new tags if provided
        if (updates.tags && Array.isArray(updates.tags) && updates.tags.length > 0) {
          for (const tag of updates.tags) {
            await connection.execute(
              'INSERT INTO time_entry_tags (time_entry_id, tag) VALUES (?, ?)',
              [entryId, tag]
            );
          }
        }
      }
      
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());

      if (fields.length === 0) {
        return; // Nothing to update
      }

      values.push(entryId); // For the WHERE clause

      const query = `UPDATE time_entries SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
    } finally {
      connection.release();
    }
  },

  // Delete a time entry
  async deleteTimeEntry(entryId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `DELETE FROM time_entries WHERE id = ?`;
      await connection.execute(query, [entryId]);
    } finally {
      connection.release();
    }
  },

  // Get time summary for dashboard
  async getTimeSummary(userId: string): Promise<TimeSummary> {
    const connection = await pool.getConnection();
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfWeek.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Today's stats
      const todayQuery = `
        SELECT SUM(duration) as total_duration, 
               SUM(CASE WHEN is_billable = 1 THEN duration ELSE 0 END) as billable_duration,
               COUNT(*) as entry_count
        FROM time_entries 
        WHERE user_id = ? AND start_time >= ? AND start_time <= ?
      `;
      
      const [todayRows]: any = await connection.execute(todayQuery, [userId, startOfDay, new Date(now.getTime() + 86400000)]);
      
      // Week's stats
      const weekQuery = `
        SELECT SUM(duration) as total_duration, 
               SUM(CASE WHEN is_billable = 1 THEN duration ELSE 0 END) as billable_duration,
               COUNT(*) as entry_count
        FROM time_entries 
        WHERE user_id = ? AND start_time >= ? AND start_time <= ?
      `;
      
      const [weekRows]: any = await connection.execute(weekQuery, [userId, startOfWeek, new Date(now.getTime() + 86400000)]);
      
      // Month's stats
      const monthQuery = `
        SELECT SUM(duration) as total_duration, 
               SUM(CASE WHEN is_billable = 1 THEN duration ELSE 0 END) as billable_duration,
               COUNT(*) as entry_count
        FROM time_entries 
        WHERE user_id = ? AND start_time >= ? AND start_time <= ?
      `;
      
      const [monthRows]: any = await connection.execute(monthQuery, [userId, startOfMonth, new Date(now.getTime() + 86400000)]);

      return {
        today: {
          total: todayRows[0].total_duration || 0,
          billable: todayRows[0].billable_duration || 0,
          entries: todayRows[0].entry_count || 0
        },
        thisWeek: {
          total: weekRows[0].total_duration || 0,
          billable: weekRows[0].billable_duration || 0,
          entries: weekRows[0].entry_count || 0
        },
        thisMonth: {
          total: monthRows[0].total_duration || 0,
          billable: monthRows[0].billable_duration || 0,
          entries: monthRows[0].entry_count || 0
        }
      };
    } finally {
      connection.release();
    }
  },

  // Get all time entries (for admin use)
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        ORDER BY created_at DESC
      `;

      const [rows]: any = await connection.execute(query);
      return rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get all running time entries (for admin use)
  async getAllRunningTimeEntries(companyId: string | null): Promise<TimeEntry[]> {
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT * FROM time_entries 
        WHERE is_running = 1
        ORDER BY created_at DESC
      `;
      let params: any[] = [];

      if (companyId) {
        query = `
          SELECT te.* FROM time_entries te
          JOIN users u ON te.user_id = u.id
          WHERE te.is_running = 1 AND u.company_id = ?
          ORDER BY te.created_at DESC
        `;
        params = [companyId];
      }

      const [rows]: any = await connection.execute(query, params);
      return rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  }
};

export type { TimeEntry };
