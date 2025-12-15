export type UserRole = 'employee' | 'hr' | 'admin' | 'super_admin' | 'root'
export type TeamRole = 'member' | 'leader'
export type PricingLevel = 'solo' | 'office' | 'enterprise'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  companyId?: string | null
  teamId?: string | null
  teamRole?: TeamRole | null
  avatar?: string | null
  timezone: string
  hourlyRate?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthUser {
  uid: string
  email: string
  role: UserRole
  name: string
  companyId?: string | null
  teamId?: string | null
  teamRole?: TeamRole | null
  avatar?: string | null
  emailVerified?: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupCredentials {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: UserRole
}

export interface Company {
  id: string
  name: string
  isActive: boolean
  pricingLevel: PricingLevel
  maxMembers: number
  createdAt: string
  updatedAt: string
  pdfSettings?: PDFSettings
}

// Add the new PDFSettings interface
export interface PDFSettings {
  companyName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  showPoweredBy: boolean
  customFooterText: string
}

// Update the Company interface to include PDF settings
export interface CompanyWithPDFSettings extends Company {
  pdfSettings?: PDFSettings
}

// Project Management Types
export interface Project {
  id: string
  name: string
  description?: string
  color: string
  status: 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  startDate?: Date
  endDate?: Date
  budget?: number
  clientId?: string
  clientName?: string
  isArchived: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type ClientType = 'full-time' | 'part-time' | 'custom' | 'gig'

export interface Client {
  id: string
  name: string
  email: string
  country: string
  timezone: string
  clientType: ClientType
  hourlyRate: number // Hourly rate for this client
  hoursPerWeek?: number // For custom type
  startDate?: Date // For gig type
  endDate?: Date // For gig type
  phone?: string
  company?: string
  address?: string
  currency?: string // Add currency field
  isArchived: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateClientData {
  name: string
  email: string
  country: string
  timezone: string
  clientType: ClientType
  hourlyRate: number // Hourly rate for this client
  hoursPerWeek?: number // For custom type
  startDate?: Date // For gig type
  endDate?: Date // For gig type
  phone?: string
  company?: string
  address?: string
  currency?: string // Add currency field
}

export interface CreateProjectData {
  name: string
  description?: string
  color: string
  status: 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  clientId?: string
}

// Time Tracking Types
export interface TimeEntry {
  id: string
  userId: string
  companyId?: string
  projectId?: string
  projectName?: string
  clientId?: string // Add clientId field
  clientName?: string // Add clientName field
  description?: string
  startTime: Date
  endTime?: Date
  duration: number // in seconds
  isRunning: boolean
  isBillable: boolean
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateTimeEntryData {
  projectId?: string
  description?: string
  isBillable?: boolean
  tags?: string[]
  clientId?: string // Add clientId field
}

export interface TimerState {
  isRunning: boolean
  startTime?: Date
  currentEntry?: TimeEntry
  elapsedTime: number // in seconds
}

export interface TimeStats {
  daily: number // seconds
  weekly: number // seconds
  monthly: number // seconds
  total: number // seconds
}

export interface TimeSummary {
  today: {
    total: number
    billable: number
    entries: number
  }
  thisWeek: {
    total: number
    billable: number
    entries: number
  }
  thisMonth: {
    total: number
    billable: number
    entries: number
  }
}

// Reports and Analytics Types
export interface TimeAnalytics {
  totalTime: number
  billableTime: number
  nonBillableTime: number
  totalEntries: number
  averageSessionLength: number
  mostProductiveDay: string
  mostProductiveHour: number
  totalEarnings: number
}

export interface ProjectAnalytics {
  projectId: string
  projectName: string
  totalTime: number
  billableTime: number
  entries: number
  percentage: number
  color: string
}

export interface DailyAnalytics {
  date: string
  totalTime: number
  billableTime: number
  entries: number
  projects: { [projectId: string]: number }
}

export interface WeeklyAnalytics {
  week: string
  totalTime: number
  billableTime: number
  entries: number
  dailyBreakdown: DailyAnalytics[]
}

export interface MonthlyAnalytics {
  month: string
  totalTime: number
  billableTime: number
  entries: number
  weeklyBreakdown: WeeklyAnalytics[]
}

export interface ReportFilters {
  startDate: Date
  endDate: Date
  projectIds?: string[]
  clientIds?: string[] // Add clientIds filter
  billableOnly?: boolean
  nonBillableOnly?: boolean
  userId?: string
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }[]
}

// Project Management Types
export interface Task {
  id: string
  title: string
  description?: string
  notes?: string
  projectId: string
  projectName: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string
  assigneeName?: string
  assigneeEmail?: string
  dueDate?: Date
  estimatedHours?: number
  actualHours?: number
  tags: string[]
  isCompleted: boolean
  completedAt?: Date
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
  parentTaskId?: string
  subtasks?: Task[]
  attachments: TaskAttachment[]
  comments: TaskComment[]
  timeEntries: string[] // Array of time entry IDs
  teamId?: string // Add teamId field
}

export interface TaskStatus {
  id: string
  name: string
  color: string
  order: number
  isCompleted: boolean
}

export interface TaskPriority {
  id: string
  name: string
  color: string
  level: number
}

export interface TaskAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedBy: string
  uploadedAt: Date
}

export interface TaskComment {
  id: string
  content: string
  authorId: string
  authorName: string
  authorEmail: string
  createdAt: Date
  updatedAt: Date
  mentions: string[] // Array of user IDs mentioned
  parentCommentId?: string
  replies?: TaskComment[]
}

export interface Mention {
  id: string
  userId: string
  userName: string
  userEmail: string
  startIndex: number
  endIndex: number
}

export interface MentionSuggestion {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
}

export interface MentionNotification {
  id: string
  type: 'mention'
  title: string
  message: string
  mentionedBy: string
  mentionedByName: string
  mentionedUserId: string
  contextType: 'comment' | 'note' | 'task' | 'message'
  contextId: string
  contextTitle: string
  taskId?: string
  projectId?: string
  isRead: boolean
  createdAt: Date
  actionUrl: string
}

export interface ProjectBoard {
  id: string
  name: string
  description?: string
  projectId: string
  type: BoardType
  columns: BoardColumn[]
  settings: BoardSettings
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface BoardColumn {
  id: string
  name: string
  color: string
  order: number
  taskStatusId: string
  taskLimit?: number
  isCollapsed: boolean
}

export interface BoardSettings {
  showCompletedTasks: boolean
  showAssignee: boolean
  showDueDate: boolean
  showPriority: boolean
  showTags: boolean
  showTimeTracking: boolean
  allowDragDrop: boolean
  groupBy?: 'assignee' | 'priority' | 'dueDate' | 'tags' | 'none'
}

export type BoardType = 'kanban' | 'list' | 'calendar' | 'gantt' | 'timeline'

export interface CreateTaskData {
  title: string
  description?: string
  projectId: string
  status: string
  priority: string
  assigneeId?: string
  dueDate?: Date
  estimatedHours?: number
  tags: string[]
  parentTaskId?: string
  teamId?: string
}

export interface UpdateTaskData {
  title?: string
  description?: string
  notes?: string
  status?: string
  priority?: string
  assigneeId?: string
  dueDate?: Date
  estimatedHours?: number
  actualHours?: number
  tags?: string[]
  isCompleted?: boolean
  parentTaskId?: string
  comments?: TaskComment[]
  teamId?: string // Add teamId field
}

export interface CreateBoardData {
  name: string
  description?: string
  projectId: string
  type: BoardType
  columns: Omit<BoardColumn, 'id'>[]
  settings: BoardSettings
}

export interface UpdateBoardData {
  name?: string
  description?: string
  type?: BoardType
  columns?: BoardColumn[]
  settings?: BoardSettings
}

export interface TaskFilter {
  projectId?: string
  status?: string[]
  priority?: string[]
  assigneeId?: string
  tags?: string[]
  dueDateFrom?: Date
  dueDateTo?: Date
  isCompleted?: boolean
  search?: string
}

export interface ProjectStats {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  totalEstimatedHours: number
  totalActualHours: number
  completionRate: number
  averageTaskDuration: number
  teamMembers: number
  activeBoards: number
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'member' | 'viewer'
  avatar?: string
  isActive: boolean
  joinedAt: Date
  lastActiveAt?: Date
  taskCount: number
  completedTasks: number
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  color: string
  defaultStatuses: Omit<TaskStatus, 'id'>[]
  defaultPriorities: Omit<TaskPriority, 'id'>[]
  defaultColumns: Omit<BoardColumn, 'id' | 'taskStatusId'>[]
  isPublic: boolean
  createdBy: string
  createdAt: Date
  usageCount: number
}

// Team Management Types
export interface Team {
  id: string
  name: string
  description?: string
  leaderId: string
  leaderName: string
  leaderEmail: string
  color: string
  companyId?: string | null
  isActive: boolean
  memberCount: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  unreadCount?: number // Add this field
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  userName: string
  userEmail: string
  teamRole: TeamRole
  joinedAt: Date
  isActive: boolean
}

export interface CreateTeamData {
  name: string
  description?: string
  leaderId: string
  color: string
}

export interface UpdateTeamData {
  name?: string
  description?: string | null
  leaderId?: string
  color?: string
  isActive?: boolean
}

export interface AddTeamMemberData {
  userId: string
  role: TeamRole
}

export interface TeamStats {
  totalMembers: number
  activeMembers: number
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  totalTimeLogged: number
  averageTaskCompletion: number
  // Time tracking data
  totalHours: number
  billableHours: number
  nonBillableHours: number
  totalTimeEntries: number
  averageHoursPerMember: number
  mostActiveMember?: {
    userId: string
    userName: string
    hours: number
  }
  timeByProject: {
    projectId: string
    projectName: string
    hours: number
    percentage: number
  }[]
}

// Add this new interface for tracking last read timestamps
export interface LastReadTimestamp {
  userId: string
  teamId: string
  timestamp: Date
}

// Messaging Types
export interface Message {
  id: string
  teamId: string
  senderId: string
  senderName: string
  senderEmail: string
  content: string
  timestamp: Date
  type: 'text' | 'system' | 'file'
  isEdited: boolean
  editedAt?: Date
  replyTo?: string
  attachments?: MessageAttachment[]
  reactions?: MessageReaction[]
}

export interface MessageAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedAt: Date
}

export interface MessageReaction {
  emoji: string
  userId: string
  userName: string
  timestamp: Date
}

export interface TeamChat {
  teamId: string
  teamName: string
  lastMessage?: Message
  unreadCount: number
  isActive: boolean
  members: string[]
}

export interface CreateMessageData {
  teamId: string
  content: string
  type?: 'text' | 'system' | 'file'
  replyTo?: string
  attachments?: Omit<MessageAttachment, 'id' | 'uploadedAt'>[]
}

// Add this new interface for team messages
export interface TeamMessage {
  id: string
  teamId: string
  senderId: string
  senderName: string
  senderEmail: string
  content: string
  timestamp: Date
  isEdited: boolean
  editedAt?: Date
}

// Calendar Types
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  duration: number // in seconds
  projectId?: string
  projectName?: string
  isBillable: boolean
  tags?: string[]
  color?: string
  type: 'timeEntry' | 'task' | 'meeting' | 'break'
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  events: CalendarEvent[]
  totalDuration: number
  billableDuration: number
}

export interface CalendarView {
  type: 'month' | 'week' | 'day'
  currentDate: Date
  startDate: Date
  endDate: Date
}

export interface CalendarFilters {
  projectIds?: string[]
  billableOnly?: boolean
  tags?: string[]
  showTasks?: boolean
  showTimeEntries?: boolean
}