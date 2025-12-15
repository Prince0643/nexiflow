import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pool = require('../config/db');

async function initDatabase() {
  const connection = await pool.getConnection();
  
  try {
    // Create companies table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        pricing_level ENUM('solo', 'office', 'enterprise') DEFAULT 'solo',
        max_members INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create company_pdf_settings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS company_pdf_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        logo_url TEXT,
        primary_color VARCHAR(7) DEFAULT '#3B82F6',
        secondary_color VARCHAR(7) DEFAULT '#1E40AF',
        show_powered_by BOOLEAN DEFAULT TRUE,
        custom_footer_text TEXT,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_company_pdf (company_id)
      )
    `);

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role ENUM('employee', 'hr', 'admin', 'super_admin', 'root') NOT NULL,
        company_id VARCHAR(255),
        team_id VARCHAR(255),
        team_role ENUM('member', 'leader'),
        avatar TEXT,
        timezone VARCHAR(100) DEFAULT 'GMT+0 (Greenwich Mean Time)',
        hourly_rate DECIMAL(10, 2) DEFAULT 25.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    // Create clients table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        country VARCHAR(100),
        timezone VARCHAR(100),
        client_type ENUM('full-time', 'part-time', 'custom', 'gig') DEFAULT 'full-time',
        hourly_rate DECIMAL(10, 2) DEFAULT 25.00,
        hours_per_week INT,
        start_date DATE,
        end_date DATE,
        phone VARCHAR(50),
        company VARCHAR(255),
        address TEXT,
        currency VARCHAR(10),
        is_archived BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        company_id VARCHAR(255),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    // Create projects table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#3B82F6',
        status ENUM('active', 'on-hold', 'completed', 'cancelled') DEFAULT 'active',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        start_date DATE,
        end_date DATE,
        budget DECIMAL(12, 2),
        client_id VARCHAR(255),
        client_name VARCHAR(255),
        is_archived BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        company_id VARCHAR(255),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    // Create time_entries table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        company_id VARCHAR(255),
        project_id VARCHAR(255),
        project_name VARCHAR(255),
        client_id VARCHAR(255),
        client_name VARCHAR(255),
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INT NOT NULL,
        is_running BOOLEAN DEFAULT FALSE,
        is_billable BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    // Create time_entry_tags table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS time_entry_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        time_entry_id VARCHAR(255) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE
      )
    `);

    // Create teams table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        leader_id VARCHAR(255),
        leader_name VARCHAR(255),
        leader_email VARCHAR(255),
        color VARCHAR(7) DEFAULT '#3B82F6',
        company_id VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        member_count INT DEFAULT 0,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    // Create team_members table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS team_members (
        id VARCHAR(255) PRIMARY KEY,
        team_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        team_role ENUM('member', 'leader') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create tasks table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        notes TEXT,
        project_id VARCHAR(255) NOT NULL,
        project_name VARCHAR(255),
        status_id VARCHAR(50),
        status_name VARCHAR(50),
        status_color VARCHAR(7),
        status_order INT,
        status_is_completed BOOLEAN,
        priority_id VARCHAR(50),
        priority_name VARCHAR(50),
        priority_color VARCHAR(7),
        priority_level INT,
        assignee_id VARCHAR(255),
        assignee_name VARCHAR(255),
        assignee_email VARCHAR(255),
        due_date DATE,
        estimated_hours DECIMAL(8, 2),
        actual_hours DECIMAL(8, 2),
        is_completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP NULL,
        created_by VARCHAR(255) NOT NULL,
        created_by_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        parent_task_id VARCHAR(255),
        team_id VARCHAR(255),
        company_id VARCHAR(255),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    // Create task_tags table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS task_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(255) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Create task_attachments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        type VARCHAR(100),
        size INT,
        uploaded_by VARCHAR(255),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create task_comments table
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
        parent_comment_id VARCHAR(255),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_comment_id) REFERENCES task_comments(id) ON DELETE SET NULL
      )
    `);

    // Create comment_mentions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS comment_mentions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comment_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create task_time_entries table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS task_time_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(255) NOT NULL,
        time_entry_id VARCHAR(255) NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE,
        UNIQUE KEY unique_task_time_entry (task_id, time_entry_id)
      )
    `);

    // Create indexes for better performance
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_time_entries_client ON time_entries(client_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_time_entries_company ON time_entries(company_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_teams_company ON teams(company_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id)');

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    connection.release();
  }
}

// Run the initialization
initDatabase();