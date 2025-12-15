import pool from '../config/db';
import { Project, CreateProjectData, Client } from '../types';

export const mysqlProjectService = {
  // Get all projects for a company
  async getProjectsForCompany(companyId: string | null): Promise<Project[]> {
    if (!companyId) return [];

    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM projects 
        WHERE company_id = ? AND is_archived = 0
        ORDER BY created_at DESC
      `;

      const [rows]: any = await connection.execute(query, [companyId]);
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        status: row.status,
        priority: row.priority,
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        budget: row.budget,
        clientId: row.client_id,
        clientName: row.client_name,
        isArchived: row.is_archived === 1,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Get project by ID
  async getProjectById(projectId: string): Promise<Project | null> {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT * FROM projects WHERE id = ?`;

      const [rows]: any = await connection.execute(query, [projectId]);
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        status: row.status,
        priority: row.priority,
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        budget: row.budget,
        clientId: row.client_id,
        clientName: row.client_name,
        isArchived: row.is_archived === 1,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } finally {
      connection.release();
    }
  },

  // Create a new project
  async createProject(projectData: CreateProjectData & { companyId: string | null, createdBy: string, startDate?: Date, endDate?: Date, budget?: number }): Promise<Project> {
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO projects (
          name, description, color, status, priority, start_date, end_date, budget, 
          client_id, client_name, is_archived, created_by, company_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date();
      const result: any = await connection.execute(query, [
        projectData.name,
        projectData.description || null,
        projectData.color || '#3B82F6',
        projectData.status || 'active',
        projectData.priority || 'medium',
        projectData.startDate ? new Date(projectData.startDate) : null,
        projectData.endDate ? new Date(projectData.endDate) : null,
        projectData.budget || null,
        projectData.clientId || null,
        null, // client_name will be populated later
        0, // is_archived
        projectData.createdBy,
        projectData.companyId || null,
        now,
        now
      ]);

      const newProject: Project = {
        id: result[0].insertId.toString(),
        name: projectData.name,
        description: projectData.description,
        color: projectData.color || '#3B82F6',
        status: projectData.status || 'active',
        priority: projectData.priority || 'medium',
        startDate: projectData.startDate,
        endDate: projectData.endDate,
        budget: projectData.budget,
        clientId: projectData.clientId,
        clientName: undefined,
        isArchived: false,
        createdBy: projectData.createdBy,
        createdAt: now,
        updatedAt: now
      };

      return newProject;
    } finally {
      connection.release();
    }
  },

  // Update a project
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
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
      if (updates.color !== undefined) {
        fields.push('color = ?');
        values.push(updates.color);
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.priority !== undefined) {
        fields.push('priority = ?');
        values.push(updates.priority);
      }
      if (updates.startDate !== undefined) {
        fields.push('start_date = ?');
        values.push(updates.startDate ? new Date(updates.startDate) : null);
      }
      if (updates.endDate !== undefined) {
        fields.push('end_date = ?');
        values.push(updates.endDate ? new Date(updates.endDate) : null);
      }
      if (updates.budget !== undefined) {
        fields.push('budget = ?');
        values.push(updates.budget);
      }
      if (updates.clientId !== undefined) {
        fields.push('client_id = ?');
        values.push(updates.clientId);
      }
      if (updates.clientName !== undefined) {
        fields.push('client_name = ?');
        values.push(updates.clientName);
      }
      if (updates.isArchived !== undefined) {
        fields.push('is_archived = ?');
        values.push(updates.isArchived ? 1 : 0);
      }

      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());

      if (fields.length === 0) {
        return; // Nothing to update
      }

      values.push(projectId); // For the WHERE clause

      const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
    } finally {
      connection.release();
    }
  },

  // Archive a project
  async archiveProject(projectId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const query = `UPDATE projects SET is_archived = 1, updated_at = ? WHERE id = ?`;
      await connection.execute(query, [new Date(), projectId]);
    } finally {
      connection.release();
    }
  },

  // Get clients for a company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    if (!companyId) return [];

    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM clients 
        WHERE company_id = ? AND is_archived = 0
        ORDER BY created_at DESC
      `;

      const [rows]: any = await connection.execute(query, [companyId]);
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        country: row.country,
        timezone: row.timezone,
        clientType: row.client_type,
        hourlyRate: row.hourly_rate,
        hoursPerWeek: row.hours_per_week,
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        phone: row.phone,
        company: row.company,
        address: row.address,
        currency: row.currency,
        isArchived: row.is_archived === 1,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      connection.release();
    }
  },

  // Create a new client
  async createClient(clientData: any & { companyId: string | null, createdBy: string }): Promise<Client> {
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO clients (
          name, email, country, timezone, client_type, hourly_rate, hours_per_week,
          start_date, end_date, phone, company, address, currency, is_archived,
          created_by, company_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date();
      const result: any = await connection.execute(query, [
        clientData.name,
        clientData.email || null,
        clientData.country || null,
        clientData.timezone || null,
        clientData.clientType || 'full-time',
        clientData.hourlyRate !== undefined ? clientData.hourlyRate : 25.00,
        clientData.hoursPerWeek || null,
        clientData.startDate ? new Date(clientData.startDate) : null,
        clientData.endDate ? new Date(clientData.endDate) : null,
        clientData.phone || null,
        clientData.company || null,
        clientData.address || null,
        clientData.currency || null,
        0, // is_archived
        clientData.createdBy,
        clientData.companyId || null,
        now,
        now
      ]);

      const newClient: Client = {
        id: result[0].insertId.toString(),
        name: clientData.name,
        email: clientData.email,
        country: clientData.country,
        timezone: clientData.timezone,
        clientType: clientData.clientType || 'full-time',
        hourlyRate: clientData.hourlyRate !== undefined ? clientData.hourlyRate : 25.00,
        hoursPerWeek: clientData.hoursPerWeek,
        startDate: clientData.startDate,
        endDate: clientData.endDate,
        phone: clientData.phone,
        company: clientData.company,
        address: clientData.address,
        currency: clientData.currency,
        isArchived: false,
        createdBy: clientData.createdBy,
        createdAt: now,
        updatedAt: now
      };

      return newClient;
    } finally {
      connection.release();
    }
  }
};