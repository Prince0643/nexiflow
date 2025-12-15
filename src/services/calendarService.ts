import { TimeEntry, CalendarEvent, CalendarDay, CalendarView, CalendarFilters, Project } from '../types'
import { timeEntryService } from './timeEntryService'
import { projectService } from './projectService'
import { taskService } from './taskService'

export const calendarService = {
  // Convert time entries to calendar events
  convertTimeEntriesToEvents(timeEntries: TimeEntry[]): CalendarEvent[] {
    return timeEntries.map(entry => ({
      id: entry.id,
      title: entry.description || 'Time Entry',
      description: entry.description,
      startTime: entry.startTime,
      endTime: entry.endTime || new Date(entry.startTime.getTime() + entry.duration * 1000),
      duration: entry.duration,
      projectId: entry.projectId,
      projectName: entry.projectName,
      isBillable: entry.isBillable,
      tags: entry.tags,
      color: this.getProjectColor(entry.projectId),
      type: 'timeEntry' as const
    }))
  },

  // Get project color for calendar events
  getProjectColor(projectId?: string): string {
    // Default colors for projects
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316', // Orange
    ]
    
    if (!projectId) return '#6B7280' // Gray for no project
    
    // Simple hash function to get consistent color for project
    let hash = 0
    for (let i = 0; i < projectId.length; i++) {
      hash = projectId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  },

  // Generate calendar days for a given month
  generateCalendarDays(
    year: number, 
    month: number, 
    events: CalendarEvent[] = [],
    selectedDate?: Date
  ): CalendarDay[] {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from Sunday
    
    const days: CalendarDay[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Generate 42 days (6 weeks) to fill the calendar grid
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.startTime)
        eventDate.setHours(0, 0, 0, 0)
        return eventDate.getTime() === date.getTime()
      })
      
      const totalDuration = dayEvents.reduce((sum, event) => sum + event.duration, 0)
      const billableDuration = dayEvents
        .filter(event => event.isBillable)
        .reduce((sum, event) => sum + event.duration, 0)
      
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        isSelected: selectedDate ? date.getTime() === selectedDate.getTime() : false,
        events: dayEvents,
        totalDuration,
        billableDuration
      })
    }
    
    return days
  },

  // Get calendar view for different time periods
  getCalendarView(type: 'month' | 'week' | 'day', currentDate: Date): CalendarView {
    const date = new Date(currentDate)
    
    switch (type) {
      case 'month': {
        const startDate = new Date(date.getFullYear(), date.getMonth(), 1)
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        return {
          type: 'month',
          currentDate: date,
          startDate,
          endDate
        }
      }
      case 'week': {
        const startOfWeek = new Date(date)
        startOfWeek.setDate(date.getDate() - date.getDay())
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        return {
          type: 'week',
          currentDate: date,
          startDate: startOfWeek,
          endDate: endOfWeek
        }
      }
      case 'day': {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)
        return {
          type: 'day',
          currentDate: date,
          startDate: startOfDay,
          endDate: endOfDay
        }
      }
    }
  },

  // Filter events based on calendar filters
  filterEvents(events: CalendarEvent[], filters: CalendarFilters): CalendarEvent[] {
    return events.filter(event => {
      // Project filter
      if (filters.projectIds && filters.projectIds.length > 0) {
        if (!event.projectId || !filters.projectIds.includes(event.projectId)) {
          return false
        }
      }
      
      // Billable filter
      if (filters.billableOnly && !event.isBillable) {
        return false
      }
      
      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        if (!event.tags || !event.tags.some(tag => filters.tags!.includes(tag))) {
          return false
        }
      }
      
      // Type filter
      if (filters.showTimeEntries === false && event.type === 'timeEntry') {
        return false
      }
      
      if (filters.showTasks === false && event.type === 'task') {
        return false
      }
      
      return true
    })
  },

  // Get events for a specific date range
  async getEventsForDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date,
    filters: CalendarFilters = {}
  ): Promise<CalendarEvent[]> {
    try {
      // Get time entries for the date range
      const timeEntries = await timeEntryService.getTimeEntriesByDateRange(userId, startDate, endDate)
      
      // Convert to calendar events
      let events = this.convertTimeEntriesToEvents(timeEntries)
      
      // Apply filters
      events = this.filterEvents(events, filters)
      
      return events
    } catch (error) {
      console.error('Error getting events for date range:', error)
      return []
    }
  },

  // Get calendar data for a specific month
  async getCalendarData(
    userId: string,
    year: number,
    month: number,
    filters: CalendarFilters = {}
  ): Promise<CalendarDay[]> {
    try {
      // Get the date range for the month
      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0)
      
      // Get events for the month
      const events = await this.getEventsForDateRange(userId, startDate, endDate, filters)
      
      // Generate calendar days
      return this.generateCalendarDays(year, month, events)
    } catch (error) {
      console.error('Error getting calendar data:', error)
      return []
    }
  },

  // Get statistics for a specific date
  getDateStatistics(day: CalendarDay) {
    const totalHours = day.totalDuration / 3600
    const billableHours = day.billableDuration / 3600
    const nonBillableHours = totalHours - billableHours
    
    return {
      totalHours,
      billableHours,
      nonBillableHours,
      totalEvents: day.events.length,
      billableEvents: day.events.filter(e => e.isBillable).length
    }
  },

  // Format duration for display
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }
}
