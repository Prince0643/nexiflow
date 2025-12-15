import React, { useState, useEffect } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  DollarSign, 
  Tag,
  Filter,
  Eye,
  EyeOff,
  Plus,
  MoreHorizontal
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useTimeEntries } from '../contexts/TimeEntryContext'
import { CalendarDay, CalendarEvent, CalendarFilters, Project } from '../types'
import { calendarService } from '../services/calendarService'
import { projectService } from '../services/projectService'
import { formatTimeFromSeconds, formatDate } from '../utils'

export default function Calendar() {
  const { currentUser } = useMySQLAuth()
  const { timeEntries, refreshTimeEntries } = useTimeEntries()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month')
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [filters, setFilters] = useState<CalendarFilters>({
    showTimeEntries: true,
    showTasks: false,
    billableOnly: false
  })
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadCalendarData()
  }, [currentDate, viewType, filters, timeEntries])

  const loadInitialData = async () => {
    if (!currentUser) return
    
    try {
      const projectsData = await projectService.getProjects()
      setProjects(projectsData)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadCalendarData = async () => {
    if (!currentUser) return
    
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      
      const days = await calendarService.getCalendarData(
        currentUser.uid,
        year,
        month,
        filters
      )
      
      setCalendarDays(days)
    } catch (error) {
      console.error('Error loading calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  const handleDateClick = (day: CalendarDay) => {
    setSelectedDate(day.date)
    setSelectedDay(day)
  }

  const handleEventClick = (event: CalendarEvent) => {
    // You can add event details modal here
    console.log('Event clicked:', event)
  }

  const getWeekDays = () => {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const getEventColor = (event: CalendarEvent) => {
    return event.color || '#6B7280'
  }

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        {getWeekDays().map(day => (
          <div key={day} className="bg-gray-100 dark:bg-gray-800 p-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
            {day}
          </div>
        ))}
        
        {/* Calendar Days */}
        {calendarDays.map((day, index) => (
          <div
            key={index}
            onClick={() => handleDateClick(day)}
            className={`
              bg-white dark:bg-gray-900 p-1 min-h-[80px] cursor-pointer transition-colors
              ${!day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''}
              ${day.isToday ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900' : ''}
              ${day.isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''}
              hover:bg-gray-50 dark:hover:bg-gray-800
            `}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium text-gray-900 dark:text-gray-100 ${day.isToday ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                {day.date.getDate()}
              </span>
              {day.totalDuration > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {calendarService.formatDuration(day.totalDuration)}
                </span>
              )}
            </div>
            
            {/* Events */}
            <div className="space-y-1">
              {day.events.slice(0, 2).map((event, eventIndex) => (
                <div
                  key={eventIndex}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEventClick(event)
                  }}
                  className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                  style={{ 
                    backgroundColor: getEventColor(event) + '20',
                    color: getEventColor(event)
                  }}
                >
                  {event.title}
                </div>
              ))}
              {day.events.length > 2 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  +{day.events.length - 2} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = calendarDays.filter(day => {
      const weekStart = new Date(currentDate)
      weekStart.setDate(currentDate.getDate() - currentDate.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      return day.date >= weekStart && day.date <= weekEnd
    })

    return (
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
        {getWeekDays().map((dayName, index) => {
          const day = weekDays[index]
          if (!day) return null
          
          return (
            <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{dayName}</div>
                  <div className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${day.isToday ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                    {day.date.getDate()}
                  </div>
                </div>
                {day.totalDuration > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {calendarService.formatDuration(day.totalDuration)}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {day.events.map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    onClick={() => handleEventClick(event)}
                    className="text-xs p-2 rounded cursor-pointer hover:opacity-80"
                    style={{ 
                      backgroundColor: getEventColor(event) + '20',
                      color: getEventColor(event)
                    }}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-xs opacity-75">
                      {event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderDayView = () => {
    const day = calendarDays.find(d => 
      d.date.toDateString() === currentDate.toDateString()
    )
    
    if (!day) return null

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(day.date)}
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {calendarService.formatDuration(day.totalDuration)} total
            </div>
          </div>
          
          {day.events.length > 0 ? (
            <div className="space-y-3">
              {day.events.map((event, index) => (
                <div
                  key={index}
                  onClick={() => handleEventClick(event)}
                  className="p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getEventColor(event) }}
                        />
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {event.title}
                        </h4>
                        {event.isBillable && (
                          <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                        )}
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {event.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                            {event.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{calendarService.formatDuration(event.duration)}</span>
                        </div>
                        {event.projectName && (
                          <span>{event.projectName}</span>
                        )}
                      </div>
                      
                      {event.tags && event.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {event.tags.map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries for this day</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderView = () => {
    switch (viewType) {
      case 'month':
        return renderMonthView()
      case 'week':
        return renderWeekView()
      case 'day':
        return renderDayView()
      default:
        return renderMonthView()
    }
  }

  const renderNavigation = () => {
    const navigate = viewType === 'month' ? navigateMonth : viewType === 'week' ? navigateWeek : navigateDay
    
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mx-4">
            {viewType === 'month' ? getMonthName(currentDate) : 
             viewType === 'week' ? `Week of ${formatDate(currentDate)}` :
             formatDate(currentDate)}
          </h2>
          
          <button
            onClick={() => navigate('next')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            Today
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="text-gray-600 dark:text-gray-400">View your time entries in calendar format</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Type Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['month', 'week', 'day'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={`px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                  viewType === type
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Filters</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Projects
              </label>
              <select
                multiple
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={filters.projectIds || []}
                onChange={(e) => {
                  const selectedIds = Array.from(e.target.selectedOptions, option => option.value)
                  setFilters(prev => ({ ...prev, projectIds: selectedIds }))
                }}
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.billableOnly || false}
                  onChange={(e) => setFilters(prev => ({ ...prev, billableOnly: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Billable only
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.showTimeEntries !== false}
                  onChange={(e) => setFilters(prev => ({ ...prev, showTimeEntries: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show time entries
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      {renderNavigation()}

      {/* Calendar Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Loading calendar...</p>
          </div>
        </div>
      ) : (
        renderView()
      )}

      {/* Selected Day Details */}
      {selectedDay && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(selectedDay.date)} Details
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {calendarService.formatDuration(selectedDay.totalDuration)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Time</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                {calendarService.formatDuration(selectedDay.billableDuration)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Billable Time</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {selectedDay.events.length}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Entries</div>
            </div>
          </div>
          
          {selectedDay.events.length > 0 && (
            <div className="space-y-2">
              {selectedDay.events.map((event, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getEventColor(event) }}
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {event.title}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {event.projectName || 'No project'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {calendarService.formatDuration(event.duration)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
