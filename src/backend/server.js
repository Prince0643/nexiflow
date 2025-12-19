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

// Task Management API endpoints
// Get all tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { projectId, userId } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT * FROM tasks 
        WHERE 1=1
      `;
      const params = [];
      
      // Filter by project
      if (projectId) {
        query += ` AND project_id = ?`;
        params.push(projectId);
      }
      
      // Filter by user
      if (userId) {
        query += ` AND assignee_id = ?`;
        params.push(userId);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const [rows] = await connection.execute(query, params);
      const tasks = rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        notes: row.notes,
        projectId: row.project_id,
        projectName: row.project_name,
        status: {
          id: row.status_id,
          name: row.status_name,
          color: row.status_color,
          order: row.status_order,
          isCompleted: row.status_is_completed === 1
        },
        priority: {
          id: row.priority_id,
          name: row.priority_name,
          color: row.priority_color,
          level: row.priority_level
        },
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
        teamId: row.team_id,
        companyId: row.company_id,
        attachments: row.attachments ? JSON.parse(row.attachments) : [],
        comments: row.comments ? JSON.parse(row.comments) : [],
        timeEntries: row.time_entries ? JSON.parse(row.time_entries) : []
      }));
      
      res.json({ 
        success: true, 
        data: tasks,
        count: tasks.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get tasks' 
    });
  }
});

// Create a new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const taskData = req.body;
    
    const connection = await pool.getConnection();
    try {
      const now = new Date().toISOString();
      const taskId = uuidv4(); // Generate a unique ID for the task
      
      const query = `
        INSERT INTO tasks (
          id, title, description, notes, project_id, project_name, status_id, status_name,
          status_color, status_order, status_is_completed, priority_id, priority_name,
          priority_color, priority_level, assignee_id, assignee_name, assignee_email,
          due_date, estimated_hours, actual_hours, is_completed, completed_at, created_by,
          created_by_name, created_at, updated_at, parent_task_id, team_id, company_id,
          tags, attachments, comments, time_entries
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await connection.execute(query, [
        taskId,
        taskData.title,
        taskData.description || null,
        taskData.notes || null,
        taskData.projectId || null,
        taskData.projectName || null,
        taskData.status?.id || null,
        taskData.status?.name || null,
        taskData.status?.color || null,
        taskData.status?.order || null,
        taskData.status?.isCompleted ? 1 : 0,
        taskData.priority?.id || null,
        taskData.priority?.name || null,
        taskData.priority?.color || null,
        taskData.priority?.level || null,
        taskData.assigneeId || null,
        taskData.assigneeName || null,
        taskData.assigneeEmail || null,
        taskData.dueDate ? new Date(taskData.dueDate).toISOString().split('T')[0] : null,
        taskData.estimatedHours || null,
        taskData.actualHours || null,
        taskData.isCompleted ? 1 : 0,
        taskData.completedAt ? new Date(taskData.completedAt).toISOString() : null,
        taskData.createdBy || null,
        taskData.createdByName || null,
        now,
        now,
        taskData.parentTaskId || null,
        taskData.teamId || null,
        taskData.companyId || null,
        taskData.tags ? JSON.stringify(taskData.tags) : JSON.stringify([]),
        taskData.attachments ? JSON.stringify(taskData.attachments) : JSON.stringify([]),
        taskData.comments ? JSON.stringify(taskData.comments) : JSON.stringify([]),
        taskData.timeEntries ? JSON.stringify(taskData.timeEntries) : JSON.stringify([])
      ]);
      
      const newTask = {
        id: taskId,
        title: taskData.title,
        description: taskData.description,
        notes: taskData.notes,
        projectId: taskData.projectId,
        projectName: taskData.projectName,
        status: taskData.status,
        priority: taskData.priority,
        assigneeId: taskData.assigneeId,
        assigneeName: taskData.assigneeName,
        assigneeEmail: taskData.assigneeEmail,
        dueDate: taskData.dueDate,
        estimatedHours: taskData.estimatedHours,
        actualHours: taskData.actualHours,
        tags: taskData.tags || [],
        isCompleted: taskData.isCompleted || false,
        completedAt: taskData.completedAt,
        createdBy: taskData.createdBy,
        createdByName: taskData.createdByName,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        parentTaskId: taskData.parentTaskId,
        teamId: taskData.teamId,
        companyId: taskData.companyId,
        attachments: taskData.attachments || [],
        comments: taskData.comments || [],
        timeEntries: taskData.timeEntries || []
      };
      
      res.status(201).json({ 
        success: true, 
        data: newTask,
        message: 'Task created successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create task' 
    });
  }
});

// Update a task
app.put('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    // Validate taskId
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Task ID is required' 
      });
    }
    
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];
      
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
      if (updates.projectId !== undefined) {
        fields.push('project_id = ?');
        values.push(updates.projectId);
      }
      if (updates.projectName !== undefined) {
        fields.push('project_name = ?');
        values.push(updates.projectName);
      }
      if (updates.status !== undefined) {
        fields.push('status_id = ?', 'status_name = ?', 'status_color = ?', 'status_order = ?', 'status_is_completed = ?');
        values.push(
          updates.status.id,
          updates.status.name,
          updates.status.color,
          updates.status.order,
          updates.status.isCompleted ? 1 : 0
        );
      }
      if (updates.priority !== undefined) {
        fields.push('priority_id = ?', 'priority_name = ?', 'priority_color = ?', 'priority_level = ?');
        values.push(
          updates.priority.id,
          updates.priority.name,
          updates.priority.color,
          updates.priority.level
        );
      }
      if (updates.assigneeId !== undefined) {
        fields.push('assignee_id = ?');
        values.push(updates.assigneeId);
      }
      if (updates.assigneeName !== undefined) {
        fields.push('assignee_name = ?');
        values.push(updates.assigneeName);
      }
      if (updates.assigneeEmail !== undefined) {
        fields.push('assignee_email = ?');
        values.push(updates.assigneeEmail);
      }
      if (updates.dueDate !== undefined) {
        fields.push('due_date = ?');
        values.push(updates.dueDate ? new Date(updates.dueDate).toISOString().split('T')[0] : null);
      }
      if (updates.estimatedHours !== undefined) {
        fields.push('estimated_hours = ?');
        values.push(updates.estimatedHours);
      }
      if (updates.actualHours !== undefined) {
        fields.push('actual_hours = ?');
        values.push(updates.actualHours);
      }
      if (updates.isCompleted !== undefined) {
        fields.push('is_completed = ?');
        values.push(updates.isCompleted ? 1 : 0);
        
        if (updates.isCompleted) {
          fields.push('completed_at = ?');
          values.push(new Date().toISOString());
        }
      }
      if (updates.completedAt !== undefined) {
        fields.push('completed_at = ?');
        values.push(updates.completedAt ? new Date(updates.completedAt).toISOString() : null);
      }
      if (updates.createdBy !== undefined) {
        fields.push('created_by = ?');
        values.push(updates.createdBy);
      }
      if (updates.createdByName !== undefined) {
        fields.push('created_by_name = ?');
        values.push(updates.createdByName);
      }
      if (updates.parentTaskId !== undefined) {
        fields.push('parent_task_id = ?');
        values.push(updates.parentTaskId);
      }
      if (updates.teamId !== undefined) {
        fields.push('team_id = ?');
        values.push(updates.teamId);
      }
      if (updates.companyId !== undefined) {
        fields.push('company_id = ?');
        values.push(updates.companyId);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(updates.tags));
      }
      if (updates.attachments !== undefined) {
        fields.push('attachments = ?');
        values.push(JSON.stringify(updates.attachments));
      }
      if (updates.comments !== undefined) {
        fields.push('comments = ?');
        values.push(JSON.stringify(updates.comments));
      }
      if (updates.timeEntries !== undefined) {
        fields.push('time_entries = ?');
        values.push(JSON.stringify(updates.timeEntries));
      }
      
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      
      if (fields.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No updates provided' 
        });
      }
      
      values.push(taskId); // For the WHERE clause
      
      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await connection.execute(query, values);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Task not found' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Task updated successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update task' 
    });
  }
});

// Delete a task
app.delete('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    // Validate taskId
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Task ID is required' 
      });
    }
    
    const connection = await pool.getConnection();
    try {
      const query = `DELETE FROM tasks WHERE id = ?`;
      const [result] = await connection.execute(query, [taskId]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Task not found' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Task deleted successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete task' 
    });
  }
});

// Get task statuses
app.get('/api/task-statuses', async (req, res) => {
  console.log('Task statuses endpoint hit');
  try {
    // Return default statuses
    const statuses = [
      { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
      { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
      { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
      { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
    ];
    
    res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    console.error('Error fetching task statuses:', error);
    res.status(500).json({ error: 'Failed to fetch task statuses' });
  }
});

// Get task priorities
app.get('/api/task-priorities', async (req, res) => {
  console.log('Task priorities endpoint hit');
  try {
    // Return default priorities
    const priorities = [
      { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
      { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
      { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
      { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
    ];
    
    res.json({
      success: true,
      data: priorities
    });
  } catch (error) {
    console.error('Error fetching task priorities:', error);
    res.status(500).json({ error: 'Failed to fetch task priorities' });
  }
});

// Get clients for company
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

// Team endpoints
// Get all teams (admin only)
app.get('/api/admin/teams', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM teams 
        WHERE is_active = 1
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query);
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
    console.error('Get all teams error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get teams' 
    });
  }
});

// Get teams for company (admin only)
app.get('/api/admin/teams/company/:companyId', authenticateToken, authorizeAdmin, async (req, res) => {
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

// Get team members
app.get('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    
    const connection = await pool.getConnection();
    try {
      // Check if user is a member of the team or an admin
      const memberQuery = `
        SELECT * FROM team_members 
        WHERE team_id = ? AND user_id = ? AND is_active = 1
      `;
      const [memberRows] = await connection.execute(memberQuery, [teamId, userId]);
      
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'root';
      const isTeamMember = memberRows.length > 0;
      
      if (!isTeamMember && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. You must be a team member or administrator to view team members.' 
        });
      }
      
      const query = `
        SELECT * FROM team_members 
        WHERE team_id = ? AND is_active = 1
        ORDER BY team_role = 'leader' DESC, joined_at ASC
      `;
      
      const [rows] = await connection.execute(query, [teamId]);
      
      const members = rows.map(row => ({
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        teamRole: row.team_role,
        joinedAt: new Date(row.joined_at),
        isActive: row.is_active === 1
      }));
      
      res.json({ 
        success: true, 
        data: members,
        count: members.length
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get team members' 
    });
  }
});

// Add team member
app.post('/api/teams/:teamId/members', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId: newUserId, role } = req.body;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    // Validate required fields
    if (!newUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId is required' 
      });
    }
    
    const connection = await pool.getConnection();
    try {
      // Check if requesting user is the team leader or an admin
      const teamQuery = `SELECT leader_id FROM teams WHERE id = ? AND is_active = 1`;
      const [teamRows] = await connection.execute(teamQuery, [teamId]);
      
      if (teamRows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Team not found' 
        });
      }
      
      const team = teamRows[0];
      const isAdmin = requestingUserRole === 'admin' || requestingUserRole === 'super_admin' || requestingUserRole === 'root';
      const isTeamLeader = team.leader_id === requestingUserId;
      
      if (!isTeamLeader && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Only team leaders and administrators can add team members.' 
        });
      }
      
      // Check if user is already a member
      const checkQuery = `
        SELECT * FROM team_members 
        WHERE team_id = ? AND user_id = ? AND is_active = 1
      `;
      const [checkRows] = await connection.execute(checkQuery, [teamId, newUserId]);
      
      if (checkRows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'User is already a member of this team' 
        });
      }
      
      // Get user details
      const userQuery = `SELECT name, email FROM users WHERE id = ?`;
      const [userRows] = await connection.execute(userQuery, [newUserId]);
      
      if (userRows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      const user = userRows[0];
      
      const now = new Date().toISOString();
      const query = `
        INSERT INTO team_members (
          team_id, user_id, user_name, user_email, team_role, joined_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await connection.execute(query, [
        teamId,
        newUserId,
        user.name,
        user.email,
        role || 'member',
        now,
        1 // is_active
      ]);
      
      const memberId = result[0].insertId.toString();
      
      // Update team member count
      const countQuery = `
        SELECT COUNT(*) as count FROM team_members 
        WHERE team_id = ? AND is_active = 1
      `;
      const [countRows] = await connection.execute(countQuery, [teamId]);
      const memberCount = countRows[0].count;
      
      const updateQuery = `
        UPDATE teams 
        SET member_count = ?, updated_at = ?
        WHERE id = ?
      `;
      await connection.execute(updateQuery, [memberCount, now, teamId]);
      
      // Get the created member
      const selectQuery = `SELECT * FROM team_members WHERE id = ?`;
      const [memberRows] = await connection.execute(selectQuery, [memberId]);
      
      const row = memberRows[0];
      const member = {
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        teamRole: row.team_role,
        joinedAt: new Date(row.joined_at),
        isActive: row.is_active === 1
      };
      
      res.status(201).json({ 
        success: true, 
        data: member,
        message: 'Team member added successfully'
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add team member' 
    });
  }
});    } 
 } ) ; 
 
 / /   U p d a t e   t e a m   m e m b e r   r o l e 
 a p p . p u t ( ' / a p i / t e a m s / : t e a m I d / m e m b e r s / : m e m b e r I d ' ,   a u t h e n t i c a t e T o k e n ,   a s y n c   ( r e q ,   r e s )   = >   { 
     t r y   { 
         c o n s t   {   t e a m I d ,   m e m b e r I d   }   =   r e q . p a r a m s ; 
         c o n s t   {   r o l e   }   =   r e q . b o d y ; 
         c o n s t   u s e r I d   =   r e q . u s e r . i d ; 
         c o n s t   u s e r R o l e   =   r e q . u s e r . r o l e ; 
         
         / /   V a l i d a t e   r e q u i r e d   f i e l d s 
         i f   ( ! r o l e )   { 
             r e t u r n   r e s . s t a t u s ( 4 0 0 ) . j s o n ( {   
                 s u c c e s s :   f a l s e ,   
                 e r r o r :   ' r o l e   i s   r e q u i r e d '   
             } ) ; 
         } 
         
         c o n s t   c o n n e c t i o n   =   a w a i t   p o o l . g e t C o n n e c t i o n ( ) ; 
         t r y   { 
             / /   C h e c k   i f   u s e r   i s   t h e   t e a m   l e a d e r   o r   a n   a d m i n 
             c o n s t   t e a m Q u e r y   =   \ S E L E C T   l e a d e r _ i d   F R O M   t e a m s   W H E R E   i d   =   ?   A N D   i s _ a c t i v e   =   1 \ ; 
             c o n s t   [ t e a m R o w s ]   =   a w a i t   c o n n e c t i o n . e x e c u t e ( t e a m Q u e r y ,   [ t e a m I d ] ) ; 
             
             i f   ( t e a m R o w s . l e n g t h   = = =   0 )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 4 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' T e a m   n o t   f o u n d '   
                 } ) ; 
             } 
             
             c o n s t   t e a m   =   t e a m R o w s [ 0 ] ; 
             c o n s t   i s A d m i n   =   u s e r R o l e   = = =   ' a d m i n '   | |   u s e r R o l e   = = =   ' s u p e r _ a d m i n '   | |   u s e r R o l e   = = =   ' r o o t ' ; 
             c o n s t   i s T e a m L e a d e r   =   t e a m . l e a d e r _ i d   = = =   u s e r I d ; 
             
             i f   ( ! i s T e a m L e a d e r   & &   ! i s A d m i n )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 3 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' A c c e s s   d e n i e d .   O n l y   t e a m   l e a d e r s   a n d   a d m i n i s t r a t o r s   c a n   u p d a t e   t e a m   m e m b e r s . '   
                 } ) ; 
             } 
             
             / /   C h e c k   i f   m e m b e r   e x i s t s   a n d   i s   a c t i v e 
             c o n s t   m e m b e r Q u e r y   =   \ 
                 S E L E C T   u s e r _ i d   F R O M   t e a m _ m e m b e r s   
                 W H E R E   i d   =   ?   A N D   t e a m _ i d   =   ?   A N D   i s _ a c t i v e   =   1 
             \ ; 
             c o n s t   [ m e m b e r R o w s ]   =   a w a i t   c o n n e c t i o n . e x e c u t e ( m e m b e r Q u e r y ,   [ m e m b e r I d ,   t e a m I d ] ) ; 
             
             i f   ( m e m b e r R o w s . l e n g t h   = = =   0 )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 4 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' T e a m   m e m b e r   n o t   f o u n d '   
                 } ) ; 
             } 
             
             c o n s t   m e m b e r U s e r I d   =   m e m b e r R o w s [ 0 ] . u s e r _ i d ; 
             
             / /   I f   p r o m o t i n g   t o   l e a d e r ,   u p d a t e   t e a m   l e a d e r   i n f o 
             i f   ( r o l e   = = =   ' l e a d e r ' )   { 
                 / /   U p d a t e   t e a m   l e a d e r   i n f o 
                 c o n s t   u p d a t e T e a m Q u e r y   =   \ 
                     U P D A T E   t e a m s   
                     S E T   l e a d e r _ i d   =   ? 
                     W H E R E   i d   =   ? 
                 \ ; 
                 a w a i t   c o n n e c t i o n . e x e c u t e ( u p d a t e T e a m Q u e r y ,   [ m e m b e r U s e r I d ,   t e a m I d ] ) ; 
                 
                 / /   S e t   c u r r e n t   l e a d e r   t o   m e m b e r 
                 c o n s t   u p d a t e O l d L e a d e r Q u e r y   =   \ 
                     U P D A T E   t e a m _ m e m b e r s   
                     S E T   t e a m _ r o l e   =   ' m e m b e r ' 
                     W H E R E   t e a m _ i d   =   ?   A N D   t e a m _ r o l e   =   ' l e a d e r '   A N D   i s _ a c t i v e   =   1 
                 \ ; 
                 a w a i t   c o n n e c t i o n . e x e c u t e ( u p d a t e O l d L e a d e r Q u e r y ,   [ t e a m I d ] ) ; 
             } 
             
             / /   U p d a t e   m e m b e r   r o l e 
             c o n s t   q u e r y   =   \ 
                 U P D A T E   t e a m _ m e m b e r s   
                 S E T   t e a m _ r o l e   =   ? 
                 W H E R E   i d   =   ? 
             \ ; 
             a w a i t   c o n n e c t i o n . e x e c u t e ( q u e r y ,   [ r o l e ,   m e m b e r I d ] ) ; 
             
             r e s . j s o n ( {   
                 s u c c e s s :   t r u e ,   
                 m e s s a g e :   ' T e a m   m e m b e r   u p d a t e d   s u c c e s s f u l l y ' 
             } ) ; 
             
         }   f i n a l l y   { 
             c o n n e c t i o n . r e l e a s e ( ) ; 
         } 
         
     }   c a t c h   ( e r r o r )   { 
         c o n s o l e . e r r o r ( ' U p d a t e   t e a m   m e m b e r   e r r o r : ' ,   e r r o r ) ; 
         r e s . s t a t u s ( 5 0 0 ) . j s o n ( {   
             s u c c e s s :   f a l s e ,   
             e r r o r :   ' F a i l e d   t o   u p d a t e   t e a m   m e m b e r '   
         } ) ; 
     } 
 } ) ; 
 
 / /   R e m o v e   t e a m   m e m b e r 
 a p p . d e l e t e ( ' / a p i / t e a m s / : t e a m I d / m e m b e r s / : m e m b e r I d ' ,   a u t h e n t i c a t e T o k e n ,   a s y n c   ( r e q ,   r e s )   = >   { 
     t r y   { 
         c o n s t   {   t e a m I d ,   m e m b e r I d   }   =   r e q . p a r a m s ; 
         c o n s t   u s e r I d   =   r e q . u s e r . i d ; 
         c o n s t   u s e r R o l e   =   r e q . u s e r . r o l e ; 
         
         c o n s t   c o n n e c t i o n   =   a w a i t   p o o l . g e t C o n n e c t i o n ( ) ; 
         t r y   { 
             / /   C h e c k   i f   u s e r   i s   t h e   t e a m   l e a d e r   o r   a n   a d m i n 
             c o n s t   t e a m Q u e r y   =   \ S E L E C T   l e a d e r _ i d   F R O M   t e a m s   W H E R E   i d   =   ?   A N D   i s _ a c t i v e   =   1 \ ; 
             c o n s t   [ t e a m R o w s ]   =   a w a i t   c o n n e c t i o n . e x e c u t e ( t e a m Q u e r y ,   [ t e a m I d ] ) ; 
             
             i f   ( t e a m R o w s . l e n g t h   = = =   0 )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 4 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' T e a m   n o t   f o u n d '   
                 } ) ; 
             } 
             
             c o n s t   t e a m   =   t e a m R o w s [ 0 ] ; 
             c o n s t   i s A d m i n   =   u s e r R o l e   = = =   ' a d m i n '   | |   u s e r R o l e   = = =   ' s u p e r _ a d m i n '   | |   u s e r R o l e   = = =   ' r o o t ' ; 
             c o n s t   i s T e a m L e a d e r   =   t e a m . l e a d e r _ i d   = = =   u s e r I d ; 
             
             i f   ( ! i s T e a m L e a d e r   & &   ! i s A d m i n )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 3 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' A c c e s s   d e n i e d .   O n l y   t e a m   l e a d e r s   a n d   a d m i n i s t r a t o r s   c a n   r e m o v e   t e a m   m e m b e r s . '   
                 } ) ; 
             } 
             
             / /   C h e c k   i f   m e m b e r   e x i s t s   a n d   i s   a c t i v e 
             c o n s t   m e m b e r Q u e r y   =   \ 
                 S E L E C T   u s e r _ i d   F R O M   t e a m _ m e m b e r s   
                 W H E R E   i d   =   ?   A N D   t e a m _ i d   =   ?   A N D   i s _ a c t i v e   =   1 
             \ ; 
             c o n s t   [ m e m b e r R o w s ]   =   a w a i t   c o n n e c t i o n . e x e c u t e ( m e m b e r Q u e r y ,   [ m e m b e r I d ,   t e a m I d ] ) ; 
             
             i f   ( m e m b e r R o w s . l e n g t h   = = =   0 )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 4 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' T e a m   m e m b e r   n o t   f o u n d '   
                 } ) ; 
             } 
             
             c o n s t   m e m b e r U s e r I d   =   m e m b e r R o w s [ 0 ] . u s e r _ i d ; 
             
             / /   P r e v e n t   r e m o v i n g   t h e   t e a m   l e a d e r   ( t h e y   s h o u l d   b e   t r a n s f e r r e d   o r   t e a m   d e l e t e d ) 
             i f   ( m e m b e r U s e r I d   = = =   t e a m . l e a d e r _ i d )   { 
                 r e t u r n   r e s . s t a t u s ( 4 0 0 ) . j s o n ( {   
                     s u c c e s s :   f a l s e ,   
                     e r r o r :   ' C a n n o t   r e m o v e   t e a m   l e a d e r .   T r a n s f e r   l e a d e r s h i p   f i r s t   o r   d e l e t e   t h e   t e a m . '   
                 } ) ; 
             } 
             
             / /   S o f t   d e l e t e   t h e   m e m b e r 
             c o n s t   q u e r y   =   \ 
                 U P D A T E   t e a m _ m e m b e r s   
                 S E T   i s _ a c t i v e   =   0 ,   l e f t _ a t   =   ? 
                 W H E R E   i d   =   ? 
             \ ; 
             a w a i t   c o n n e c t i o n . e x e c u t e ( q u e r y ,   [ n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,   m e m b e r I d ] ) ; 
             
             / /   U p d a t e   t e a m   m e m b e r   c o u n t 
             c o n s t   c o u n t Q u e r y   =   \ 
                 S E L E C T   C O U N T ( * )   a s   c o u n t   F R O M   t e a m _ m e m b e r s   
                 W H E R E   t e a m _ i d   =   ?   A N D   i s _ a c t i v e   =   1 
             \ ; 
             c o n s t   [ c o u n t R o w s ]   =   a w a i t   c o n n e c t i o n . e x e c u t e ( c o u n t Q u e r y ,   [ t e a m I d ] ) ; 
             c o n s t   m e m b e r C o u n t   =   c o u n t R o w s [ 0 ] . c o u n t ; 
             
             c o n s t   u p d a t e Q u e r y   =   \ 
                 U P D A T E   t e a m s   
                 S E T   m e m b e r _ c o u n t   =   ? ,   u p d a t e d _ a t   =   ? 
                 W H E R E   i d   =   ? 
             \ ; 
             a w a i t   c o n n e c t i o n . e x e c u t e ( u p d a t e Q u e r y ,   [ m e m b e r C o u n t ,   n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,   t e a m I d ] ) ; 
             
             r e s . j s o n ( {   
                 s u c c e s s :   t r u e ,   
                 m e s s a g e :   ' T e a m   m e m b e r   r e m o v e d   s u c c e s s f u l l y ' 
             } ) ; 
             
         }   f i n a l l y   { 
             c o n n e c t i o n . r e l e a s e ( ) ; 
         } 
         
     }   c a t c h   ( e r r o r )   { 
         c o n s o l e . e r r o r ( ' R e m o v e   t e a m   m e m b e r   e r r o r : ' ,   e r r o r ) ; 
         r e s . s t a t u s ( 5 0 0 ) . j s o n ( {   
             s u c c e s s :   f a l s e ,   
             e r r o r :   ' F a i l e d   t o   r e m o v e   t e a m   m e m b e r '   
         } ) ; 
     } 
 } ) ; 
 
 e x p o r t   d e f a u l t   a p p ;  
 