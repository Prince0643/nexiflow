import { useState } from 'react'
import { 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  User, 
  DollarSign,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Pause,
  Play
} from 'lucide-react'
import { Project } from '../../types'

interface NotionBoardProps {
  projects: Project[]
  onProjectUpdate: (projectId: string, updates: Partial<Project>) => void
  onCreateProject: () => void
}

const STATUS_COLUMNS = [
  { 
    id: 'not-started', 
    title: 'Not Started', 
    color: 'bg-gray-100 border-gray-300',
    status: 'active' as const,
    priority: 'low' as const
  },
  { 
    id: 'in-progress', 
    title: 'In Progress', 
    color: 'bg-blue-100 border-blue-300',
    status: 'active' as const,
    priority: 'medium' as const
  },
  { 
    id: 'for-revisions', 
    title: 'For Revisions', 
    color: 'bg-orange-100 border-orange-300',
    status: 'on-hold' as const,
    priority: 'high' as const
  },
  { 
    id: 'for-approval', 
    title: 'For Approval', 
    color: 'bg-purple-100 border-purple-300',
    status: 'on-hold' as const,
    priority: 'high' as const
  },
  { 
    id: 'done', 
    title: 'Done', 
    color: 'bg-green-100 border-green-300',
    status: 'completed' as const,
    priority: 'low' as const
  }
]

const PRIORITY_ICONS = {
  low: Circle,
  medium: Play,
  high: AlertCircle,
  urgent: AlertCircle
}

const PRIORITY_COLORS = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500'
}

export default function NotionBoard({ projects, onProjectUpdate, onCreateProject }: NotionBoardProps) {
  const [draggedProject, setDraggedProject] = useState<string | null>(null)

  const getProjectsForColumn = (columnId: string) => {
    const column = STATUS_COLUMNS.find(col => col.id === columnId)
    if (!column) return []
    
    return projects.filter(project => {
      if (columnId === 'not-started') {
        return project.status === 'active' && project.priority === 'low'
      } else if (columnId === 'in-progress') {
        return project.status === 'active' && project.priority === 'medium'
      } else if (columnId === 'for-revisions') {
        return project.status === 'on-hold' && project.priority === 'high'
      } else if (columnId === 'for-approval') {
        return project.status === 'on-hold' && project.priority === 'high'
      } else if (columnId === 'done') {
        return project.status === 'completed'
      }
      return false
    })
  }

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProject(projectId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    
    if (!draggedProject) return
    
    const column = STATUS_COLUMNS.find(col => col.id === columnId)
    if (!column) return
    
    // Update project status and priority based on column
    const updates: Partial<Project> = {
      status: column.status,
      priority: column.priority
    }
    
    onProjectUpdate(draggedProject, updates)
    setDraggedProject(null)
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'on-hold':
        return <Pause className="h-4 w-4 text-orange-500" />
      case 'active':
        return <Play className="h-4 w-4 text-blue-500" />
      default:
        return <Circle className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
            <p className="text-gray-600">Organize and track your projects</p>
          </div>
          
          <button 
            onClick={onCreateProject}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex overflow-x-auto p-6 space-x-6">
        {STATUS_COLUMNS.map((column) => {
          const columnProjects = getProjectsForColumn(column.id)
          
          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className={`${column.color} border rounded-lg p-4 mb-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded-full">
                    {columnProjects.length}
                  </span>
                </div>
              </div>

              {/* Projects */}
              <div className="space-y-3">
                {columnProjects.map((project) => {
                  const PriorityIcon = PRIORITY_ICONS[project.priority]
                  
                  return (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, project.id)}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-move group"
                    >
                      {/* Project Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <h4 className="font-medium text-gray-900">
                            {project.name}
                          </h4>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-all">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Project Description */}
                      {project.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {/* Project Meta */}
                      <div className="space-y-2">
                        {/* Priority */}
                        <div className="flex items-center space-x-2">
                          <PriorityIcon className={`h-4 w-4 ${PRIORITY_COLORS[project.priority]}`} />
                          <span className="text-sm text-gray-600 capitalize">
                            {project.priority} priority
                          </span>
                        </div>

                        {/* Client */}
                        {project.clientName && (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {project.clientName}
                            </span>
                          </div>
                        )}

                        {/* Budget */}
                        {project.budget && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              ${project.budget.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* Dates */}
                        {(project.startDate || project.endDate) && (
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {project.startDate && formatDate(project.startDate)}
                              {project.startDate && project.endDate && ' - '}
                              {project.endDate && formatDate(project.endDate)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Add New Project Button */}
                <button
                  onClick={onCreateProject}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors group"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Add Project</span>
                  </div>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
