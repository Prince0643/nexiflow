import { useState, useEffect } from 'react'

import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Archive,
  AlertCircle,
  Info
} from 'lucide-react'

import { Project, Client } from '../types'
import { projectApiService } from '../services/projectApiService'
import ProjectModal from '../components/projects/ProjectModal'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { canAccessFeature } from '../utils/permissions'
import { formatDate } from '../utils'

const STATUS_COLORS = {
  active: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300',
  'on-hold': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300',
  completed: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300',
  cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300'
}

const PRIORITY_COLORS = {
  low: 'text-gray-600 dark:text-gray-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  high: 'text-orange-600 dark:text-orange-400',
  urgent: 'text-red-600 dark:text-red-400'
}

export default function Projects() {
  const { currentUser, currentCompany } = useMySQLAuth()
  const PAGE_SIZE = 8
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [error, setError] = useState('')
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const [pageIndex, setPageIndex] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [activeProjectsCount, setActiveProjectsCount] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250)
    return () => window.clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPageIndex(0)
  }, [showArchived, currentUser?.companyId, statusFilter, debouncedSearch])

  useEffect(() => {
    loadData()
  }, [showArchived, currentUser?.companyId, statusFilter, debouncedSearch, pageIndex])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePageIndex = Math.min(pageIndex, totalPages - 1)
  const startItem = totalCount === 0 ? 0 : safePageIndex * PAGE_SIZE + 1
  const endItem = Math.min(totalCount, safePageIndex * PAGE_SIZE + projects.length)

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1))
    }
  }, [pageIndex, totalPages])

  const loadData = async () => {
    setLoading(true)
    try {
      if (!currentUser) return

      const offset = pageIndex * PAGE_SIZE

      const projectsPromise = currentUser.companyId
        ? projectApiService.getProjectsForCompanyPage(currentUser.companyId, {
            includeArchived: showArchived,
            status: statusFilter,
            search: debouncedSearch,
            limit: PAGE_SIZE,
            offset
          })
        : projectApiService.getProjectsPage({
            includeArchived: showArchived,
            status: statusFilter,
            search: debouncedSearch,
            limit: PAGE_SIZE,
            offset
          })

      const clientsPromise = currentUser.companyId
        ? projectApiService.getClientsForCompany(currentUser.companyId)
        : projectApiService.getClients()

      const activeCountPromise = currentCompany?.pricingLevel === 'solo'
        ? (currentUser.companyId
            ? projectApiService.getProjectsForCompanyPage(currentUser.companyId, {
                includeArchived: false,
                status: 'all',
                search: '',
                limit: 1,
                offset: 0
              })
            : projectApiService.getProjectsPage({
                includeArchived: false,
                status: 'all',
                search: '',
                limit: 1,
                offset: 0
              }))
        : Promise.resolve({ data: [], count: 0 })

      const [{ data: projectsData, count }, clientsData, activeCountResult] = await Promise.all([
        projectsPromise,
        clientsPromise,
        activeCountPromise
      ])

      setProjects(projectsData)
      setTotalCount(count)
      setClients(clientsData)
      if (currentCompany?.pricingLevel === 'solo') {
        setActiveProjectsCount(activeCountResult.count)
      }
    } catch (error) {
      setError('Failed to load projects')
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = () => {
    // Check if user is on solo pricing level and has reached the project limit
    // Office and Enterprise plans have unlimited projects
    if (currentCompany?.pricingLevel === 'solo' && activeProjectsCount >= 1) {
      setError('Solo plan is limited to 1 project. Please upgrade to create more projects.')
      return
    }
    
    setSelectedProject(null)
    setShowProjectModal(true)
  }

  const handleEditProject = (project: Project) => {
    setSelectedProject(project)
    setShowProjectModal(true)
    setOpenProjectId(null) // Close dropdown after selection
  }

  const handleDeleteProject = async (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      try {
        await projectApiService.deleteProject(project.id)
        loadData()
      } catch (error) {
        setError('Failed to delete project')
      }
    }
    setOpenProjectId(null) // Close dropdown after selection
  }

  const handleArchiveProject = async (project: Project) => {
    try {
      await projectApiService.archiveProject(project.id)
      loadData()
    } catch (error) {
      setError('Failed to archive project')
    }
    setOpenProjectId(null) // Close dropdown after selection
  }

  const handleUnarchiveProject = async (project: Project) => {
    try {
      await projectApiService.unarchiveProject(project.id)
      loadData()
    } catch (error) {
      setError('Failed to unarchive project')
    }
    setOpenProjectId(null) // Close dropdown after selection
  }

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'No client'
    const client = clients.find(c => c.id === clientId)
    return client?.name || 'Unknown client'
  }

  // Permission check
  if (!currentUser?.role || !canAccessFeature(currentUser.role, 'projects')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-center p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl sm:text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 scrollbar-visible">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your projects</p>
        </div>
        
        <div className="flex space-x-3">
          {currentUser?.role && canAccessFeature(currentUser.role, 'projects') && (
            <button
              onClick={handleCreateProject}
              disabled={currentCompany?.pricingLevel === 'solo' && activeProjectsCount >= 1}
              className={`flex items-center space-x-2 ${currentCompany?.pricingLevel === 'solo' && activeProjectsCount >= 1 ? 'btn-secondary cursor-not-allowed opacity-50' : 'btn-primary'}`}
              title={currentCompany?.pricingLevel === 'solo' && activeProjectsCount >= 1 ? 'Solo plan is limited to 1 project. Please upgrade to create more projects.' : ''}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Project Limit Info for Solo Plan */}
      {currentCompany?.pricingLevel === 'solo' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/30 dark:border-blue-800">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 dark:text-blue-400" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Project Limit</h3>
              <p className="text-sm text-blue-700 mt-1 dark:text-blue-300">
                Your Solo plan is limited to 1 project. You have {activeProjectsCount} of 1 project slots used.
              </p>
              <p className="text-sm text-blue-700 mt-1 dark:text-blue-300">
                Upgrade to Office or Enterprise plan to create more projects.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input h-10 min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 h-10 rounded-lg border text-sm inline-flex items-center ${
              showArchived 
                ? 'bg-primary-100 dark:bg-primary-900 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300' 
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="hidden xs:inline">
              {showArchived ? 'Showing Archived' : 'Show Archived'}
            </span>
            <span className="xs:hidden">
              {showArchived ? 'Archived' : 'Archive'}
            </span>
          </button>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {startItem}-{endItem} of {totalCount}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={safePageIndex <= 0}
            className={`px-3 h-10 rounded-lg border text-sm ${
              safePageIndex <= 0
                ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            Prev
          </button>

          <div className="px-2 h-10 inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
            Page {safePageIndex + 1} / {totalPages}
          </div>

          <button
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePageIndex >= totalPages - 1}
            className={`px-3 h-10 rounded-lg border text-sm ${
              safePageIndex >= totalPages - 1
                ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            Next
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Plus className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {showArchived ? 'No archived projects found' : 'No projects found'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 px-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : showArchived 
                ? 'There are no archived projects yet'
                : 'Get started by creating your first project'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && !showArchived && (
            <button
              onClick={handleCreateProject}
              className="btn-primary mx-4"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Grid View */}
          <div className="grid grid-cols-1 sm:hidden gap-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{project.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="relative ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenProjectId(openProjectId === project.id ? null : project.id);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openProjectId === project.id && (
                      <div
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleEditProject(project)}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        {showArchived ? (
                          <button
                            onClick={() => handleUnarchiveProject(project)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Unarchive
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveProject(project)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteProject(project)}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Client</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{getClientName(project.clientId)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Status</div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}`}>
                      {project.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Priority</div>
                    <div className={`font-medium ${PRIORITY_COLORS[project.priority as keyof typeof PRIORITY_COLORS]}`}>{project.priority}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Start</div>
                    <div className="text-gray-700 dark:text-gray-300">
                      {project.startDate ? formatDate(project.startDate) : '-'}
                    </div>
                  </div>
                </div>
                
                {project.budget && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Budget</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">${project.budget.toLocaleString()}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Budget</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{project.name}</div>
                          {project.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{project.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{getClientName(project.clientId)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}`}>
                        {project.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${PRIORITY_COLORS[project.priority as keyof typeof PRIORITY_COLORS]}`}>{project.priority}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {project.startDate ? formatDate(project.startDate) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {project.budget ? `$${project.budget.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenProjectId(openProjectId === project.id ? null : project.id);
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openProjectId === project.id && (
                          <div
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleEditProject(project)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </button>
                            {showArchived ? (
                              <button
                                onClick={() => handleUnarchiveProject(project)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Unarchive
                              </button>
                            ) : (
                              <button
                                onClick={() => handleArchiveProject(project)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteProject(project)}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modals */}
      <ProjectModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        project={selectedProject}
        onSuccess={loadData}
      />
    </div>
  )
}