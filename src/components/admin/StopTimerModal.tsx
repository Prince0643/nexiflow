import { useState, useEffect } from 'react'
import { X, Clock, FolderOpen, Edit3 } from 'lucide-react'
import { TimeEntry, Project, Client } from '../../types'
import { projectService } from '../../services/projectService'

interface StopTimerModalProps {
  isOpen: boolean
  onClose: () => void
  timeEntry: TimeEntry | null
  projects: Project[]
  clients: Client[]
  onStopTimer: (entryId: string, updates: { projectId: string; description: string; clientId?: string }) => void
}

export default function StopTimerModal({ 
  isOpen, 
  onClose, 
  timeEntry, 
  projects, 
  clients,
  onStopTimer 
}: StopTimerModalProps) {
  const [formData, setFormData] = useState({
    projectId: '',
    clientId: '',
    description: ''
  })
  const [projectClients, setProjectClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (timeEntry) {
      setFormData({
        projectId: timeEntry.projectId || '',
        clientId: timeEntry.clientId || '',
        description: timeEntry.description || ''
      })
    }
  }, [timeEntry])

  useEffect(() => {
    if (formData.projectId) {
      const project = projects.find(p => p.id === formData.projectId)
      if (project?.clientId) {
        const client = clients.find(c => c.id === project.clientId)
        if (client) {
          setProjectClients([client])
          // Auto-select the client if it's tied to the project
          setFormData(prev => ({ ...prev, clientId: project.clientId || '' }))
        } else {
          setProjectClients([])
        }
      } else {
        // Show all clients if project doesn't have a specific client
        setProjectClients(clients)
      }
    } else {
      setProjectClients(clients)
    }
  }, [formData.projectId, projects, clients])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!timeEntry) return
    
    if (!formData.projectId) {
      alert('Please select a project')
      return
    }
    
    if (!formData.description.trim()) {
      alert('Please enter a description')
      return
    }
    
    setLoading(true)
    
    try {
      const project = projects.find(p => p.id === formData.projectId)
      const updates = {
        projectId: formData.projectId,
        description: formData.description.trim(),
        clientId: formData.clientId || project?.clientId || undefined,
        projectName: project?.name || undefined,
        clientName: project?.clientName || undefined
      }
      
      onStopTimer(timeEntry.id, updates)
      onClose()
    } catch (error) {
      console.error('Error stopping timer:', error)
      alert('Failed to stop timer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !timeEntry) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Stop Timer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Timer Details</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This timer needs to be stopped. Please provide the required information below.
                </p>
              </div>
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FolderOpen className="h-4 w-4 inline mr-1" />
              Project <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Select a project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Selection (if applicable) */}
          {projectClients.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client
              </label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select a client (optional)</option>
                {projectClients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Edit3 className="h-4 w-4 inline mr-1" />
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="What were you working on?"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Stopping...' : 'Stop Timer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}