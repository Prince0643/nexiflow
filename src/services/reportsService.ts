// import { ref, get, query, orderByChild, equalTo, startAt, endAt } from 'firebase/database'
// import { database } from '../config/firebase'
import { 
  TimeAnalytics, 
  ProjectAnalytics, 
  DailyAnalytics, 
  WeeklyAnalytics, 
  MonthlyAnalytics, 
  ReportFilters,
  TimeEntry,
  // Project
} from '../types'
import { timeEntryService } from './timeEntryService'
import { projectService } from './projectService'

export const reportsService = {
  // Get time analytics for a date range
  async getTimeAnalytics(filters: ReportFilters): Promise<TimeAnalytics> {
    const entries = await this.getFilteredTimeEntries(filters)
    // const projects = await projectService.getProjects()
    
    const totalTime = entries.reduce((sum, entry) => sum + entry.duration, 0)
    const billableTime = entries.filter(entry => entry.isBillable).reduce((sum, entry) => sum + entry.duration, 0)
    const nonBillableTime = totalTime - billableTime
    const totalEntries = entries.length
    const averageSessionLength = totalEntries > 0 ? totalTime / totalEntries : 0
    
    // Calculate most productive day
    const dayStats: { [key: string]: number } = {}
    entries.forEach(entry => {
      const day = new Date(entry.startTime).toLocaleDateString('en-US', { weekday: 'long' })
      dayStats[day] = (dayStats[day] || 0) + entry.duration
    })
    const mostProductiveDay = Object.keys(dayStats).reduce((a, b) => 
      dayStats[a] > dayStats[b] ? a : b, 'Monday'
    )
    
    // Calculate most productive hour
    const hourStats: { [key: number]: number } = {}
    entries.forEach(entry => {
      const hour = new Date(entry.startTime).getHours()
      hourStats[hour] = (hourStats[hour] || 0) + entry.duration
    })
    const mostProductiveHour = Object.keys(hourStats).reduce((a, b) => 
      hourStats[parseInt(a)] > hourStats[parseInt(b)] ? a : b, '9'
    )
    
    // Calculate earnings (assuming $25/hour default rate)
    const totalEarnings = (billableTime / 3600) * 25
    
    return {
      totalTime,
      billableTime,
      nonBillableTime,
      totalEntries,
      averageSessionLength,
      mostProductiveDay,
      mostProductiveHour: parseInt(mostProductiveHour),
      totalEarnings
    }
  },

  // Get project analytics
  async getProjectAnalytics(filters: ReportFilters): Promise<ProjectAnalytics[]> {
    const entries = await this.getFilteredTimeEntries(filters)
    const projects = await projectService.getProjects()
    
    const projectStats: { [key: string]: { 
      totalTime: number, 
      billableTime: number, 
      entries: number,
      projectName: string,
      color: string
    } } = {}
    
    entries.forEach(entry => {
      const projectId = entry.projectId || 'no-project'
      const project = projects.find(p => p.id === projectId)
      
      if (!projectStats[projectId]) {
        projectStats[projectId] = {
          totalTime: 0,
          billableTime: 0,
          entries: 0,
          projectName: project?.name || 'No Project',
          color: project?.color || '#6B7280'
        }
      }
      
      projectStats[projectId].totalTime += entry.duration
      projectStats[projectId].entries += 1
      if (entry.isBillable) {
        projectStats[projectId].billableTime += entry.duration
      }
    })
    
    const totalTime = Object.values(projectStats).reduce((sum, stat) => sum + stat.totalTime, 0)
    
    return Object.entries(projectStats).map(([projectId, stats]) => ({
      projectId,
      projectName: stats.projectName,
      totalTime: stats.totalTime,
      billableTime: stats.billableTime,
      entries: stats.entries,
      percentage: totalTime > 0 ? (stats.totalTime / totalTime) * 100 : 0,
      color: stats.color
    })).sort((a, b) => b.totalTime - a.totalTime)
  },

  // Get daily analytics for a date range
  async getDailyAnalytics(filters: ReportFilters): Promise<DailyAnalytics[]> {
    const entries = await this.getFilteredTimeEntries(filters)
    const dailyStats: { [key: string]: DailyAnalytics } = {}
    
    entries.forEach(entry => {
      const date = new Date(entry.startTime).toISOString().split('T')[0]
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          totalTime: 0,
          billableTime: 0,
          entries: 0,
          projects: {}
        }
      }
      
      dailyStats[date].totalTime += entry.duration
      dailyStats[date].entries += 1
      
      if (entry.isBillable) {
        dailyStats[date].billableTime += entry.duration
      }
      
      const projectId = entry.projectId || 'no-project'
      dailyStats[date].projects[projectId] = (dailyStats[date].projects[projectId] || 0) + entry.duration
    })
    
    return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))
  },

  // Get weekly analytics
  async getWeeklyAnalytics(filters: ReportFilters): Promise<WeeklyAnalytics[]> {
    const dailyAnalytics = await this.getDailyAnalytics(filters)
    const weeklyStats: { [key: string]: WeeklyAnalytics } = {}
    
    dailyAnalytics.forEach(daily => {
      const date = new Date(daily.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      
      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = {
          week: weekKey,
          totalTime: 0,
          billableTime: 0,
          entries: 0,
          dailyBreakdown: []
        }
      }
      
      weeklyStats[weekKey].totalTime += daily.totalTime
      weeklyStats[weekKey].billableTime += daily.billableTime
      weeklyStats[weekKey].entries += daily.entries
      weeklyStats[weekKey].dailyBreakdown.push(daily)
    })
    
    return Object.values(weeklyStats).sort((a, b) => a.week.localeCompare(b.week))
  },

  // Get monthly analytics
  async getMonthlyAnalytics(filters: ReportFilters): Promise<MonthlyAnalytics[]> {
    const weeklyAnalytics = await this.getWeeklyAnalytics(filters)
    const monthlyStats: { [key: string]: MonthlyAnalytics } = {}
    
    weeklyAnalytics.forEach(weekly => {
      const date = new Date(weekly.week)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          totalTime: 0,
          billableTime: 0,
          entries: 0,
          weeklyBreakdown: []
        }
      }
      
      monthlyStats[monthKey].totalTime += weekly.totalTime
      monthlyStats[monthKey].billableTime += weekly.billableTime
      monthlyStats[monthKey].entries += weekly.entries
      monthlyStats[monthKey].weeklyBreakdown.push(weekly)
    })
    
    return Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month))
  },

  // Get filtered time entries based on filters
  async getFilteredTimeEntries(filters: ReportFilters): Promise<TimeEntry[]> {
    if (!filters.userId) {
      return []
    }
    
    const entries = await timeEntryService.getTimeEntries(filters.userId)
    
    // Fix for date range filtering: set end date to end of day to include all entries for that day
    const adjustedEndDate = new Date(filters.endDate)
    adjustedEndDate.setHours(23, 59, 59, 999)
    
    return entries.filter(entry => {
      const entryDate = new Date(entry.startTime)
      
      // Date range filter
      if (entryDate < filters.startDate || entryDate > adjustedEndDate) {
        return false
      }
      
      // Project filter
      if (filters.projectIds && filters.projectIds.length > 0) {
        if (!entry.projectId || !filters.projectIds.includes(entry.projectId)) {
          return false
        }
      }
      
      // Client filter
      if (filters.clientIds && filters.clientIds.length > 0) {
        if (!entry.clientId || !filters.clientIds.includes(entry.clientId)) {
          return false
        }
      }
      
      // Billable filter
      if (filters.billableOnly) {
        if (!entry.isBillable) {
          return false
        }
      }
      
      if (filters.nonBillableOnly) {
        if (entry.isBillable) {
          return false
        }
      }
      
      return true
    })
  },

  // Generate chart data for different chart types
  generateProjectChartData(projectAnalytics: ProjectAnalytics[]): any {
    // Filter out invalid data and ensure we have valid values
    const validAnalytics = projectAnalytics.filter(p => 
      p && 
      typeof p.totalTime === 'number' && 
      !isNaN(p.totalTime) && 
      isFinite(p.totalTime) &&
      p.projectName
    )
    
    if (validAnalytics.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Time (hours)',
          data: [0],
          backgroundColor: ['#E5E7EB'],
          borderColor: ['#E5E7EB'],
          borderWidth: 1
        }]
      }
    }
    
    return {
      labels: validAnalytics.map(p => p.projectName),
      datasets: [{
        label: 'Time (hours)',
        data: validAnalytics.map(p => Math.max(0, p.totalTime / 3600)),
        backgroundColor: validAnalytics.map(p => p.color || '#3B82F6'),
        borderColor: validAnalytics.map(p => p.color || '#3B82F6'),
        borderWidth: 1
      }]
    }
  },

  generateDailyChartData(dailyAnalytics: DailyAnalytics[]): any {
    // Filter out invalid data and ensure we have valid values
    const validAnalytics = dailyAnalytics.filter(d => 
      d && 
      d.date &&
      typeof d.totalTime === 'number' && 
      !isNaN(d.totalTime) && 
      isFinite(d.totalTime) &&
      typeof d.billableTime === 'number' && 
      !isNaN(d.billableTime) && 
      isFinite(d.billableTime)
    )
    
    if (validAnalytics.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [
          {
            label: 'Total Time',
            data: [0],
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2
          },
          {
            label: 'Billable Time',
            data: [0],
            backgroundColor: 'rgba(16, 185, 129, 0.5)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 2
          }
        ]
      }
    }
    
    return {
      labels: validAnalytics.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Total Time',
          data: validAnalytics.map(d => Math.max(0, d.totalTime / 3600)),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        },
        {
          label: 'Billable Time',
          data: validAnalytics.map(d => Math.max(0, d.billableTime / 3600)),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2
        }
      ]
    }
  },

  generateWeeklyChartData(weeklyAnalytics: WeeklyAnalytics[]): any {
    return {
      labels: weeklyAnalytics.map(w => `Week of ${new Date(w.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`),
      datasets: [
        {
          label: 'Total Time',
          data: weeklyAnalytics.map(w => w.totalTime / 3600),
          backgroundColor: 'rgba(139, 92, 246, 0.5)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 2
        },
        {
          label: 'Billable Time',
          data: weeklyAnalytics.map(w => w.billableTime / 3600),
          backgroundColor: 'rgba(245, 158, 11, 0.5)',
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 2
        }
      ]
    }
  }
}
