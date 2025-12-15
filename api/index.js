const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const Joi = require('joi');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clockistry_secret_key');
    console.log('Token verified successfully, decoded:', decoded);
    
    // Get user from database
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE id = ? AND is_active = 1', 
        [decoded.userId]
      );
      
      if (rows.length === 0) {
        console.log('User not found or inactive for userId:', decoded.userId);
        return res.status(401).json({ error: 'Invalid user' });
      }
      
      const user = rows[0];
      req.user = {
        uid: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        companyId: user.company_id || null
      };
      
      console.log('User authenticated successfully:', req.user);
      next();
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Validation schemas
const timeEntrySchema = Joi.object({
  projectId: Joi.string().optional(),
  description: Joi.string().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().optional(),
  duration: Joi.number().min(0).required(),
  isBillable: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string()).default([])
});

const projectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  color: Joi.string().required(),
  status: Joi.string().valid('active', 'on-hold', 'completed', 'cancelled').default('active'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  clientId: Joi.string().optional()
});

// Utility functions
const formatTimeFromSeconds = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const calculateDuration = (startTime, endTime) => {
  return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
};

// Company-aware filtering helpers
const filterByCompany = (data, companyId) => {
  if (!companyId) return data; // Root users can see all data
  return data.filter(item => item.companyId === companyId);
};

const addCompanyId = (data, companyId) => {
  if (companyId) {
    return { ...data, companyId };
  }
  return data;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
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
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'clockistry_secret_key',
        { expiresIn: '24h' }
      );
      
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
        token,
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
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'clockistry_secret_key',
        { expiresIn: '24h' }
      );
      
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
        token,
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

// Time Entries API
app.get('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, projectId, billableOnly } = req.query;
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    
    const connection = await pool.getConnection();
    try {
      // Build query based on filters
      let query = 'SELECT * FROM time_entries WHERE user_id = ?';
      let params = [userId];
      
      // Apply company filtering for non-root users
      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      }
      
      // Apply filters
      if (startDate) {
        query += ' AND start_time >= ?';
        params.push(new Date(startDate));
      }
      
      if (endDate) {
        // Fix for date range filtering: set end date to end of day to include all entries for that day
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setHours(23, 59, 59, 999);
        query += ' AND start_time <= ?';
        params.push(adjustedEndDate);
      }
      
      if (projectId) {
        query += ' AND project_id = ?';
        params.push(projectId);
      }
      
      if (billableOnly === 'true') {
        query += ' AND is_billable = 1';
      }
      
      query += ' ORDER BY start_time DESC';
      
      const [rows] = await connection.execute(query, params);
      
      const entries = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.json({
        success: true,
        data: entries,
        count: entries.length
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

app.post('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    const { error, value } = timeEntrySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    const now = new Date();
    
    // Get project name if projectId provided
    let projectName = null;
    let clientId = null;
    let clientName = null;
    if (value.projectId) {
      const connection = await pool.getConnection();
      try {
        const [projectRows] = await connection.execute(
          'SELECT * FROM projects WHERE id = ?', 
          [value.projectId]
        );
        
        if (projectRows.length > 0) {
          const project = projectRows[0];
          projectName = project.name;
          clientId = project.client_id;
          
          // Get client name if client exists
          if (clientId) {
            const [clientRows] = await connection.execute(
              'SELECT * FROM clients WHERE id = ?', 
              [clientId]
            );
            
            if (clientRows.length > 0) {
              clientName = clientRows[0].name;
            }
          }
          
          // Verify user has access to this project (same company)
          if (req.user.role !== 'root' && project.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied to this project' });
          }
        }
      } finally {
        connection.release();
      }
    }
    
    // Insert time entry into database
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO time_entries (
          user_id, company_id, project_id, project_name, client_id, client_name,
          description, start_time, end_time, duration, is_running, is_billable, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await connection.execute(query, [
        userId,
        companyId,
        value.projectId || null,
        projectName || null,
        clientId || null,
        clientName || null,
        value.description,
        value.startTime,
        value.endTime || null,
        value.duration,
        !value.endTime ? 1 : 0, // is_running
        value.isBillable ? 1 : 0, // is_billable
        value.tags ? JSON.stringify(value.tags) : null,
        now,
        now
      ]);
      
      const entryId = result[0].insertId;
      
      // Get the created time entry
      const [rows] = await connection.execute(
        'SELECT * FROM time_entries WHERE id = ?', 
        [entryId]
      );
      
      const timeEntry = {
        id: rows[0].id,
        userId: rows[0].user_id,
        companyId: rows[0].company_id,
        projectId: rows[0].project_id,
        projectName: rows[0].project_name,
        clientId: rows[0].client_id,
        clientName: rows[0].client_name,
        description: rows[0].description,
        startTime: rows[0].start_time,
        endTime: rows[0].end_time,
        duration: rows[0].duration,
        isRunning: rows[0].is_running === 1,
        isBillable: rows[0].is_billable === 1,
        tags: rows[0].tags ? JSON.parse(rows[0].tags) : [],
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at
      };
      
      res.status(201).json({
        success: true,
        data: timeEntry,
        message: 'Time entry created successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

app.put('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = timeEntrySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    
    // Check if entry exists and belongs to user
    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute(
        'SELECT * FROM time_entries WHERE id = ?', 
        [id]
      );
      
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      const existingEntry = existingRows[0];
      if (existingEntry.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // For non-root users, verify they belong to the same company
      if (req.user.role !== 'root' && existingEntry.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get project name if projectId changed
      let projectName = existingEntry.project_name;
      let clientId = existingEntry.client_id;
      let clientName = existingEntry.client_name;
      
      if (value.projectId && value.projectId !== existingEntry.project_id) {
        const [projectRows] = await connection.execute(
          'SELECT * FROM projects WHERE id = ?', 
          [value.projectId]
        );
        
        if (projectRows.length > 0) {
          const project = projectRows[0];
          projectName = project.name;
          clientId = project.client_id;
          
          // Get client name if client exists
          if (clientId) {
            const [clientRows] = await connection.execute(
              'SELECT * FROM clients WHERE id = ?', 
              [clientId]
            );
            
            if (clientRows.length > 0) {
              clientName = clientRows[0].name;
            }
          }
          
          // Verify user has access to this project (same company)
          if (req.user.role !== 'root' && project.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied to this project' });
          }
        }
      }
      
      // Update entry
      const query = `
        UPDATE time_entries 
        SET project_id = ?, project_name = ?, client_id = ?, client_name = ?, 
            description = ?, start_time = ?, end_time = ?, duration = ?, 
            is_running = ?, is_billable = ?, tags = ?, updated_at = ?
        WHERE id = ?
      `;
      
      await connection.execute(query, [
        value.projectId || null,
        projectName || null,
        clientId || null,
        clientName || null,
        value.description,
        value.startTime,
        value.endTime || null,
        value.duration,
        !value.endTime ? 1 : 0, // is_running
        value.isBillable ? 1 : 0, // is_billable
        value.tags ? JSON.stringify(value.tags) : null,
        new Date(),
        id
      ]);
      
      res.json({
        success: true,
        message: 'Time entry updated successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

app.delete('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    
    // Check if entry exists and belongs to user
    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute(
        'SELECT * FROM time_entries WHERE id = ?', 
        [id]
      );
      
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      const existingEntry = existingRows[0];
      if (existingEntry.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // For non-root users, verify they belong to the same company
      if (req.user.role !== 'root' && existingEntry.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await connection.execute('DELETE FROM time_entries WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: 'Time entry deleted successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// Get time entries for a specific user
app.get('/api/time-entries/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user has access to this data
    if (req.user.uid !== userId && req.user.role !== 'root' && req.user.companyId) {
      // For non-root users, verify they belong to the same company
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT company_id FROM users WHERE id = ?', 
          [userId]
        );
        
        if (rows.length === 0 || rows[0].company_id !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } finally {
        connection.release();
      }
    }
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM time_entries 
        WHERE user_id = ?
        ORDER BY start_time DESC
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
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
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
    console.error('Get time entries by user error:', error);
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
    
    // Check if user has access to this data
    if (req.user.uid !== userId && req.user.role !== 'root' && req.user.companyId) {
      // For non-root users, verify they belong to the same company
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT company_id FROM users WHERE id = ?', 
          [userId]
        );
        
        if (rows.length === 0 || rows[0].company_id !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } finally {
        connection.release();
      }
    }
    
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
      const timeEntry = {
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
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

// Projects API
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM projects WHERE is_archived = 0';
      let params = [];
      
      // For non-root users, filter by company
      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const [rows] = await connection.execute(query, params);
      
      const projects = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        status: row.status,
        priority: row.priority,
        startDate: row.start_date,
        endDate: row.end_date,
        budget: row.budget,
        clientId: row.client_id,
        clientName: row.client_name,
        isArchived: row.is_archived === 1,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
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
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    const now = new Date();
    
    // Get client name if client exists
    let clientName = null;
    if (value.clientId) {
      const connection = await pool.getConnection();
      try {
        const [clientRows] = await connection.execute(
          'SELECT * FROM clients WHERE id = ?', 
          [value.clientId]
        );
        
        if (clientRows.length > 0) {
          clientName = clientRows[0].name;
        }
      } finally {
        connection.release();
      }
    }
    
    // Insert project into database
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO projects (
          name, description, color, status, priority, start_date, end_date, budget, 
          client_id, client_name, is_archived, company_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await connection.execute(query, [
        value.name,
        value.description || null,
        value.color,
        value.status,
        value.priority,
        value.startDate || null,
        value.endDate || null,
        value.budget || null,
        value.clientId || null,
        clientName || null,
        0, // is_archived
        companyId,
        userId,
        now,
        now
      ]);
      
      const projectId = result[0].insertId;
      
      // Get the created project
      const [rows] = await connection.execute(
        'SELECT * FROM projects WHERE id = ?', 
        [projectId]
      );
      
      const project = {
        id: rows[0].id,
        name: rows[0].name,
        description: rows[0].description,
        color: rows[0].color,
        status: rows[0].status,
        priority: rows[0].priority,
        startDate: rows[0].start_date,
        endDate: rows[0].end_date,
        budget: rows[0].budget,
        clientId: rows[0].client_id,
        clientName: rows[0].client_name,
        isArchived: rows[0].is_archived === 1,
        createdBy: rows[0].created_by,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at
      };
      
      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get projects for company
app.get('/api/projects/company/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Check if user has access to this company
    // Handle case where companyId might be a Firebase ID (not a valid MySQL ID)
    if (!companyId || companyId.startsWith('-')) {
      return res.status(400).json({ error: 'Invalid company ID format' });
    }
    
    if (req.user.role !== 'root' && req.user.companyId !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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
    console.error('Error fetching projects for company:', error);
    res.status(500).json({ error: 'Failed to fetch projects for company' });
  }
});

// Get clients for company
app.get('/api/clients/company/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Check if user has access to this company
    // Handle case where companyId might be a Firebase ID (not a valid MySQL ID)
    if (!companyId || companyId.startsWith('-')) {
      return res.status(400).json({ error: 'Invalid company ID format' });
    }
    
    if (req.user.role !== 'root' && req.user.companyId !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT * FROM clients 
        WHERE company_id = ?
        ORDER BY created_at DESC
      `;
      
      const [rows] = await connection.execute(query, [companyId]);
      const clients = rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        companyId: row.company_id,
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
    console.error('Error fetching clients for company:', error);
    res.status(500).json({ error: 'Failed to fetch clients for company' });
  }
});

// Time Summary API
app.get('/api/time-summary', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
        endDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
    }
    
    const connection = await pool.getConnection();
    try {
      // Fix for date range filtering: set end date to end of day to include all entries for that day
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);
      
      let query = 'SELECT * FROM time_entries WHERE user_id = ? AND start_time >= ? AND start_time <= ?';
      let params = [userId, startDate, adjustedEndDate];
      
      // For non-root users, filter by company
      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      }
      
      const [rows] = await connection.execute(query, params);
      
      const entries = rows.map(row => ({
        duration: row.duration,
        isBillable: row.is_billable === 1
      }));
      
      const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
      const billableDuration = entries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => sum + entry.duration, 0);
      
      const summary = {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDuration,
        billableDuration,
        nonBillableDuration: totalDuration - billableDuration,
        totalEntries: entries.length,
        billableEntries: entries.filter(entry => entry.isBillable).length,
        formattedTotal: formatTimeFromSeconds(totalDuration),
        formattedBillable: formatTimeFromSeconds(billableDuration),
        formattedNonBillable: formatTimeFromSeconds(totalDuration - billableDuration)
      };
      
      res.json({
        success: true,
        data: summary
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching time summary:', error);
    res.status(500).json({ error: 'Failed to fetch time summary' });
  }
});

// Calendar API
app.get('/api/calendar', authenticateToken, async (req, res) => {
  try {
    const { year, month, projectId, billableOnly } = req.query;
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM time_entries WHERE user_id = ? AND start_time >= ? AND start_time <= ?';
      let params = [userId, startDate, endDate];
      
      // For non-root users, filter by company
      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      }
      
      // Apply filters
      if (projectId) {
        query += ' AND project_id = ?';
        params.push(projectId);
      }
      
      if (billableOnly === 'true') {
        query += ' AND is_billable = 1';
      }
      
      const [rows] = await connection.execute(query, params);
      
      const entries = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        projectId: row.project_id,
        projectName: row.project_name,
        clientId: row.client_id,
        clientName: row.client_name,
        description: row.description,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        isRunning: row.is_running === 1,
        isBillable: row.is_billable === 1,
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      // Group entries by date
      const calendarData = {};
      entries.forEach(entry => {
        const date = new Date(entry.startTime).toDateString();
        if (!calendarData[date]) {
          calendarData[date] = {
            date,
            events: [],
            totalDuration: 0,
            billableDuration: 0
          };
        }
        
        calendarData[date].events.push(entry);
        calendarData[date].totalDuration += entry.duration;
        if (entry.isBillable) {
          calendarData[date].billableDuration += entry.duration;
        }
      });
      
      res.json({
        success: true,
        data: Object.values(calendarData),
        month: targetMonth,
        year: targetYear
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

// Logging endpoints

// Create a new log entry
app.post('/api/logs', authenticateToken, async (req, res) => {
  try {
    const { level, message, action, details, userId, userName, ipAddress, userAgent } = req.body;
    
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO system_logs (
          timestamp, level, message, user_id, user_name, action, details, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await connection.execute(query, [
        new Date(),
        level,
        message,
        userId || null,
        userName || null,
        action,
        details ? JSON.stringify(details) : null,
        ipAddress || null,
        userAgent || null
      ]);
      
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating log entry:', error);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
});

// Get recent logs
app.get('/api/logs/recent', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, startDate, endDate } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?';
      let params = [parseInt(limit)];
      
      if (startDate && endDate) {
        query = 'SELECT * FROM system_logs WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ?';
        params = [new Date(startDate), new Date(endDate), parseInt(limit)];
      }
      
      const [rows] = await connection.execute(query, params);
      
      res.json({
        success: true,
        logs: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get logs by level
app.get('/api/logs/level/:level', authenticateToken, async (req, res) => {
  try {
    const { level } = req.params;
    const { limit = 100 } = req.query;
    
    const connection = await pool.getConnection();
    try {
      const query = 'SELECT * FROM system_logs WHERE level = ? ORDER BY timestamp DESC LIMIT ?';
      const [rows] = await connection.execute(query, [level, parseInt(limit)]);
      
      res.json({
        success: true,
        logs: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching logs by level:', error);
    res.status(500).json({ error: 'Failed to fetch logs by level' });
  }
});

// Get logs by user
app.get('/api/logs/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, startDate, endDate } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM system_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?';
      let params = [userId, parseInt(limit)];
      
      if (startDate && endDate) {
        query = 'SELECT * FROM system_logs WHERE user_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ?';
        params = [userId, new Date(startDate), new Date(endDate), parseInt(limit)];
      }
      
      const [rows] = await connection.execute(query, params);
      
      res.json({
        success: true,
        logs: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching logs by user:', error);
    res.status(500).json({ error: 'Failed to fetch logs by user' });
  }
});

// Get logs by action
app.get('/api/logs/action/:action', authenticateToken, async (req, res) => {
  try {
    const { action } = req.params;
    const { limit = 100, level, startDate, endDate } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM system_logs WHERE action = ? ORDER BY timestamp DESC LIMIT ?';
      let params = [action, parseInt(limit)];
      
      if (level) {
        query = 'SELECT * FROM system_logs WHERE action = ? AND level = ? ORDER BY timestamp DESC LIMIT ?';
        params = [action, level, parseInt(limit)];
      }
      
      if (startDate && endDate) {
        if (level) {
          query = 'SELECT * FROM system_logs WHERE action = ? AND level = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ?';
          params = [action, level, new Date(startDate), new Date(endDate), parseInt(limit)];
        } else {
          query = 'SELECT * FROM system_logs WHERE action = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ?';
          params = [action, new Date(startDate), new Date(endDate), parseInt(limit)];
        }
      }
      
      const [rows] = await connection.execute(query, params);
      
      res.json({
        success: true,
        logs: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching logs by action:', error);
    res.status(500).json({ error: 'Failed to fetch logs by action' });
  }
});

// Clear all logs
app.delete('/api/logs/clear', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ error: 'Only administrators can clear logs' });
    }
    
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM system_logs');
      
      res.json({ success: true, message: 'Logs cleared successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Clockistry API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
