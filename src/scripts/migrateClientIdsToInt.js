import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pool = require('../config/db');

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function foreignKeyNames(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT CONSTRAINT_NAME 
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ? 
       AND COLUMN_NAME = ? 
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [tableName, columnName]
  );
  return rows.map(r => r.CONSTRAINT_NAME);
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function migrate() {
  const connection = await pool.getConnection();

  console.log('Starting migration: Convert clients.id to INT and update references...');
  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();

    // 1) Ensure clients.id_int exists
    const hasClientsIdInt = await columnExists(connection, 'clients', 'id_int');
    if (!hasClientsIdInt) {
      console.log('Adding clients.id_int INT AUTO_INCREMENT UNIQUE...');
      await connection.execute(
        `ALTER TABLE clients ADD COLUMN id_int INT NOT NULL AUTO_INCREMENT UNIQUE`
      );
    } else {
      console.log('clients.id_int already exists, skipping add.');
    }

    // 2) Create client_id_map and backfill
    const hasMap = await tableExists(connection, 'client_id_map');
    if (!hasMap) {
      console.log('Creating client_id_map...');
      await connection.execute(
        `CREATE TABLE client_id_map (
           old_id VARCHAR(255) PRIMARY KEY,
           new_id INT UNIQUE
         )`
      );
      console.log('Backfilling client_id_map from clients...');
      await connection.execute(
        `INSERT INTO client_id_map (old_id, new_id)
         SELECT id, id_int FROM clients`
      );
    } else {
      console.log('client_id_map already exists, ensuring populated...');
      await connection.execute(
        `INSERT IGNORE INTO client_id_map (old_id, new_id)
         SELECT id, id_int FROM clients`
      );
    }

    // 3) Add client_id_int to projects and time_entries
    const hasProjClientInt = await columnExists(connection, 'projects', 'client_id_int');
    if (!hasProjClientInt) {
      console.log('Adding projects.client_id_int INT...');
      await connection.execute(`ALTER TABLE projects ADD COLUMN client_id_int INT NULL`);
    }
    const hasTeClientInt = await columnExists(connection, 'time_entries', 'client_id_int');
    if (!hasTeClientInt) {
      console.log('Adding time_entries.client_id_int INT...');
      await connection.execute(`ALTER TABLE time_entries ADD COLUMN client_id_int INT NULL`);
    }

    // 4) Backfill integer references
    console.log('Backfilling projects.client_id_int from client_id_map...');
    await connection.execute(
      `UPDATE projects p
       JOIN client_id_map m ON p.client_id = m.old_id
       SET p.client_id_int = m.new_id`
    );
    console.log('Backfilling time_entries.client_id_int from client_id_map...');
    await connection.execute(
      `UPDATE time_entries t
       JOIN client_id_map m ON t.client_id = m.old_id
       SET t.client_id_int = m.new_id`
    );

    // 5) Swap projects client_id
    console.log('Swapping projects.client_id to INT...');
    // Drop FK(s) if any
    const projFkNames = await foreignKeyNames(connection, 'projects', 'client_id');
    for (const fk of projFkNames) {
      console.log(`Dropping projects FK ${fk}...`);
      await connection.execute(`ALTER TABLE projects DROP FOREIGN KEY \`${fk}\``);
    }
    // Drop index if present
    const hasProjIdx = await indexExists(connection, 'projects', 'idx_projects_client');
    if (hasProjIdx) {
      console.log('Dropping projects idx_projects_client...');
      await connection.execute(`ALTER TABLE projects DROP INDEX idx_projects_client`);
    }
    // Swap column
    await connection.execute(`ALTER TABLE projects DROP COLUMN client_id`);
    await connection.execute(`ALTER TABLE projects CHANGE COLUMN client_id_int client_id INT NULL`);
    // Recreate index and FK
    console.log('Recreating projects client index and FK...');
    await connection.execute(`ALTER TABLE projects ADD KEY idx_projects_client (client_id)`);
    await connection.execute(
      `ALTER TABLE projects 
       ADD CONSTRAINT fk_projects_client 
       FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`
    );

    // 6) Swap time_entries client_id
    console.log('Swapping time_entries.client_id to INT...');
    const teFkNames = await foreignKeyNames(connection, 'time_entries', 'client_id');
    for (const fk of teFkNames) {
      console.log(`Dropping time_entries FK ${fk}...`);
      await connection.execute(`ALTER TABLE time_entries DROP FOREIGN KEY \`${fk}\``);
    }
    const hasTeIdx = await indexExists(connection, 'time_entries', 'idx_time_entries_client');
    if (hasTeIdx) {
      console.log('Dropping time_entries idx_time_entries_client...');
      await connection.execute(`ALTER TABLE time_entries DROP INDEX idx_time_entries_client`);
    }
    await connection.execute(`ALTER TABLE time_entries DROP COLUMN client_id`);
    await connection.execute(`ALTER TABLE time_entries CHANGE COLUMN client_id_int client_id INT NULL`);
    console.log('Recreating time_entries client index and FK...');
    await connection.execute(`ALTER TABLE time_entries ADD KEY idx_time_entries_client (client_id)`);
    await connection.execute(
      `ALTER TABLE time_entries 
       ADD CONSTRAINT fk_time_entries_client 
       FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`
    );

    // 7) Make clients.id the INT primary key
    console.log('Promoting clients.id_int to primary key...');
    // Drop PK
    await connection.execute(`ALTER TABLE clients DROP PRIMARY KEY`);
    // Rename original id to id_varchar (nullable)
    const hasIdVarchar = await columnExists(connection, 'clients', 'id_varchar');
    if (!hasIdVarchar) {
      await connection.execute(`ALTER TABLE clients CHANGE COLUMN id id_varchar VARCHAR(255) NULL`);
    }
    // Rename id_int to id and make it the PK with AUTO_INCREMENT
    await connection.execute(`ALTER TABLE clients CHANGE COLUMN id_int id INT NOT NULL`);
    await connection.execute(`ALTER TABLE clients ADD PRIMARY KEY (id)`);
    await connection.execute(`ALTER TABLE clients MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`);
    // Recreate helpful indexes
    const hasClientsCompanyIdx = await indexExists(connection, 'clients', 'idx_clients_company');
    if (!hasClientsCompanyIdx) {
      await connection.execute(`ALTER TABLE clients ADD KEY idx_clients_company (company_id)`);
    }
    const hasClientsCreatedByIdx = await indexExists(connection, 'clients', 'created_by');
    if (!hasClientsCreatedByIdx) {
      await connection.execute(`ALTER TABLE clients ADD KEY created_by (created_by)`);
    }

    await connection.commit();
    console.log('Migration committed successfully.');

    // 8) Post-migration tests
    console.log('Running post-migration tests...');
    // Insert test client
    const now = new Date();
    const [clientResult] = await connection.execute(
      `INSERT INTO clients (name, email, country, timezone, client_type, hourly_rate, is_archived, created_by, company_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        '___migration_test_client___',
        'migration@test.local',
        'United States',
        'America/New_York',
        'full-time',
        25,
        0,
        null,
        null,
        now,
        now
      ]
    );
    const insertedClientId = clientResult.insertId;
    console.log(`Inserted test client with auto-increment id: ${insertedClientId}`);

    // Insert test time entry referencing client_id
    const { v4: uuidv4 } = require('uuid');
    const timeEntryId = uuidv4();
    await connection.execute(
      `INSERT INTO time_entries (id, user_id, project_id, project_name, client_id, client_name, description, start_time, duration, is_running, is_billable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timeEntryId,
        null,
        null,
        null,
        insertedClientId,
        '___migration_test_client___',
        'Migration test entry',
        now,
        60,
        0,
        0,
        now,
        now
      ]
    );
    const [checkRows] = await connection.execute(
      `SELECT client_id FROM time_entries WHERE id = ?`,
      [timeEntryId]
    );
    console.log('Inserted time entry client_id:', checkRows[0]?.client_id);

    console.log('Post-migration tests completed.');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  } catch (err) {
    console.error('Migration failed, rolling back:', err?.message || err);
    try {
      await connection.rollback();
    } catch (e) {
      console.error('Rollback failed:', e?.message || e);
    }
    try {
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    } catch {}
    process.exit(1);
  } finally {
    connection.release();
  }
}

migrate().then(() => {
  console.log('Client ID migration complete.');
  process.exit(0);
});
