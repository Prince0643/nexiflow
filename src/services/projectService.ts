import { Project, Client, CreateProjectData, CreateClientData } from '../types'
import { projectApiService } from './projectApiService'
import { clientApiService } from './clientApiService'

const POLLING_INTERVAL = 30000 // 30 seconds

export const projectService = {
  // Projects
  async createProject(projectData: CreateProjectData, _userId: string, _companyId?: string | null): Promise<string> {
    const result = await projectApiService.createProject(projectData)
    return String(result.id)
  },

  async getProjects(): Promise<Project[]> {
    return projectApiService.getProjects()
  },

  // Get archived projects - TODO: backend needs archived filter support
  async getArchivedProjects(): Promise<Project[]> {
    console.warn('[projectService] getArchivedProjects not fully implemented in API')
    const all = await projectApiService.getProjects(true)
    return all.filter(p => p.isArchived)
  },

  // Get archived projects for specific company - TODO: backend needs archived filter
  async getArchivedProjectsForCompany(companyId: string | null): Promise<Project[]> {
    if (!companyId) return []
    console.warn('[projectService] getArchivedProjectsForCompany not fully implemented in API')
    const all = await projectApiService.getProjectsForCompany(companyId, true)
    return all.filter(p => p.isArchived)
  },

  // Get projects for specific company
  async getProjectsForCompany(companyId: string | null): Promise<Project[]> {
    return projectApiService.getProjectsForCompany(companyId)
  },

  // TODO: Backend needs GET /api/projects/:id endpoint
  async getProjectById(projectId: string): Promise<Project | null> {
    console.warn('[projectService] getProjectById not implemented in API, fetching all')
    const all = await this.getProjects()
    return all.find(p => String(p.id) === projectId) || null
  },

  // TODO: Backend needs PUT /api/projects/:id endpoint
  async updateProject(projectId: string, updates: Partial<CreateProjectData>): Promise<void> {
    console.warn('[projectService] updateProject not implemented in API')
    throw new Error('Project update not yet implemented in MySQL backend')
  },

  // TODO: Backend needs DELETE /api/projects/:id endpoint
  async deleteProject(projectId: string): Promise<void> {
    console.warn('[projectService] deleteProject not implemented in API')
    throw new Error('Project deletion not yet implemented in MySQL backend')
  },

  // TODO: Backend needs PUT /api/projects/:id/archive endpoint
  async archiveProject(projectId: string): Promise<void> {
    console.warn('[projectService] archiveProject not implemented in API')
    throw new Error('Project archive not yet implemented in MySQL backend')
  },

  // TODO: Backend needs PUT /api/projects/:id/unarchive endpoint
  async unarchiveProject(projectId: string): Promise<void> {
    console.warn('[projectService] unarchiveProject not implemented in API')
    throw new Error('Project unarchive not yet implemented in MySQL backend')
  },

  // Clients
  async createClient(clientData: CreateClientData, _userId: string, _companyId?: string | null): Promise<string> {
    const result = await clientApiService.createClient(clientData)
    return String(result.id)
  },

  async getClients(): Promise<Client[]> {
    return projectApiService.getClients()
  },

  // Get clients for specific company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    return projectApiService.getClientsForCompany(companyId)
  },

  // TODO: Backend needs GET /api/clients/:id endpoint
  async getClientById(clientId: string): Promise<Client | null> {
    console.warn('[projectService] getClientById not implemented in API, fetching all')
    const all = await this.getClients()
    return all.find(c => String(c.id) === clientId) || null
  },

  // Check if client with email exists
  async getClientByEmail(email: string, companyId?: string | null): Promise<Client | null> {
    const all = companyId
      ? await projectApiService.getClientsForCompany(companyId)
      : await projectApiService.getClients()
    const existing = all.find((c: Client) => c.email?.toLowerCase() === email.toLowerCase())
    return existing || null
  },

  // TODO: Backend needs PUT /api/clients/:id endpoint (exists but returns 405?)
  async updateClient(clientId: string, updates: Partial<CreateClientData>): Promise<void> {
    return clientApiService.updateClient(clientId, updates)
  },

  // TODO: Backend needs DELETE /api/clients/:id endpoint
  async deleteClient(clientId: string): Promise<void> {
    console.warn('[projectService] deleteClient not implemented in API')
    throw new Error('Client deletion not yet implemented in MySQL backend')
  },

  // TODO: Backend needs PUT /api/clients/:id/archive endpoint
  async archiveClient(clientId: string): Promise<void> {
    console.warn('[projectService] archiveClient not implemented in API')
    throw new Error('Client archive not yet implemented in MySQL backend')
  },

  // Polling-based "real-time" listeners
  subscribeToProjects(
    callback: (projects: Project[]) => void,
    companyId?: string | null,
    _limit?: number
  ): () => void {
    let cancelled = false

    const loadProjects = async () => {
      try {
        const projects = companyId
          ? await projectApiService.getProjectsForCompany(companyId)
          : await projectApiService.getProjects()
        if (!cancelled) callback(projects.filter(p => !p.isArchived))
      } catch (error) {
        console.error('[projectService] Failed to poll projects:', error)
      }
    }

    loadProjects()
    const interval = window.setInterval(loadProjects, POLLING_INTERVAL)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  },

  subscribeToClients(
    callback: (clients: Client[]) => void,
    companyId?: string | null,
    _limit?: number
  ): () => void {
    let cancelled = false

    const loadClients = async () => {
      try {
        const clients = companyId
          ? await projectApiService.getClientsForCompany(companyId)
          : await projectApiService.getClients()
        if (!cancelled) callback(clients.filter(c => !c.isArchived))
      } catch (error) {
        console.error('[projectService] Failed to poll clients:', error)
      }
    }

    loadClients()
    const interval = window.setInterval(loadClients, POLLING_INTERVAL)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }
}
