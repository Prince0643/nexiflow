import pool from '../config/db';
import { Task, CreateTaskData, UpdateTaskData, TaskStatus, TaskPriority } from '../types';

export const mysqlTaskService = {
  // Tasks
  async createTask(taskData: CreateTaskData, userId: string, userName: string, companyId?: string | null): Promise<Task> {
    const connection = await pool.getConnection();
    try {
      // Get default statuses and priorities
      const defaultStatuses: TaskStatus[] = [
        { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
        { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
        { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
        { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
      ];
      
      const defaultPriorities: TaskPriority[] = [
        { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
        { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
        { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
        { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
      ];
      
      // Find the actual status and priority objects based on the IDs provided
      const status = defaultStatuses.find(s => s.id === taskData.status) || defaultStatuses[0];
      const priority = defaultPriorities.find(p => p.id === taskData.priority) || defaultPriorities[0];
      
      const now = new Date().toISOString();
      const query = `
        INSERT INTO tasks (
          title, description, notes, project_id, project_name, status_id, status_name,
          status_color, status_order, status_is_completed, priority_id, priority_name,
          priority_color, priority_level, assignee_id, assignee_name, assignee_email,
          due_date, estimated_hours, actual_hours, is_completed, completed_at, created_by,
          created_by_name, created_at, updated_at, parent_task_id, team_id, company_id,
          tags, attachments, comments, time_entries
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result: any = await connection.execute(query, [
        taskData.title,
        taskData.description || null,
        null, // notes
        taskData.projectId,
        '', // project_name (will be set when project is loaded)
        status.id,
        status.name,
        status.color,
        status.order,
        status.isCompleted ? 1 : 0,
        priority.id,
        priority.name,
        priority.color,
        priority.level,
        taskData.assigneeId || null,
        null, // assignee_name
        null, // assignee_email
        taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
        taskData.estimatedHours || null,
        null, // actual_hours
        0, // is_completed
        null, // completed_at
        userId,
        userName,
        now,
        now,
        taskData.parentTaskId || null,
        taskData.teamId || null,
        companyId || null,
        JSON.stringify(taskData.tags || []), // tags
        JSON.stringify([]), // attachments
        JSON.stringify([]), // comments
        JSON.stringify([]) // time_entries
      ]);
      
      const newTask: Task = {
        id: result[0].insertId.toString(),
        title: taskData.title,
        description: taskData.description,
        notes: undefined,
        projectId: taskData.projectId,
        projectName: '',
        status,
        priority,
        assigneeId: taskData.assigneeId,
        assigneeName: undefined,
        assigneeEmail: undefined,
        dueDate: taskData.dueDate,
        estimatedHours: taskData.estimatedHours,
        actualHours: undefined,
        tags: taskData.tags || [],
        isCompleted: false,
        completedAt: undefined,
        createdBy: userId,
        createdByName: userName,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        parentTaskId: taskData.parentTaskId,
        subtasks: [],
        attachments: [],
        comments: [],
        timeEntries: [],
        teamId: taskData.teamId
      };
      
      return newTask;
    } finally {
      connection.release();
    }
  },

  async getTasks(projectId?: string, userId?: string, companyId?: string | null): Promise<Task[]> {
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT * FROM tasks 
        WHERE 1=1
      `;
      const params: any[] = [];
      
      // Company scope if provided
      if (companyId) {
        query += ` AND company_id = ?`;
        params.push(companyId);
      } else {
        query += ` AND company_id IS NULL`;
      }
      
      // Filter by user - users can only see tasks assigned to them
      if (userId) {
        query += ` AND assignee_id = ?`;
        params.push(userId);
      }
      
      // Filter by project
      if (projectId) {
        query += ` AND project_id = ?`;
        params.push(projectId);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const [rows]: any = await connection.execute(query, params);
      
      return rows.map((row: any) => {
        // Get default statuses and priorities
        const defaultStatuses: TaskStatus[] = [
          { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
          { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
          { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
          { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
        ];
        
        const defaultPriorities: TaskPriority[] = [
          { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
          { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
          { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
          { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
        ];
        
        // Find the actual status and priority objects
        const status = defaultStatuses.find(s => s.id === row.status_id) || defaultStatuses[0];
        const priority = defaultPriorities.find(p => p.id === row.priority_id) || defaultPriorities[0];
        
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          notes: row.notes,
          projectId: row.project_id,
          projectName: row.project_name,
          status,
          priority,
          assigneeId: row.assignee_id,
          assigneeName: row.assignee_name,
          assigneeEmail: row.assignee_email,
          dueDate: row.due_date ? new Date(row.due_date) : undefined,
          estimatedHours: row.estimated_hours,
          actualHours: row.actual_hours,
          tags: row.tags ? JSON.parse(row.tags) : [],
          isCompleted: row.is_completed === 1,
          completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          parentTaskId: row.parent_task_id,
          subtasks: [],
          attachments: row.attachments ? JSON.parse(row.attachments) : [],
          comments: row.comments ? JSON.parse(row.comments) : [],
          timeEntries: row.time_entries ? JSON.parse(row.time_entries) : [],
          teamId: row.team_id
        };
      });
    } finally {
      connection.release();
    }
  },

  // Get tasks for team members (for team leaders)
  async getTeamTasks(teamId: string, projectId?: string, companyId?: string | null): Promise<Task[]> {
    const connection = await pool.getConnection();
    try {
      // First get team members
      const memberQuery = `SELECT user_id FROM team_members WHERE team_id = ? AND is_active = 1`;
      const [memberRows]: any = await connection.execute(memberQuery, [teamId]);
      const teamMemberIds = memberRows.map((row: any) => row.user_id);
      
      if (teamMemberIds.length === 0) {
        return [];
      }
      
      let query = `
        SELECT * FROM tasks 
        WHERE assignee_id IN (?)
      `;
      const params: any[] = [teamMemberIds];
      
      // Company scope
      if (companyId) {
        query += ` AND company_id = ?`;
        params.push(companyId);
      } else {
        query += ` AND company_id IS NULL`;
      }
      
      // Filter by project
      if (projectId) {
        query += ` AND project_id = ?`;
        params.push(projectId);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const [rows]: any = await connection.execute(query, params);
      
      return rows.map((row: any) => {
        // Get default statuses and priorities
        const defaultStatuses: TaskStatus[] = [
          { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
          { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
          { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
          { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
        ];
        
        const defaultPriorities: TaskPriority[] = [
          { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
          { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
          { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
          { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
        ];
        
        // Find the actual status and priority objects
        const status = defaultStatuses.find(s => s.id === row.status_id) || defaultStatuses[0];
        const priority = defaultPriorities.find(p => p.id === row.priority_id) || defaultPriorities[0];
        
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          notes: row.notes,
          projectId: row.project_id,
          projectName: row.project_name,
          status,
          priority,
          assigneeId: row.assignee_id,
          assigneeName: row.assignee_name,
          assigneeEmail: row.assignee_email,
          dueDate: row.due_date ? new Date(row.due_date) : undefined,
          estimatedHours: row.estimated_hours,
          actualHours: row.actual_hours,
          tags: row.tags ? JSON.parse(row.tags) : [],
          isCompleted: row.is_completed === 1,
          completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          parentTaskId: row.parent_task_id,
          subtasks: [],
          attachments: row.attachments ? JSON.parse(row.attachments) : [],
          comments: row.comments ? JSON.parse(row.comments) : [],
          timeEntries: row.time_entries ? JSON.parse(row.time_entries) : [],
          teamId: row.team_id
        };
      });
    } finally {
      connection.release();
    }
  },

  async updateTask(taskId: string, updates: UpdateTaskData): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      
      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updates.notes);
      }
      if (updates.status !== undefined) {
        // Get default statuses to find the full status object
        const defaultStatuses: TaskStatus[] = [
          { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
          { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
          { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
          { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
        ];
        
        const status = defaultStatuses.find(s => s.id === updates.status) || defaultStatuses[0];
        
        fields.push('status_id = ?', 'status_name = ?', 'status_color = ?', 'status_order = ?', 'status_is_completed = ?');
        values.push(status.id, status.name, status.color, status.order, status.isCompleted ? 1 : 0);
      }
      if (updates.priority !== undefined) {
        // Get default priorities to find the full priority object
        const defaultPriorities: TaskPriority[] = [
          { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
          { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
          { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
          { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
        ];
        
        const priority = defaultPriorities.find(p => p.id === updates.priority) || defaultPriorities[0];
        
        fields.push('priority_id = ?', 'priority_name = ?', 'priority_color = ?', 'priority_level = ?');
        values.push(priority.id, priority.name, priority.color, priority.level);
      }
      if (updates.assigneeId !== undefined) {
        fields.push('assignee_id = ?');
        values.push(updates.assigneeId || null);
      }
      if (updates.dueDate !== undefined) {
        fields.push('due_date = ?');
        values.push(updates.dueDate ? new Date(updates.dueDate).toISOString() : null);
      }
      if (updates.estimatedHours !== undefined) {
        fields.push('estimated_hours = ?');
        values.push(updates.estimatedHours || null);
      }
      if (updates.actualHours !== undefined) {
        fields.push('actual_hours = ?');
        values.push(updates.actualHours || null);
      }
      if (updates.isCompleted !== undefined) {
        fields.push('is_completed = ?');
        values.push(updates.isCompleted ? 1 : 0);
        
        if (updates.isCompleted) {
          fields.push('completed_at = ?');
          values.push(new Date().toISOString());
        }
      }
      if (updates.parentTaskId !== undefined) {
        fields.push('parent_task_id = ?');
        values.push(updates.parentTaskId || null);
      }
      if (updates.teamId !== undefined) {
        fields.push('team_id = ?');
        values.push(updates.teamId || null);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(updates.tags));
      }
      
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      
      if (fields.length === 0) {
        return; // Nothing to update
      }
      
      values.push(taskId); // For the WHERE clause
      
      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
    } finally {
      connection.release();
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `DELETE FROM tasks WHERE id = ?`;
      await connection.execute(query, [taskId]);
    } finally {
      connection.release();
    }
  },

  // Task Statuses
  async getTaskStatuses(): Promise<TaskStatus[]> {
    // Return default statuses
    return [
      { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
      { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
      { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
      { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
    ];
  },

  // Task Priorities
  async getTaskPriorities(): Promise<TaskPriority[]> {
    // Return default priorities
    return [
      { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
      { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
      { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
      { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
    ];
  }
};