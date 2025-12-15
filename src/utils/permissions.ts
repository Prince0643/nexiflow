import { UserRole } from '../types'

export interface Permission {
  canManageProjects: boolean
  canManageClients: boolean
  canManageUsers: boolean
  canViewAllTimeEntries: boolean
  canManageTeams: boolean
  canAccessAdminDashboard: boolean
  canCreateUsers: boolean
  canViewUserDetails: boolean
  canManageSystemSettings: boolean
  canViewHourlyRates: boolean
  canEditHourlyRates: boolean  // New permission for editing hourly rates
  canStopOtherUsersTimers: boolean  // New permission for stopping other users' timers
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  employee: {
    canManageProjects: false,
    canManageClients: false,
    canManageUsers: false,
    canViewAllTimeEntries: false,
    canManageTeams: false,
    canAccessAdminDashboard: false,
    canCreateUsers: false,
    canViewUserDetails: false,
    canManageSystemSettings: false,
    canViewHourlyRates: false,
    canEditHourlyRates: false,  // Employees cannot edit hourly rates
    canStopOtherUsersTimers: false  // Employees cannot stop other users' timers
  },
  hr: {
    canManageProjects: false,
    canManageClients: false,
    canManageUsers: true,
    canViewAllTimeEntries: true,
    canManageTeams: false,
    canAccessAdminDashboard: true,
    canCreateUsers: true,
    canViewUserDetails: true,
    canManageSystemSettings: false,
    canViewHourlyRates: true,
    canEditHourlyRates: true,
    canStopOtherUsersTimers: true  // HR can stop other users' timers
  },
  admin: {
    canManageProjects: true,
    canManageClients: true,
    canManageUsers: true,
    canViewAllTimeEntries: true,
    canManageTeams: true,
    canAccessAdminDashboard: true,
    canCreateUsers: true,
    canViewUserDetails: true,
    canManageSystemSettings: false,
    canViewHourlyRates: false,  // false ko to mamamaya
    canEditHourlyRates: false,   // pati ito
    canStopOtherUsersTimers: true  // Admins can stop other users' timers
  },
  super_admin: {
    canManageProjects: true,
    canManageClients: true,
    canManageUsers: true,
    canViewAllTimeEntries: true,
    canManageTeams: true,
    canAccessAdminDashboard: true,
    canCreateUsers: true,
    canViewUserDetails: true,
    canManageSystemSettings: true,
    canViewHourlyRates: true,   // Super admin can view hourly rates
    canEditHourlyRates: true,    // Super admin can edit hourly rates
    canStopOtherUsersTimers: true  // Super admins can stop other users' timers
  },
  root: {
    canManageProjects: true,
    canManageClients: true,
    canManageUsers: true,
    canViewAllTimeEntries: true,
    canManageTeams: true,
    canAccessAdminDashboard: true,
    canCreateUsers: true,
    canViewUserDetails: true,
    canManageSystemSettings: true,
    canViewHourlyRates: true,   // Root can view hourly rates
    canEditHourlyRates: true,    // Root can edit hourly rates
    canStopOtherUsersTimers: true  // Root can stop other users' timers
  }
}

export function hasPermission(userRole: UserRole, permission: keyof Permission): boolean {
  return ROLE_PERMISSIONS[userRole][permission]
}

export function canAccessFeature(userRole: UserRole, feature: string): boolean {
  switch (feature) {
    case 'projects':
      return hasPermission(userRole, 'canManageProjects')
    case 'clients':
      return hasPermission(userRole, 'canManageClients')
    case 'users':
      return hasPermission(userRole, 'canManageUsers')
    case 'canManageUsers':
      return hasPermission(userRole, 'canManageUsers')
    case 'time-entries':
      return hasPermission(userRole, 'canViewAllTimeEntries')
    case 'teams':
      return hasPermission(userRole, 'canManageTeams')
    case 'admin-dashboard':
      return hasPermission(userRole, 'canAccessAdminDashboard')
    case 'create-users':
      return hasPermission(userRole, 'canCreateUsers')
    case 'user-details':
      return hasPermission(userRole, 'canViewUserDetails')
    case 'system-settings':
      return hasPermission(userRole, 'canManageSystemSettings')
    case 'hourly-rates':
      return hasPermission(userRole, 'canViewHourlyRates')
    case 'edit-hourly-rates':
      return hasPermission(userRole, 'canEditHourlyRates')  // New feature check
    case 'stop-other-timers':
      return hasPermission(userRole, 'canStopOtherUsersTimers')  // New feature check
    default:
      return false
  }
}

export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'employee':
      return 'Employee'
    case 'hr':
      return 'HR'
    case 'admin':
      return 'Admin'
    case 'super_admin':
      return 'Super Admin'
    case 'root':
      return 'Root'
    default:
      return 'Unknown'
  }
}

export function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'employee':
      return 'Basic time tracking and project access'
    case 'hr':
      return 'Manage employees and view user details'
    case 'admin':
      return 'Full system access including user management and projects'
    case 'super_admin':
      return 'Complete company access and all permissions'
    case 'root':
      return 'Platform owner with ultimate system control'
    default:
      return 'Unknown role'
  }
}

export function getRoleHierarchy(): UserRole[] {
  return ['employee', 'hr', 'admin', 'super_admin', 'root']
}

export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  const hierarchy = getRoleHierarchy()
  return hierarchy.indexOf(role1) > hierarchy.indexOf(role2)
}

export function canManageUser(managerRole: UserRole, targetUserRole: UserRole): boolean {
  // HR can manage employees only
  if (managerRole === 'hr') {
    return targetUserRole === 'employee'
  }
  
  // Admin can manage everyone (employees and HR)
  if (managerRole === 'admin') {
    return targetUserRole === 'employee' || targetUserRole === 'hr'
  }
  
  // Super Admin can manage everyone except root
  if (managerRole === 'super_admin') {
    return targetUserRole !== 'root'
  }
  
  // Root can manage everyone
  if (managerRole === 'root') {
    return true
  }
  
  return false
}

export function canDeleteTask(userRole: UserRole, taskCreatorId: string, currentUserId: string): boolean {
  // Admins, super admins, and root can delete any task
  if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'root') {
    return true;
  }
  
  // Users can delete their own tasks
  if (taskCreatorId === currentUserId) {
    return true;
  }
  
  return false;
}

// Utility function to check if user can view hourly rates
export function canViewHourlyRates(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canViewHourlyRates')
}

// Utility function to check if user can edit hourly rates
export function canEditHourlyRates(userRole: UserRole): boolean {
  return hasPermission(userRole, 'canEditHourlyRates')
}