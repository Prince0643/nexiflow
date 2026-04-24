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
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const billingEmailService = require('./services/billingEmailService');
const { isStartTimerIntent, isStopTimerIntent } = require('./aiTimerIntent.cjs');
const { sanitizeAIReply } = require('./aiReplyFormatting.cjs');
const paypal = require('@paypal/checkout-server-sdk');

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

const ensureEmailVerificationTables = async () => {
  const connection = await pool.getConnection();
  try {
    // Ensure `users.email_verified` exists (some environments may not have run migrations yet)
    const [columnRows] = await connection.execute(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'email_verified'
        LIMIT 1
      `
    );
    if (!columnRows.length) {
      await connection.execute(`ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0 AFTER is_active`);
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_verification_user_id (user_id),
        INDEX idx_email_verification_token_hash (token_hash)
      )
    `);
  } finally {
    connection.release();
  }
}

ensureEmailVerificationTables().catch((error) => {
  console.error('Error ensuring email verification tables exist:', error);
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

const ensureCollaborationTables = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author_id VARCHAR(255) NOT NULL,
        author_name VARCHAR(255),
        author_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        parent_comment_id VARCHAR(255) NULL
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS comment_mentions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comment_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_comment_mention (comment_id, user_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS mention_notifications (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        mentioned_by VARCHAR(255) NULL,
        mentioned_by_name VARCHAR(255) NULL,
        mentioned_user_id VARCHAR(255) NOT NULL,
        context_type VARCHAR(50) NOT NULL,
        context_id VARCHAR(255) NOT NULL,
        context_title VARCHAR(255) NOT NULL,
        task_id VARCHAR(255) NULL,
        project_id VARCHAR(255) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        action_url VARCHAR(512) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connection.release();
  }
}

ensureCollaborationTables().catch((error) => {
  console.error('Error ensuring collaboration tables exist:', error);
});

console.log('MySQL config:', {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
  user: process.env.MYSQL_USER || 'root',
  database: process.env.MYSQL_DATABASE || 'clockistry'
});

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || '').replace(/\/$/, '') || 'http://localhost:3000';
}

async function createEmailVerificationToken(connection, userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const tokenId = uuidv4();
  const expiresAt = moment().add(24, 'hours').toDate();

  await connection.execute(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)`,
    [tokenId, userId, tokenHash, expiresAt]
  );

  return { rawToken, expiresAt };
}

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

// Rate limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// Rate limiting - General API
const isDev = process.env.NODE_ENV !== 'production'
const createApiLimiter = (max, skip) => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 2000 : max,
  skip,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});
const mentionReadLimiter = createApiLimiter(600, (req) => req.method !== 'GET');
const taskLiveReadLimiter = createApiLimiter(900, (req) => req.method !== 'GET');
const limiter = createApiLimiter(300);
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 300 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { success: false, error: 'Too many AI requests. Please try again shortly.' }
});

app.use('/api/mention-notifications', mentionReadLimiter);
app.use('/api/tasks/:id', taskLiveReadLimiter);
app.use('/api/tasks/:id/', taskLiveReadLimiter);
app.use('/api/', limiter);

// ============================================
// PAYPAL CONFIGURATION
// ============================================
const paypalEnvironment = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

  if (!clientId || !clientSecret) {
    console.warn('PayPal credentials not configured. PayPal payments will be disabled.');
    return null;
  }

  if (environment === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
};

const getPayPalClient = () => {
  const environment = paypalEnvironment();
  if (!environment) return null;
  return new paypal.core.PayPalHttpClient(environment);
};

const mapTaskRow = (row) => ({
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
});

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

app.delete('/api/admin/companies/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'root') {
    return res.status(403).json({ success: false, error: 'Access denied. Root only.' });
  }

  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [companyRows] = await connection.execute(
      'SELECT id, name FROM companies WHERE id = ? LIMIT 1',
      [id]
    );

    if (companyRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const companyName = companyRows[0].name;
    const companyId = companyRows[0].id;

    const [teamRows] = await connection.execute(
      'SELECT id FROM teams WHERE company_id = ?',
      [companyId]
    );
    const teamIds = teamRows.length ? teamRows.map(row => row.id).filter(Boolean) : [];

    const [taskRows] = await connection.execute(
      'SELECT id FROM tasks WHERE company_id = ?',
      [companyId]
    );
    const taskIds = taskRows.length ? taskRows.map(row => row.id).filter(Boolean) : [];

    const [invoiceRows] = await connection.execute(
      'SELECT id FROM invoices WHERE company_id = ?',
      [companyId]
    );
    const invoiceIds = invoiceRows.length ? invoiceRows.map(row => row.id).filter(Boolean) : [];

    const [timeEntriesRows] = await connection.execute(
      'SELECT id FROM time_entries WHERE company_id = ?',
      [companyId]
    );
    const timeEntryIds = timeEntriesRows.length ? timeEntriesRows.map(row => row.id).filter(Boolean) : [];

    const deleteInClause = async (table, column, ids) => {
      if (!ids.length) return;
      await connection.execute(
        `DELETE FROM ${table} WHERE ${column} IN (?)`,
        [ids]
      );
    };

    await connection.execute('DELETE FROM billing_reminders WHERE company_id = ?', [companyId]);
    await connection.execute('DELETE FROM company_pdf_settings WHERE company_id = ?', [companyId]);
    await connection.execute('DELETE FROM payment_transactions WHERE company_id = ?', [companyId]);
    await connection.execute('DELETE FROM clients WHERE company_id = ?', [companyId]);

    await deleteInClause('invoice_items', 'invoice_id', invoiceIds);
    await connection.execute('DELETE FROM invoices WHERE company_id = ?', [companyId]);

    await deleteInClause('team_members', 'team_id', teamIds);
    await connection.execute('DELETE FROM teams WHERE company_id = ?', [companyId]);

    await deleteInClause('task_time_entries', 'task_id', taskIds);
    await deleteInClause('task_comments', 'task_id', taskIds);
    await deleteInClause('task_attachments', 'task_id', taskIds);
    await deleteInClause('task_tags', 'task_id', taskIds);
    await connection.execute('DELETE FROM tasks WHERE company_id = ?', [companyId]);

    await deleteInClause('time_entry_tags', 'time_entry_id', timeEntryIds);
    await connection.execute('DELETE FROM time_entries WHERE company_id = ?', [companyId]);

    await connection.execute('DELETE FROM users WHERE company_id = ?', [companyId]);
    await connection.execute('DELETE FROM companies WHERE id = ?', [companyId]);

    await connection.commit();

    console.log(`Root deleted company ${companyName} (${companyId}) and related data`);

    res.json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    res.status(500).json({ success: false, error: 'Failed to delete company' });
  } finally {
    connection.release();
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

// ============================================
// GOOGLE DRIVE (PER-COMPANY SUPER ADMIN)
// ============================================
const requireEnv = (key) => {
  const value = process.env[key];
  if (!value || !String(value).trim()) throw new Error(`Missing env var: ${key}`);
  return String(value).trim();
};

const getTokenEncKey = () => {
  const b64 = requireEnv('GOOGLE_DRIVE_TOKEN_ENC_KEY');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('GOOGLE_DRIVE_TOKEN_ENC_KEY must be 32 bytes (base64-encoded)');
  return key;
};

const encryptRefreshToken = (refreshToken) => {
  const key = getTokenEncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64')
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
};

const decryptRefreshToken = (encryptedPayload) => {
  const key = getTokenEncKey();
  const json = Buffer.from(encryptedPayload, 'base64').toString('utf8');
  const payload = JSON.parse(json);
  if (!payload?.iv || !payload?.tag || !payload?.ct) throw new Error('Invalid encrypted token payload');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ct, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

const base64UrlEncode = (bufOrStr) => {
  const buf = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(String(bufOrStr), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (str) => {
  const padded = String(str).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(str).length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
};

const signOAuthState = (payloadObj) => {
  const secret = requireEnv('GOOGLE_DRIVE_OAUTH_STATE_SECRET');
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = base64UrlEncode(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
};

const verifyOAuthState = (state) => {
  const secret = requireEnv('GOOGLE_DRIVE_OAUTH_STATE_SECRET');
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('Invalid state');
  const expected = base64UrlEncode(crypto.createHmac('sha256', secret).update(payload).digest());
  if (expected !== sig) throw new Error('Invalid state signature');
  return JSON.parse(base64UrlDecode(payload).toString('utf8'));
};

const getAccessTokenFromRefreshToken = async (refreshToken) => {
  const tokenRes = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: requireEnv('GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return tokenRes?.data?.access_token || null;
};

const getOrCreateDriveFolderId = async (accessToken, folderName) => {
  const q = `name='${String(folderName).replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const search = await axios.get('https://www.googleapis.com/drive/v3/files', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q, fields: 'files(id,name)' }
  });
  const existing = search?.data?.files?.[0];
  if (existing?.id) return existing.id;

  const create = await axios.post(
    'https://www.googleapis.com/drive/v3/files',
    { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  return create?.data?.id;
};

const uploadJpegToDrive = async (accessToken, { buffer, filename, folderId, description }) => {
  const fileMetadata = {
    name: filename,
    parents: folderId ? [folderId] : undefined,
    description: description || undefined
  };

  const boundary = '-------nexiflow-boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartHeader =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: image/jpeg\r\n\r\n';

  const body = Buffer.concat([
    Buffer.from(multipartHeader, 'utf8'),
    buffer,
    Buffer.from(closeDelim, 'utf8')
  ]);

  const res = await axios.post(
    'https://www.googleapis.com/upload/drive/v3/files',
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      params: { uploadType: 'multipart', fields: 'id,name,webViewLink' },
      maxBodyLength: Infinity
    }
  );

  return {
    fileId: res?.data?.id,
    filename: res?.data?.name,
    webViewLink: res?.data?.webViewLink
  };
};

const getTinyJpegBuffer = () => {
  // Minimal 1x1 JPEG image
  return Buffer.from(
    'ffd8ffe000104a46494600010101006000600000ffdb004300' +
      '080606070605080707070909080a0c140d0c0b0b0c1912130f' +
      '141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c3031' +
      '3434341f27393d38323c2e333432ffdb0043010909090c0b0c' +
      '180d0d1832211c213232323232323232323232323232323232' +
      '323232323232323232323232323232323232323232323232' +
      '323232323232323232ffc00011080001000103012200021101' +
      '031101ffc40014000100000000000000000000000000000000' +
      '00ffc4001410010000000000000000000000000000000000' +
      '00ffda000c03010002110311003f00d2cf20ffd9',
    'hex'
  );
};

// Start OAuth (company super admin)
app.get('/api/admin/google-drive/connect', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin', 'root'].includes(req.user?.role)) {
      return res.status(403).send('Forbidden');
    }
    const companyId = String(req.user?.companyId || '').trim();
    if (!companyId) return res.status(400).send('Missing companyId for user');

    const redirectUri = requireEnv('GOOGLE_DRIVE_REDIRECT_URI');
    const clientId = requireEnv('GOOGLE_DRIVE_CLIENT_ID');
    const scope = 'https://www.googleapis.com/auth/drive.file';

    const state = signOAuthState({
      companyId,
      userId: req.user.uid,
      nonce: crypto.randomBytes(12).toString('hex'),
      t: Date.now()
    });

    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(state)}`;

    res.redirect(authUrl);
  } catch (error) {
    console.error('Drive connect error:', error);
    res.status(500).send(error?.message || 'Failed to start Google Drive OAuth');
  }
});

// Return OAuth URL as JSON (so UI can navigate without losing auth header on initial request)
app.get('/api/admin/google-drive/connect-url', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin', 'root'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const companyId = String(req.user?.companyId || '').trim();
    if (!companyId) return res.status(400).json({ success: false, error: 'Missing companyId for user' });

    const redirectUri = requireEnv('GOOGLE_DRIVE_REDIRECT_URI');
    const clientId = requireEnv('GOOGLE_DRIVE_CLIENT_ID');
    const scope = 'https://www.googleapis.com/auth/drive.file';

    const state = signOAuthState({
      companyId,
      userId: req.user.uid,
      nonce: crypto.randomBytes(12).toString('hex'),
      t: Date.now()
    });

    const url =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(state)}`;

    res.json({ success: true, url });
  } catch (error) {
    console.error('Drive connect-url error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to build Google Drive OAuth URL' });
  }
});

// Check per-company connection status
app.get('/api/admin/google-drive/status', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin', 'root'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const companyId = String(req.user?.companyId || '').trim();
    if (!companyId) return res.status(400).json({ success: false, error: 'Missing companyId for user' });

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `
          SELECT connected_by_user_id, updated_at, folder_id, folder_name
          FROM company_google_drive_integrations
          WHERE company_id = ?
          LIMIT 1
        `,
        [companyId]
      );

      const row = rows?.[0];
      if (!row) {
        return res.json({ success: true, connected: false });
      }

      res.json({
        success: true,
        connected: true,
        connectedAt: row.updated_at,
        connectedByUserId: row.connected_by_user_id || null,
        folderId: row.folder_id || null,
        folderName: row.folder_name || null
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Drive status error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to get Google Drive status' });
  }
});

// Update per-company Google Drive folder name (override)
app.put('/api/admin/google-drive/folder-name', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'root'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const companyId = String(req.user?.companyId || '').trim();
    if (!companyId) return res.status(400).json({ success: false, error: 'Missing companyId for user' });

    const raw = typeof req.body?.folderName === 'string' ? req.body.folderName : '';
    const folderName = raw.trim();

    if (!folderName) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }
    if (folderName.length > 80) {
      return res.status(400).json({ success: false, error: 'Folder name must be 80 characters or fewer' });
    }
    if (/[\\/]/.test(folderName)) {
      return res.status(400).json({ success: false, error: 'Folder name cannot contain / or \\' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `
          UPDATE company_google_drive_integrations
          SET folder_name = ?, folder_id = NULL, updated_at = NOW()
          WHERE company_id = ?
        `,
        [folderName, companyId]
      );

      const [rows] = await connection.execute(
        `
          SELECT connected_by_user_id, updated_at, folder_id, folder_name
          FROM company_google_drive_integrations
          WHERE company_id = ?
          LIMIT 1
        `,
        [companyId]
      );
      const row = rows?.[0];

      res.json({
        success: true,
        connected: !!row,
        connectedAt: row?.updated_at || null,
        connectedByUserId: row?.connected_by_user_id || null,
        folderId: row?.folder_id || null,
        folderName: row?.folder_name || null
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Drive folder-name error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to update Google Drive folder name' });
  }
});

// Test upload to Drive (creates a tiny JPEG in the configured company folder)
app.post('/api/admin/google-drive/test-upload', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'root'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const companyId = String(req.user?.companyId || '').trim();
    if (!companyId) return res.status(400).json({ success: false, error: 'Missing companyId for user' });

    const connection = await pool.getConnection();
    let refreshTokenEnc = null;
    let cachedFolderId = null;
    let folderNameOverride = null;
    try {
      const [rows] = await connection.execute(
        'SELECT refresh_token_enc, folder_id, folder_name FROM company_google_drive_integrations WHERE company_id = ? LIMIT 1',
        [companyId]
      );
      const row = rows?.[0];
      refreshTokenEnc = row?.refresh_token_enc || null;
      cachedFolderId = row?.folder_id || null;
      folderNameOverride = row?.folder_name || null;
    } finally {
      connection.release();
    }

    if (!refreshTokenEnc) {
      return res.status(503).json({ success: false, error: 'Google Drive not connected for this company' });
    }

    const refreshToken = decryptRefreshToken(refreshTokenEnc);
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    if (!accessToken) return res.status(502).json({ success: false, error: 'Failed to obtain Google Drive access token' });

    const folderName = folderNameOverride || process.env.GOOGLE_DRIVE_FOLDER_NAME || 'NexiFlow Screenshots';
    const folderId = cachedFolderId || (await getOrCreateDriveFolderId(accessToken, folderName));
    if (!cachedFolderId && folderId) {
      const c2 = await pool.getConnection();
      try {
        await c2.execute(
          'UPDATE company_google_drive_integrations SET folder_id = ?, updated_at = NOW() WHERE company_id = ?',
          [folderId, companyId]
        );
      } finally {
        c2.release();
      }
    }

    const now = new Date();
    const safe = now.toISOString().replace(/[:.]/g, '-');
    const filename = `nexiflow_test_${safe}.jpg`;
    const description = `NexiFlow test upload • ${now.toISOString()}`;

    const buffer = getTinyJpegBuffer();
    const uploaded = await uploadJpegToDrive(accessToken, { buffer, filename, folderId, description });

    res.json({
      success: true,
      ...uploaded,
      folderId,
      folderName
    });
  } catch (error) {
    console.error('Drive test-upload error:', error?.response?.data || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to test upload to Google Drive' });
  }
});

// OAuth callback: exchange code -> refresh token -> store per-company
app.get('/api/admin/google-drive/callback', async (req, res) => {
  try {
    const frontendUrl = (process.env.FRONTEND_URL || 'https://nexi-flow.com').replace(/\/$/, '');
    const sendOAuthPage = ({ title, message, status = 'success' }) => {
      const isSuccess = status === 'success';
      const accent = isSuccess ? '#16a34a' : '#dc2626';
      const badgeBg = isSuccess ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)';
      const badgeText = isSuccess ? 'Connected' : 'Error';

      res
        .status(isSuccess ? 200 : 400)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        background: radial-gradient(1200px 600px at 20% 0%, rgba(59,130,246,.12), transparent 60%),
                    radial-gradient(900px 500px at 100% 0%, rgba(168,85,247,.10), transparent 55%),
                    #0b1220;
        color: #e5e7eb;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 680px;
        background: rgba(17, 24, 39, 0.86);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .logo {
        width: 34px; height: 34px;
        border-radius: 10px;
        background: linear-gradient(135deg, #3b82f6, #a855f7);
        box-shadow: 0 8px 20px rgba(59,130,246,.25);
      }
      .badge {
        font-size: 12px;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 999px;
        background: ${badgeBg};
        color: ${accent};
        border: 1px solid rgba(255,255,255,0.10);
      }
      h1 { font-size: 22px; margin: 0 0 8px; }
      p { margin: 0 0 16px; color: rgba(229,231,235,0.85); line-height: 1.55; }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 600;
        border: 1px solid rgba(255,255,255,0.14);
      }
      a.primary { background: ${accent}; color: white; border-color: rgba(0,0,0,0.12); }
      a.secondary { background: rgba(255,255,255,0.06); color: #e5e7eb; }
      .hint { margin-top: 14px; font-size: 12px; color: rgba(229,231,235,0.65); }
      @media (prefers-color-scheme: light) {
        body { background: #f8fafc; color: #0f172a; }
        .card { background: white; border-color: rgba(2,6,23,0.10); }
        p, .hint { color: rgba(15,23,42,0.75); }
        a.secondary { color: #0f172a; background: rgba(2,6,23,0.04); border-color: rgba(2,6,23,0.10); }
      }
    </style>
  </head>
  <body>
    <main class="card" role="main" aria-label="Google Drive connection status">
      <div class="top">
        <div class="brand">
          <div class="logo" aria-hidden="true"></div>
          <div>NexiFlow</div>
        </div>
        <div class="badge">${badgeText}</div>
      </div>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="actions">
        <a class="button primary" href="${frontendUrl}/settings">Back to Settings</a>
        <a class="button secondary" href="${frontendUrl}">Open NexiFlow</a>
      </div>
      <div class="hint">You can close this tab after returning to NexiFlow.</div>
    </main>
  </body>
</html>`);
    };

    const code = String(req.query.code || '').trim();
    const stateRaw = String(req.query.state || '').trim();
    if (!code) return sendOAuthPage({ title: 'Google Drive connection failed', message: 'Missing OAuth code. Please try connecting again.', status: 'error' });
    if (!stateRaw) return sendOAuthPage({ title: 'Google Drive connection failed', message: 'Missing OAuth state. Please try connecting again.', status: 'error' });

    const state = verifyOAuthState(stateRaw);
    const companyId = String(state.companyId || '').trim();
    const connectedByUserId = String(state.userId || '').trim() || null;
    if (!companyId) return res.status(400).send('Invalid state: missing companyId');

    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: requireEnv('GOOGLE_DRIVE_CLIENT_ID'),
        client_secret: requireEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: requireEnv('GOOGLE_DRIVE_REDIRECT_URI')
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const refreshToken = tokenRes?.data?.refresh_token;
    if (!refreshToken) {
      return sendOAuthPage({
        title: 'Google Drive needs re-consent',
        message: 'No refresh token was returned. Revoke NexiFlow access in your Google Account, then connect again.',
        status: 'error'
      });
    }

    const refreshTokenEnc = encryptRefreshToken(refreshToken);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `
        INSERT INTO company_google_drive_integrations
          (company_id, refresh_token_enc, folder_id, connected_by_user_id, created_at, updated_at)
        VALUES (?, ?, NULL, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          refresh_token_enc = VALUES(refresh_token_enc),
          folder_id = NULL,
          connected_by_user_id = VALUES(connected_by_user_id),
          updated_at = NOW()
        `,
        [companyId, refreshTokenEnc, connectedByUserId]
      );
    } finally {
      connection.release();
    }

    return sendOAuthPage({
      title: 'Google Drive connected',
      message: 'Your company Google Drive is now connected. Screenshots can be uploaded to Drive.',
      status: 'success'
    });
  } catch (error) {
    console.error('Drive callback error:', error?.response?.data || error);
    res
      .status(500)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .send(error?.message || 'Failed to complete Google Drive OAuth');
  }
});

// Upload screenshot (extension -> backend -> company Drive)
app.post('/api/screenshots', authenticateToken, async (req, res) => {
  try {
    const { imageBase64, companyId, projectName, duration, timestamp } = req.body || {};
    const userId = req.user?.uid;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    const effectiveCompanyId = String(companyId || req.user?.companyId || '').trim();
    if (!effectiveCompanyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }
    if (req.user?.companyId && effectiveCompanyId !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: company mismatch' });
    }

    const connection = await pool.getConnection();
    let refreshTokenEnc = null;
    let cachedFolderId = null;
    let folderNameOverride = null;
    try {
      const [rows] = await connection.execute(
        'SELECT refresh_token_enc, folder_id, folder_name FROM company_google_drive_integrations WHERE company_id = ? LIMIT 1',
        [effectiveCompanyId]
      );
      const row = rows?.[0];
      refreshTokenEnc = row?.refresh_token_enc || null;
      cachedFolderId = row?.folder_id || null;
      folderNameOverride = row?.folder_name || null;
    } finally {
      connection.release();
    }

    if (!refreshTokenEnc) {
      return res.status(503).json({ success: false, error: 'Google Drive not connected for this company' });
    }

    const refreshToken = decryptRefreshToken(refreshTokenEnc);
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    if (!accessToken) return res.status(502).json({ success: false, error: 'Failed to obtain Google Drive access token' });

    const folderName = folderNameOverride || process.env.GOOGLE_DRIVE_FOLDER_NAME || 'NexiFlow Screenshots';
    const folderId = cachedFolderId || (await getOrCreateDriveFolderId(accessToken, folderName));
    if (!cachedFolderId && folderId) {
      const c2 = await pool.getConnection();
      try {
        await c2.execute(
          'UPDATE company_google_drive_integrations SET folder_id = ?, updated_at = NOW() WHERE company_id = ?',
          [folderId, effectiveCompanyId]
        );
      } finally {
        c2.release();
      }
    }

    const safeTimestamp = (timestamp && typeof timestamp === 'string' ? timestamp : new Date().toISOString()).replace(/[:.]/g, '-');
    const filename = `nexiflow_${userId}_${safeTimestamp}.jpg`;
    const description = `Project: ${projectName || 'No project'} | Duration: ${duration || 'N/A'} | Captured: ${timestamp || new Date().toISOString()}`;

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ success: false, error: 'Invalid base64 image' });

    const uploaded = await uploadJpegToDrive(accessToken, { buffer, filename, folderId, description });

    res.json({
      success: true,
      ...uploaded,
      folderId,
      timestamp: timestamp || new Date().toISOString()
    });
  } catch (error) {
    console.error('Screenshot upload error:', error?.response?.data || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to upload screenshot' });
  }
});

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AI_HISTORY_LIMIT = 10;
const AI_TOOL_MAX_STEPS = 4;
const AI_TOOL_TIMEOUT_MS = 8000;
const buildAISystemPrompt = (pageContext = {}) => {
  const currentPath = typeof pageContext?.currentPath === 'string' ? pageContext.currentPath.trim() : '';
  const currentPage = typeof pageContext?.currentPage === 'string' ? pageContext.currentPage.trim() : '';
  const visibleNavigation = Array.isArray(pageContext?.visibleNavigation)
    ? pageContext.visibleNavigation
        .filter((item) => item && typeof item.name === 'string' && typeof item.href === 'string')
        .slice(0, 20)
    : [];
  const pageContextLines = [];

  if (currentPage) {
    pageContextLines.push(`- The user is currently on the ${currentPage} page.`)
  }

  if (currentPath) {
    pageContextLines.push(`- Current route: ${currentPath}`)
  }

  if (visibleNavigation.length) {
    pageContextLines.push(`- Visible sidebar navigation: ${visibleNavigation.map((item) => `${item.name} (${item.href})`).join(', ')}`)
  }

  return `You are Nexie, an AI assistant integrated into NexiFlow, a comprehensive time tracking and project management application.

Key features of NexiFlow include:
1. Time Tracking - Start/stop timers, manual entries, project/task association, tags, billable hours
2. Dashboard & Analytics - Overview statistics, earnings tracking, productivity insights, recent activity
3. Project Management - Project organization, task management, client management, color coding
4. Reports & Export - Time reports, data export, filtering, visual charts
5. Team Collaboration - Teams, team details, messaging (separate feature)
6. Settings & Customization - User profile, time & billing, notifications, appearance

When helping users:
- Provide specific, step-by-step guidance
- Use exact names and terminology from NexiFlow
- Include references to UI elements like buttons, icons, and menu items
- Ask clarifying questions when user intent is vague
- Keep responses concise but complete
- When the user asks how to do something in NexiFlow, act like a tutor:
  1. Briefly state where to go
  2. Give short numbered steps
  3. Mention the relevant page, button, form, or menu name
  4. End with one short follow-up offer when helpful
- For factual questions, first infer what the user actually wants from their wording before answering.
- If the user asks for one metric, answer that metric directly and do not add unrelated metrics unless the user asks for a fuller summary.
- Examples:
  - "How much time did I use this week?" -> answer with time used for the week.
  - "How much did I make this week?" -> answer with estimated earnings for the week.
  - "How many billable hours do I have this month?" -> answer with billable time for the month.
- If the user's current page is relevant, anchor the answer to that page first instead of giving generic navigation.
- Treat the provided visible sidebar navigation as source-of-truth for whether a page exists and what it is called in the UI.
- If a page appears in visible sidebar navigation, do not say it does not exist.
- When the user asks where to find a page that appears in visible sidebar navigation, direct them to that exact sidebar label.
- Use tools for current time and time/earnings summaries when the user asks factual questions like "what time is it?" or "how much did I make this week?".
- Write replies as plain chat text. Do not use markdown emphasis like **bold** or __underline__.
- If you are unsure whether a feature exists, say what you do know and avoid inventing settings, buttons, or workflows.

Code generation policy - STRICTLY ENFORCED:
- You MUST NOT generate, write, or provide code of any kind (HTML, CSS, JavaScript, Python, SQL, etc.).
- If a user asks for code, scripts, snippets, or programming help, politely decline and explain that you are Nexie, a time tracking assistant, not a coding assistant.
- Redirect code-related requests to appropriate help resources or suggest they consult a developer.
- Examples of requests to decline:
  - "Write me a script to..." -> "I can't help with writing scripts. I'm here to help with time tracking and project management in NexiFlow."
  - "Generate HTML for..." -> "I can't generate code. Is there something about tracking time or managing projects I can help with instead?"
  - "Show me CSS to..." -> "I can't help with CSS. Let me know if you need help navigating NexiFlow features instead."
- You may only provide UI navigation steps within NexiFlow itself - never code or technical implementation.

Scope boundaries - STRICTLY ENFORCED:
- Your ONLY purpose is to help users with NexiFlow time tracking and project management.
- You MUST NOT engage in conversations outside of NexiFlow's scope.
- Topics to decline and redirect:
  - Emotional support, personal problems, mental health -> "I'm here to help with time tracking and project management in NexiFlow. For personal matters, please speak with someone you trust."
  - General tech advice, software development, app building -> "I can help you track time and manage projects for your development work in NexiFlow. Would you like to set up a project for your app?"
  - How AI works, system architecture, technical implementation -> "I'm designed to help with NexiFlow features. Is there something about tracking time or managing projects I can help with?"
  - General knowledge questions unrelated to NexiFlow -> "I specialize in helping with NexiFlow. Let me know if you need help with time tracking, projects, clients, or reports."
  - Personal opinions, debates, creative writing -> "I'm focused on helping you use NexiFlow effectively. How can I help with your work today?"
- Always redirect back to relevant NexiFlow features when users go off-topic.
- Examples of redirection:
  - "i'm broken hearted" -> "I'm here to help with time tracking and project management in NexiFlow. If you need help organizing your work or tracking time on projects, let me know."
  - "i want to build a mobile app" -> "I can help you create a project in NexiFlow to track time and manage tasks for your mobile app development. Would you like me to show you how to set that up?"
  - "how are you created" -> "I'm Nexie, an AI assistant built into NexiFlow to help with time tracking and project management. How can I help you with your work today?"

Tool usage policy:
- Use tools for timer operations. Do not invent IDs.
- Start timer only on explicit user intent (for example: "start timer" or "clock me in").
- If a timer is already running, clearly tell the user it is already running and do not auto-stop it.
- Starting a timer does not require project, client, or description.
- No confirmation is required for explicit stop intent; execute stop flow directly.
- Before stopping a timer, ensure client, project, and description are set. If any are missing, ask only for missing fields, then update the running timer and retry stop.

Current UI context:
${pageContextLines.length ? pageContextLines.join('\n') : '- Current page is unknown.'}`;
};

const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current local time for the authenticated user based on their profile timezone.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_period_summary',
      description: 'Get raw summary data for today, this week, or this month including total time, billable time, entry count, hourly rate, and estimated earnings. Use only the fields needed to answer the user\'s specific question.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month']
          }
        },
        required: ['period']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_running_timer',
      description: 'Get the authenticated user\'s currently running timer, if any.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: 'List projects available to the authenticated user. Use search when user provides project text.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          search: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_clients',
      description: 'List clients available to the authenticated user. Optional projectId narrows to the project\'s client.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          projectId: { type: 'string' },
          search: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'start_timer',
      description: 'Start a new running timer for the authenticated user. Use projectId only when resolved from tool data.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          projectId: { type: 'string' },
          description: { type: 'string' },
          isBillable: { type: 'boolean' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_running_timer',
      description: 'Update the authenticated user\'s currently running timer fields before stopping or correcting context.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          projectId: { type: 'string' },
          clientId: { type: 'string' },
          description: { type: 'string' },
          isBillable: { type: 'boolean' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'stop_running_timer',
      description: 'Stop the authenticated user\'s current running timer. Requires projectId, clientId, and non-empty description.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {}
      }
    }
  }
];

const normalizeAIHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .slice(-AI_HISTORY_LIMIT)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.slice(0, 4000)
    }));
};

const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseToolArguments = (rawArgs) => {
  if (!rawArgs || typeof rawArgs !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArgs);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const runWithTimeout = async (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timed out')), timeoutMs);
    })
  ]);
};

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20)));
};

const getRunningTimerRowForUser = async (connection, userId) => {
  const [rows] = await connection.execute(
    `SELECT * FROM time_entries
     WHERE user_id = ? AND is_running = 1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows.length ? rows[0] : null;
};

const getAccessibleProject = async (connection, req, projectId) => {
  if (!projectId) return null;

  if (req.user.role !== 'root' && req.user.companyId) {
    const [rows] = await connection.execute(
      `SELECT id, name, client_id
       FROM projects
       WHERE id = ? AND company_id = ?
       LIMIT 1`,
      [projectId, req.user.companyId]
    );
    return rows.length ? rows[0] : null;
  }

  const [rows] = await connection.execute(
    `SELECT id, name, client_id
     FROM projects
     WHERE id = ?
     LIMIT 1`,
    [projectId]
  );
  return rows.length ? rows[0] : null;
};

const getAccessibleClient = async (connection, req, clientId) => {
  if (!clientId) return null;

  if (req.user.role !== 'root' && req.user.companyId) {
    const [rows] = await connection.execute(
      `SELECT id, name
       FROM clients
       WHERE id = ? AND company_id = ?
       LIMIT 1`,
      [clientId, req.user.companyId]
    );
    return rows.length ? rows[0] : null;
  }

  const [rows] = await connection.execute(
    `SELECT id, name
     FROM clients
     WHERE id = ?
     LIMIT 1`,
    [clientId]
  );
  return rows.length ? rows[0] : null;
};

const mapTimeEntryRow = (row) => ({
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
});

const getAuthenticatedUserDetails = async (connection, userId) => {
  const [rows] = await connection.execute(
    'SELECT id, name, timezone, hourly_rate FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return rows.length ? rows[0] : null;
};

const resolvePeriodRange = (period) => {
  const now = new Date();

  if (period === 'today') {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    };
  }

  if (period === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return {
      startDate: new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate()),
      endDate: new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59, 999)
    };
  }

  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  };
};

const buildPeriodSummary = async (connection, req, period) => {
  const { startDate, endDate } = resolvePeriodRange(period);
  const params = [req.user.uid, startDate, endDate];
  let query = 'SELECT duration, is_billable FROM time_entries WHERE user_id = ? AND start_time >= ? AND start_time <= ?';

  if (req.user.role !== 'root' && req.user.companyId) {
    query += ' AND company_id = ?';
    params.push(req.user.companyId);
  }

  const [rows] = await connection.execute(query, params);
  const totalDuration = rows.reduce((sum, row) => sum + Number(row.duration || 0), 0);
  const billableDuration = rows.reduce((sum, row) => sum + (row.is_billable === 1 ? Number(row.duration || 0) : 0), 0);
  const userDetails = await getAuthenticatedUserDetails(connection, req.user.uid);
  const hourlyRate = Number(userDetails?.hourly_rate || 0);
  const estimatedEarnings = Number((((billableDuration / 3600) * hourlyRate) || 0).toFixed(2));

  return {
    period,
    totalDuration,
    billableDuration,
    totalEntries: rows.length,
    formattedTotal: formatTimeFromSeconds(totalDuration),
    formattedBillable: formatTimeFromSeconds(billableDuration),
    hourlyRate,
    estimatedEarnings
  };
};

const toolHandlers = {
  async get_current_time(req) {
    const connection = await pool.getConnection();
    try {
      const userDetails = await getAuthenticatedUserDetails(connection, req.user.uid);
      const timezone = userDetails?.timezone || 'UTC';
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }).format(now);

      return {
        success: true,
        timezone,
        currentTime: formatted
      };
    } finally {
      connection.release();
    }
  },

  async get_period_summary(req, args) {
    const period = ['today', 'week', 'month'].includes(args?.period) ? args.period : 'today';
    const connection = await pool.getConnection();
    try {
      const summary = await buildPeriodSummary(connection, req, period);
      return {
        success: true,
        summary
      };
    } finally {
      connection.release();
    }
  },

  async get_running_timer(req) {
    const connection = await pool.getConnection();
    try {
      const runningRow = await getRunningTimerRowForUser(connection, req.user.uid);
      if (!runningRow) {
        return { success: true, running: false, timer: null };
      }

      return { success: true, running: true, timer: mapTimeEntryRow(runningRow) };
    } finally {
      connection.release();
    }
  },

  async list_projects(req, args) {
    const search = toSafeString(args?.search);
    const params = [0];
    let where = 'WHERE is_archived = ?';

    if (req.user.role !== 'root' && req.user.companyId) {
      where += ' AND company_id = ?';
      params.push(req.user.companyId);
    }

    if (search) {
      where += ' AND (name LIKE ? OR description LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, name, client_id, client_name, status
         FROM projects
         ${where}
         ORDER BY created_at DESC
         LIMIT 20`,
        params
      );

      return {
        success: true,
        projects: rows.map((row) => ({
          id: row.id,
          name: row.name,
          clientId: row.client_id,
          clientName: row.client_name,
          status: row.status
        }))
      };
    } finally {
      connection.release();
    }
  },

  async list_clients(req, args) {
    const search = toSafeString(args?.search);
    const projectId = toSafeString(args?.projectId);
    const params = [];
    let where = 'WHERE 1=1';

    if (req.user.role !== 'root' && req.user.companyId) {
      where += ' AND company_id = ?';
      params.push(req.user.companyId);
    }

    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    const connection = await pool.getConnection();
    try {
      if (projectId) {
        let projectQuery = 'SELECT client_id FROM projects WHERE id = ?';
        const projectParams = [projectId];

        if (req.user.role !== 'root' && req.user.companyId) {
          projectQuery += ' AND company_id = ?';
          projectParams.push(req.user.companyId);
        }

        const [projectRows] = await connection.execute(projectQuery, projectParams);
        if (!projectRows.length) {
          return { success: false, errorCode: 'PROJECT_NOT_FOUND', message: 'Project not found.' };
        }

        const linkedClientId = projectRows[0].client_id;
        if (!linkedClientId) {
          return { success: true, clients: [] };
        }

        const [clientRows] = await connection.execute(
          'SELECT id, name, email FROM clients WHERE id = ? LIMIT 1',
          [linkedClientId]
        );

        return {
          success: true,
          clients: clientRows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email
          }))
        };
      }

      const [rows] = await connection.execute(
        `SELECT id, name, email
         FROM clients
         ${where}
         ORDER BY created_at DESC
         LIMIT 20`,
        params
      );

      return {
        success: true,
        clients: rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email
        }))
      };
    } finally {
      connection.release();
    }
  },

  async start_timer(req, args) {
    const userId = req.user.uid;
    const companyId = req.user.companyId || null;
    const projectId = toSafeString(args?.projectId) || null;
    const description = toSafeString(args?.description) || null;
    const isBillable = Boolean(args?.isBillable);
    const tags = sanitizeTags(args?.tags);

    const connection = await pool.getConnection();
    try {
      const [runningRows] = await connection.execute(
        `SELECT * FROM time_entries
         WHERE user_id = ? AND is_running = 1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (runningRows.length) {
        return {
          success: false,
          errorCode: 'TIMER_ALREADY_RUNNING',
          message: 'A timer is already running. Please stop the current timer before starting a new one.',
          timer: mapTimeEntryRow(runningRows[0])
        };
      }

      let projectName = null;
      let clientId = null;
      let clientName = null;

      if (projectId) {
        let projectQuery = 'SELECT id, name, company_id, client_id FROM projects WHERE id = ? LIMIT 1';
        const projectParams = [projectId];

        if (req.user.role !== 'root' && companyId) {
          projectQuery = 'SELECT id, name, company_id, client_id FROM projects WHERE id = ? AND company_id = ? LIMIT 1';
          projectParams.push(companyId);
        }

        const [projectRows] = await connection.execute(projectQuery, projectParams);
        if (!projectRows.length) {
          return {
            success: false,
            errorCode: 'PROJECT_NOT_FOUND',
            message: 'Project not found or not accessible.'
          };
        }

        const project = projectRows[0];
        projectName = project.name;
        clientId = project.client_id || null;

        if (clientId) {
          const [clientRows] = await connection.execute(
            'SELECT id, name FROM clients WHERE id = ? LIMIT 1',
            [clientId]
          );
          if (clientRows.length) {
            clientName = clientRows[0].name;
          }
        }
      }

      const entryId = uuidv4();
      const now = new Date();

      await connection.execute(
        `INSERT INTO time_entries (
          id, user_id, company_id, project_id, project_name, client_id, client_name,
          description, start_time, end_time, duration, is_running, is_billable, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          userId,
          companyId,
          projectId,
          projectName,
          clientId,
          clientName,
          description,
          now,
          null,
          0,
          1,
          isBillable ? 1 : 0,
          JSON.stringify(tags),
          now,
          now
        ]
      );

      const [rows] = await connection.execute('SELECT * FROM time_entries WHERE id = ? LIMIT 1', [entryId]);
      return { success: true, timer: rows.length ? mapTimeEntryRow(rows[0]) : null };
    } finally {
      connection.release();
    }
  },

  async update_running_timer(req, args) {
    const userId = req.user.uid;
    const projectId = toSafeString(args?.projectId) || null;
    const clientId = toSafeString(args?.clientId) || null;
    const rawDescription = toSafeString(args?.description);
    const hasDescriptionArg = Object.prototype.hasOwnProperty.call(args || {}, 'description');
    const isBillableProvided = Object.prototype.hasOwnProperty.call(args || {}, 'isBillable');
    const tagsProvided = Object.prototype.hasOwnProperty.call(args || {}, 'tags');
    const tags = sanitizeTags(args?.tags);

    const connection = await pool.getConnection();
    try {
      const runningRow = await getRunningTimerRowForUser(connection, userId);
      if (!runningRow) {
        return {
          success: false,
          errorCode: 'NO_RUNNING_TIMER',
          message: 'No running timer found to update.'
        };
      }

      const fields = [];
      const values = [];
      let resolvedProjectName = runningRow.project_name || null;
      let resolvedClientId = runningRow.client_id || null;
      let resolvedClientName = runningRow.client_name || null;

      if (projectId) {
        const project = await getAccessibleProject(connection, req, projectId);
        if (!project) {
          return {
            success: false,
            errorCode: 'PROJECT_NOT_FOUND',
            message: 'Project not found or not accessible.'
          };
        }
        resolvedProjectName = project.name;
        resolvedClientId = project.client_id || null;

        fields.push('project_id = ?');
        values.push(projectId);
        fields.push('project_name = ?');
        values.push(resolvedProjectName);

        if (resolvedClientId) {
          const projectClient = await getAccessibleClient(connection, req, resolvedClientId);
          resolvedClientName = projectClient?.name || null;
          fields.push('client_id = ?');
          values.push(resolvedClientId);
          fields.push('client_name = ?');
          values.push(resolvedClientName);
        }
      }

      if (clientId) {
        const client = await getAccessibleClient(connection, req, clientId);
        if (!client) {
          return {
            success: false,
            errorCode: 'CLIENT_NOT_FOUND',
            message: 'Client not found or not accessible.'
          };
        }

        resolvedClientId = client.id;
        resolvedClientName = client.name;
        fields.push('client_id = ?');
        values.push(resolvedClientId);
        fields.push('client_name = ?');
        values.push(resolvedClientName);
      }

      if (hasDescriptionArg) {
        fields.push('description = ?');
        values.push(rawDescription || null);
      }

      if (isBillableProvided) {
        fields.push('is_billable = ?');
        values.push(Boolean(args?.isBillable) ? 1 : 0);
      }

      if (tagsProvided) {
        fields.push('tags = ?');
        values.push(JSON.stringify(tags));
      }

      if (!fields.length) {
        return { success: true, message: 'No changes provided.', timer: mapTimeEntryRow(runningRow) };
      }

      fields.push('updated_at = ?');
      values.push(new Date());
      values.push(runningRow.id);

      await connection.execute(
        `UPDATE time_entries
         SET ${fields.join(', ')}
         WHERE id = ?`,
        values
      );

      const [rows] = await connection.execute(
        'SELECT * FROM time_entries WHERE id = ? LIMIT 1',
        [runningRow.id]
      );

      return {
        success: true,
        timer: rows.length ? mapTimeEntryRow(rows[0]) : null
      };
    } finally {
      connection.release();
    }
  },

  async stop_running_timer(req) {
    const userId = req.user.uid;
    const connection = await pool.getConnection();
    try {
      const runningRow = await getRunningTimerRowForUser(connection, userId);
      if (!runningRow) {
        return {
          success: false,
          errorCode: 'NO_RUNNING_TIMER',
          message: 'No running timer found.'
        };
      }

      const missingRequiredFields = [];
      if (!runningRow.client_id) missingRequiredFields.push('client');
      if (!runningRow.project_id) missingRequiredFields.push('project');
      if (!toSafeString(runningRow.description)) missingRequiredFields.push('description');

      if (missingRequiredFields.length) {
        return {
          success: false,
          errorCode: 'MISSING_REQUIRED_FIELDS',
          message: 'Client, project, and description are required before stopping a timer.',
          missingRequiredFields,
          timer: mapTimeEntryRow(runningRow)
        };
      }

      const endTime = new Date();
      const startTime = new Date(runningRow.start_time);
      const duration = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

      await connection.execute(
        `UPDATE time_entries
         SET end_time = ?, duration = ?, is_running = 0, updated_at = ?
         WHERE id = ?`,
        [endTime, duration, new Date(), runningRow.id]
      );

      const [rows] = await connection.execute(
        'SELECT * FROM time_entries WHERE id = ? LIMIT 1',
        [runningRow.id]
      );

      return {
        success: true,
        timer: rows.length ? mapTimeEntryRow(rows[0]) : null
      };
    } finally {
      connection.release();
    }
  }
};

const executeAIToolCall = async (req, toolCall) => {
  const toolName = toolCall?.function?.name;
  const rawArgs = toolCall?.function?.arguments;
  const handler = toolHandlers[toolName];

  if (!handler) {
    return {
      success: false,
      errorCode: 'UNKNOWN_TOOL',
      message: `Unknown tool: ${toolName || 'unknown'}`
    };
  }

  const args = parseToolArguments(rawArgs);
  try {
    return await runWithTimeout(handler(req, args), AI_TOOL_TIMEOUT_MS);
  } catch (error) {
    return {
      success: false,
      errorCode: 'TOOL_EXECUTION_ERROR',
      message: error?.message || 'Tool execution failed'
    };
  }
};

app.post('/api/ai/chat', authenticateToken, aiChatLimiter, async (req, res) => {
  const { prompt, history, pageContext } = req.body || {};
  const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';

  if (!trimmedPrompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  // Disable AI chat for Solo plan companies (root users are exempt).
  try {
    if (req.user?.role !== 'root') {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ success: false, error: 'AI chat is unavailable on the Solo plan.' });
      }

      const connection = await pool.getConnection();
      try {
        const [companyRows] = await connection.execute(
          'SELECT pricing_level FROM companies WHERE id = ? LIMIT 1',
          [companyId]
        );

        const pricingLevel = companyRows?.[0]?.pricing_level;
        if (!pricingLevel || pricingLevel === 'solo') {
          return res.status(403).json({ success: false, error: 'AI chat is unavailable on the Solo plan.' });
        }
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    console.error('Error validating AI chat access:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate AI chat access' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ success: false, error: 'AI is not configured on the server' });
  }

  const messages = [
    { role: 'system', content: buildAISystemPrompt(pageContext) },
    ...normalizeAIHistory(history),
    { role: 'user', content: trimmedPrompt }
  ];

  try {
    if (isStartTimerIntent(trimmedPrompt)) {
      const startResult = await runWithTimeout(toolHandlers.start_timer(req, {}), AI_TOOL_TIMEOUT_MS);

      if (startResult?.success) {
        return res.json({
          success: true,
          reply: 'Your timer has been started.',
          meta: {
            toolCallsUsed: 1,
            truncatedByMaxSteps: false,
            timerSync: { changed: true, action: 'started', source: 'ai' }
          }
        });
      }

      if (startResult?.errorCode === 'TIMER_ALREADY_RUNNING') {
        return res.json({
          success: true,
          reply: 'A timer is already running. Please stop the current timer before starting a new one.',
          meta: { toolCallsUsed: 1, truncatedByMaxSteps: false }
        });
      }

      return res.status(502).json({ success: false, error: startResult?.message || 'Failed to start timer' });
    }

    if (isStopTimerIntent(trimmedPrompt)) {
      const stopResult = await runWithTimeout(toolHandlers.stop_running_timer(req), AI_TOOL_TIMEOUT_MS);

      if (stopResult?.success) {
        return res.json({
          success: true,
          reply: 'Timer stopped successfully.',
          meta: {
            toolCallsUsed: 1,
            truncatedByMaxSteps: false,
            timerSync: { changed: true, action: 'stopped', source: 'ai' }
          }
        });
      }

      if (stopResult?.errorCode === 'NO_RUNNING_TIMER') {
        return res.json({
          success: true,
          reply: 'No running timer was found.',
          meta: { toolCallsUsed: 1, truncatedByMaxSteps: false }
        });
      }

      if (stopResult?.errorCode === 'MISSING_REQUIRED_FIELDS') {
        const missingFields = Array.isArray(stopResult?.missingRequiredFields) ? stopResult.missingRequiredFields : [];
        const missingFieldsLabel = missingFields.length ? missingFields.join(', ') : 'client, project, description';
        return res.json({
          success: true,
          reply: `I found your running timer, but it cannot be stopped yet because these required fields are missing: ${missingFieldsLabel}. Complete them below, then stop the timer.`,
          meta: {
            toolCallsUsed: 1,
            truncatedByMaxSteps: false,
            actionRequest: {
              type: 'stop_timer_requirements',
              missingFields,
              runningTimer: stopResult?.timer || null
            }
          }
        });
      }

      return res.status(502).json({ success: false, error: stopResult?.message || 'Failed to stop timer' });
    }

    let reply = '';
    let truncatedByMaxSteps = false;
    let toolCallsUsed = 0;
    let timerSync = null;
    let actionRequest = null;

    for (let step = 0; step < AI_TOOL_MAX_STEPS; step += 1) {
      const openAIResponse = await axios.post(
        OPENAI_API_URL,
        {
          model: OPENAI_MODEL,
          messages,
          tools: AI_TOOLS,
          tool_choice: 'auto',
          temperature: 0.5,
          max_tokens: 500
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const assistantMessage = openAIResponse.data?.choices?.[0]?.message;
      const assistantContent = sanitizeAIReply(typeof assistantMessage?.content === 'string' ? assistantMessage.content : '');
      const toolCalls = Array.isArray(assistantMessage?.tool_calls) ? assistantMessage.tool_calls : [];

      if (!assistantMessage) {
        return res.status(502).json({ success: false, error: 'Invalid AI response format' });
      }

      if (!toolCalls.length) {
        reply = assistantContent;
        break;
      }

      toolCallsUsed += toolCalls.length;

      messages.push({
        role: 'assistant',
        content: sanitizeAIReply(assistantMessage.content || ''),
        tool_calls: toolCalls
      });

      for (const toolCall of toolCalls) {
        const toolResult = await executeAIToolCall(req, toolCall);
        const toolName = toolCall?.function?.name;

        if (toolResult?.success === true) {
          if (toolName === 'start_timer') {
            timerSync = { changed: true, action: 'started', source: 'ai' };
          } else if (toolName === 'stop_running_timer') {
            timerSync = { changed: true, action: 'stopped', source: 'ai' };
          }
        } else if (toolName === 'stop_running_timer' && toolResult?.errorCode === 'MISSING_REQUIRED_FIELDS') {
          actionRequest = {
            type: 'stop_timer_requirements',
            missingFields: Array.isArray(toolResult?.missingRequiredFields) ? toolResult.missingRequiredFields : [],
            runningTimer: toolResult?.timer || null
          };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }

      if (step === AI_TOOL_MAX_STEPS - 1) {
        truncatedByMaxSteps = true;
      }
    }

    if (!reply) {
      if (truncatedByMaxSteps) {
        return res.json({
          success: true,
          reply: sanitizeAIReply('I could not complete that action in time. Please try again with a more specific request.')
        });
      }

      return res.status(502).json({ success: false, error: 'Invalid AI response format' });
    }

    const meta = {
      toolCallsUsed,
      truncatedByMaxSteps,
      ...(actionRequest ? { actionRequest } : {}),
      ...(timerSync ? { timerSync } : {})
    };

    return res.json({ success: true, reply: sanitizeAIReply(reply), meta });
  } catch (error) {
    const providerStatus = error?.response?.status;
    const providerMessage = error?.response?.data?.error?.message;
    console.error('AI chat error:', {
      userId: req.user?.uid || null,
      status: providerStatus,
      message: providerMessage || error.message
    });

    if (providerStatus === 429) {
      return res.status(429).json({ success: false, error: 'AI rate limit reached. Please try again shortly.' });
    }

    if (providerStatus === 401 || providerStatus === 403) {
      return res.status(502).json({ success: false, error: 'AI provider rejected server credentials' });
    }

    return res.status(502).json({ success: false, error: 'Failed to get AI response' });
  }
});

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
  notes: Joi.string().allow('', null).optional(),
  projectId: Joi.string().optional(),
  status: Joi.string().optional(),
  priority: Joi.string().optional(),
  assigneeId: Joi.string().allow('', null).optional(),
  dueDate: Joi.date().allow('', null).optional(),
  estimatedHours: Joi.number().min(0).allow(null).optional(),
  actualHours: Joi.number().min(0).allow(null).optional(),
  isCompleted: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  comments: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    content: Joi.string().allow('', null).required(),
    authorId: Joi.string().required(),
    authorName: Joi.string().allow('', null).optional(),
    authorEmail: Joi.string().allow('', null).optional(),
    createdAt: Joi.date().required(),
    updatedAt: Joi.date().required(),
    mentions: Joi.array().items(
      Joi.alternatives().try(
        Joi.string(),
        Joi.object({
          userId: Joi.string().required(),
          userName: Joi.string().allow('', null).required(),
          userEmail: Joi.string().allow('', null).optional()
        })
      )
    ).optional()
  })).optional(),
  parentTaskId: Joi.string().allow('', null).optional(),
  teamId: Joi.string().allow('', null).optional()
}).min(1);

const mentionNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid('mention').required(),
  title: Joi.string().required(),
  message: Joi.string().required(),
  mentionedBy: Joi.string().allow('', null).optional(),
  mentionedByName: Joi.string().allow('', null).optional(),
  contextType: Joi.string().valid('comment', 'note', 'message', 'task').required(),
  contextId: Joi.string().required(),
  contextTitle: Joi.string().allow('', null).required(),
  taskId: Joi.string().allow('', null).optional(),
  projectId: Joi.string().allow('', null).optional(),
  actionUrl: Joi.string().allow('', null).optional()
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

const isAdminRole = (role) => {
  return ['admin', 'super_admin', 'hr', 'root'].includes(role);
};

const isGlobalAdminRole = (role) => {
  return ['root', 'super_admin'].includes(role);
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
          error: 'Invalid email or password. Please check your credentials and try again.' 
        });
      }
      
      const user = userRows[0];

      // Verify the password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid email or password. Please check your credentials and try again.' 
        });
      }

      const emailVerified = user.email_verified === 1;
      if (!emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Please verify your email before signing in.',
          emailVerified: false
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
        emailVerified,
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

// Returns the latest user + company for the current JWT (used to refresh plan/tier without logout)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user' });
    }

    const connection = await pool.getConnection();
    try {
      const [userRows] = await connection.execute('SELECT * FROM users WHERE id = ? AND is_active = 1 LIMIT 1', [userId]);
      if (!userRows.length) {
        return res.status(401).json({ success: false, error: 'Invalid user' });
      }

      const user = userRows[0];
      const emailVerified = user.email_verified === 1;

      let companyData = null;
      if (user.company_id) {
        const [companyRows] = await connection.execute('SELECT * FROM companies WHERE id = ? LIMIT 1', [user.company_id]);
        if (companyRows.length) {
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

      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id || null,
        teamId: user.team_id || null,
        teamRole: user.team_role || null,
        avatar: user.avatar || null,
        emailVerified,
        timezone: user.timezone,
        hourlyRate: user.hourly_rate,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };

      res.json({ success: true, user: userData, company: companyData });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ success: false, error: 'Failed to load account info' });
  }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const connection = await pool.getConnection();
    try {
      const [userRows] = await connection.execute(
        'SELECT id, name, email FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
        [normalizedEmail]
      );

      // Always return success to avoid user enumeration
      if (!userRows.length) {
        return res.json({
          success: true,
          message: 'If an account exists for that email, password reset instructions have been sent.'
        });
      }

      const user = userRows[0];

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const resetId = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await connection.execute(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [resetId, user.id, tokenHash, expiresAt]
      );

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const resetLink = `${frontendUrl}/auth?mode=reset-password&token=${rawToken}`;

      const emailResult = await billingEmailService.sendPasswordResetEmail(
        { name: user.name, email: user.email },
        resetLink
      );

      if (!emailResult?.success) {
        console.error('Password reset email send failed:', emailResult?.error);
      }

      return res.json({
        success: true,
        message: 'If an account exists for that email, password reset instructions have been sent.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
         FROM password_reset_tokens prt
         WHERE prt.token_hash = ?
         ORDER BY prt.created_at DESC
         LIMIT 1`,
        [tokenHash]
      );

      if (!rows.length) {
        return res.status(400).json({ success: false, error: 'Invalid or expired token' });
      }

      const resetRow = rows[0];
      if (resetRow.used_at) {
        return res.status(400).json({ success: false, error: 'Token has already been used' });
      }

      const expiresAt = new Date(resetRow.expires_at);
      if (Date.now() > expiresAt.getTime()) {
        return res.status(400).json({ success: false, error: 'Invalid or expired token' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await connection.beginTransaction();
      try {
        await connection.execute(
          'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ? AND is_active = 1',
          [hashedPassword, resetRow.user_id]
        );

        await connection.execute(
          'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL',
          [resetRow.id]
        );

        await connection.commit();
      } catch (e) {
        try {
          await connection.rollback();
        } catch {}
        throw e;
      }

      return res.json({ success: true, message: 'Password has been reset successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// Change password endpoint (for logged-in users)
app.put('/api/users/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    const requesterId = String(req.user.uid);
    const requesterRole = req.user.role;

    // Only allow users to change their own password, or admins to change any password
    const isSelf = requesterId === String(id);
    const isPrivileged = ['admin', 'super_admin', 'hr', 'root'].includes(requesterRole);

    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Validation
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, error: 'New password is required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }

    // For non-admin users, current password is required
    if (isSelf && !isPrivileged && (!currentPassword || typeof currentPassword !== 'string')) {
      return res.status(400).json({ success: false, error: 'Current password is required' });
    }

    const connection = await pool.getConnection();
    try {
      // Get user
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE (id = ? OR uid = ?) AND is_active = 1 LIMIT 1',
        [id, id]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const user = rows[0];

      // If changing own password, verify current password
      if (isSelf && !isPrivileged) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await connection.execute(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, user.id]
      );

      res.json({ success: true, message: 'Password changed successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
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

      if (!isGlobalAdminRole(req.user.role) && companyId) {
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
    const effectiveCompanyId = isGlobalAdminRole(req.user.role)
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

      if (!isGlobalAdminRole(req.user.role) && companyId) {
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
      if (!isGlobalAdminRole(req.user.role) && companyId) {
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
      if (!isGlobalAdminRole(req.user.role) && companyId) {
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
          id, uid, name, email, password_hash, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, email_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, 1, 0, ?, ?)
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
      const [userRows] = await connection.execute(
        `SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      const user = userRows[0];

      const { rawToken } = await createEmailVerificationToken(connection, userId);
      const verifyLink = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
      await billingEmailService.sendEmailVerificationEmail({ name: user.name, email: user.email }, verifyLink);

      res.status(201).json({
        success: true,
        requiresEmailVerification: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: false
        },
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

// Verify email endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Verification token is required' });
    }

    const tokenHash = sha256Hex(token);
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `
          SELECT id, user_id, expires_at, used_at
          FROM email_verification_tokens
          WHERE token_hash = ?
          LIMIT 1
        `,
        [tokenHash]
      );

      if (!rows.length) {
        return res.status(400).json({ success: false, error: 'Invalid or expired verification token' });
      }

      const record = rows[0];
      const now = new Date();
      if (record.used_at) {
        return res.status(400).json({ success: false, error: 'This verification link has already been used' });
      }
      if (new Date(record.expires_at).getTime() < now.getTime()) {
        return res.status(400).json({ success: false, error: 'This verification link has expired' });
      }

      await connection.execute('UPDATE users SET email_verified = 1, updated_at = NOW() WHERE id = ?', [record.user_id]);
      await connection.execute('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?', [now, record.id]);

      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, error: 'Email verification failed. Please try again.' });
  }
});

// Resend verification endpoint
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const connection = await pool.getConnection();
    try {
      const [userRows] = await connection.execute(
        'SELECT id, name, email, email_verified FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
        [normalizedEmail]
      );

      if (userRows.length && userRows[0].email_verified !== 1) {
        const user = userRows[0];
        const { rawToken } = await createEmailVerificationToken(connection, user.id);
        const verifyLink = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(normalizedEmail)}`;
        await billingEmailService.sendEmailVerificationEmail({ name: user.name, email: user.email }, verifyLink);
      }

      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend verification email. Please try again.' });
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

const adminUserCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('employee', 'hr', 'admin', 'super_admin', 'root').required(),
  hourlyRate: Joi.number().min(0).optional(),
  timezone: Joi.string().trim().min(1).optional(),
  companyId: Joi.string().allow(null, '').optional()
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  const { error, value } = adminUserCreateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  try {
    const requesterRole = req.user.role;
    const requesterCompanyId = req.user.companyId || null;

    const isPrivileged = ['admin', 'super_admin', 'hr', 'root'].includes(requesterRole);
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const createCompanyId = requesterRole === 'root'
      ? (value.companyId ? String(value.companyId) : null)
      : (requesterCompanyId || (value.companyId ? String(value.companyId) : null));

    const connection = await pool.getConnection();
    try {
      if (createCompanyId && requesterRole !== 'root') {
        const [companyRows] = await connection.execute(
          'SELECT max_members, pricing_level FROM companies WHERE id = ? LIMIT 1',
          [createCompanyId]
        );

        if (!companyRows.length) {
          return res.status(404).json({
            success: false,
            error: 'Company not found'
          });
        }

        const company = companyRows[0];

        const [userCountRows] = await connection.execute(
          'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND is_active = 1',
          [createCompanyId]
        );

        const currentUsers = Number(userCountRows[0]?.count || 0);
        const maxMembers = Number(company.max_members || 0);

        if (Number.isFinite(maxMembers) && maxMembers > 0 && currentUsers >= maxMembers) {
          return res.status(403).json({
            success: false,
            error: `Seat limit reached for ${company.pricing_level || 'current'} plan. Please upgrade to add more users.`
          });
        }
      }

      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [value.email]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      const hashedPassword = await bcrypt.hash(value.password, 12);

      const userId = uuidv4();
      const now = new Date();

      const userQuery = `
        INSERT INTO users (
          id, uid, name, email, password_hash, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 1, ?, ?)
      `;

      const timezone = value.timezone || 'America/New_York';
      const hourlyRate = typeof value.hourlyRate === 'number' ? value.hourlyRate : 25;

      await connection.execute(userQuery, [
        userId,
        userId,
        value.name,
        value.email,
        hashedPassword,
        value.role,
        createCompanyId,
        timezone,
        hourlyRate,
        now,
        now
      ]);

      return res.status(201).json({
        success: true,
        data: {
          id: userId,
          uid: userId,
          name: value.name,
          email: value.email,
          role: value.role,
          companyId: createCompanyId,
          teamId: null,
          teamRole: null,
          avatar: null,
          timezone,
          hourlyRate,
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        message: 'User created successfully'
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

app.put('/api/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterRole = req.user.role;
    const requesterCompanyId = req.user.companyId || null;
    const updates = req.body || {};

    const isPrivileged = ['admin', 'super_admin', 'hr', 'root'].includes(requesterRole);
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT id, company_id FROM users WHERE (id = ? OR uid = ?) LIMIT 1',
        [userId, userId]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = rows[0];

      if (requesterRole !== 'root' && requesterCompanyId && user.company_id !== requesterCompanyId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

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
        values.push(updates.companyId || null);
      }
      if (updates.teamId !== undefined) {
        fields.push('team_id = ?');
        values.push(updates.teamId || null);
      }
      if (updates.teamRole !== undefined) {
        fields.push('team_role = ?');
        values.push(updates.teamRole || null);
      }

      fields.push('updated_at = ?');
      values.push(new Date());

      if (!fields.length) {
        return res.status(400).json({
          success: false,
          error: 'No updates provided'
        });
      }

      await connection.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        [...values, user.id]
      );

      return res.json({
        success: true,
        message: 'User updated successfully'
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error updating admin user:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

app.delete('/api/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterRole = req.user.role;
    const requesterCompanyId = req.user.companyId || null;

    const isPrivileged = ['admin', 'super_admin', 'hr', 'root'].includes(requesterRole);
    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT id, company_id, is_active FROM users WHERE (id = ? OR uid = ?) LIMIT 1',
        [userId, userId]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = rows[0];

      if (requesterRole !== 'root' && requesterCompanyId && user.company_id !== requesterCompanyId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const [result] = await connection.execute(
        'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ? AND is_active = 1',
        [new Date(), user.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting admin user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
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

const invoiceAllowedRoles = new Set(['admin', 'hr', 'super_admin']);
const requireInvoiceRole = (req, res, next) => {
  const role = req?.user?.role;
  if (!role || !invoiceAllowedRoles.has(role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  return next();
};

app.post('/api/invoices', authenticateToken, requireInvoiceRole, async (req, res) => {
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

app.get('/api/invoices', authenticateToken, requireInvoiceRole, async (req, res) => {
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

app.get('/api/invoices/:id', authenticateToken, requireInvoiceRole, async (req, res) => {
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

app.post('/api/invoices/:id/send', authenticateToken, requireInvoiceRole, async (req, res) => {
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
      const tasks = rows.map(mapTaskRow);
      
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

app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = rows[0];

      if (req.user.role !== 'root' && task.company_id !== companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        success: true,
        data: mapTaskRow(task)
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
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
      if (value.notes !== undefined) {
        fields.push('notes = ?');
        values.push(value.notes || null);
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
      if (value.actualHours !== undefined) {
        fields.push('actual_hours = ?');
        values.push(value.actualHours || null);
      }
      if (value.isCompleted !== undefined) {
        fields.push('is_completed = ?');
        values.push(value.isCompleted ? 1 : 0);
      }
      if (value.tags !== undefined) {
        fields.push('tags = ?');
        values.push(JSON.stringify(value.tags));
      }
      if (value.comments !== undefined) {
        fields.push('comments = ?');
        values.push(JSON.stringify(value.comments));
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

      if (value.comments !== undefined) {
        await connection.execute(
          `
            DELETE cm
            FROM comment_mentions cm
            INNER JOIN task_comments tc ON tc.id = cm.comment_id
            WHERE tc.task_id = ?
          `,
          [id]
        );

        await connection.execute('DELETE FROM task_comments WHERE task_id = ?', [id]);

        for (const comment of value.comments) {
          const createdAt = comment.createdAt ? new Date(comment.createdAt) : new Date();
          const updatedAt = comment.updatedAt ? new Date(comment.updatedAt) : createdAt;

          await connection.execute(
            `
              INSERT INTO task_comments (
                id, task_id, content, author_id, author_name, author_email,
                created_at, updated_at, parent_comment_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              comment.id,
              id,
              comment.content || '',
              comment.authorId,
              comment.authorName || null,
              comment.authorEmail || null,
              createdAt,
              updatedAt,
              comment.parentCommentId || null
            ]
          );

          const mentionUserIds = Array.from(
            new Set(
              (comment.mentions || [])
                .map((mention) => typeof mention === 'string' ? mention : mention?.userId)
                .filter(Boolean)
            )
          );

          for (const userId of mentionUserIds) {
            await connection.execute(
              'INSERT IGNORE INTO comment_mentions (comment_id, user_id) VALUES (?, ?)',
              [comment.id, userId]
            );
          }
        }
      }
      
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

app.get('/api/mention-notifications', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `
          SELECT *
          FROM mention_notifications
          WHERE mentioned_user_id = ?
          ORDER BY created_at DESC
        `,
        [req.user.uid]
      );

      const notifications = rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        mentionedBy: row.mentioned_by,
        mentionedByName: row.mentioned_by_name,
        mentionedUserId: row.mentioned_user_id,
        contextType: row.context_type,
        contextId: row.context_id,
        contextTitle: row.context_title,
        taskId: row.task_id,
        projectId: row.project_id,
        isRead: row.is_read === 1,
        createdAt: new Date(row.created_at),
        actionUrl: row.action_url
      }));

      res.json({
        success: true,
        data: notifications
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching mention notifications:', error);
    res.status(500).json({ error: 'Failed to fetch mention notifications' });
  }
});

app.post('/api/mention-notifications', authenticateToken, async (req, res) => {
  try {
    const { error, value } = mentionNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const notificationId = uuidv4();
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `
          INSERT INTO mention_notifications (
            id, type, title, message, mentioned_by, mentioned_by_name,
            mentioned_user_id, context_type, context_id, context_title,
            task_id, project_id, is_read, action_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          notificationId,
          value.type,
          value.title,
          value.message,
          value.mentionedBy || null,
          value.mentionedByName || null,
          value.userId,
          value.contextType,
          value.contextId,
          value.contextTitle,
          value.taskId || null,
          value.projectId || null,
          0,
          value.actionUrl || null
        ]
      );

      res.status(201).json({
        success: true,
        data: {
          id: notificationId
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating mention notification:', error);
    res.status(500).json({ error: 'Failed to create mention notification' });
  }
});

app.put('/api/mention-notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `
          UPDATE mention_notifications
          SET is_read = 1
          WHERE id = ? AND mentioned_user_id = ?
        `,
        [req.params.id, req.user.uid]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        success: true
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error marking mention notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.put('/api/mention-notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `
          UPDATE mention_notifications
          SET is_read = 1
          WHERE mentioned_user_id = ? AND is_read = 0
        `,
        [req.user.uid]
      );

      res.json({
        success: true
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error marking all mention notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// ============================================
// BILLING API - External Payment Integration
// ============================================

function getPlanMaxMembers(pricingLevel) {
  if (pricingLevel === 'enterprise') return 100;
  if (pricingLevel === 'office') return 10;
  return 1;
}

function getPublicBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = (forwardedProto ? String(forwardedProto) : req.protocol || 'http').split(',')[0].trim();

  const forwardedHost = req.headers['x-forwarded-host'];
  const host = (forwardedHost ? String(forwardedHost) : req.get('host')).split(',')[0].trim();

  return `${proto}://${host}`;
}

async function applyPaidPlanUpgrade(connection, { orderId, transaction, captureId = null }) {
  const metadata = JSON.parse(transaction.metadata || '{}');
  const pricingLevel = metadata?.pricing_level;
  if (!pricingLevel || !['office', 'enterprise'].includes(pricingLevel)) {
    const err = new Error(`Invalid pricing_level in transaction metadata: ${pricingLevel}`);
    err.code = 'INVALID_METADATA';
    throw err;
  }

  const now = new Date();
  const nextBillingDate = new Date(now);
  nextBillingDate.setDate(nextBillingDate.getDate() + 30);

  // Update transaction (idempotent)
  if (transaction.status !== 'paid') {
    await connection.execute(
      `UPDATE payment_transactions 
       SET status = 'paid', 
           paid_at = NOW(),
           billing_period_start = CURDATE(),
           billing_period_end = ?,
           is_renewal = 1
       WHERE checkout_session_id = ?`,
      [nextBillingDate, orderId]
    );
  }

  // Update company plan
  const planMaxMembers = getPlanMaxMembers(pricingLevel);
  await connection.execute(
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
    [pricingLevel, planMaxMembers, nextBillingDate, transaction.company_id]
  );

  return {
    pricingLevel,
    companyId: transaction.company_id,
    nextBillingDate,
    captureId
  };
}

// Create checkout session for plan upgrade via external PayMongo backend
app.post('/api/billing/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl, paymentMethod } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.uid;
    
    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    if (!plan || !['office', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be office or enterprise' });
    }
    
    // Bill per active user (up to the plan cap)
    const planMaxMembers = getPlanMaxMembers(plan);
    
    // Get user details for customer info
    const connection = await pool.getConnection();
    let customerEmail = '';
    let customerName = '';
    let billableUserCount = 1;
    try {
      const [userRows] = await connection.execute(
        'SELECT email, name FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0) {
        customerEmail = userRows[0].email;
        customerName = userRows[0].name || '';
      }

      const [userCountRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND is_active = 1',
        [companyId]
      );
      const activeUsers = Number(userCountRows[0]?.count || 0);
      billableUserCount = Math.max(1, Math.min(planMaxMembers, activeUsers));
    } finally {
      connection.release();
    }
    
    // Call external PayMongo backend
    const externalApiUrl = process.env.EXTERNAL_PAYMONGO_API_URL || 'https://api.nexistrydigitalsolutions.com';

    const normalizedPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod.trim().toLowerCase() : '';
    const supportedPaymentMethods = new Set([
      'all',
      'gcash',
      'grabpay',
      'maya',
      'shopeepay',
      'bpi',
      'unionbank',
      'dob',
      'dob_ubp',
      'qrph',
      'card'
    ]);
    const paymentMethodToSend = normalizedPaymentMethod && supportedPaymentMethods.has(normalizedPaymentMethod)
      ? normalizedPaymentMethod
      : 'all';
    if (normalizedPaymentMethod && !supportedPaymentMethods.has(normalizedPaymentMethod)) {
      return res.status(400).json({ error: 'Invalid paymentMethod' });
    }
    
    console.log('Calling external PayMongo API:', `${externalApiUrl}/api/clockistry/create-payment-intent`);
    console.log('Request data:', { companyId, userId, plan, userCount: billableUserCount, paymentMethod: paymentMethodToSend });
    
    const response = await axios.post(
      `${externalApiUrl}/api/clockistry/create-payment-intent`,
      {
        companyId: companyId,
        userId: userId,
        plan: plan,
        userCount: billableUserCount,
        paymentMethod: paymentMethodToSend,
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
      const totalAmountUSDCents = Math.round(pricePerUserCents * billableUserCount);
      
      await conn.execute(
        `INSERT INTO payment_transactions 
         (id, company_id, checkout_session_id, amount, currency, status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          data.transactionId,
          companyId,
          data.checkoutSessionId,
          totalAmountUSDCents,
          'USD',
          'pending',
          JSON.stringify({
            pricing_level: plan,
            user_count: billableUserCount,
            price_per_user: pricePerUserCents,
            source: 'clockistry',
            amount_php_centavos: data.amount,
            currency_php: data.currency,
            checkout_session_id: data.checkoutSessionId,
            internal_transaction_id: data.transactionId,
            payment_method: paymentMethodToSend
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
    return res.status(400).json({
      error: 'Seat add-ons are not supported. NexiFlow bills per active user per month up to your plan limit (Office: 10, Enterprise: 100).'
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

// Webhook handler for payment events from external backend
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

    // Expected format from external backend: { eventType, checkoutSessionId, metadata, status }
    const isExternalBackendFormat = payload.eventType !== undefined && payload.metadata !== undefined;
    
    if (!isExternalBackendFormat) {
      console.error('Unknown webhook format - expected external backend format');
      return res.status(200).json({ received: true, warning: 'Unknown format' });
    }
    
    console.log('Processing external backend webhook');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    const { eventType, checkoutSessionId, metadata, status } = payload;

    console.log('Extracted values:', { eventType, checkoutSessionId, metadata, status });

    const eventTypeStr = String(eventType || '');

    // Handle payment success
    if (eventTypeStr.includes('paid')) {
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

        // Seat add-ons are deprecated; always reset the plan cap based on pricing level.
        const planMaxMembers = getPlanMaxMembers(pricingLevel);

        console.log('Updating company plan and billing dates:', { companyId, pricingLevel, planMaxMembers, nextBillingDate });
        
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
          [pricingLevel, planMaxMembers, nextBillingDate, companyId]
        );

        console.log('Company update result:', { affectedRows: companyResult?.affectedRows });

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
    else if (eventTypeStr.includes('failed') || String(status || '').includes('failed')) {
      console.log('Processing payment failure for:', checkoutSessionId);
      
      if (checkoutSessionId) {
        const connection = await pool.getConnection();
        try {
          const [result] = await connection.execute(
            `UPDATE payment_transactions 
             SET status = 'failed'
             WHERE checkout_session_id = ?`,
            [checkoutSessionId]
          );
          console.log('Failed status update result:', { affectedRows: result?.affectedRows });
        } finally {
          connection.release();
        }
      }
    } 
    // Handle cancellation / expiry
    else if (eventTypeStr.includes('cancel') || eventTypeStr.includes('expired')) {
      console.log('Processing checkout cancellation/expiry for:', checkoutSessionId);

      if (checkoutSessionId) {
        const connection = await pool.getConnection();
        try {
          const [result] = await connection.execute(
            `UPDATE payment_transactions 
             SET status = 'cancelled'
             WHERE checkout_session_id = ?`,
            [checkoutSessionId]
          );
          console.log('Cancelled/expired status update result:', { affectedRows: result?.affectedRows });
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

// Webhook endpoint for external payment backend
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handlePaymongoWebhook);

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

// ============================================
// PAYPAL PAYMENT ENDPOINTS
// ============================================

// Create PayPal order for plan upgrade or seat purchase
app.post('/api/billing/create-paypal-order', authenticateToken, async (req, res) => {
  try {
    const { plan, additionalSeats, successUrl, cancelUrl } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.uid;
    
    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }
    
    // Check PayPal configuration
    const paypalClient = getPayPalClient();
    if (!paypalClient) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    
    // Validate either plan upgrade or seat purchase
    const isPlanUpgrade = plan && ['office', 'enterprise'].includes(plan);
    const isSeatPurchase = additionalSeats && parseInt(additionalSeats) >= 1;
    
    if (!isPlanUpgrade && !isSeatPurchase) {
      return res.status(400).json({ error: 'Invalid request. Must provide plan (office/enterprise) or additionalSeats' });
    }

    if (isSeatPurchase) {
      return res.status(400).json({
        error: 'Seat add-ons are not supported. NexiFlow bills per active user per month up to your plan limit (Office: 10, Enterprise: 100).'
      });
    }
    
    // Only super_admin can purchase seats
    if (isSeatPurchase && req.user.role !== 'super_admin' && req.user.role !== 'root') {
      return res.status(403).json({ error: 'Only super admins can purchase additional seats' });
    }
    
    // Get user and company details
    const connection = await pool.getConnection();
    let customerEmail = '';
    let customerName = '';
    let companyPricingLevel = plan;
    let unitAmount = 0;
    let quantity = 1;
    let description = '';
    
    try {
      const [userRows] = await connection.execute(
        'SELECT email, name FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0) {
        customerEmail = userRows[0].email;
        customerName = userRows[0].name || '';
      }

      // Plan upgrade (billed per active user up to plan cap)
      unitAmount = plan === 'office' ? 9 : 12;
      const planMaxMembers = getPlanMaxMembers(plan);

      const [userCountRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND is_active = 1',
        [companyId]
      );
      const activeUsers = Number(userCountRows[0]?.count || 0);
      quantity = Math.max(1, Math.min(planMaxMembers, activeUsers));
      description = `${plan} plan (${quantity} user${quantity !== 1 ? 's' : ''})`;
    } finally {
      connection.release();
    }
    
    // Calculate total
    const totalAmount = unitAmount * quantity;

    const publicBaseUrl = getPublicBaseUrl(req);
    const backendReturnUrl = `${publicBaseUrl}/api/billing/paypal-return`;
    const frontendCancelUrl = cancelUrl || `${publicBaseUrl}/billing/paypal-cancel`;
    
    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: totalAmount.toString(),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: totalAmount.toString()
            }
          }
        },
        description: description,
        custom_id: companyId,
        invoice_id: `TXN-${uuidv4()}`,
        items: [{
          name: description,
          quantity: quantity.toString(),
          unit_amount: {
            currency_code: 'USD',
            value: unitAmount.toString()
          }
        }]
      }],
      application_context: {
        brand_name: 'NexiFlow',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        // Use a backend return handler so we can capture+upgrade server-side even if SPA routing/storage is flaky.
        return_url: process.env.PAYPAL_RETURN_URL || backendReturnUrl,
        cancel_url: frontendCancelUrl
      },
      payer: {
        email_address: customerEmail,
        name: {
          given_name: customerName.split(' ')[0] || '',
          surname: customerName.split(' ').slice(1).join(' ') || ''
        }
      }
    });
    
    const order = await paypalClient.execute(request);
    
    // Store transaction in local database
    const transactionId = uuidv4();
    const conn = await pool.getConnection();
    try {
      const metadata = {
        payment_provider: 'paypal',
        pricing_level: plan,
        user_count: quantity,
        type: 'plan_upgrade',
        additional_seats: null,
        price_per_user: unitAmount * 100, // Store in cents for consistency
        paypal_order_id: order.result.id
      };
      
      await conn.execute(
        `INSERT INTO payment_transactions 
         (id, company_id, checkout_session_id, amount, currency, status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          transactionId,
          companyId,
          order.result.id, // Use PayPal order ID as checkout_session_id
          totalAmount * 100, // Store in cents
          'USD',
          'pending',
          JSON.stringify(metadata)
        ]
      );
    } finally {
      conn.release();
    }
    
    // Find the approval URL
    const approvalLink = order.result.links.find(link => link.rel === 'approve');
    
    res.json({
      success: true,
      orderId: order.result.id,
      transactionId: transactionId,
      approvalUrl: approvalLink ? approvalLink.href : null,
      amount: totalAmount,
      currency: 'USD'
    });
    
  } catch (error) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({ error: 'Failed to create PayPal order: ' + (error.message || 'Unknown error') });
  }
});

// PayPal return handler (server-side): capture + apply plan upgrade, then redirect to the frontend.
// This makes upgrades robust even if the SPA route/component does not run after PayPal redirects back.
app.get('/api/billing/paypal-return', async (req, res) => {
  const orderId = req.query?.token ? String(req.query.token) : null;
  const publicBaseUrl = getPublicBaseUrl(req);

  if (!orderId) {
    return res.redirect(`${publicBaseUrl}/upgrade?billing=paypal_error&reason=missing_token`);
  }

  const paypalClient = getPayPalClient();
  if (!paypalClient) {
    return res.redirect(`${publicBaseUrl}/upgrade?billing=paypal_error&reason=paypal_not_configured`);
  }

  const connection = await pool.getConnection();
  try {
    const [txRows] = await connection.execute(
      'SELECT * FROM payment_transactions WHERE checkout_session_id = ? LIMIT 1',
      [orderId]
    );

    if (!txRows.length) {
      return res.redirect(`${publicBaseUrl}/upgrade?billing=paypal_error&reason=transaction_not_found`);
    }

    const transaction = txRows[0];

    // Capture the order (idempotent)
    let captureId = null;
    let captureStatus = null;
    if (transaction.status !== 'paid') {
      try {
        const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
        captureRequest.requestBody({});
        const capture = await paypalClient.execute(captureRequest);
        captureStatus = capture?.result?.status || null;
        captureId = capture?.result?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
      } catch (captureError) {
        const msg = (captureError && (captureError.message || captureError.toString())) || '';
        const isAlreadyCaptured =
          msg.includes('ORDER_ALREADY_CAPTURED') ||
          msg.includes('ORDER_ALREADY_COMPLETED') ||
          msg.includes('ORDER_ALREADY_PROCESSED');
        if (!isAlreadyCaptured) {
          console.error('PayPal return capture error:', captureError);
          return res.redirect(`${publicBaseUrl}/upgrade?billing=paypal_error&reason=capture_failed`);
        }
        captureStatus = 'COMPLETED';
      }
    } else {
      captureStatus = 'COMPLETED';
    }

    if (captureStatus && captureStatus !== 'COMPLETED') {
      return res.redirect(`${publicBaseUrl}/upgrade?billing=paypal_error&reason=not_completed`);
    }

    const result = await applyPaidPlanUpgrade(connection, { orderId, transaction, captureId });
    return res.redirect(
      `${publicBaseUrl}/settings?billing=paypal_success&plan=${encodeURIComponent(result.pricingLevel)}&orderId=${encodeURIComponent(orderId)}`
    );
  } catch (error) {
    console.error('PayPal return handler error:', error);
    return res.redirect(`${publicBaseUrl}/upgrade?billing=paypal_error&reason=server_error`);
  } finally {
    connection.release();
  }
});

// Capture PayPal order after user approval
app.post('/api/billing/capture-paypal-order', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }
    
    // Check PayPal configuration
    const paypalClient = getPayPalClient();
    if (!paypalClient) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }

    // Get transaction details from database (and handle idempotency)
    const connection = await pool.getConnection();
    try {
      const [txRows] = await connection.execute(
        'SELECT * FROM payment_transactions WHERE checkout_session_id = ? LIMIT 1',
        [orderId]
      );
      
      if (txRows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      const transaction = txRows[0];
      const transactionCompanyId = transaction.company_id || null;
      const metadata = JSON.parse(transaction.metadata || '{}');

      // Authorization: only allow capturing/updating for your own company (root exempt).
      if (req.user.role !== 'root') {
        if (!req.user.companyId) {
          return res.status(400).json({ error: 'User must belong to a company' });
        }
        if (!transactionCompanyId || String(req.user.companyId) !== String(transactionCompanyId)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const pricingLevel = metadata?.pricing_level;
      if (!pricingLevel || !['office', 'enterprise'].includes(pricingLevel)) {
        return res.status(400).json({ error: 'Invalid transaction metadata: pricing_level must be office or enterprise' });
      }

      if (!transactionCompanyId) {
        return res.status(500).json({ error: 'Transaction is missing company_id; cannot apply upgrade' });
      }

      // Capture the order (may already be captured; treat as success and continue DB updates)
      let captureId = null;
      let captureStatus = null;
      if (transaction.status !== 'paid') {
        try {
          const request = new paypal.orders.OrdersCaptureRequest(orderId);
          request.requestBody({});
          const capture = await paypalClient.execute(request);
          captureStatus = capture?.result?.status || null;
          captureId = capture?.result?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
        } catch (captureError) {
          const msg = (captureError && (captureError.message || captureError.toString())) || '';
          const isAlreadyCaptured =
            msg.includes('ORDER_ALREADY_CAPTURED') ||
            msg.includes('ORDER_ALREADY_COMPLETED') ||
            msg.includes('ORDER_ALREADY_PROCESSED');
          if (!isAlreadyCaptured) {
            console.error('PayPal capture execute error:', captureError);
            return res.status(500).json({ error: 'Failed to capture PayPal payment: ' + (captureError.message || 'Unknown error') });
          }
          captureStatus = 'COMPLETED';
        }
      } else {
        captureStatus = 'COMPLETED';
      }

      if (captureStatus && captureStatus !== 'COMPLETED') {
        return res.status(400).json({ error: 'Payment not completed', status: captureStatus });
      }

      const upgradeResult = await applyPaidPlanUpgrade(connection, { orderId, transaction, captureId });
      
      res.json({
        success: true,
        message: transaction.status === 'paid' ? 'Payment already processed' : 'Payment captured successfully',
        alreadyProcessed: transaction.status === 'paid',
        orderId,
        captureId: upgradeResult.captureId,
        companyId: upgradeResult.companyId,
        pricingLevel: upgradeResult.pricingLevel
      });
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ error: 'Failed to capture PayPal payment: ' + (error.message || 'Unknown error') });
  }
});

// PayPal webhook handler (for async payment notifications)
app.post('/api/billing/paypal-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('=== PAYPAL WEBHOOK RECEIVED ===');
    
    // Parse the body
    const rawBodyBuffer = req.rawBody
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    const rawBodyString = rawBodyBuffer.toString('utf8');
    
    let payload;
    try {
      payload = JSON.parse(rawBodyString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(200).json({ received: true, error: 'Invalid JSON' });
    }
    
    console.log('PayPal webhook payload:', JSON.stringify(payload, null, 2));
    
    const { event_type, resource } = payload;

    const getOrderIdFromPayPalWebhook = () => {
      if (!resource) return null;

      // PayPal event payloads vary by event_type.
      if (event_type === 'CHECKOUT.ORDER.APPROVED') {
        return resource.id || resource.order_id || null;
      }

      if (event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        // In capture events, resource.id is typically the CAPTURE id, not the ORDER id.
        return (
          resource?.supplementary_data?.related_ids?.order_id ||
          resource?.supplementary_data?.related_ids?.orderID ||
          resource?.order_id ||
          null
        );
      }

      return resource.id || resource.order_id || null;
    };
    
    // Handle payment capture completed
    if (event_type === 'CHECKOUT.ORDER.APPROVED' || event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = getOrderIdFromPayPalWebhook();
      
      if (!orderId) {
        console.log('No order ID in webhook payload');
        return res.status(200).json({ received: true, warning: 'No order ID' });
      }
      
      const connection = await pool.getConnection();
      try {
        // Find the transaction
        const [txRows] = await connection.execute(
          'SELECT * FROM payment_transactions WHERE checkout_session_id = ? LIMIT 1',
          [orderId]
        );
        
        if (txRows.length === 0) {
          console.log('Transaction not found or already processed:', orderId);
          return res.status(200).json({ received: true, warning: 'Transaction not found' });
        }
        
        const transaction = txRows[0];
        const metadata = JSON.parse(transaction.metadata || '{}');
        const pricingLevel = metadata?.pricing_level;
        if (!pricingLevel || !['office', 'enterprise'].includes(pricingLevel)) {
          console.log('Invalid pricing_level in transaction metadata:', pricingLevel);
          return res.status(200).json({ received: true, warning: 'Invalid metadata' });
        }

        await applyPaidPlanUpgrade(connection, { orderId, transaction });
        console.log('=== PAYPAL WEBHOOK PROCESSED ===', { orderId, companyId: transaction.company_id });
      } finally {
        connection.release();
      }
    }
    
    // Handle payment failures
    if (event_type === 'PAYMENT.CAPTURE.DENIED' || event_type === 'CHECKOUT.ORDER.DECLINED') {
      const orderId = resource.id || resource.order_id;
      
      if (orderId) {
        const connection = await pool.getConnection();
        try {
          await connection.execute(
            `UPDATE payment_transactions 
             SET status = 'failed', failed_at = NOW()
             WHERE checkout_session_id = ?`,
            [orderId]
          );
        } finally {
          connection.release();
        }
      }
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return res.status(200).json({ received: true, error: error.message });
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

// ============================================
// TIME ENTRY REMINDERS - Background tasks
// ============================================

// Send reminder emails for running timers (every 12 hours while still running).
// This should be called by a cron job (recommended hourly) and is protected via ROOT_API_KEY.
app.post('/api/time-entries/send-running-timer-reminders', async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    const rootApiKey = process.env.ROOT_API_KEY;

    if (!rootApiKey || apiKey !== rootApiKey) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    try {
      const [runningRows] = await connection.execute(
        `SELECT id, user_id, company_id, project_name, client_name, description, start_time, timer_reminder_sent_at
         FROM time_entries
         WHERE is_running = 1
         AND company_id IS NOT NULL
         AND TIMESTAMPDIFF(HOUR, start_time, NOW()) >= 12
         AND (
           timer_reminder_sent_at IS NULL
           OR TIMESTAMPDIFF(HOUR, timer_reminder_sent_at, NOW()) >= 12
         )`
      );

      const processed = [];
      const skipped = [];
      const failed = [];

      for (const entry of runningRows) {
        try {
          const companyId = entry.company_id;
          const userId = entry.user_id;

          const [companyRows] = await connection.execute(
            `SELECT id, name FROM companies WHERE id = ? LIMIT 1`,
            [companyId]
          );
          if (!companyRows?.length) {
            skipped.push({ timeEntryId: entry.id, reason: 'Company not found' });
            continue;
          }

          const [userRows] = await connection.execute(
            `SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1`,
            [userId]
          );
          if (!userRows?.length) {
            skipped.push({ timeEntryId: entry.id, reason: 'Timer owner not found' });
            continue;
          }

          const company = companyRows[0];
          const timerOwner = userRows[0];

          const [superAdminRows] = await connection.execute(
            `SELECT email
             FROM users
             WHERE company_id = ?
             AND role = 'super_admin'
             AND is_active = 1
             AND email IS NOT NULL
             AND email != ''`,
            [companyId]
          );

          const recipients = new Set();
          if (timerOwner?.email) recipients.add(timerOwner.email);
          for (const admin of superAdminRows) {
            if (admin?.email) recipients.add(admin.email);
          }

          const recipientList = Array.from(recipients);
          if (recipientList.length === 0) {
            skipped.push({ timeEntryId: entry.id, reason: 'No recipients' });
            continue;
          }

          const emailResult = await billingEmailService.sendRunningTimerReminder({
            company,
            timerOwner,
            timeEntry: entry,
            recipients: recipientList
          });

          if (!emailResult?.success) {
            failed.push({ timeEntryId: entry.id, error: emailResult?.error || 'Email send failed' });
            continue;
          }

          await connection.execute(
            `UPDATE time_entries SET timer_reminder_sent_at = NOW() WHERE id = ?`,
            [entry.id]
          );

          processed.push({
            timeEntryId: entry.id,
            companyId,
            userId,
            recipients: recipientList
          });
        } catch (err) {
          failed.push({ timeEntryId: entry?.id, error: err?.message || 'Unknown error' });
        }
      }

      res.json({
        success: true,
        message: 'Running timer reminders processed',
        data: {
          eligibleCount: runningRows.length,
          processedCount: processed.length,
          skippedCount: skipped.length,
          failedCount: failed.length,
          processed,
          skipped,
          failed
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error sending running timer reminders:', error);
    res.status(500).json({ success: false, error: 'Failed to send running timer reminders' });
  }
});

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
