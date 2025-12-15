import { useState, useEffect } from 'react'
import { X, Clock, User, FolderOpen, DollarSign, Save, Trash2 } from 'lucide-react'
import { TimeEntry, Project, User as UserType } from '../../types'
import { timeEntryService } from '../../services/timeEntryService'
import { projectService } from '../../services/projectService'
import { userService } from '../../services/userService'

interface TimeEntryEditModalProps {
  isOpen: boolean
  onClose: () => void
  timeEntry: TimeEntry | null
  onSave: (updatedEntry: TimeEntry) => void
  onDelete: (entryId: string) => void
}

export default function TimeEntryEditModal({ 
  isOpen, 
  onClose, 
  timeEntry, 
  onSave, 
  onDelete 
}: TimeEntryEditModalProps) {
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [formData, setFormData] = useState({
    description: '',
    projectId: '',
    userId: '',
    startTime: '',
    endTime: '',
    duration: '',
    isBillable: false
  })

  useEffect(() => {
    if (isOpen && timeEntry) {
      // Load projects and users
      loadData()
      
      // Set form data from time entry
      const startTime = new Date(timeEntry.startTime)
      const endTime = timeEntry.endTime ? new Date(timeEntry.endTime) : new Date()
      const duration = timeEntry.duration || 0
      
      setFormData({
        description: timeEntry.description || '',
        projectId: timeEntry.projectId || '',
        userId: timeEntry.userId || '',
        startTime: startTime.toISOString().slice(0, 16), // Format for datetime-local input
        endTime: endTime.toISOString().slice(0, 16),
        duration: formatDuration(duration),
        isBillable: timeEntry.isBillable || false
      })
    }
  }, [isOpen, timeEntry])

  const loadData = async () => {
    try {
      const [projectsData, usersData] = await Promise.all([
        projectService.getProjects(),
        userService.getAllUsers()
      ])
      setProjects(projectsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const parseDuration = (durationStr: string): number => {
    const parts = durationStr.split(':').map(Number)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const newFormData = {
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }

    // Handle connected fields
    if (name === 'duration') {
      // When duration changes, adjust end time based on start time
      const startTime = new Date(newFormData.startTime)
      const durationSeconds = parseDuration(value)
      const newEndTime = new Date(startTime.getTime() + durationSeconds * 1000)
      
      newFormData.endTime = newEndTime.toISOString().slice(0, 16)
    } else if (name === 'startTime') {
      // When start time changes, recalculate duration based on end time
      const startTime = new Date(value)
      const endTime = new Date(newFormData.endTime)
      const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000))
      
      newFormData.duration = formatDuration(durationSeconds)
    } else if (name === 'endTime') {
      // When end time changes, recalculate duration based on start time
      const startTime = new Date(newFormData.startTime)
      const endTime = new Date(value)
      const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000))
      
      newFormData.duration = formatDuration(durationSeconds)
    }

    setFormData(newFormData)
  }

  const handleSave = async () => {
    if (!timeEntry) return

    try {
      setLoading(true)
      
      const startTime = new Date(formData.startTime)
      const endTime = new Date(formData.endTime)
      const duration = parseDuration(formData.duration)
      
      const updates = {
        description: formData.description,
        projectId: formData.projectId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        isBillable: formData.isBillable
      }

      await timeEntryService.updateTimeEntry(timeEntry.id, updates)
      
      // Create updated entry object
      const updatedEntry: TimeEntry = {
        ...timeEntry,
        ...updates,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        updatedAt: new Date()
      }

      onSave(updatedEntry)
      onClose()
    } catch (error) {
      console.error('Error updating time entry:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!timeEntry) return

    if (window.confirm('Are you sure you want to delete this time entry?')) {
      try {
        setLoading(true)
        await timeEntryService.deleteTimeEntry(timeEntry.id)
        onDelete(timeEntry.id)
        onClose()
      } catch (error) {
        console.error('Error deleting time entry:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  if (!isOpen || !timeEntry) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Clock className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Edit Time Entry
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="h-4 w-4 inline mr-1" />
              User
            </label>
            <select
              name="userId"
              value={formData.userId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select User</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FolderOpen className="h-4 w-4 inline mr-1" />
              Project
            </label>
            <select
              name="projectId"
              value={formData.projectId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select Project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter time entry description..."
            />
          </div>

          {/* Time Range - Connected Fields */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center mb-3">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Time Fields (Auto-connected)
              </span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-300 mb-4">
              Changing any field will automatically adjust the others. Duration changes will update end time, and time changes will recalculate duration.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration (HH:MM:SS)
              </label>
              <input
                type="text"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                placeholder="00:00:00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Billable */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isBillable"
              checked={formData.isBillable}
              onChange={handleInputChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              <DollarSign className="h-4 w-4 inline mr-1" />
              Billable
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDelete}
            className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            disabled={loading}
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
