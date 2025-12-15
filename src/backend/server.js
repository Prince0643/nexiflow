import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create database connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'clockistry',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }
  
  // In a real implementation, you would verify the JWT token here
  // For now, we'll accept any non-empty token as valid for demonstration purposes
  // In production, you should verify the JWT signature and expiration
  try {
    // Simple validation - check if token exists and is not empty
    if (!token.trim()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    // In a real implementation, you would decode the token and attach user info to req.user
    // req.user = decodedUser;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }
    
    // Get database connection
    const connection = await pool.getConnection();
    try {
      // Look up user by email
      const userQuery = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
      const [userRows] = await connection.execute(userQuery, [email]);
      
      if (userRows.length === 0) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid email or password' 
        });
      }
      
      const user = userRows[0];
      
      // Verify the password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid email or password' 
        });
      }
      
      // Get company information if user has a company
      let companyData = null;
      if (user.company_id) {
        const companyQuery = `SELECT * FROM companies WHERE id = ?`;
        const [companyRows] = await connection.execute(companyQuery, [user.company_id]);
        
        if (companyRows.length > 0) {
          const company = companyRows[0];
          companyData = {
            id: company.id,
            name: company.name,
            isActive: company.is_active === 1,
            pricingLevel: company.pricing_level,
            maxMembers: company.max_members,
            createdAt: company.created_at,
            updatedAt: company.updated_at,
            pdfSettings: company.pdf_settings ? JSON.parse(company.pdf_settings) : undefined
          };
        }
      }
      
      // Create user object without sensitive data
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id || null,
        teamId: user.team_id || null,
        teamRole: user.team_role || null,
        avatar: user.avatar || null,
        timezone: user.timezone,
        hourlyRate: user.hourly_rate,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
      
      res.json({ 
        success: true, 
        user: userData,
        company: companyData
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed. Please try again.' 
    });
  }
});

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role, companyName } = req.body;
    
    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Passwords do not match' 
      });
    }
    
    // Check if user already exists
    const connection = await pool.getConnection();
    try {
      const checkUserQuery = `SELECT id FROM users WHERE email = ?`;
      const [existingUsers] = await connection.execute(checkUserQuery, [email]);
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'User with this email already exists' 
        });
      }
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const now = new Date();
      const userQuery = `
        INSERT INTO users (
          name, email, password_hash, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, 1, ?, ?)
      `;
      
      const result = await connection.execute(userQuery, [
        name,
        email,
        hashedPassword,
        role,
        'America/New_York', // Default timezone
        25, // Default hourly rate
        now,
        now
      ]);
      
      const userId = result[0].insertId;
      
      // If this is a super admin signup, create a company
      let companyData = null;
      if (role === 'super_admin' && companyName) {
        // Create company
        const companyQuery = `
          INSERT INTO companies (
            name, is_active, pricing_level, max_members, created_at, updated_at, pdf_settings
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Default PDF settings
        const defaultPdfSettings = {
          companyName: companyName,
          logoUrl: '',
          primaryColor: '#3B82F6',
          secondaryColor: '#1E40AF',
          showPoweredBy: true,
          customFooterText: ''
        };
        
        const companyResult = await connection.execute(companyQuery, [
          companyName,
          1, // is_active
          'solo', // pricing_level
          1, // max_members
          now,
          now,
          JSON.stringify(defaultPdfSettings)
        ]);
        
        const companyId = companyResult[0].insertId;
        
        // Update user with company ID
        const updateUserQuery = `UPDATE users SET company_id = ? WHERE id = ?`;
        await connection.execute(updateUserQuery, [companyId, userId]);
        
        companyData = {
          id: companyId.toString(),
          name: companyName,
          isActive: true,
          pricingLevel: 'solo',
          maxMembers: 1,
          createdAt: now,
          updatedAt: now,
          pdfSettings: defaultPdfSettings
        };
      }
      
      // Get the created user
      const getUserQuery = `SELECT * FROM users WHERE id = ?`;
      const [userRows] = await connection.execute(getUserQuery, [userId]);
      const user = userRows[0];
      
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id || null,
        teamId: user.team_id || null,
        teamRole: user.team_role || null,
        avatar: user.avatar || null,
        timezone: user.timezone,
        hourlyRate: user.hourly_rate,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
      
      res.status(201).json({ 
        success: true, 
        user: userData,
        company: companyData
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Signup failed. Please try again.' 
    });
  }
});

// Get user by ID endpoint
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const userQuery = `SELECT * FROM users WHERE id = ? AND is_active = 1`;
      const [userRows] = await connection.execute(userQuery, [id]);
      
      if (userRows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      const user = userRows[0];
      
      // Get company information if user has a company
      let companyData = null;
      if (user.company_id) {
        const companyQuery = `SELECT * FROM companies WHERE id = ?`;
        const [companyRows] = await connection.execute(companyQuery, [user.company_id]);
        
        if (companyRows.length > 0) {
          const company = companyRows[0];
          companyData = {
            id: company.id,
            name: company.name,
            isActive: company.is_active === 1,
            pricingLevel: company.pricing_level,
            maxMembers: company.max_members,
            createdAt: company.created_at,
            updatedAt: company.updated_at,
            pdfSettings: company.pdf_settings ? JSON.parse(company.pdf_settings) : undefined
          };
        }
      }
      
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id || null,
        teamId: user.team_id || null,
        teamRole: user.team_role || null,
        avatar: user.avatar || null,
        timezone: user.timezone,
        hourlyRate: user.hourly_rate,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
      
      res.json({ 
        success: true, 
        user: userData,
        company: companyData
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user data' 
    });
  }
});

// Add admin API endpoints
// Get all users (admin only)
app.get('/api/admin/users', async (req, res) => {
  try {
    // In a real implementation, you would verify the user is an admin
    // For now, we'll just get all users
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM users 
        WHERE is_active = 1
        ORDER BY name ASC
      `;
      
      const [rows] = await connection.execute(query);
      const users = rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        companyId: row.company_id,
        teamId: row.team_id,
        teamRole: row.team_role,
        avatar: row.avatar,
        timezone: row.timezone,
        hourlyRate: row.hourly_rate,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.json({ 
        success: true, 
        data: users,
        count: users.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get users' 
    });
  }
});

// Get users for company (admin only)
app.get('/api/admin/users/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM users 
        WHERE company_id = ? AND is_active = 1
        ORDER BY name ASC
      `;
      
      const [rows] = await connection.execute(query, [companyId]);
      const users = rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        companyId: row.company_id,
        teamId: row.team_id,
        teamRole: row.team_role,
        avatar: row.avatar,
        timezone: row.timezone,
        hourlyRate: row.hourly_rate,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.json({ 
        success: true, 
        data: users,
        count: users.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get users for company error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get users for company' 
    });
  }
});

// Create user (admin only)
app.post('/api/admin/users', async (req, res) => {
  try {
    const userData = req.body;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO users (
          name, email, password_hash, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const now = new Date();
      const result = await connection.execute(query, [
        userData.name,
        userData.email,
        userData.passwordHash || null,
        userData.role,
        userData.companyId || null,
        null, // team_id
        null, // team_role
        null, // avatar
        userData.timezone || 'America/New_York',
        userData.hourlyRate || 25,
        1, // is_active
        now,
        now
      ]);
      
      const newUser = {
        id: result[0].insertId.toString(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
        companyId: userData.companyId || null,
        teamId: null,
        teamRole: null,
        avatar: null,
        timezone: userData.timezone || 'America/New_York',
        hourlyRate: userData.hourlyRate || 25,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
      
      res.status(201).json({ 
        success: true, 
        data: newUser,
        message: 'User created successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user' 
    });
  }
});

// Update user (admin only)
app.put('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];
      
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
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(updates.tags ? JSON.stringify(updates.tags) : null);
      }
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());
      
      if (fields.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No updates provided' 
        });
      }
      
      values.push(userId); // For the WHERE clause
      
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
      
      res.json({ 
        success: true, 
        message: 'User updated successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user' 
    });
  }
});

// Delete user (admin only) - soft delete
app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?`;
      await connection.execute(query, [new Date(), userId]);
      
      res.json({ 
        success: true, 
        message: 'User deleted successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete user' 
    });
  }
});

// Get all time entries (admin only)
app.get('/api/admin/time-entries', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query);
      const timeEntries = rows.map(row => ({
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
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
      
      res.json({ 
        success: true, 
        data: timeEntries,
        count: timeEntries.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get all time entries error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get time entries' 
    });
  }
});

// Get all running time entries (admin only)
app.get('/api/admin/time-entries/running', async (req, res) => {
  try {
    const { companyId } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT * FROM time_entries 
        WHERE is_running = 1
        ORDER BY created_at DESC
      `;
      let params = [];
      
      if (companyId) {
        query = `
          SELECT te.* FROM time_entries te
          JOIN users u ON te.user_id = u.id
          WHERE te.is_running = 1 AND u.company_id = ?
          ORDER BY te.created_at DESC
        `;
        params = [companyId];
      }
      
      const [rows] = await connection.execute(query, params);
      const timeEntries = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: timeEntries,
        count: timeEntries.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get running time entries error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get running time entries' 
    });
  }
});

// Delete time entry (admin only)
app.delete('/api/admin/time-entries/:entryId', async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `DELETE FROM time_entries WHERE id = ?`;
      await connection.execute(query, [entryId]);
      
      res.json({ 
        success: true, 
        message: 'Time entry deleted successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete time entry' 
    });
  }
});

// Stop time entry (admin only)
app.post('/api/admin/time-entries/:entryId/stop', async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      // First get the entry to calculate duration
      const selectQuery = `SELECT start_time FROM time_entries WHERE id = ?`;
      const [rows] = await connection.execute(selectQuery, [entryId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Time entry not found' 
        });
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
      
      // Fetch the updated entry to return it
      const [updatedRows] = await connection.execute('SELECT * FROM time_entries WHERE id = ?', [entryId]);
      
      if (updatedRows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Time entry not found after update' 
        });
      }
      
      const updatedRow = updatedRows[0];
      
      const updatedEntry = {
        id: updatedRow.id,
        userId: updatedRow.user_id,
        companyId: updatedRow.company_id,
        projectId: updatedRow.project_id,
        projectName: updatedRow.project_name,
        clientId: updatedRow.client_id,
        clientName: updatedRow.client_name,
        description: updatedRow.description,
        startTime: new Date(updatedRow.start_time),
        endTime: updatedRow.end_time ? new Date(updatedRow.end_time) : undefined,
        duration: duration, // Use the calculated duration instead of updatedRow.duration
        isRunning: updatedRow.is_running === 1,
        isBillable: updatedRow.is_billable === 1,
        tags: [], // Will be populated below
        createdAt: new Date(updatedRow.created_at),
        updatedAt: new Date(updatedRow.updated_at)
      };
      
      // Populate tags
      updatedEntry.tags = await getTagsForTimeEntry(connection, updatedEntry.id);
      
      res.json({ 
        success: true, 
        message: 'Time entry stopped successfully',
        data: updatedEntry
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Stop time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop time entry' 
    });
  }
});

// Update time entry (admin only)
app.put('/api/admin/time-entries/:entryId', async (req, res) => {
  try {
    const { entryId } = req.params;
    const updates = req.body;
    
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];
      
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
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(updates.tags ? JSON.stringify(updates.tags) : null);
      }
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());
      
      if (fields.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No updates provided' 
        });
      }
      
      values.push(entryId); // For the WHERE clause
      
      const query = `UPDATE time_entries SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
      
      res.json({ 
        success: true, 
        message: 'Time entry updated successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Update time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update time entry' 
    });
  }
});

// Get projects for company (admin only)
app.get('/api/admin/projects/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM projects 
        WHERE company_id = ? AND is_archived = 0
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query, [companyId]);
      const projects = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: projects,
        count: projects.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get projects for company error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get projects for company' 
    });
  }
});

// Get clients for company (admin only)
app.get('/api/admin/clients/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM clients 
        WHERE company_id = ? AND is_archived = 0
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query, [companyId]);
      const clients = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: clients,
        count: clients.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get clients for company error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get clients for company' 
    });
  }
});

// Get teams for company (admin only)
app.get('/api/admin/teams/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM teams 
        WHERE is_active = 1 AND company_id = ?
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query, [companyId]);
      const teams = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: teams,
        count: teams.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get teams for company error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get teams for company' 
    });
  }
});

// Time Entry API endpoints
// Create a new time entry
app.post('/api/time-entries', authenticateToken, async (req, res) => {  try {
    const entryData = req.body;
    const { userId, projectName, companyId, clientName } = req.query;
    
    const connection = await pool.getConnection();
    try {
      const now = new Date();
      const entryId = uuidv4(); // Generate a unique ID for the time entry
      
      // Debug logging
      console.log('Create timer debug info:', {
        entryId,
        startTime: now.toISOString(),
        startTimeMs: now.getTime()
      });
      
      const query = `
        INSERT INTO time_entries (
          id, user_id, company_id, project_id, project_name, client_id, client_name,
          description, start_time, duration, is_running, is_billable, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      
      // Handle tags if provided
      if (entryData.tags && Array.isArray(entryData.tags) && entryData.tags.length > 0) {
        // Insert each tag into the time_entry_tags table
        for (const tag of entryData.tags) {
          await connection.execute(
            'INSERT INTO time_entry_tags (time_entry_id, tag) VALUES (?, ?)',
            [entryId, tag]
          );
        }
      }
      
      res.status(201).json({ 
        success: true, 
        data: { id: entryId },
        message: 'Time entry created successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Create time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create time entry' 
    });
  }
});

// Get all time entries for a user
app.get('/api/time-entries/user/:userId', authenticateToken, async (req, res) => {  try {
    const { userId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `;

      const [rows] = await connection.execute(query, [userId]);
      const timeEntries = rows.map(row => ({
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
        tags: [], // Will be populated below
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
      
      // Populate tags for each time entry
      for (const timeEntry of timeEntries) {
        timeEntry.tags = await getTagsForTimeEntry(connection, timeEntry.id);
      }
      
      res.json({ 
        success: true, 
        data: timeEntries,
        count: timeEntries.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get time entries' 
    });
  }
});

// Get currently running time entry for a user
app.get('/api/time-entries/user/:userId/running', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        WHERE user_id = ? AND is_running = 1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const [rows] = await connection.execute(query, [userId]);
      if (rows.length === 0) {
        return res.json({ 
          success: true, 
          data: null
        });
      }

      const row = rows[0];
      
      // Debug logging
      console.log('Get running timer debug info:', {
        entryId: row.id,
        dbStartTime: row.start_time,
        parsedStartTime: new Date(row.start_time).toISOString(),
        parsedStartTimeMs: new Date(row.start_time).getTime()
      });
      
      const timeEntry = {
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
        tags: [], // Will be populated below
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
      
      // Populate tags
      timeEntry.tags = await getTagsForTimeEntry(connection, timeEntry.id);
      
      res.json({ 
        success: true, 
        data: timeEntry
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get running time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get running time entry' 
    });
  }
});

// Stop a running time entry
app.post('/api/time-entries/:entryId/stop', authenticateToken, async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      // First get the entry to calculate duration
      const selectQuery = `SELECT start_time FROM time_entries WHERE id = ?`;
      const [rows] = await connection.execute(selectQuery, [entryId]);

      if (rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Time entry not found' 
        });
      }

      // Debug logging
      console.log('Stop timer select query debug info:', {
        entryId,
        dbStartTime: rows[0].start_time,
        parsedStartTime: new Date(rows[0].start_time).toISOString(),
        parsedStartTimeMs: new Date(rows[0].start_time).getTime()
      });

      const startTime = new Date(rows[0].start_time);
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      
      // Debug logging
      console.log('Stop timer debug info:', {
        entryId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startTimeMs: startTime.getTime(),
        endTimeMs: endTime.getTime(),
        calculatedDuration: duration
      });

      const updateQuery = `
        UPDATE time_entries 
        SET end_time = ?, duration = ?, is_running = 0, updated_at = ?
        WHERE id = ?
      `;

      await connection.execute(updateQuery, [endTime, duration, new Date(), entryId]);
      
      // Fetch the updated entry to return it
      const [updatedRows] = await connection.execute('SELECT * FROM time_entries WHERE id = ?', [entryId]);
      
      if (updatedRows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Time entry not found after update' 
        });
      }
      
      const updatedRow = updatedRows[0];
      
      const updatedEntry = {
        id: updatedRow.id,
        userId: updatedRow.user_id,
        companyId: updatedRow.company_id,
        projectId: updatedRow.project_id,
        projectName: updatedRow.project_name,
        clientId: updatedRow.client_id,
        clientName: updatedRow.client_name,
        description: updatedRow.description,
        startTime: new Date(updatedRow.start_time),
        endTime: updatedRow.end_time ? new Date(updatedRow.end_time) : undefined,
        duration: duration, // Use the calculated duration instead of updatedRow.duration
        isRunning: updatedRow.is_running === 1,
        isBillable: updatedRow.is_billable === 1,
        tags: [], // Will be populated below
        createdAt: new Date(updatedRow.created_at),
        updatedAt: new Date(updatedRow.updated_at)
      };
      
      // Populate tags
      updatedEntry.tags = await getTagsForTimeEntry(connection, updatedEntry.id);
      
      res.json({ 
        success: true, 
        message: 'Time entry stopped successfully',
        data: updatedEntry
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Stop time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop time entry' 
    });
  }
});

// Update a time entry
app.put('/api/time-entries/:entryId', authenticateToken, async (req, res) => {
  try {
    const { entryId } = req.params;
    const updates = req.body;
    
    // Validate entryId
    if (!entryId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Entry ID is required' 
      });
    }
    
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];
      
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
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());
      
      if (fields.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No updates provided' 
        });
      }
      
      values.push(entryId); // For the WHERE clause
      
      const query = `UPDATE time_entries SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await connection.execute(query, values);
      
      // Handle tags update if provided
      if (updates.tags !== undefined) {
        await updateTimeEntryTags(connection, entryId, updates.tags);
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Time entry not found' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Time entry updated successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Update time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update time entry' 
    });
  }
});

// Delete a time entry
app.delete('/api/time-entries/:entryId', authenticateToken, async (req, res) => {
  try {
    const { entryId } = req.params;
    
    // Validate entryId
    if (!entryId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Entry ID is required' 
      });
    }
    
    const connection = await pool.getConnection();
    try {
      const query = `DELETE FROM time_entries WHERE id = ?`;
      await connection.execute(query, [entryId]);
      
      res.json({ 
        success: true, 
        message: 'Time entry deleted successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete time entry' 
    });
  }
});

// Project and Client API endpoints
// Get projects for company
app.get('/api/projects/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM projects 
        WHERE company_id = ? AND is_archived = 0
        ORDER BY created_at DESC
      `;

      const [rows] = await connection.execute(query, [companyId]);
      const projects = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: projects,
        count: projects.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get projects' 
    });
  }
});

// Get clients for company
app.get('/api/clients/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM clients 
        WHERE company_id = ? AND is_archived = 0
        ORDER BY created_at DESC
      `;

      const [rows] = await connection.execute(query, [companyId]);
      const clients = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: clients,
        count: clients.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get clients' 
    });
  }
});

// Get all projects (fallback for when no company ID)
app.get('/api/projects', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM projects 
        WHERE is_archived = 0
        ORDER BY created_at DESC
      `;

      const [rows] = await connection.execute(query);
      const projects = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: projects,
        count: projects.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get projects' 
    });
  }
});

// Get all clients (fallback for when no company ID)
app.get('/api/clients', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM clients 
        WHERE is_archived = 0
        ORDER BY created_at DESC
      `;

      const [rows] = await connection.execute(query);
      const clients = rows.map(row => ({
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
      
      res.json({ 
        success: true, 
        data: clients,
        count: clients.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get clients' 
    });
  }
});

// Helper function to get tags for time entries
async function getTimeEntryTags(connection, timeEntryIds) {
  if (!timeEntryIds || timeEntryIds.length === 0) {
    return {};
  }
  
  // Create placeholders for the IN clause
  const placeholders = timeEntryIds.map(() => '?').join(',');
  const query = `SELECT time_entry_id, tag FROM time_entry_tags WHERE time_entry_id IN (${placeholders})`;
  
  try {
    const [rows] = await connection.execute(query, timeEntryIds);
    
    // Group tags by time_entry_id
    const tagsMap = {};
    rows.forEach(row => {
      if (!tagsMap[row.time_entry_id]) {
        tagsMap[row.time_entry_id] = [];
      }
      tagsMap[row.time_entry_id].push(row.tag);
    });
    
    return tagsMap;
  } catch (error) {
    console.error('Error fetching time entry tags:', error);
    return {};
  }
}

// Helper function to get tags for a single time entry
async function getTagsForTimeEntry(connection, timeEntryId) {
  if (!timeEntryId) {
    return [];
  }
  
  try {
    const [rows] = await connection.execute(
      'SELECT tag FROM time_entry_tags WHERE time_entry_id = ?',
      [timeEntryId]
    );
    
    return rows.map(row => row.tag);
  } catch (error) {
    console.error('Error fetching tags for time entry:', error);
    return [];
  }
}

// Helper function to update tags for a time entry
async function updateTimeEntryTags(connection, timeEntryId, tags) {
  if (!timeEntryId) {
    return;
  }
  
  try {
    // First, delete all existing tags for this time entry
    await connection.execute(
      'DELETE FROM time_entry_tags WHERE time_entry_id = ?',
      [timeEntryId]
    );
    
    // Then insert new tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await connection.execute(
          'INSERT INTO time_entry_tags (time_entry_id, tag) VALUES (?, ?)',
          [timeEntryId, tag]
        );
      }
    }
  } catch (error) {
    console.error('Error updating tags for time entry:', error);
    throw error;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoints available at http://localhost:${PORT}/api/*`);
});

export default app;