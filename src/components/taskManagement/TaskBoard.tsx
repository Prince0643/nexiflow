import { useState, useEffect, useRef } from 'react'
import { 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  User, 
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Play,
  Flag,
  Edit,
  Eye,
  Trash2,
  Building2
} from 'lucide-react'
import { Task, TaskStatus, TaskPriority, Team } from '../../types'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { canDeleteTask } from '../../utils/permissions'

interface TaskBoardProps {
  tasks: Task[]
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  teams?: Team[]
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onCreateTask: () => void
  onEditTask: (task: Task) => void
  onViewTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

const PRIORITY_ICONS = {
  low: Circle,
  medium: Play,
  high: AlertCircle,
  urgent: Flag
}

const PRIORITY_COLORS = {
  low: 'text-gray-500 dark:text-gray-400',
  medium: 'text-blue-500 dark:text-blue-400',
  high: 'text-orange-500 dark:text-orange-400',
  urgent: 'text-red-500 dark:text-red-400'
}

export default function TaskBoard({ 
  tasks, 
  statuses, 
  priorities, 
  teams = [], // Add teams prop with default value
  onTaskUpdate, 
  onCreateTask, 
  onEditTask,
  onViewTask,
  onDeleteTask
}: TaskBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dropdownTaskId, setDropdownTaskId] = useState<string | null>(null)
  const { currentUser } = useMySQLAuth()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownTaskId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getTasksForStatus = (statusId: string) => {
    return tasks.filter(task => {
      // Handle both object and string status formats
      if (typeof task.status === 'string') {
        return task.status === statusId
      }
      return task.status.id === statusId
    })
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, statusId: string) => {
    e.preventDefault()
    
    if (!draggedTask) return
    
    const newStatus = statuses.find(s => s.id === statusId)
    if (!newStatus) return
    
    onTaskUpdate(draggedTask, { status: newStatus })
    setDraggedTask(null)
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getPriorityIcon = (priority: TaskPriority | string) => {
    const priorityName = typeof priority === 'string' ? priority : priority.name
    const IconComponent = PRIORITY_ICONS[priorityName.toLowerCase() as keyof typeof PRIORITY_ICONS] || Circle
    return <IconComponent className={`h-4 w-4 ${PRIORITY_COLORS[priorityName.toLowerCase() as keyof typeof PRIORITY_COLORS] || 'text-gray-500'}`} />
  }

  const getStatusColor = (status: TaskStatus) => {
    return `bg-${status.color.replace('#', '')} border-${status.color.replace('#', '')}`
  }

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId)
    return team ? team.name : `Team ${teamId}`
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Board */}
      <div className="flex overflow-x-auto overflow-y-auto p-6 space-x-6 h-full">
        {statuses.map((status) => {
          const statusTasks = getTasksForStatus(status.id)
          
          return (
            <div
              key={status.id}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status.id)}
            >
              {/* Status Header */}
              <div className={`${status.color} border rounded-lg p-4 mb-4`} style={{ backgroundColor: status.color + '20', borderColor: status.color }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{status.name}</h3>
                  <span className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                    {statusTasks.length}
                  </span>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                {statusTasks.map((task) => {
                  const priority = typeof task.priority === 'string' 
                    ? priorities.find(p => p.id === (task.priority as unknown as string)) || { id: task.priority, name: task.priority, level: 1, color: '#6B7280' }
                    : task.priority
                  
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onViewTask(task)}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow cursor-pointer group"
                    >
                      {/* Task Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: priority.color }}
                          />
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {task.title}
                          </h4>
                        </div>
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setDropdownTaskId(dropdownTaskId === task.id ? null : task.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          
                          {/* Dropdown menu */}
                          {dropdownTaskId === task.id && (
                            <div 
                              ref={dropdownRef}
                              className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  onViewTask(task)
                                  setDropdownTaskId(null)
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </button>
                              <button
                                onClick={() => {
                                  onEditTask(task)
                                  setDropdownTaskId(null)
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Task
                              </button>
                              {currentUser && canDeleteTask(currentUser.role, task.createdBy, currentUser.uid) && (
                                <button
                                  onClick={() => {
                                    onDeleteTask(task.id)
                                    setDropdownTaskId(null)
                                  }}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Task
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Task Description */}
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Task Meta */}
                      <div className="space-y-2">
                        {/* Priority */}
                        <div className="flex items-center space-x-2">
                          {getPriorityIcon(priority.name)}
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {priority.name} priority
                          </span>
                        </div>

                      {/* Project */}
                      {task.projectName && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {task.projectName}
                          </span>
                        </div>
                      )}

                      {/* Creator */}
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Created by {task.createdByName || 'Unknown'}
                        </span>
                      </div>

                      {/* Assignee */}
                      {task.assigneeName && (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Assigned to {task.assigneeName}
                          </span>
                        </div>
                      )}

                      {/* Due Date */}
                      {task.dueDate && (
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Due {formatDate(task.dueDate)}
                          </span>
                        </div>
                      )}

                      {/* Estimated Hours */}
                      {task.estimatedHours && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {task.estimatedHours}h estimated
                          </span>
                        </div>
                      )}

                      {/* Actual Hours */}
                      {task.actualHours && task.actualHours > 0 && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {task.actualHours}h logged
                          </span>
                        </div>
                      )}

                      {/* Team */}
                      {task.teamId && (
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Team: {getTeamName(task.teamId)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    </div>
                  )
                })}

                {/* Add New Task Button */}
                <button
                  onClick={onCreateTask}
                  className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors group"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Add Task</span>
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
