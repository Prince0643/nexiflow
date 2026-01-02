import { useState } from 'react'
import { 
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
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { Task, TaskStatus, TaskPriority, Team } from '../../types'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { canDeleteTask } from '../../utils/permissions'

interface TaskTableProps {
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

export default function TaskTable({ 
  tasks, 
  statuses, 
  priorities, 
  teams = [],
  onTaskUpdate, 
  onCreateTask, 
  onEditTask,
  onViewTask,
  onDeleteTask
}: TaskTableProps) {
  const { currentUser } = useMySQLAuth()
  const [dropdownTaskId, setDropdownTaskId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Calculate pagination
  const totalPages = Math.ceil(tasks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTasks = tasks.slice(startIndex, endIndex)

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

  const formatDate = (date: Date | undefined) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Pagination functions
  const goToFirstPage = () => setCurrentPage(1)
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1))
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1))
  const goToLastPage = () => setCurrentPage(totalPages)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-3/12">
                Task
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-2/12">
                Project
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">
                Priority
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-2/12">
                Assignee
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">
                Due Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">
                Team
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {currentTasks.map((task) => {
              const priority = typeof task.priority === 'string' 
                ? priorities.find(p => p.id === (task.priority as unknown as string)) || { id: task.priority, name: task.priority, level: 1, color: '#6B7280' }
                : task.priority
              
              return (
                <tr 
                  key={task.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                  onClick={() => onViewTask(task)}
                >
                  <td className="px-6 py-4 whitespace-nowrap w-3/12">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                        style={{ backgroundColor: priority.color }}
                      />
                      <div className="truncate max-w-xs">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 truncate">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-2/12">
                    <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {task.projectName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/12">
                    {(() => {
                      const status = typeof task.status === 'string'
                        ? statuses.find(s => s.id === task.status) || { id: task.status, name: task.status, color: '#6B7280', order: 0, isCompleted: false }
                        : task.status

                      return (
                        <span 
                          className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white truncate"
                          style={{ backgroundColor: status.color }}
                        >
                          {status.name}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/12">
                    <div className="flex items-center">
                      {getPriorityIcon(priority.name)}
                      <span className="ml-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                        {priority.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-2/12">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1 flex-shrink-0" />
                      <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                        {task.assigneeName || 'Unassigned'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/12">
                    {task.dueDate && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1 flex-shrink-0" />
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {formatDate(task.dueDate)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/12">
                    {task.teamId && (
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1 flex-shrink-0" />
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {getTeamName(task.teamId)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-1/12">
                    <div className="relative flex justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setDropdownTaskId(dropdownTaskId === task.id ? null : task.id)
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                      
                      {/* Dropdown menu */}
                      {dropdownTaskId === task.id && (
                        <div 
                          className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
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
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {tasks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            No tasks found. 
            <button
              onClick={onCreateTask}
              className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create your first task
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {tasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 flex-shrink-0">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, tasks.length)}</span> of{' '}
                <span className="font-medium">{tasks.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <span className="sr-only">First</span>
                  <ChevronsLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <span className="sr-only">Last</span>
                  <ChevronsRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}