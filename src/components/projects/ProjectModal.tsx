import React, { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { Project, Client, CreateProjectData } from '../../types'
import { projectApiService } from '../../services/projectApiService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { canAccessFeature } from '../../utils/permissions'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project?: Project | null
  onSuccess: () => void
}

const PROJECT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'text-green-600' },
  { value: 'on-hold', label: 'On Hold', color: 'text-yellow-600' },
  { value: 'completed', label: 'Completed', color: 'text-blue-600' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-600' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
]

export default function ProjectModal({ isOpen, onClose, project, onSuccess }: ProjectModalProps) {
  const { currentUser } = useMySQLAuth()
  const { isDarkMode } = useTheme()
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    color: PROJECT_COLORS[0],
    status: 'active',
    priority: 'medium',
    clientId: undefined
  })
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!project

  useEffect(() => {
    if (isOpen) {
      loadClients()
      if (project) {
        setFormData({
          name: project.name,
          description: project.description || '',
          color: project.color,
          status: project.status,
          priority: project.priority,
          clientId: project.clientId
        })
      } else {
        setFormData({
          name: '',
          description: '',
          color: PROJECT_COLORS[0],
          status: 'active',
          priority: 'medium',
          clientId: undefined
        })
      }
      setError('')
    }
  }, [isOpen, project])

  const loadClients = async () => {
    try {
      // Use company-scoped client loading to respect multi-tenancy
      const clientsData = currentUser?.companyId 
        ? await projectApiService.getClientsForCompany(currentUser.companyId)
        : await projectApiService.getClients()
      setClients(clientsData)
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    // Permission check
    if (!currentUser.role || !canAccessFeature(currentUser.role, 'projects')) {
      setError('You do not have permission to manage projects')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isEdit) {
        await projectApiService.updateProject(project!.id, formData)
      } else {
        await projectApiService.createProject(formData)
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => {
      // Normalize empty client selection to undefined to satisfy backend validation
      if (name === 'clientId') {
        return {
          ...prev,
          clientId: value ? value : undefined
        }
      }
      return {
        ...prev,
        [name]: type === 'number' ? (value ? Number(value) : undefined) : value
      }
    })
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {isEdit ? 'Edit Project' : 'Create New Project'}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className={`flex items-center space-x-2 p-3 rounded-lg ${isDarkMode ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
              <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              <p className={`text-sm ${isDarkMode ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label htmlFor="name" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Project Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              placeholder="Enter project name"
              required
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              rows={3}
              placeholder="Enter project description"
              disabled={loading}
            />
          </div>

          {/* Color and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color 
                        ? isDarkMode 
                          ? 'border-gray-300' 
                          : 'border-gray-900' 
                        : isDarkMode 
                          ? 'border-gray-600' 
                          : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="status" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                disabled={loading}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority and Client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="priority" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                disabled={loading}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="clientId" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Client
              </label>
              <select
                id="clientId"
                name="clientId"
                value={formData.clientId || ''}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                disabled={loading}
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>


          {/* Actions */}
          <div className={`flex justify-end space-x-3 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEdit ? 'Update Project' : 'Create Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
