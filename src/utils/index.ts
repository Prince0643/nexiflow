import { format, isValid, formatDistance } from 'date-fns'

// TODO: Admin can view the team tasks and projects
// add a team task, like task management is for each team
// per task is the details, comments, activity, etc
// user can only see their own tasks
// if the user exited the tab while the time is runnning, it should still count the time
// research on click up website
// change colors for the ui in task management
// if user wants to absent, file a report
// sign in using email


export const formatTime = (date: Date): string => {
  if (!isValid(date)) return '--:--'
  return format(date, 'HH:mm')
}

export const formatDate = (date: Date): string => {
  if (!isValid(date)) return '--'
  return format(date, 'MMM dd, yyyy')
}

export const formatDateTime = (date: Date): string => {
  if (!isValid(date)) return '--'
  return format(date, 'MMM dd, yyyy HH:mm')
}

export const formatTimeFromSeconds = (seconds: number): string => {
  // Handle NaN, undefined, or negative values
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '00:00:00'
  }
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const formatTimeFromSecondsPrecise = (seconds: number): string => {
  // Handle NaN, undefined, or negative values
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '00:00:00'
  }
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.round(seconds % 60 * 100) / 100 // Round to 2 decimal places
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Convert decimal hours to HH:mm:ss format
export const formatHoursToHHMMSS = (hours: number): string => {
  if (!hours || isNaN(hours) || hours < 0) {
    return '00:00:00'
  }
  
  const totalSeconds = Math.round(hours * 3600)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Convert seconds to HH:mm:ss format (for time entries stored in seconds)
export const formatSecondsToHHMMSS = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '00:00:00'
  }
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Smart formatter that detects if input is hours or seconds
export const formatDurationToHHMMSS = (duration: number): string => {
  if (!duration || isNaN(duration) || duration < 0) {
    return '00:00:00'
  }
  
  // Based on the database, durations are stored in seconds
  // Always treat as seconds - the previous logic was incorrect
  return formatSecondsToHHMMSS(duration)
}

export const formatRelativeTime = (date: Date): string => {
  if (!isValid(date)) return '--'
  return formatDistance(date, new Date(), { addSuffix: true })
}

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9)
}

export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}