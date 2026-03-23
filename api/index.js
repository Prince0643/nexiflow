console.log('Starting API server...');
require('dotenv').config();

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
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const billingEmailService = require('./services/billingEmailService');

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Create database connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'clockistry',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: process.env.MYSQL_CONNECT_TIMEOUT
    ? Number(process.env.MYSQL_CONNECT_TIMEOUT)
    : 10000
});

const ensureSystemLogsTable = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        level VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        user_id VARCHAR(255),
        user_name VARCHAR(255),
        action VARCHAR(255),
        details JSON,
        ip_address VARCHAR(255),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connection.release();
  }
}

ensureSystemLogsTable().catch((error) => {
  console.error('Error ensuring system_logs table exists:', error);
});

console.log('MySQL config:', {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
  user: process.env.MYSQL_USER || 'root',
  database: process.env.MYSQL_DATABASE || 'clockistry'
});

// Configure uploads directory
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory BEFORE helmet (to avoid CORS issues)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://nexi-flow.com',
  'https://www.nexi-flow.com'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.options('*', cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({
  limit: '25mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const isDev = process.env.NODE_ENV !== 'production'
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 2000 : 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.uid + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Admin Companies API (root only)
app.get('/api/admin/companies', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT id, name, is_active, pricing_level, max_members, created_at, updated_at FROM companies ORDER BY created_at DESC'
      );

      const companies = rows.map(row => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active === 1,
        pricingLevel: row.pricing_level,
        maxMembers: row.max_members,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      res.json({ success: true, data: companies, count: companies.length });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch companies' });
  }
});

app.post('/api/admin/companies', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { name, pricingLevel } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    const validPricing = ['solo', 'office', 'enterprise'];
    const level = validPricing.includes(pricingLevel) ? pricingLevel : 'solo';

    let maxMembers = 1;
    if (level === 'office') maxMembers = 10;
    if (level === 'enterprise') maxMembers = 100;

    const now = new Date();
    const companyId = `-${uuidv4()}`;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO companies (id, name, is_active, pricing_level, max_members, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?, ?)`,
        [companyId, name.trim(), level, maxMembers, now, now]
      );

      // Create default PDF settings row (same pattern as signup)
      const pdfSettingsId = Math.floor(Date.now() / 1000);
      await connection.execute(
        `
          INSERT INTO company_pdf_settings (
            id, company_id, company_name, logo_url, primary_color, secondary_color, show_powered_by, custom_footer_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pdfSettingsId,
          companyId,
          name.trim(),
          '',
          '#3B82F6',
          '#1E40AF',
          1,
          ''
        ]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        data: {
          id: companyId,
          name: name.trim(),
          pricingLevel: level,
          maxMembers,
          isActive: true,
          createdAt: now,
          updatedAt: now
        }
      });
    } catch (e) {
      try {
        await connection.rollback();
      } catch {}
      throw e;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ success: false, error: 'Failed to create company' });
  }
});

app.post('/api/admin/companies/:id/downgrade', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root') {
      return res.status(403).json({ success: false, error: 'Access denied. Root only.' });
    }

    const { id } = req.params;
    const { reason } = req.body || {};

    const connection = await pool.getConnection();
    try {
      // Get company details
      const [companyRows] = await connection.execute(
        'SELECT * FROM companies WHERE id = ? LIMIT 1',
        [id]
      );

      if (companyRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }

      const company = companyRows[0];
      const previousPricingLevel = company.pricing_level;

      if (previousPricingLevel === 'solo') {
        return res.status(400).json({ success: false, error: 'Company is already on solo plan' });
      }

      // Downgrade to solo
      await connection.execute(
        `UPDATE companies 
         SET pricing_level = 'solo', 
             max_members = 1,
             billing_status = 'downgraded',
             is_in_grace_period = 0,
             grace_period_end_date = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [id]
      );

      // Get all super admins for email notification
      const [adminRows] = await connection.execute(
        `SELECT email, name FROM users WHERE company_id = ? AND role = 'super_admin'`,
        [id]
      );

      // Send downgrade notification emails
      for (const admin of adminRows) {
        await billingEmailService.sendDowngradeNotification(
          { ...company, pricing_level: 'solo', max_members: 1 },
          admin
        );
      }

      console.log(`Root manually downgraded company ${company.name} (${id}) from ${previousPricingLevel} to solo`);

      res.json({
        success: true,
        message: 'Company downgraded to solo plan',
        data: {
          companyId: id,
          companyName: company.name,
          previousPricingLevel,
          newPricingLevel: 'solo',
          reason: reason || 'Manual downgrade by root',
          notifiedAdmins: adminRows.map(a => a.email)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error downgrading company:', error);
    res.status(500).json({ success: false, error: 'Failed to downgrade company' });
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Authentication middleware
async function authenticateToken(req, res, next) {
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
  description: Joi.string().allow('', null).optional(),
  startTime: Joi.date().default(() => new Date()),
  endTime: Joi.date().optional(),
  duration: Joi.number().min(0).default(0),
  isBillable: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string()).default([])
});

const timeEntryUpdateSchema = Joi.object({
  projectId: Joi.string().optional(),
  projectName: Joi.string().optional(),
  clientId: Joi.string().optional(),
  clientName: Joi.string().optional(),
  description: Joi.string().optional(),
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  duration: Joi.number().min(0).optional(),
  isBillable: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

const projectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  color: Joi.string().required(),
  status: Joi.string().valid('active', 'on-hold', 'completed', 'cancelled').default('active'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  budget: Joi.number().min(0).optional(),
  clientId: Joi.string().optional()
});

const clientSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().allow('', null).email().optional(),
  country: Joi.string().allow('', null).optional(),
  timezone: Joi.string().allow('', null).optional(),
  clientType: Joi.string().valid('full-time', 'part-time', 'custom', 'gig').default('full-time'),
  hourlyRate: Joi.number().min(0).default(25),
  hoursPerWeek: Joi.number().min(0).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  phone: Joi.string().allow('', null).optional(),
  company: Joi.string().allow('', null).optional(),
  address: Joi.string().allow('', null).optional(),
  currency: Joi.string().allow('', null).optional()
});

const taskSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  projectId: Joi.string().required(),
  status: Joi.string().required(),
  priority: Joi.string().required(),
  assigneeId: Joi.string().optional(),
  dueDate: Joi.date().optional(),
  estimatedHours: Joi.number().min(0).optional(),
  tags: Joi.array().items(Joi.string()).default([]),
  parentTaskId: Joi.string().optional(),
  teamId: Joi.string().optional()
});

const taskUpdateSchema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  projectId: Joi.string().optional(),
  status: Joi.string().optional(),
  priority: Joi.string().optional(),
  assigneeId: Joi.string().allow('', null).optional(),
  dueDate: Joi.date().allow('', null).optional(),
  estimatedHours: Joi.number().min(0).allow(null).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  parentTaskId: Joi.string().allow('', null).optional(),
  teamId: Joi.string().allow('', null).optional()
}).min(1);

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

const isAdminRole = (role) => {
  return ['admin', 'super_admin', 'hr', 'root'].includes(role);
};

const pdfSettingsSchema = Joi.object({
  companyName: Joi.string().allow('', null).optional(),
  logoUrl: Joi.string().allow('', null).optional(),
  primaryColor: Joi.string().allow('', null).optional(),
  secondaryColor: Joi.string().allow('', null).optional(),
  showPoweredBy: Joi.boolean().optional(),
  customFooterText: Joi.string().allow('', null).optional()
});

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Company PDF Settings API
app.get('/api/companies/:companyId/pdf-settings', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (req.user.role !== 'root' && req.user.companyId && String(req.user.companyId) !== String(companyId)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    try {
      const [companyRows] = await connection.execute(
        'SELECT id FROM companies WHERE id = ? LIMIT 1',
        [companyId]
      );

      if (!companyRows.length) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }

      const [settingsRows] = await connection.execute(
        'SELECT company_name, logo_url, primary_color, secondary_color, show_powered_by, custom_footer_text FROM company_pdf_settings WHERE company_id = ? LIMIT 1',
        [companyId]
      );

      if (!settingsRows.length) {
        return res.json({ success: true, data: null });
      }

      const row = settingsRows[0];
      res.json({
        success: true,
        data: {
          companyName: row.company_name || '',
          logoUrl: row.logo_url || '',
          primaryColor: row.primary_color || '#3B82F6',
          secondaryColor: row.secondary_color || '#10B981',
          showPoweredBy: row.show_powered_by === null || row.show_powered_by === undefined ? true : row.show_powered_by === 1,
          customFooterText: row.custom_footer_text || ''
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error loading PDF settings:', error);
    res.status(500).json({ success: false, error: 'Failed to load PDF settings' });
  }
});

app.put('/api/companies/:companyId/pdf-settings', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (req.user.role !== 'root' && req.user.companyId && String(req.user.companyId) !== String(companyId)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { error, value } = pdfSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const connection = await pool.getConnection();
    try {
      const [companyRows] = await connection.execute(
        'SELECT id FROM companies WHERE id = ? LIMIT 1',
        [companyId]
      );

      if (!companyRows.length) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }

      const updateQuery = `
        UPDATE company_pdf_settings
        SET company_name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, show_powered_by = ?, custom_footer_text = ?
        WHERE company_id = ?
      `;

      const updateParams = [
        value.companyName || '',
        value.logoUrl || '',
        value.primaryColor || '#3B82F6',
        value.secondaryColor || '#10B981',
        value.showPoweredBy ? 1 : 0,
        value.customFooterText || '',
        companyId
      ];

      const [updateResult] = await connection.execute(updateQuery, updateParams);

      if (!updateResult.affectedRows) {
        const insertQuery = `
          INSERT INTO company_pdf_settings (
            company_id, company_name, logo_url, primary_color, secondary_color, show_powered_by, custom_footer_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(insertQuery, [
          companyId,
          value.companyName || '',
          value.logoUrl || '',
          value.primaryColor || '#3B82F6',
          value.secondaryColor || '#10B981',
          value.showPoweredBy ? 1 : 0,
          value.customFooterText || ''
        ]);
      }

      res.json({ success: true, data: value });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating PDF settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update PDF settings' });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = String(req.user.uid);
    const requesterRole = req.user.role;
    const requesterCompanyId = req.user.companyId;

    const isSelf = requesterId === String(id);
    const isPrivileged = ['admin', 'super_admin', 'hr', 'root'].includes(requesterRole);

    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE (id = ? OR uid = ?) AND is_active = 1 LIMIT 1',
        [id, id]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const user = rows[0];

      if (requesterRole !== 'root' && requesterCompanyId && user.company_id !== requesterCompanyId && !isSelf) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          uid: user.uid,
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
        },
        company: null
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute('SELECT * FROM projects WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existing = existingRows[0];
      if (req.user.role !== 'root' && companyId && existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get client name if client exists
      let clientName = null;
      if (value.clientId) {
        const [clientRows] = await connection.execute('SELECT * FROM clients WHERE id = ?', [value.clientId]);
        if (clientRows.length > 0) {
          clientName = clientRows[0].name;
        }
      }

      const query = `
        UPDATE projects
        SET name = ?, description = ?, color = ?, status = ?, priority = ?,
            start_date = ?, end_date = ?, budget = ?, client_id = ?, client_name = ?, updated_at = ?
        WHERE id = ?
      `;

      await connection.execute(query, [
        value.name,
        value.description || null,
        value.color,
        value.status,
        value.priority,
        value.startDate || null,
        value.endDate || null,
        value.budget || null,
        value.clientId || null,
        clientName,
        new Date(),
        id
      ]);

      res.json({
        success: true,
        message: 'Project updated successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute('SELECT * FROM projects WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existing = existingRows[0];
      if (req.user.role !== 'root' && companyId && existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await connection.execute('DELETE FROM projects WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.put('/api/projects/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute('SELECT * FROM projects WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existing = existingRows[0];
      if (req.user.role !== 'root' && companyId && existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await connection.execute(
        'UPDATE projects SET is_archived = 1, updated_at = ? WHERE id = ?',
        [new Date(), id]
      );

      res.json({
        success: true,
        message: 'Project archived successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

app.put('/api/projects/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute('SELECT * FROM projects WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existing = existingRows[0];
      if (req.user.role !== 'root' && companyId && existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await connection.execute(
        'UPDATE projects SET is_archived = 0, updated_at = ? WHERE id = ?',
        [new Date(), id]
      );

      res.json({
        success: true,
        message: 'Project unarchived successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error unarchiving project:', error);
    res.status(500).json({ error: 'Failed to unarchive project' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = String(req.user.uid);
    const requesterRole = req.user.role;
    const requesterCompanyId = req.user.companyId;

    const isSelf = requesterId === String(id);
    const isPrivileged = ['admin', 'super_admin', 'hr', 'root'].includes(requesterRole);

    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updates = req.body || {};

    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.timezone !== undefined) {
      fields.push('timezone = ?');
      values.push(updates.timezone);
    }
    if (updates.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(updates.avatar || null);
    }
    if (updates.hourlyRate !== undefined) {
      fields.push('hourly_rate = ?');
      values.push(updates.hourlyRate);
    }

    fields.push('updated_at = ?');
    values.push(new Date());

    if (!fields.length) {
      return res.json({ success: true, message: 'No changes applied' });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE (id = ? OR uid = ?) AND is_active = 1 LIMIT 1',
        [id, id]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const user = rows[0];

      if (requesterRole !== 'root' && requesterCompanyId && user.company_id !== requesterCompanyId && !isSelf) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, [...values, user.id]);

      res.json({ success: true, message: 'User updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Avatar upload endpoint
app.post('/api/users/:id/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = String(req.user.uid);
    
    // Users can only upload their own avatar unless they're admin
    if (id !== requesterId && !['super_admin', 'root'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only upload your own avatar' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }
    
    // Build the full file URL with host
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const fileUrl = `${protocol}://${host}/uploads/avatars/${req.file.filename}`;
    
    // Update user avatar in database
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?',
        [fileUrl, id]
      );
      
      res.json({
        success: true,
        data: {
          avatarUrl: fileUrl,
          message: 'Avatar uploaded successfully'
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload avatar' 
    });
  }
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
          const [settingsRows] = await connection.execute(
            'SELECT company_name, logo_url, primary_color, secondary_color, show_powered_by, custom_footer_text FROM company_pdf_settings WHERE company_id = ? LIMIT 1',
            [company.id]
          );
          const settings = settingsRows.length
            ? {
                companyName: settingsRows[0].company_name || '',
                logoUrl: settingsRows[0].logo_url || '',
                primaryColor: settingsRows[0].primary_color || '#3B82F6',
                secondaryColor: settingsRows[0].secondary_color || '#10B981',
                showPoweredBy:
                  settingsRows[0].show_powered_by === null || settingsRows[0].show_powered_by === undefined
                    ? true
                    : settingsRows[0].show_powered_by === 1,
                customFooterText: settingsRows[0].custom_footer_text || ''
              }
            : undefined;
          companyData = {
            id: company.id,
            name: company.name,
            isActive: company.is_active === 1,
            pricingLevel: company.pricing_level,
            maxMembers: company.max_members,
            createdAt: company.created_at,
            updatedAt: company.updated_at,
            pdfSettings: settings
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

app.get('/api/admin/time-entries', authenticateToken, async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM time_entries';
      const params = [];

      if (req.user.role !== 'root' && companyId) {
        query += ' WHERE company_id = ?';
        params.push(companyId);
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

      res.json({ success: true, data: entries, count: entries.length });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching admin time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

app.get('/api/admin/time-entries/running', authenticateToken, async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const queryCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : null;
    const shouldIgnoreQueryCompanyId = Boolean(queryCompanyId && queryCompanyId.startsWith('-'));
    const effectiveCompanyId = req.user.role === 'root'
      ? (shouldIgnoreQueryCompanyId ? null : queryCompanyId)
      : req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM time_entries WHERE is_running = 1';
      const params = [];

      if (effectiveCompanyId) {
        query += ' AND company_id = ?';
        params.push(effectiveCompanyId);
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

      res.json({ success: true, data: entries, count: entries.length });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching running admin time entries:', error);
    res.status(500).json({ error: 'Failed to fetch running time entries' });
  }
});

app.delete('/api/admin/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let query = 'DELETE FROM time_entries WHERE id = ?';
      const params = [id];

      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      }

      const [result] = await connection.execute(query, params);

      if (!result.affectedRows) {
        return res.status(404).json({ success: false, error: 'Time entry not found' });
      }

      res.json({ success: true, message: 'Time entry deleted successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting admin time entry:', error);
    res.status(500).json({ success: false, error: 'Failed to delete time entry' });
  }
});

app.post('/api/admin/time-entries/:id/stop', authenticateToken, async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let selectQuery = 'SELECT * FROM time_entries WHERE id = ?';
      const selectParams = [id];
      if (req.user.role !== 'root' && companyId) {
        selectQuery += ' AND company_id = ?';
        selectParams.push(companyId);
      }

      const [rows] = await connection.execute(selectQuery, selectParams);
      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'Time entry not found' });
      }

      const row = rows[0];
      const endTime = new Date();
      const duration = calculateDuration(row.start_time, endTime);

      const updateQuery = `
        UPDATE time_entries
        SET end_time = ?, duration = ?, is_running = 0, updated_at = ?
        WHERE id = ?
      `;

      await connection.execute(updateQuery, [endTime, duration, endTime, id]);

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
        endTime,
        duration,
        isRunning: false,
        isBillable: row.is_billable === 1,
        tags: [],
        createdAt: row.created_at,
        updatedAt: endTime
      };

      res.json({ success: true, message: 'Time entry stopped successfully', data: timeEntry });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error stopping admin time entry:', error);
    res.status(500).json({ success: false, error: 'Failed to stop time entry' });
  }
});

app.put('/api/admin/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const updates = req.body || {};
    const companyId = req.user.companyId;

    const fields = [];
    const values = [];

    if (updates.projectId !== undefined) {
      fields.push('project_id = ?');
      values.push(updates.projectId || null);
    }
    if (updates.projectName !== undefined) {
      fields.push('project_name = ?');
      values.push(updates.projectName || null);
    }
    if (updates.clientId !== undefined) {
      fields.push('client_id = ?');
      values.push(updates.clientId || null);
    }
    if (updates.clientName !== undefined) {
      fields.push('client_name = ?');
      values.push(updates.clientName || null);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description || null);
    }
    if (updates.isBillable !== undefined) {
      fields.push('is_billable = ?');
      values.push(updates.isBillable ? 1 : 0);
    }
    if (updates.startTime !== undefined) {
      fields.push('start_time = ?');
      values.push(new Date(updates.startTime));
    }
    if (updates.endTime !== undefined) {
      fields.push('end_time = ?');
      values.push(updates.endTime ? new Date(updates.endTime) : null);
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(Number(updates.duration) || 0);
    }

    fields.push('updated_at = ?');
    values.push(new Date());

    if (!fields.length) {
      return res.json({ success: true, message: 'No changes applied' });
    }

    const connection = await pool.getConnection();
    try {
      let where = ' WHERE id = ?';
      const params = [...values, id];
      if (req.user.role !== 'root' && companyId) {
        where += ' AND company_id = ?';
        params.push(companyId);
      }

      const query = `UPDATE time_entries SET ${fields.join(', ')}${where}`;
      const [result] = await connection.execute(query, params);

      if (!result.affectedRows) {
        return res.status(404).json({ success: false, error: 'Time entry not found' });
      }

      res.json({ success: true, message: 'Time entry updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating admin time entry:', error);
    res.status(500).json({ success: false, error: 'Failed to update time entry' });
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
      
      // Create user with generated UUID
      const userId = uuidv4();
      const now = new Date();
      const userQuery = `
        INSERT INTO users (
          id, uid, name, email, password_hash, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, 1, ?, ?)
      `;
      
      await connection.execute(userQuery, [
        userId,
        userId,
        name,
        email,
        hashedPassword,
        role,
        'America/New_York', // Default timezone
        25, // Default hourly rate
        now,
        now
      ]);
      
      // If this is a super admin signup, create a company
      let companyData = null;
      if (role === 'super_admin' && companyName) {
        // Create company
        const newCompanyId = `-${uuidv4()}`;
        const companyQuery = `
          INSERT INTO companies (
            id, name, is_active, pricing_level, max_members, created_at, updated_at
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
        
        await connection.execute(companyQuery, [
          newCompanyId,
          companyName,
          1, // is_active
          'solo', // pricing_level
          1, // max_members
          now,
          now
        ]);

        const companyId = newCompanyId;

        // Create default PDF settings row
        const pdfSettingsId = Math.floor(Date.now() / 1000); // Generate unique int id
        await connection.execute(
          `
            INSERT INTO company_pdf_settings (
              id, company_id, company_name, logo_url, primary_color, secondary_color, show_powered_by, custom_footer_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            pdfSettingsId,
            companyId,
            defaultPdfSettings.companyName,
            defaultPdfSettings.logoUrl,
            defaultPdfSettings.primaryColor,
            defaultPdfSettings.secondaryColor,
            defaultPdfSettings.showPoweredBy ? 1 : 0,
            defaultPdfSettings.customFooterText
          ]
        );
        
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
        tags: [],
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
    const entryId = uuidv4();
    
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
          projectId = value.projectId;
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
          id, user_id, company_id, project_id, project_name, client_id, client_name,
          description, start_time, end_time, duration, is_running, is_billable, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await connection.execute(query, [
        entryId,
        userId,
        companyId,
        value.projectId || null,
        projectName || null,
        clientId || null,
        clientName || null,
        value.description ?? null,
        value.startTime,
        value.endTime || null,
        value.duration ?? 0,
        !value.endTime ? 1 : 0, // is_running
        value.isBillable ? 1 : 0, // is_billable
        JSON.stringify(value.tags || []),
        now,
        now
      ]);
      
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
    const { error, value } = timeEntryUpdateSchema.validate(req.body);
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
      let projectId = existingEntry.project_id;
      let projectName = existingEntry.project_name;
      let clientId = existingEntry.client_id;
      let clientName = existingEntry.client_name;
      
      // Allow explicitly setting client without changing project
      if (Object.prototype.hasOwnProperty.call(value, 'clientId')) {
        clientId = value.clientId || null;
      }
      if (Object.prototype.hasOwnProperty.call(value, 'clientName')) {
        clientName = value.clientName || null;
      }

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

      // Merge other fields with existing entry
      const description = Object.prototype.hasOwnProperty.call(value, 'description')
        ? value.description
        : existingEntry.description;

      const startTime = Object.prototype.hasOwnProperty.call(value, 'startTime')
        ? value.startTime
        : existingEntry.start_time;

      const endTime = Object.prototype.hasOwnProperty.call(value, 'endTime')
        ? value.endTime
        : existingEntry.end_time;

      const duration = Object.prototype.hasOwnProperty.call(value, 'duration')
        ? value.duration
        : existingEntry.duration;

      const isBillable = Object.prototype.hasOwnProperty.call(value, 'isBillable')
        ? (value.isBillable ? 1 : 0)
        : existingEntry.is_billable;

      const isRunning = endTime ? 0 : 1;

      const tags = Object.prototype.hasOwnProperty.call(value, 'tags')
        ? JSON.stringify(value.tags || [])
        : existingEntry.tags;
      
      // Update entry
      const query = `
        UPDATE time_entries 
        SET project_id = ?, project_name = ?, client_id = ?, client_name = ?, 
            description = ?, start_time = ?, end_time = ?, duration = ?, 
            is_running = ?, is_billable = ?, tags = ?, updated_at = ?
        WHERE id = ?
      `;

      const params = [
        projectId || null,
        projectName || null,
        clientId || null,
        clientName || null,
        description,
        startTime,
        endTime || null,
        duration,
        isRunning, // is_running
        isBillable, // is_billable
        tags,
        new Date(),
        id
      ].map(p => (p === undefined ? null : p));

      await connection.execute(query, params);
      
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

// Stop a running time entry
app.post('/api/time-entries/:id/stop', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const companyId = req.user.companyId;

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

      if (req.user.role !== 'root' && existingEntry.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const startTime = new Date(existingEntry.start_time);
      const endTime = new Date();
      const duration = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

      await connection.execute(
        `UPDATE time_entries
         SET end_time = ?, duration = ?, is_running = 0, updated_at = ?
         WHERE id = ?`,
        [endTime, duration, new Date(), id]
      );

      const [rows] = await connection.execute(
        'SELECT * FROM time_entries WHERE id = ?',
        [id]
      );

      const row = rows[0];
      const updated = {
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
        data: updated,
        message: 'Time entry stopped successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error stopping time entry:', error);
    res.status(500).json({ error: 'Failed to stop time entry' });
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
        tags: [],
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

// Admin Teams API
app.get('/api/admin/teams', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM teams WHERE is_active = 1';
      const params = [];

      // For non-root users, filter by company
      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await connection.execute(query, params);
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
        createdAt: row.created_at,
        updatedAt: row.updated_at
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
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Team Stats API
app.get('/api/teams/:teamId/stats', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [teamRows] = await connection.execute('SELECT * FROM teams WHERE id = ?', [teamId]);
      if (teamRows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const team = teamRows[0];
      if (req.user.role !== 'root' && companyId && team.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const [memberRows] = await connection.execute(
        'SELECT COUNT(*) AS totalMembers, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeMembers FROM team_members WHERE team_id = ?',
        [teamId]
      );

      const [taskRows] = await connection.execute(
        `SELECT
           COUNT(*) AS totalTasks,
           SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS completedTasks,
           SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) AS inProgressTasks,
           SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURDATE() AND is_completed = 0 THEN 1 ELSE 0 END) AS overdueTasks
         FROM tasks
         WHERE team_id = ?`,
        [teamId]
      );

      // Time tracking is computed from the team's members.
      // This ensures time is reflected even if entries aren't linked to tasks.
      let timeQuery = `
        SELECT
          COALESCE(SUM(te.duration), 0) AS totalTimeLogged,
          COALESCE(SUM(CASE WHEN te.is_billable = 1 THEN te.duration ELSE 0 END), 0) AS billableTimeLogged,
          COUNT(te.id) AS totalTimeEntries
        FROM time_entries te
        WHERE te.user_id IN (
          SELECT tm.user_id
          FROM team_members tm
          WHERE tm.team_id = ? AND tm.is_active = 1
        )
      `;

      const timeParams = [teamId];
      if (req.user.role !== 'root' && companyId) {
        timeQuery += ' AND te.company_id = ?';
        timeParams.push(companyId);
      }

      const [timeRows] = await connection.execute(timeQuery, timeParams);

      const totalMembers = Number(memberRows[0]?.totalMembers || 0);
      const activeMembers = Number(memberRows[0]?.activeMembers || 0);
      const totalTasks = Number(taskRows[0]?.totalTasks || 0);
      const completedTasks = Number(taskRows[0]?.completedTasks || 0);
      const inProgressTasks = Number(taskRows[0]?.inProgressTasks || 0);
      const overdueTasks = Number(taskRows[0]?.overdueTasks || 0);
      const totalTimeLogged = Number(timeRows[0]?.totalTimeLogged || 0);
      const billableTimeLogged = Number(timeRows[0]?.billableTimeLogged || 0);
      const totalTimeEntries = Number(timeRows[0]?.totalTimeEntries || 0);

      const stats = {
        totalMembers,
        activeMembers,
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        totalTimeLogged,
        averageTaskCompletion: 0,
        totalHours: totalTimeLogged / 3600,
        billableHours: billableTimeLogged / 3600,
        nonBillableHours: (totalTimeLogged - billableTimeLogged) / 3600,
        totalTimeEntries,
        averageHoursPerMember: totalMembers > 0 ? (totalTimeLogged / 3600) / totalMembers : 0,
        timeByProject: []
      };

      res.json({ success: true, data: stats });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching team stats:', error);
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

// Admin Users API
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM users WHERE is_active = 1';
      const params = [];

      // For root users without company, show all users (root dashboard)
      // For non-root users, always filter by company
      if (req.user.role === 'root') {
        // Root users can see all users, or filter by their company if they have one
        if (companyId) {
          query += ' AND (company_id = ? OR company_id IS NULL)';
          params.push(companyId);
        }
      } else {
        // Non-root users MUST have company filtering
        // If they have a company, show only that company's users
        // If they don't have a company, show only themselves
        if (companyId) {
          query += ' AND company_id = ?';
          params.push(companyId);
        } else {
          // No company assigned - user should only see themselves
          query += ' AND id = ?';
          params.push(req.user.uid);
        }
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await connection.execute(query, params);
      const users = rows.map(row => ({
        id: row.id,
        uid: row.uid,
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
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Invoices API

const invoiceCreateSchema = Joi.object({
  invoiceNumber: Joi.string().required(),
  clientId: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  status: Joi.string().valid('draft', 'sent', 'paid', 'void').default('draft'),
  notes: Joi.string().allow('', null).optional(),
  currency: Joi.string().allow('', null).optional(),
  hourlyRate: Joi.number().min(0).allow(null).optional(),
  items: Joi.array().items(Joi.object({
    timeEntryId: Joi.string().allow('', null).optional(),
    projectId: Joi.string().allow('', null).optional(),
    description: Joi.string().allow('', null).optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().allow(null).optional(),
    duration: Joi.number().min(0).required(),
    rate: Joi.number().min(0).allow(null).optional(),
    amount: Joi.number().min(0).allow(null).optional()
  })).min(1).required()
});

app.post('/api/invoices', authenticateToken, async (req, res) => {
  const { error, value } = invoiceCreateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  const connection = await pool.getConnection();
  try {
    const invoiceId = uuidv4();

    const clientId = value.clientId;
    const invoiceNumber = value.invoiceNumber;
    const startDate = moment(value.startDate).format('YYYY-MM-DD');
    const endDate = moment(value.endDate).format('YYYY-MM-DD');
    const status = value.status || 'draft';
    const notes = value.notes ?? null;
    const currency = value.currency ?? null;
    const hourlyRate = typeof value.hourlyRate === 'number' ? value.hourlyRate : null;

    const createdBy = req.user.uid;
    const companyId = req.user.companyId || null;

    const totalSeconds = value.items.reduce((sum, item) => sum + (item.duration || 0), 0);
    const totalAmount = value.items.reduce((sum, item) => {
      const amount = typeof item.amount === 'number'
        ? item.amount
        : ((item.duration || 0) / 3600) * (typeof item.rate === 'number' ? item.rate : (hourlyRate || 0));
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO invoices (
        id, invoice_number, client_id, company_id, created_by,
        start_date, end_date, status,
        currency, hourly_rate,
        total_seconds, total_amount,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        invoiceNumber,
        clientId,
        companyId,
        createdBy,
        startDate,
        endDate,
        status,
        currency,
        hourlyRate,
        totalSeconds,
        totalAmount,
        notes
      ]
    );

    for (const item of value.items) {
      const itemId = uuidv4();
      const duration = item.duration || 0;
      const rate = typeof item.rate === 'number' ? item.rate : hourlyRate;
      const amount = typeof item.amount === 'number'
        ? item.amount
        : (duration / 3600) * (typeof rate === 'number' ? rate : 0);

      await connection.execute(
        `INSERT INTO invoice_items (
          id, invoice_id, time_entry_id, project_id,
          description, start_time, end_time, duration,
          rate, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          invoiceId,
          item.timeEntryId || null,
          item.projectId || null,
          item.description ?? null,
          item.startTime ? moment(item.startTime).format('YYYY-MM-DD HH:mm:ss') : null,
          item.endTime ? moment(item.endTime).format('YYYY-MM-DD HH:mm:ss') : null,
          duration,
          rate,
          amount
        ]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      data: {
        id: invoiceId,
        invoiceNumber,
        status,
        totalSeconds,
        totalAmount
      }
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error('Error creating invoice:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create invoice'
    });
  } finally {
    connection.release();
  }
});

app.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          i.id,
          i.invoice_number,
          i.client_id,
          c.name AS client_name,
          i.start_date,
          i.end_date,
          i.status,
          i.currency,
          i.hourly_rate,
          i.total_seconds,
          i.total_amount,
          i.notes,
          i.created_at,
          i.updated_at
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        WHERE i.created_by = ?
        ORDER BY i.created_at DESC`,
        [req.user.uid]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error fetching invoices:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices'
    });
  }
});

app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [invoiceRows] = await connection.execute(
      `SELECT
        i.id,
        i.invoice_number,
        i.client_id,
        c.name AS client_name,
        c.email AS client_email,
        i.start_date,
        i.end_date,
        i.status,
        i.currency,
        i.hourly_rate,
        i.total_seconds,
        i.total_amount,
        i.notes,
        i.created_at,
        i.updated_at
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.id = ? AND i.created_by = ?
      LIMIT 1`,
      [id, req.user.uid]
    );

    if (!invoiceRows || invoiceRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = invoiceRows[0];

    const [itemRows] = await connection.execute(
      `SELECT
        ii.id,
        ii.invoice_id,
        ii.time_entry_id,
        ii.project_id,
        p.name AS project_name,
        ii.description,
        ii.start_time,
        ii.end_time,
        ii.duration,
        ii.rate,
        ii.amount,
        ii.created_at
      FROM invoice_items ii
      LEFT JOIN projects p ON p.id = ii.project_id
      WHERE invoice_id = ?
      ORDER BY start_time ASC, created_at ASC`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        invoice,
        items: itemRows
      }
    });
  } catch (err) {
    console.error('Error fetching invoice details:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch invoice details' });
  } finally {
    connection.release();
  }
});

const invoiceSendSchema = Joi.object({
  pdfBase64: Joi.string().required(),
  fileName: Joi.string().allow('', null).optional(),
  subject: Joi.string().allow('', null).optional(),
  message: Joi.string().allow('', null).optional()
});

app.post('/api/invoices/:id/send', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { error, value } = invoiceSendSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    return res.status(500).json({
      success: false,
      error: 'SMTP is not configured'
    });
  }

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT 
        i.id,
        i.invoice_number,
        i.status,
        i.client_id,
        c.name AS client_name,
        c.email AS client_email
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.id = ? AND i.created_by = ?
      LIMIT 1`,
      [id, req.user.uid]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = rows[0];
    const to = invoice.client_email;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Client email not found' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const pdfBuffer = Buffer.from(value.pdfBase64, 'base64');
    const fileName = value.fileName || `${invoice.invoice_number || 'invoice'}.pdf`;
    const subject = value.subject || `Invoice ${invoice.invoice_number}`;
    const message = value.message || `Hi ${invoice.client_name || ''},\n\nPlease see the attached invoice.\n\nThanks.`;

    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: message,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    await connection.execute(
      `UPDATE invoices SET status = 'sent' WHERE id = ? AND created_by = ?`,
      [id, req.user.uid]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Error sending invoice email:', err);
    return res.status(500).json({ success: false, error: 'Failed to send invoice email' });
  } finally {
    connection.release();
  }
});

// Projects API
const mapProjectRow = (row) => ({
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
});

const parsePagination = (req) => {
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = Math.max(1, Math.min(100, Number.parseInt(String(limitRaw ?? '20'), 10) || 20));
  const offset = Math.max(0, Number.parseInt(String(offsetRaw ?? '0'), 10) || 0);

  return { limit, offset };
};

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const includeArchived = req.query.archived === '1' || req.query.archived === 'true';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const { limit, offset } = parsePagination(req);
    
    const connection = await pool.getConnection();
    try {
      let where = ' WHERE is_archived = ?';
      const params = [includeArchived ? 1 : 0];
      
      // For non-root users, filter by company
      if (req.user.role !== 'root' && companyId) {
        where += ' AND company_id = ?';
        params.push(companyId);
      }

      if (status && status !== 'all') {
        where += ' AND status = ?';
        params.push(status);
      }

      if (search) {
        where += ' AND (name LIKE ? OR description LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like);
      }

      const countQuery = `SELECT COUNT(*) as total FROM projects${where}`;
      const [countRows] = await connection.execute(countQuery, params);
      const total = Number(countRows?.[0]?.total || 0);

      const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
      const safeOffset = Math.max(0, Number(offset) || 0);
      const query = `SELECT * FROM projects${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
      
      const [rows] = await connection.execute(query, params);
      const projects = rows.map(mapProjectRow);
      
      res.json({
        success: true,
        data: projects,
        count: total
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Clients API
const mapClientRow = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  country: row.country,
  timezone: row.timezone,
  clientType: row.client_type,
  hourlyRate: row.hourly_rate,
  hoursPerWeek: row.hours_per_week,
  startDate: row.start_date,
  endDate: row.end_date,
  phone: row.phone,
  company: row.company,
  address: row.address,
  currency: row.currency,
  isArchived: row.is_archived === 1,
  createdBy: row.created_by,
  companyId: row.company_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

app.get('/api/clients/company/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Non-root users can only access their own company
    if (req.user.role !== 'root' && req.user.companyId !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM clients WHERE company_id = ? ORDER BY created_at DESC',
        [companyId]
      );

      const clients = rows.map(mapClientRow);

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
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM clients';
      const params = [];

      // For non-root users, filter by company
      if (req.user.role !== 'root' && companyId) {
        query += ' WHERE company_id = ?';
        params.push(companyId);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await connection.execute(query, params);
      const clients = rows.map(mapClientRow);

      res.json({
        success: true,
        data: clients,
        count: clients.length
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    const companyId = req.user.companyId;
    const now = new Date();
    const clientId = uuidv4();

    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO clients (
          id, name, email, country, timezone, client_type, hourly_rate, hours_per_week,
          start_date, end_date, phone, company, address, currency, is_archived,
          created_by, company_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.execute(query, [
        clientId,
        value.name,
        value.email || null,
        value.country || null,
        value.timezone || null,
        value.clientType || 'full-time',
        value.hourlyRate !== undefined ? value.hourlyRate : 25,
        value.hoursPerWeek !== undefined ? value.hoursPerWeek : null,
        value.startDate || null,
        value.endDate || null,
        value.phone || null,
        value.company || null,
        value.address || null,
        value.currency || null,
        0,
        userId,
        companyId,
        now,
        now
      ]);
      const [rows] = await connection.execute('SELECT * FROM clients WHERE id = ?', [clientId]);
      const row = rows[0];

      const client = {
        id: row.id,
        name: row.name,
        email: row.email,
        country: row.country,
        timezone: row.timezone,
        clientType: row.client_type,
        hourlyRate: row.hourly_rate,
        hoursPerWeek: row.hours_per_week,
        startDate: row.start_date,
        endDate: row.end_date,
        phone: row.phone,
        company: row.company,
        address: row.address,
        currency: row.currency,
        isArchived: row.is_archived === 1,
        createdBy: row.created_by,
        companyId: row.company_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      res.status(201).json({
        success: true,
        data: client,
        message: 'Client created successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute('SELECT * FROM clients WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const existing = existingRows[0];
      if (req.user.role !== 'root' && companyId && existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const query = `
        UPDATE clients
        SET name = ?, email = ?, country = ?, timezone = ?, client_type = ?, hourly_rate = ?,
            hours_per_week = ?, start_date = ?, end_date = ?, phone = ?, company = ?, address = ?,
            currency = ?, updated_at = ?
        WHERE id = ?
      `;

      await connection.execute(query, [
        value.name,
        value.email || null,
        value.country || null,
        value.timezone || null,
        value.clientType || 'full-time',
        value.hourlyRate !== undefined ? value.hourlyRate : 25,
        value.hoursPerWeek !== undefined ? value.hoursPerWeek : null,
        value.startDate || null,
        value.endDate || null,
        value.phone || null,
        value.company || null,
        value.address || null,
        value.currency || null,
        new Date(),
        id
      ]);

      res.json({
        success: true,
        message: 'Client updated successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
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
    const projectId = uuidv4();
    
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
          id, name, description, color, status, priority, start_date, end_date, budget, 
          client_id, client_name, is_archived, company_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await connection.execute(query, [
        projectId,
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
      
      // Get the created project
      const [rows] = await connection.execute(
        'SELECT * FROM projects WHERE id = ?', 
        [projectId]
      );
      
      const project = {
        ...mapProjectRow(rows[0])
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
    const includeArchived = req.query.archived === '1' || req.query.archived === 'true';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const { limit, offset } = parsePagination(req);
    
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
      let where = ' WHERE company_id = ? AND is_archived = ?';
      const params = [companyId, includeArchived ? 1 : 0];

      if (status && status !== 'all') {
        where += ' AND status = ?';
        params.push(status);
      }

      if (search) {
        where += ' AND (name LIKE ? OR description LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like);
      }

      const countQuery = `SELECT COUNT(*) as total FROM projects${where}`;
      const [countRows] = await connection.execute(countQuery, params);
      const total = Number(countRows?.[0]?.total || 0);

      const query = `SELECT * FROM projects${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      const dataParams = [...params, limit, offset];

      const [rows] = await connection.execute(query, dataParams);
      const projects = rows.map(mapProjectRow);
      
      res.json({
        success: true,
        data: projects,
        count: total
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching projects for company:', error);
    res.status(500).json({ error: 'Failed to fetch projects for company' });
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

// Test endpoint without authentication
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Task Statuses API
console.log('Registering /api/task-statuses endpoint');
app.get('/api/task-statuses', authenticateToken, async (req, res) => {
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

// Task Priorities API
console.log('Registering /api/task-priorities endpoint');
app.get('/api/task-priorities', authenticateToken, async (req, res) => {
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

// Tasks API
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { projectId, userId } = req.query;
    const companyId = req.user.companyId;
    
    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM tasks WHERE 1=1';
      const params = [];
      
      // Apply company filtering for non-root users
      if (req.user.role !== 'root' && companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
      } else if (req.user.role !== 'root') {
        query += ' AND company_id IS NULL';
      }
      
      // Filter by project
      if (projectId) {
        query += ' AND project_id = ?';
        params.push(projectId);
      }
      
      // Filter by user (assigned tasks)
      if (userId) {
        query += ' AND assignee_id = ?';
        params.push(userId);
      }
      
      query += ' ORDER BY created_at DESC';
      
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
        subtasks: [],
        attachments: row.attachments ? JSON.parse(row.attachments) : [],
        comments: row.comments ? JSON.parse(row.comments) : [],
        timeEntries: row.time_entries ? JSON.parse(row.time_entries) : [],
        teamId: row.team_id
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
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { error, value } = taskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const userId = req.user.uid;
    const userName = req.user.name;
    const companyId = req.user.companyId;
    const now = new Date();
    
    // Get default statuses and priorities
    const defaultStatuses = [
      { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
      { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
      { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
      { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
    ];
    
    const defaultPriorities = [
      { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
      { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
      { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
      { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
    ];
    
    // Find the actual status and priority objects based on the IDs provided
    const status = defaultStatuses.find(s => s.id === value.status) || defaultStatuses[0];
    const priority = defaultPriorities.find(p => p.id === value.priority) || defaultPriorities[0];
    
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO tasks (
          id, title, description, notes, project_id, project_name, status_id, status_name,
          status_color, status_order, status_is_completed, priority_id, priority_name,
          priority_color, priority_level, assignee_id, assignee_name, assignee_email,
          due_date, estimated_hours, actual_hours, is_completed, completed_at, created_by,
          created_by_name, created_at, updated_at, parent_task_id, team_id, company_id,
          tags, attachments, comments, time_entries
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // Generate a unique ID for the task
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await connection.execute(query, [
        taskId,
        value.title,
        value.description || null,
        null, // notes
        value.projectId,
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
        value.assigneeId || null,
        null, // assignee_name
        null, // assignee_email
        value.dueDate ? new Date(value.dueDate).toISOString().split('T')[0] : null,
        value.estimatedHours || null,
        null, // actual_hours
        0, // is_completed
        null, // completed_at
        userId,
        userName,
        now,
        now,
        value.parentTaskId || null,
        value.teamId || null,
        companyId || null,
        JSON.stringify(value.tags || []), // tags
        JSON.stringify([]), // attachments
        JSON.stringify([]), // comments
        JSON.stringify([]) // time_entries
      ]);
      
      // Get the created task
      const [rows] = await connection.execute(
        'SELECT * FROM tasks WHERE id = ?', 
        [taskId]
      );
      
      const task = {
        id: rows[0].id,
        title: rows[0].title,
        description: rows[0].description,
        notes: rows[0].notes,
        projectId: rows[0].project_id,
        projectName: rows[0].project_name,
        status: {
          id: rows[0].status_id,
          name: rows[0].status_name,
          color: rows[0].status_color,
          order: rows[0].status_order,
          isCompleted: rows[0].status_is_completed === 1
        },
        priority: {
          id: rows[0].priority_id,
          name: rows[0].priority_name,
          color: rows[0].priority_color,
          level: rows[0].priority_level
        },
        assigneeId: rows[0].assignee_id,
        assigneeName: rows[0].assignee_name,
        assigneeEmail: rows[0].assignee_email,
        dueDate: rows[0].due_date ? new Date(rows[0].due_date) : undefined,
        estimatedHours: rows[0].estimated_hours,
        actualHours: rows[0].actual_hours,
        tags: rows[0].tags ? JSON.parse(rows[0].tags) : [],
        isCompleted: rows[0].is_completed === 1,
        completedAt: rows[0].completed_at ? new Date(rows[0].completed_at) : undefined,
        createdBy: rows[0].created_by,
        createdByName: rows[0].created_by_name,
        createdAt: new Date(rows[0].created_at),
        updatedAt: new Date(rows[0].updated_at),
        parentTaskId: rows[0].parent_task_id,
        subtasks: [],
        attachments: rows[0].attachments ? JSON.parse(rows[0].attachments) : [],
        comments: rows[0].comments ? JSON.parse(rows[0].comments) : [],
        timeEntries: rows[0].time_entries ? JSON.parse(rows[0].time_entries) : [],
        teamId: rows[0].team_id
      };
      
      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = taskUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const companyId = req.user.companyId;
    
    // Check if task exists and user has access
    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute(
        'SELECT * FROM tasks WHERE id = ?', 
        [id]
      );
      
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const existingTask = existingRows[0];
      
      // For non-root users, verify they belong to the same company
      if (req.user.role !== 'root' && existingTask.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get default statuses and priorities
      const defaultStatuses = [
        { id: 'status_0', name: 'To Do', color: '#6B7280', order: 0, isCompleted: false },
        { id: 'status_1', name: 'In Progress', color: '#3B82F6', order: 1, isCompleted: false },
        { id: 'status_2', name: 'Review', color: '#F59E0B', order: 2, isCompleted: false },
        { id: 'status_3', name: 'Done', color: '#10B981', order: 3, isCompleted: true }
      ];
      
      const defaultPriorities = [
        { id: 'priority_0', name: 'Low', color: '#6B7280', level: 1 },
        { id: 'priority_1', name: 'Medium', color: '#F59E0B', level: 2 },
        { id: 'priority_2', name: 'High', color: '#EF4444', level: 3 },
        { id: 'priority_3', name: 'Urgent', color: '#DC2626', level: 4 }
      ];
      
      // Update task
      const fields = [];
      const values = [];
      
      if (value.title !== undefined) {
        fields.push('title = ?');
        values.push(value.title);
      }
      if (value.description !== undefined) {
        fields.push('description = ?');
        values.push(value.description);
      }
      if (value.status !== undefined) {
        const status = defaultStatuses.find(s => s.id === value.status) || defaultStatuses[0];
        fields.push('status_id = ?', 'status_name = ?', 'status_color = ?', 'status_order = ?', 'status_is_completed = ?');
        values.push(status.id, status.name, status.color, status.order, status.isCompleted ? 1 : 0);
      }
      if (value.priority !== undefined) {
        const priority = defaultPriorities.find(p => p.id === value.priority) || defaultPriorities[0];
        fields.push('priority_id = ?', 'priority_name = ?', 'priority_color = ?', 'priority_level = ?');
        values.push(priority.id, priority.name, priority.color, priority.level);
      }
      if (value.assigneeId !== undefined) {
        fields.push('assignee_id = ?');
        values.push(value.assigneeId || null);
      }
      if (value.dueDate !== undefined) {
        fields.push('due_date = ?');
        values.push(value.dueDate ? new Date(value.dueDate).toISOString().split('T')[0] : null);
      }
      if (value.estimatedHours !== undefined) {
        fields.push('estimated_hours = ?');
        values.push(value.estimatedHours || null);
      }
      if (value.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(value.tags));
      }
      if (value.parentTaskId !== undefined) {
        fields.push('parent_task_id = ?');
        values.push(value.parentTaskId || null);
      }
      if (value.teamId !== undefined) {
        fields.push('team_id = ?');
        values.push(value.teamId || null);
      }
      
      // Always update the timestamp
      fields.push('updated_at = ?');
      values.push(new Date());
      
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      values.push(id); // For the WHERE clause
      
      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
      
      res.json({
        success: true,
        message: 'Task updated successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const companyId = req.user.companyId;
    
    // Check if task exists and user has access
    const connection = await pool.getConnection();
    try {
      const [existingRows] = await connection.execute(
        'SELECT * FROM tasks WHERE id = ?', 
        [id]
      );
      
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const existingTask = existingRows[0];
      
      // For non-root users, verify they belong to the same company
      if (req.user.role !== 'root' && existingTask.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Check if user is authorized to delete (creator, admin, or super_admin)
      if (req.user.role !== 'root' && req.user.role !== 'admin' && req.user.role !== 'super_admin' && existingTask.created_by !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await connection.execute('DELETE FROM tasks WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ============================================
// BILLING API - Paymongo Integration
// ============================================

// Create checkout session for plan upgrade via external PayMongo backend
app.post('/api/billing/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.uid;
    
    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    if (!plan || !['office', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be office or enterprise' });
    }
    
    // Default included seats per plan
    const defaultSeats = plan === 'office' ? 10 : 100;
    const count = defaultSeats;
    
    // Get user details for customer info
    const connection = await pool.getConnection();
    let customerEmail = '';
    let customerName = '';
    try {
      const [userRows] = await connection.execute(
        'SELECT email, name FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0) {
        customerEmail = userRows[0].email;
        customerName = userRows[0].name || '';
      }
    } finally {
      connection.release();
    }
    
    // Call external PayMongo backend
    const externalApiUrl = process.env.EXTERNAL_PAYMONGO_API_URL || 'https://api.nexistrydigitalsolutions.com';
    
    console.log('Calling external PayMongo API:', `${externalApiUrl}/api/clockistry/create-payment-intent`);
    console.log('Request data:', { companyId, userId, plan, userCount: count });
    
    const response = await axios.post(
      `${externalApiUrl}/api/clockistry/create-payment-intent`,
      {
        companyId: companyId,
        userId: userId,
        plan: plan,
        userCount: count,
        successUrl: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success`,
        cancelUrl: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel`,
        customerEmail: customerEmail,
        customerName: customerName
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const data = response.data;
    
    if (!data.success) {
      throw new Error(data.error || 'External API returned unsuccessful response');
    }
    
    // Store transaction in local database
    const conn = await pool.getConnection();
    try {
      // Calculate price for local record (same formula as external backend)
      const pricePerUserUSD = plan === 'office' ? 9 : 12;
      const pricePerUserCents = pricePerUserUSD * 100;
      
      await conn.execute(
        `INSERT INTO payment_transactions 
         (id, company_id, checkout_session_id, amount, currency, status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          data.transactionId,
          companyId,
          data.checkoutSessionId,
          data.amount,
          'USD',
          'pending',
          JSON.stringify({
            pricing_level: plan,
            user_count: count,
            price_per_user: pricePerUserCents,
            source: 'external_api'
          })
        ]
      );
    } finally {
      conn.release();
    }
    
    res.json({
      success: true,
      checkoutUrl: data.checkoutUrl,
      checkoutSessionId: data.checkoutSessionId,
      transactionId: data.transactionId
    });
    
  } catch (error) {
    console.error('External PayMongo API error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received from external API');
    } else {
      console.error('Error message:', error.message);
    }
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to create checkout session: ' + (error.message || 'Unknown error') });
  }
});

// Create checkout session for purchasing additional seats
app.post('/api/billing/purchase-seats', authenticateToken, async (req, res) => {
  try {
    const { additionalSeats } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.uid;
    
    // Only super_admin can purchase seats
    if (req.user.role !== 'super_admin' && req.user.role !== 'root') {
      return res.status(403).json({ error: 'Only super admins can purchase additional seats' });
    }
    
    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    const seats = parseInt(additionalSeats);
    if (!seats || seats < 1) {
      return res.status(400).json({ error: 'Invalid seat count. Must be at least 1' });
    }
    
    // Get company info to determine pricing
    const connection = await pool.getConnection();
    let company, customerEmail = '', customerName = '';
    
    try {
      const [companyRows] = await connection.execute(
        'SELECT * FROM companies WHERE id = ?',
        [companyId]
      );
      
      if (companyRows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      company = companyRows[0];
      
      // Get user details for customer info
      const [userRows] = await connection.execute(
        'SELECT email, name FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0) {
        customerEmail = userRows[0].email;
        customerName = userRows[0].name || '';
      }
    } finally {
      connection.release();
    }
    
    // Determine price per seat based on current plan
    const pricePerUserUSD = company.pricing_level === 'enterprise' ? 12 : 9;
    const totalAmount = pricePerUserUSD * seats;
    
    // Call external PayMongo backend for seat add-on
    const externalApiUrl = process.env.EXTERNAL_PAYMONGO_API_URL || 'https://api.nexistrydigitalsolutions.com';
    
    console.log('Creating seat add-on checkout:', { companyId, userId, additionalSeats: seats, totalAmount });
    
    const response = await axios.post(
      `${externalApiUrl}/api/clockistry/create-payment-intent`,
      {
        companyId: companyId,
        userId: userId,
        type: 'seat_addon',
        additionalSeats: seats,
        plan: company.pricing_level,
        successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/seats-success`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/seats-cancel`,
        customerEmail: customerEmail,
        customerName: customerName
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const data = response.data;
    
    if (!data.success) {
      throw new Error(data.error || 'External API returned unsuccessful response');
    }
    
    // Store transaction in local database
    const conn = await pool.getConnection();
    try {
      const pricePerUserCents = pricePerUserUSD * 100;
      
      await conn.execute(
        `INSERT INTO payment_transactions 
         (id, company_id, checkout_session_id, amount, currency, status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          data.transactionId,
          companyId,
          data.checkoutSessionId,
          data.amount,
          'USD',
          'pending',
          JSON.stringify({
            type: 'seat_addon',
            pricing_level: company.pricing_level,
            additional_seats: seats,
            price_per_user: pricePerUserCents,
            source: 'external_api'
          })
        ]
      );
    } finally {
      conn.release();
    }
    
    res.json({
      success: true,
      checkoutUrl: data.checkoutUrl,
      checkoutSessionId: data.checkoutSessionId,
      transactionId: data.transactionId,
      additionalSeats: seats,
      totalAmount: totalAmount
    });
    
  } catch (error) {
    console.error('Seat purchase error:', error);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json({ error: 'Failed to create seat purchase: ' + (error.message || 'Unknown error') });
  }
});

// Check seat limit for a company
app.get('/api/billing/seat-limit', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Get company max_members
      const [companyRows] = await connection.execute(
        'SELECT max_members, pricing_level FROM companies WHERE id = ?',
        [companyId]
      );
      
      if (companyRows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      const company = companyRows[0];
      
      // Count active users in the company
      const [userCountRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND is_active = 1',
        [companyId]
      );
      
      const currentUsers = userCountRows[0].count;
      const maxMembers = company.max_members;
      const availableSeats = Math.max(0, maxMembers - currentUsers);
      const atLimit = currentUsers >= maxMembers;
      
      res.json({
        success: true,
        data: {
          currentUsers,
          maxMembers,
          availableSeats,
          atLimit,
          pricingLevel: company.pricing_level
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error checking seat limit:', error);
    res.status(500).json({ error: 'Failed to check seat limit' });
  }
});

// Webhook handler for Paymongo events (from external backend or direct)
const handlePaymongoWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    // Parse the body - handle both rawBody and regular body
    const rawBodyBuffer = req.rawBody
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    const rawBodyString = rawBodyBuffer.toString('utf8');
    
    console.log('Raw body preview:', rawBodyString.substring(0, 500));
    
    let payload;
    try {
      payload = JSON.parse(rawBodyString);
      console.log('Payload parsed successfully');
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(200).json({ received: true, error: 'Invalid JSON' });
    }

    // Check if this is from external backend (forwarded format) or direct PayMongo
    // External backend format has: { eventType, checkoutSessionId, metadata, status }
    // PayMongo format has: { data: { attributes: { type, data: { id, attributes: { metadata } } } } }
    const isExternalBackendFormat = payload.eventType !== undefined && payload.metadata !== undefined;
    const isPaymongoFormat = payload.data?.attributes?.type !== undefined;
    
    console.log('Webhook format detected:', { isExternalBackendFormat, isPaymongoFormat });
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    let eventType, checkoutSessionId, metadata, status;

    if (isExternalBackendFormat) {
      // External backend forwarded format
      console.log('Processing external backend webhook format');
      eventType = payload.eventType;
      checkoutSessionId = payload.checkoutSessionId;
      metadata = payload.metadata;
      status = payload.status;
    } else if (isPaymongoFormat) {
      // Direct PayMongo format
      console.log('Processing direct PayMongo webhook format');
      eventType = payload.data?.attributes?.type;
      const checkoutSession = payload.data?.attributes?.data;
      checkoutSessionId = checkoutSession?.id;
      metadata = checkoutSession?.attributes?.metadata;
    } else {
      console.error('Unknown webhook format - cannot process');
      return res.status(200).json({ received: true, warning: 'Unknown format' });
    }

    console.log('Extracted values:', { eventType, checkoutSessionId, metadata, status });

    // Handle payment success
    if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
      if (!metadata) {
        console.error('No metadata in webhook payload - cannot process upgrade');
        return res.status(200).json({ received: true, warning: 'No metadata' });
      }

      const companyId = metadata.company_id;
      const pricingLevel = metadata.pricing_level;
      const userCount = metadata.user_count;
      const type = metadata.type;
      const additionalSeats = metadata.additional_seats;

      console.log('Processing payment success:', { companyId, pricingLevel, userCount, type, additionalSeats, checkoutSessionId });

      if (!companyId || !checkoutSessionId) {
        console.error('Missing required fields:', { companyId, checkoutSessionId });
        return res.status(200).json({ received: true, warning: 'Missing fields' });
      }

      const connection = await pool.getConnection();
      try {
        console.log('Updating transaction status for checkout_session_id:', checkoutSessionId);
        
        // Calculate billing period (30 days from now)
        const now = new Date();
        const nextBillingDate = new Date(now);
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
        
        const [txResult] = await connection.execute(
          `UPDATE payment_transactions 
           SET status = 'paid', 
               paid_at = NOW(),
               billing_period_start = CURDATE(),
               billing_period_end = ?,
               is_renewal = 1
           WHERE checkout_session_id = ?`,
          [nextBillingDate, checkoutSessionId]
        );

        console.log('Transaction update result:', { affectedRows: txResult?.affectedRows });

        // Check if this is a seat_addon or plan_upgrade
        if (type === 'seat_addon' && additionalSeats) {
          // Handle seat add-on: increase max_members
          console.log('Processing seat add-on:', { companyId, additionalSeats });
          
          const [companyResult] = await connection.execute(
            `UPDATE companies 
             SET max_members = max_members + ?,
                 last_payment_date = CURDATE(),
                 next_billing_date = ?,
                 billing_status = 'active',
                 updated_at = NOW()
             WHERE id = ?`,
            [parseInt(additionalSeats), nextBillingDate, companyId]
          );
          
          console.log('Seat add-on processed:', { companyId, additionalSeats, affectedRows: companyResult?.affectedRows });
        } else {
          // Handle plan upgrade: set pricing_level and max_members
          console.log('Updating company plan and billing dates:', { companyId, pricingLevel, userCount, nextBillingDate });
          
          const [companyResult] = await connection.execute(
            `UPDATE companies 
             SET pricing_level = ?, 
                 max_members = ?, 
                 last_payment_date = CURDATE(),
                 next_billing_date = ?,
                 billing_status = 'active',
                 is_in_grace_period = 0,
                 grace_period_end_date = NULL,
                 updated_at = NOW()
             WHERE id = ?`,
            [pricingLevel, parseInt(userCount) || 1, nextBillingDate, companyId]
          );

          console.log('Company update result:', { affectedRows: companyResult?.affectedRows });
        }

        console.log('=== PAYMENT SUCCESS PROCESSED ===', {
          companyId,
          type,
          pricingLevel,
          userCount: parseInt(userCount) || 1,
          additionalSeats,
          checkoutSessionId,
          transactionsUpdated: txResult?.affectedRows
        });
      } finally {
        connection.release();
      }
    } 
    // Handle payment failure
    else if (eventType === 'payment.failed' || status === 'failed') {
      console.log('Processing payment failure for:', checkoutSessionId);
      
      if (checkoutSessionId) {
        const connection = await pool.getConnection();
        try {
          const [result] = await connection.execute(
            `UPDATE payment_transactions 
             SET status = 'failed', failed_at = NOW()
             WHERE checkout_session_id = ?`,
            [checkoutSessionId]
          );
          console.log('Failed status update result:', { affectedRows: result?.affectedRows });
        } finally {
          connection.release();
        }
      }
    } 
    else {
      console.log('Event type not handled:', eventType);
    }

    console.log('=== WEBHOOK PROCESSING COMPLETE ===');
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('=== WEBHOOK ERROR ===', error);
    console.error('Error stack:', error.stack);
    // Always return 200 to prevent retries
    return res.status(200).json({ received: true, error: error.message });
  }
};

// Accept both paths (PayMongo config currently points to /webhook)
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handlePaymongoWebhook);
app.post('/webhook', express.raw({ type: 'application/json' }), handlePaymongoWebhook);

// Get billing history for company
app.get('/api/billing/history', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, checkout_session_id, amount, currency, status, 
                metadata, paid_at, failed_at, created_at
         FROM payment_transactions 
         WHERE company_id = ? 
         ORDER BY created_at DESC`,
        [companyId]
      );
      
      const transactions = rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));
      
      res.json({
        success: true,
        data: transactions,
        count: transactions.length
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// Get current billing status for company
app.get('/api/billing/status', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, name, pricing_level, max_members, 
                next_billing_date, last_payment_date, 
                grace_period_end_date, is_in_grace_period, 
                billing_status, payment_reminder_sent_at
         FROM companies 
         WHERE id = ? 
         LIMIT 1`,
        [companyId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      const company = rows[0];
      const now = new Date();
      const nextBilling = company.next_billing_date ? new Date(company.next_billing_date) : null;
      const graceEnd = company.grace_period_end_date ? new Date(company.grace_period_end_date) : null;
      
      // Calculate days until due
      let daysUntilDue = null;
      let isOverdue = false;
      let isInGracePeriod = company.is_in_grace_period === 1;
      
      if (nextBilling) {
        const diffTime = nextBilling - now;
        daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysUntilDue < 0;
      }
      
      // Determine status message
      let statusMessage = '';
      let statusType = 'info'; // info, warning, danger
      
      if (company.pricing_level === 'solo') {
        statusMessage = 'Free plan - no billing required';
        statusType = 'info';
      } else if (isInGracePeriod) {
        const graceDaysLeft = graceEnd ? Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24)) : 0;
        statusMessage = `Payment overdue. Grace period expires in ${graceDaysLeft} days. Downgrade to Solo will occur after grace period.`;
        statusType = 'danger';
      } else if (isOverdue) {
        statusMessage = 'Payment is overdue. Please pay now to avoid service interruption.';
        statusType = 'warning';
      } else if (daysUntilDue <= 3) {
        statusMessage = `Payment due in ${daysUntilDue} days`;
        statusType = 'warning';
      } else if (daysUntilDue <= 7) {
        statusMessage = `Payment due in ${daysUntilDue} days`;
        statusType = 'info';
      } else {
        statusMessage = `Next payment due in ${daysUntilDue} days`;
        statusType = 'info';
      }
      
      res.json({
        success: true,
        data: {
          companyId: company.id,
          companyName: company.name,
          pricingLevel: company.pricing_level,
          maxMembers: company.max_members,
          nextBillingDate: company.next_billing_date,
          lastPaymentDate: company.last_payment_date,
          gracePeriodEndDate: company.grace_period_end_date,
          isInGracePeriod: isInGracePeriod,
          billingStatus: company.billing_status,
          daysUntilDue: daysUntilDue,
          isOverdue: isOverdue,
          statusMessage: statusMessage,
          statusType: statusType,
          canUpgrade: company.pricing_level !== 'enterprise',
          needsPayment: company.pricing_level !== 'solo' && (isOverdue || isInGracePeriod || daysUntilDue <= 7)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching billing status:', error);
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// Trigger payment reminder (for testing or manual trigger)
app.post('/api/billing/remind', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.uid;
    
    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    // Only super_admin can trigger reminders
    if (req.user.role !== 'super_admin' && req.user.role !== 'root') {
      return res.status(403).json({ error: 'Only super admins can trigger payment reminders' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Get company and ALL super admin details
      const [adminRows] = await connection.execute(
        `SELECT u.email, u.name
         FROM users u
         WHERE u.company_id = ? AND u.role = 'super_admin'`,
        [companyId]
      );
      
      if (adminRows.length === 0) {
        return res.status(404).json({ error: 'No super admin found for this company' });
      }
      
      const [companyData] = await connection.execute(
        `SELECT * FROM companies WHERE id = ? LIMIT 1`,
        [companyId]
      );
      
      if (companyData.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      const company = companyData[0];
      
      // Calculate days until due
      const now = new Date();
      const nextBilling = company.next_billing_date ? new Date(company.next_billing_date) : null;
      let daysUntilDue = null;
      if (nextBilling) {
        const diffTime = nextBilling - now;
        daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      // Send email to ALL super admins
      const sentTo = [];
      for (const admin of adminRows) {
        await billingEmailService.sendPaymentReminder(
          company,
          admin,
          daysUntilDue || 0
        );
        sentTo.push(admin.email);
      }
      
      console.log(`Payment reminder for ${company.name} (${company.pricing_level} plan)`);
      console.log(`Next billing date: ${company.next_billing_date}`);
      console.log(`Super admins: ${sentTo.join(', ')}`);
      
      // Update reminder sent timestamp
      await connection.execute(
        `UPDATE companies SET payment_reminder_sent_at = NOW() WHERE id = ?`,
        [companyId]
      );
      
      res.json({
        success: true,
        message: 'Payment reminder sent to all super admins',
        data: {
          companyName: company.name,
          nextBillingDate: company.next_billing_date,
          pricingLevel: company.pricing_level,
          sentTo: sentTo,
          superAdminCount: sentTo.length
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error triggering payment reminder:', error);
    res.status(500).json({ error: 'Failed to trigger payment reminder' });
  }
});

// ============================================
// BILLING SCHEDULER - Background tasks
// ============================================

// Check for companies that need to enter grace period
// This should be called by a cron job daily
app.post('/api/billing/check-overdue', async (req, res) => {
  try {
    // Authenticate via ROOT_API_KEY header (for cron jobs) or JWT token (for root users)
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    const rootApiKey = process.env.ROOT_API_KEY;
    
    if (apiKey !== rootApiKey) {
      // Fallback to JWT authentication - check if root user
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'root') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const connection = await pool.getConnection();
    try {
      // Find companies that are overdue (past next_billing_date) and not in grace period
      const [overdueRows] = await connection.execute(
        `SELECT id, name, pricing_level, next_billing_date, grace_period_end_date
         FROM companies 
         WHERE pricing_level IN ('office', 'enterprise')
         AND next_billing_date < CURDATE()
         AND is_in_grace_period = 0
         AND billing_status = 'active'`
      );
      
      const companiesEnteredGracePeriod = [];
      
      for (const company of overdueRows) {
        // Set grace period (7 days from now)
        const graceEndDate = new Date();
        graceEndDate.setDate(graceEndDate.getDate() + 7);
        
        await connection.execute(
          `UPDATE companies 
           SET is_in_grace_period = 1,
               grace_period_end_date = ?,
               billing_status = 'overdue',
               updated_at = NOW()
           WHERE id = ?`,
          [graceEndDate, company.id]
        );
        
        companiesEnteredGracePeriod.push({
          id: company.id,
          name: company.name,
          pricingLevel: company.pricing_level,
          gracePeriodEndDate: graceEndDate
        });
        
        // Get ALL super admin details for email notification
        const [adminRows] = await connection.execute(
          `SELECT email, name FROM users WHERE company_id = ? AND role = 'super_admin'`,
          [company.id]
        );
        
        for (const admin of adminRows) {
          await billingEmailService.sendGracePeriodNotification(
            { ...company, max_members: company.pricing_level === 'office' ? 10 : 100 },
            admin,
            graceEndDate
          );
        }
        
        console.log(`Company ${company.name} entered grace period. Downgrade on ${graceEndDate}`);
      }
      
      // Find companies whose grace period has ended - downgrade them
      const [graceExpiredRows] = await connection.execute(
        `SELECT id, name, pricing_level
         FROM companies 
         WHERE is_in_grace_period = 1
         AND grace_period_end_date < CURDATE()`
      );
      
      const companiesDowngraded = [];
      
      for (const company of graceExpiredRows) {
        // Downgrade to solo
        await connection.execute(
          `UPDATE companies 
           SET pricing_level = 'solo',
               max_members = 1,
               billing_status = 'suspended',
               is_in_grace_period = 0,
               grace_period_end_date = NULL,
               next_billing_date = NULL,
               updated_at = NOW()
           WHERE id = ?`,
          [company.id]
        );
        
        companiesDowngraded.push({
          id: company.id,
          name: company.name,
          previousPricingLevel: company.pricing_level,
          newPricingLevel: 'solo'
        });
        
        // Get ALL super admin details for email notification
        const [adminRows] = await connection.execute(
          `SELECT email, name FROM users WHERE company_id = ? AND role = 'super_admin'`,
          [company.id]
        );
        
        for (const admin of adminRows) {
          await billingEmailService.sendDowngradeNotification(
            { ...company, max_members: 1 },
            admin
          );
        }
        
        console.log(`Company ${company.name} downgraded to solo due to non-payment`);
      }
      
      res.json({
        success: true,
        data: {
          companiesEnteredGracePeriod,
          companiesDowngraded,
          totalProcessed: overdueRows.length + graceExpiredRows.length
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error checking overdue companies:', error);
    res.status(500).json({ error: 'Failed to check overdue companies' });
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
