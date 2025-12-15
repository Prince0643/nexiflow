#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the Firebase export data
const firebaseDataPath = path.join(__dirname, '..', '..', 'time-tracker-system-d5cca-default-rtdb-export.json');
const firebaseData = JSON.parse(fs.readFileSync(firebaseDataPath, 'utf8'));

// MySQL connection configuration
const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'clockistry',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function migrateCompanies(connection, companies) {
  console.log('Migrating companies...');
  const companiesArray = Object.entries(companies || {}).map(([id, company]) => [
    id,
    company.name,
    company.isActive !== undefined ? company.isActive : true,
    company.pricingLevel || 'solo',
    company.maxMembers || 1,
    company.createdAt ? new Date(company.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    company.updatedAt ? new Date(company.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null
  ]);

  if (companiesArray.length > 0) {
    const insertSql = `
      INSERT INTO companies (id, name, is_active, pricing_level, max_members, created_at, updated_at)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        is_active = VALUES(is_active),
        pricing_level = VALUES(pricing_level),
        max_members = VALUES(max_members),
        updated_at = VALUES(updated_at)
    `;
    
    await connection.query(insertSql, [companiesArray]);
    console.log(`Migrated ${companiesArray.length} companies`);
  }
}

async function migrateUsers(connection, users, companies) {
  console.log('Migrating users...');
  const usersArray = Object.entries(users || {}).map(([id, user]) => [
    id,
    user.uid || id,
    user.name,
    user.email,
    user.role || 'employee',
    user.companyId && companies[user.companyId] ? user.companyId : null, // Only set company_id if it exists in companies table
    user.teamId || null,
    user.teamRole || null,
    user.avatar || null,
    user.timezone || 'GMT+0 (Greenwich Mean Time)',
    user.hourlyRate !== undefined ? user.hourlyRate : 25.00,
    user.isActive !== undefined ? user.isActive : true,
    user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    user.updatedAt ? new Date(user.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null
  ]);

  if (usersArray.length > 0) {
    const insertSql = `
      INSERT INTO users (id, uid, name, email, role, company_id, team_id, team_role, avatar, timezone, hourly_rate, is_active, created_at, updated_at)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        uid = VALUES(uid),
        name = VALUES(name),
        email = VALUES(email),
        role = VALUES(role),
        company_id = VALUES(company_id),
        team_id = VALUES(team_id),
        team_role = VALUES(team_role),
        avatar = VALUES(avatar),
        timezone = VALUES(timezone),
        hourly_rate = VALUES(hourly_rate),
        is_active = VALUES(is_active),
        updated_at = VALUES(updated_at)
    `;
    
    await connection.query(insertSql, [usersArray]);
    console.log(`Migrated ${usersArray.length} users`);
  }
}

async function migrateClients(connection, clients, companies) {
  console.log('Migrating clients...');
  const clientsArray = Object.entries(clients || {}).map(([id, client]) => [
    id,
    client.name,
    client.email || null,
    client.country || null,
    client.timezone || null,
    client.clientType || 'full-time',
    client.hourlyRate !== undefined ? client.hourlyRate : 25.00,
    client.hoursPerWeek || null,
    client.startDate ? new Date(client.startDate).toISOString().slice(0, 19).replace('T', ' ') : null,
    client.endDate ? new Date(client.endDate).toISOString().slice(0, 19).replace('T', ' ') : null,
    client.phone || null,
    client.company || null,
    client.address || null,
    client.currency || null,
    client.isArchived !== undefined ? client.isArchived : false,
    client.createdBy || null,
    client.createdAt ? new Date(client.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    client.updatedAt ? new Date(client.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    client.companyId && companies[client.companyId] ? client.companyId : null // Only set company_id if it exists in companies table
  ]);

  if (clientsArray.length > 0) {
    const insertSql = `
      INSERT INTO clients (
        id, name, email, country, timezone, client_type, hourly_rate, hours_per_week,
        start_date, end_date, phone, company, address, currency, is_archived,
        created_by, created_at, updated_at, company_id
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        country = VALUES(country),
        timezone = VALUES(timezone),
        client_type = VALUES(client_type),
        hourly_rate = VALUES(hourly_rate),
        hours_per_week = VALUES(hours_per_week),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        phone = VALUES(phone),
        company = VALUES(company),
        address = VALUES(address),
        currency = VALUES(currency),
        is_archived = VALUES(is_archived),
        created_by = VALUES(created_by),
        updated_at = VALUES(updated_at),
        company_id = VALUES(company_id)
    `;
    
    await connection.query(insertSql, [clientsArray]);
    console.log(`Migrated ${clientsArray.length} clients`);
  }
}

async function migrateProjects(connection, projects, companies) {
  console.log('Migrating projects...');
  const projectsArray = Object.entries(projects || {}).map(([id, project]) => [
    id,
    project.name,
    project.description || null,
    project.color || '#3B82F6',
    project.status || 'active',
    project.priority || 'medium',
    project.startDate ? new Date(project.startDate).toISOString().slice(0, 19).replace('T', ' ') : null,
    project.endDate ? new Date(project.endDate).toISOString().slice(0, 19).replace('T', ' ') : null,
    project.budget !== undefined ? project.budget : null,
    project.clientId || null,
    project.clientName || null,
    project.isArchived !== undefined ? project.isArchived : false,
    project.createdBy,
    project.createdAt ? new Date(project.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    project.updatedAt ? new Date(project.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    project.companyId && companies[project.companyId] ? project.companyId : null // Only set company_id if it exists in companies table
  ]);

  if (projectsArray.length > 0) {
    const insertSql = `
      INSERT INTO projects (
        id, name, description, color, status, priority, start_date, end_date,
        budget, client_id, client_name, is_archived, created_by, created_at, updated_at, company_id
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        color = VALUES(color),
        status = VALUES(status),
        priority = VALUES(priority),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        budget = VALUES(budget),
        client_id = VALUES(client_id),
        client_name = VALUES(client_name),
        is_archived = VALUES(is_archived),
        created_by = VALUES(created_by),
        updated_at = VALUES(updated_at),
        company_id = VALUES(company_id)
    `;
    
    await connection.query(insertSql, [projectsArray]);
    console.log(`Migrated ${projectsArray.length} projects`);
  }
}

async function migrateTimeEntries(connection, timeEntries, companies, clients, projects, users) {
  console.log('Migrating time entries...');
  // Filter time entries to only include those with valid references
  const validTimeEntries = {};
  for (const [id, entry] of Object.entries(timeEntries || {})) {
    // Check if required references exist
    const hasValidUser = entry.userId && users[entry.userId];
    const hasValidCompany = !entry.companyId || companies[entry.companyId];
    const hasValidProject = !entry.projectId || projects[entry.projectId];
    const hasValidClient = !entry.clientId || clients[entry.clientId];
    
    if (hasValidUser && hasValidCompany && hasValidProject && hasValidClient) {
      validTimeEntries[id] = entry;
    }
  }
  
  const timeEntriesArray = Object.entries(validTimeEntries).map(([id, entry]) => [
    id,
    entry.userId,
    entry.companyId && companies[entry.companyId] ? entry.companyId : null, // Only set company_id if it exists in companies table
    entry.projectId || null,
    entry.projectName || null,
    entry.clientId || null,
    entry.clientName || null,
    entry.description || null,
    entry.startTime ? new Date(entry.startTime).toISOString().slice(0, 19).replace('T', ' ') : null,
    entry.endTime ? new Date(entry.endTime).toISOString().slice(0, 19).replace('T', ' ') : null,
    entry.duration || 0,
    entry.isRunning !== undefined ? entry.isRunning : false,
    entry.isBillable !== undefined ? entry.isBillable : false,
    entry.createdAt ? new Date(entry.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    entry.updatedAt ? new Date(entry.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null
  ]);

  if (timeEntriesArray.length > 0) {
    const insertSql = `
      INSERT INTO time_entries (
        id, user_id, company_id, project_id, project_name, client_id, client_name,
        description, start_time, end_time, duration, is_running, is_billable, created_at, updated_at
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        company_id = VALUES(company_id),
        project_id = VALUES(project_id),
        project_name = VALUES(project_name),
        client_id = VALUES(client_id),
        client_name = VALUES(client_name),
        description = VALUES(description),
        start_time = VALUES(start_time),
        end_time = VALUES(end_time),
        duration = VALUES(duration),
        is_running = VALUES(is_running),
        is_billable = VALUES(is_billable),
        updated_at = VALUES(updated_at)
    `;
    
    await connection.query(insertSql, [timeEntriesArray]);
    console.log(`Migrated ${timeEntriesArray.length} time entries`);
  } else {
    console.log('No valid time entries to migrate');
  }
}

async function migrateTeams(connection, teams, companies) {
  console.log('Migrating teams...');
  const teamsArray = Object.entries(teams || {}).map(([id, team]) => [
    id,
    team.name,
    team.description || null,
    team.leaderId || null,
    team.leaderName || null,
    team.leaderEmail || null,
    team.color || '#3B82F6',
    team.companyId && companies[team.companyId] ? team.companyId : null, // Only set company_id if it exists in companies table
    team.isActive !== undefined ? team.isActive : true,
    team.memberCount || 0,
    team.createdBy || null,
    team.createdAt ? new Date(team.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    team.updatedAt ? new Date(team.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null
  ]);

  if (teamsArray.length > 0) {
    const insertSql = `
      INSERT INTO teams (
        id, name, description, leader_id, leader_name, leader_email, color,
        company_id, is_active, member_count, created_by, created_at, updated_at
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        leader_id = VALUES(leader_id),
        leader_name = VALUES(leader_name),
        leader_email = VALUES(leader_email),
        color = VALUES(color),
        company_id = VALUES(company_id),
        is_active = VALUES(is_active),
        member_count = VALUES(member_count),
        created_by = VALUES(created_by),
        updated_at = VALUES(updated_at)
    `;
    
    await connection.query(insertSql, [teamsArray]);
    console.log(`Migrated ${teamsArray.length} teams`);
  }
}

async function migrateTeamMembers(connection, teamMembers, users, teams) {
  console.log('Migrating team members...');
  // Filter team members to only include those with valid user and team IDs
  const validTeamMembers = {};
  for (const [id, member] of Object.entries(teamMembers || {})) {
    if (member.userId && users[member.userId] && member.teamId && teams[member.teamId]) {
      validTeamMembers[id] = member;
    }
  }
  
  const teamMembersArray = Object.entries(validTeamMembers).map(([id, member]) => [
    id,
    member.teamId,
    member.userId,
    member.userName || null,
    member.userEmail || null,
    member.teamRole || 'member',
    member.joinedAt ? new Date(member.joinedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    member.leftAt ? new Date(member.leftAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    member.isActive !== undefined ? member.isActive : true
  ]);

  if (teamMembersArray.length > 0) {
    const insertSql = `
      INSERT INTO team_members (
        id, team_id, user_id, user_name, user_email, team_role, joined_at, left_at, is_active
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        team_id = VALUES(team_id),
        user_id = VALUES(user_id),
        user_name = VALUES(user_name),
        user_email = VALUES(user_email),
        team_role = VALUES(team_role),
        joined_at = VALUES(joined_at),
        left_at = VALUES(left_at),
        is_active = VALUES(is_active)
    `;
    
    await connection.query(insertSql, [teamMembersArray]);
    console.log(`Migrated ${teamMembersArray.length} team members`);
  } else {
    console.log('No valid team members to migrate');
  }
}

async function migrateTasks(connection, tasks, users, projects, teams, companies) {
  console.log('Migrating tasks...');
  // Filter tasks to only include those with valid references
  const validTasks = {};
  for (const [id, task] of Object.entries(tasks || {})) {
    // Check if required references exist
    const hasValidProject = task.projectId && projects[task.projectId];
    const hasValidCreatedBy = task.createdBy && users[task.createdBy];
    const hasValidAssignee = !task.assigneeId || users[task.assigneeId];
    const hasValidParentTask = !task.parentTaskId || tasks[task.parentTaskId];
    const hasValidTeam = !task.teamId || teams[task.teamId];
    const hasValidCompany = !task.companyId || companies[task.companyId];
    
    if (hasValidProject && hasValidCreatedBy && hasValidAssignee && hasValidParentTask && hasValidTeam && hasValidCompany) {
      validTasks[id] = task;
    }
  }
  
  const tasksArray = Object.entries(validTasks).map(([id, task]) => [
    id,
    task.title,
    task.description || null,
    task.notes || null,
    task.projectId,
    task.projectName || null,
    task.statusId || null,
    task.statusName || null,
    task.statusColor || null,
    task.statusOrder !== undefined ? task.statusOrder : null,
    task.statusIsCompleted !== undefined ? task.statusIsCompleted : false,
    task.priorityId || null,
    task.priorityName || null,
    task.priorityColor || null,
    task.priorityLevel !== undefined ? task.priorityLevel : null,
    task.assigneeId || null,
    task.assigneeName || null,
    task.assigneeEmail || null,
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 19).replace('T', ' ') : null,
    task.estimatedHours !== undefined ? task.estimatedHours : null,
    task.actualHours !== undefined ? task.actualHours : null,
    task.isCompleted !== undefined ? task.isCompleted : false,
    task.completedAt ? new Date(task.completedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    task.createdBy,
    task.createdByName || null,
    task.createdAt ? new Date(task.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    task.updatedAt ? new Date(task.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    task.parentTaskId || null,
    task.teamId || null,
    task.companyId || null
  ]);

  if (tasksArray.length > 0) {
    const insertSql = `
      INSERT INTO tasks (
        id, title, description, notes, project_id, project_name, status_id, status_name,
        status_color, status_order, status_is_completed, priority_id, priority_name,
        priority_color, priority_level, assignee_id, assignee_name, assignee_email,
        due_date, estimated_hours, actual_hours, is_completed, completed_at, created_by,
        created_by_name, created_at, updated_at, parent_task_id, team_id, company_id
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        notes = VALUES(notes),
        project_id = VALUES(project_id),
        project_name = VALUES(project_name),
        status_id = VALUES(status_id),
        status_name = VALUES(status_name),
        status_color = VALUES(status_color),
        status_order = VALUES(status_order),
        status_is_completed = VALUES(status_is_completed),
        priority_id = VALUES(priority_id),
        priority_name = VALUES(priority_name),
        priority_color = VALUES(priority_color),
        priority_level = VALUES(priority_level),
        assignee_id = VALUES(assignee_id),
        assignee_name = VALUES(assignee_name),
        assignee_email = VALUES(assignee_email),
        due_date = VALUES(due_date),
        estimated_hours = VALUES(estimated_hours),
        actual_hours = VALUES(actual_hours),
        is_completed = VALUES(is_completed),
        completed_at = VALUES(completed_at),
        created_by = VALUES(created_by),
        created_by_name = VALUES(created_by_name),
        updated_at = VALUES(updated_at),
        parent_task_id = VALUES(parent_task_id),
        team_id = VALUES(team_id),
        company_id = VALUES(company_id)
    `;
    
    await connection.query(insertSql, [tasksArray]);
    console.log(`Migrated ${tasksArray.length} tasks`);
  } else {
    console.log('No valid tasks to migrate');
  }
}

async function migrateAllData() {
  let connection;
  
  try {
    // Connect to MySQL
    connection = await mysql.createConnection(mysqlConfig);
    console.log('Connected to MySQL database');
    
    // Migrate each collection in order of dependencies
    await migrateCompanies(connection, firebaseData.companies);
    await migrateUsers(connection, firebaseData.users, firebaseData.companies);
    await migrateClients(connection, firebaseData.clients, firebaseData.companies);
    await migrateProjects(connection, firebaseData.projects, firebaseData.companies);
    await migrateTeams(connection, firebaseData.teams, firebaseData.companies);
    await migrateTeamMembers(connection, firebaseData.teamMembers, firebaseData.users, firebaseData.teams);
    await migrateTasks(connection, firebaseData.tasks, firebaseData.users, firebaseData.projects, firebaseData.teams, firebaseData.companies);
    await migrateTimeEntries(connection, firebaseData.timeEntries, firebaseData.companies, firebaseData.clients, firebaseData.projects, firebaseData.users);
    
    console.log('All data migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('MySQL connection closed');
    }
  }
}

// Run the migration
migrateAllData();