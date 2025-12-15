import { ref, set, get, push, remove, update, onValue, query, orderByChild, equalTo, limitToLast } from 'firebase/database'
import { database } from '../config/firebase'
import { Project, Client, CreateProjectData, CreateClientData } from '../types'

export const projectService = {
  // Projects
  async createProject(projectData: CreateProjectData, userId: string, companyId?: string | null): Promise<string> {
    const projectRef = push(ref(database, 'projects'))
    const newProject: Project = {
      ...projectData,
      id: projectRef.key!,
      isArchived: false,
      createdBy: userId,
      // @ts-ignore allow optional in persisted record
      companyId: companyId ?? undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Convert dates to ISO strings for Firebase storage
    const projectDataToSave: any = {
      ...newProject,
      createdAt: newProject.createdAt.toISOString(),
      updatedAt: newProject.updatedAt.toISOString()
    }
    
    await set(projectRef, projectDataToSave)
    return projectRef.key!
  },

  async getProjects(): Promise<Project[]> {
    const projectsRef = ref(database, 'projects')
    const snapshot = await get(projectsRef)
    
    if (snapshot.exists()) {
      const projects = snapshot.val()
      return Object.values(projects)
        .map((project: any) => ({
          ...project,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }))
        .filter((project: Project) => 
          !project.isArchived
        )
        .sort((a: Project, b: Project) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get archived projects
  async getArchivedProjects(): Promise<Project[]> {
    const projectsRef = ref(database, 'projects')
    const snapshot = await get(projectsRef)
    
    if (snapshot.exists()) {
      const projects = snapshot.val()
      return Object.values(projects)
        .map((project: any) => ({
          ...project,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }))
        .filter((project: Project) => 
          project.isArchived
        )
        .sort((a: Project, b: Project) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get archived projects for specific company (multi-tenant safe)
  async getArchivedProjectsForCompany(companyId: string | null): Promise<Project[]> {
    const projectsRef = ref(database, 'projects')
    const snapshot = await get(projectsRef)
    
    if (snapshot.exists()) {
      const projects = snapshot.val()
      return Object.values(projects)
        .map((project: any) => ({
          ...project,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }))
        .filter((project: Project) => {
          // Filter by company and archived status
          return project.isArchived && (project as any).companyId === companyId
        })
        .sort((a: Project, b: Project) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  // Get projects for specific company (multi-tenant safe)
  async getProjectsForCompany(companyId: string | null): Promise<Project[]> {
    const projectsRef = ref(database, 'projects')
    const snapshot = await get(projectsRef)
    
    if (snapshot.exists()) {
      const projects = snapshot.val()
      return Object.values(projects)
        .map((project: any) => ({
          ...project,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }))
        .filter((project: Project) => {
          // Filter by company and active status
          return !project.isArchived && (project as any).companyId === companyId
        })
        .sort((a: Project, b: Project) => b.createdAt.getTime() - a.createdAt.getTime())
    }
    
    return []
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const projectRef = ref(database, `projects/${projectId}`)
      const snapshot = await get(projectRef)
      
      if (snapshot.exists()) {
        const project = snapshot.val()
        console.log('Project data for ID', projectId, ':', project)
        return {
          ...project,
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }
      }
      
      console.log('No project found for ID:', projectId)
      return null
    } catch (error) {
      console.error('Error getting project by ID:', error)
      return null
    }
  },

  async updateProject(projectId: string, updates: Partial<CreateProjectData>): Promise<void> {
    const projectRef = ref(database, `projects/${projectId}`)
    
    // Filter out undefined values and convert dates to ISO strings for Firebase storage
    const updatesToSave: any = {
      updatedAt: new Date().toISOString()
    }
    
    // Only include defined values
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof CreateProjectData]
      if (value !== undefined) {
        updatesToSave[key] = value
      }
    })
    
    await update(projectRef, updatesToSave)
  },

  async deleteProject(projectId: string): Promise<void> {
    const projectRef = ref(database, `projects/${projectId}`)
    await remove(projectRef)
  },

  async archiveProject(projectId: string): Promise<void> {
    const projectRef = ref(database, `projects/${projectId}`)
    await update(projectRef, {
      isArchived: true,
      updatedAt: new Date()
    })
  },

  async unarchiveProject(projectId: string): Promise<void> {
    const projectRef = ref(database, `projects/${projectId}`)
    await update(projectRef, {
      isArchived: false,
      updatedAt: new Date()
    })
  },

  // Clients
  async createClient(clientData: CreateClientData, userId: string, companyId?: string | null): Promise<string> {
    const clientRef = push(ref(database, 'clients'))
    const newClient: Client = {
      ...clientData,
      id: clientRef.key!,
      isArchived: false,
      createdBy: userId,
      // @ts-ignore optional on persisted record
      companyId: companyId ?? undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Filter out undefined values and convert dates to ISO strings for Firebase storage
    const clientDataToSave: any = {
      id: newClient.id,
      name: newClient.name,
      email: newClient.email,
      country: newClient.country,
      timezone: newClient.timezone,
      clientType: newClient.clientType,
      hourlyRate: newClient.hourlyRate,
      phone: newClient.phone,
      company: newClient.company,
      address: newClient.address,
      currency: newClient.currency, // Add currency field
      // Persist if provided
      companyId: companyId ?? undefined,
      isArchived: newClient.isArchived,
      createdBy: newClient.createdBy,
      createdAt: newClient.createdAt.toISOString(),
      updatedAt: newClient.updatedAt.toISOString()
    }
    
    // Only include optional fields if they are defined
    if (newClient.hoursPerWeek !== undefined) {
      clientDataToSave.hoursPerWeek = newClient.hoursPerWeek
    }
    if (newClient.startDate !== undefined) {
      clientDataToSave.startDate = newClient.startDate.toISOString()
    }
    if (newClient.endDate !== undefined) {
      clientDataToSave.endDate = newClient.endDate.toISOString()
    }
    
    await set(clientRef, clientDataToSave)
    return clientRef.key!
  },

  async getClients(): Promise<Client[]> {
    const clientsRef = ref(database, 'clients')
    const snapshot = await get(clientsRef)
    
    if (snapshot.exists()) {
      const clients = snapshot.val()
      return Object.values(clients)
        .map((client: any) => ({
          ...client,
          createdAt: new Date(client.createdAt),
          updatedAt: new Date(client.updatedAt),
          startDate: client.startDate ? new Date(client.startDate) : undefined,
          endDate: client.endDate ? new Date(client.endDate) : undefined
        }))
        .filter((client: Client) => 
          !client.isArchived
        )
        .sort((a: Client, b: Client) => a.name.localeCompare(b.name))
    }
    
    return []
  },

  // Get clients for specific company (multi-tenant safe)
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    const clientsRef = ref(database, 'clients')
    const snapshot = await get(clientsRef)
    
    if (snapshot.exists()) {
      const clients = snapshot.val()
      return Object.values(clients)
        .map((client: any) => ({
          ...client,
          createdAt: new Date(client.createdAt),
          updatedAt: new Date(client.updatedAt),
          startDate: client.startDate ? new Date(client.startDate) : undefined,
          endDate: client.endDate ? new Date(client.endDate) : undefined
        }))
        .filter((client: Client) => {
          // Filter by company and active status
          return !client.isArchived && (client as any).companyId === companyId
        })
        .sort((a: Client, b: Client) => a.name.localeCompare(b.name))
    }
    
    return []
  },

  async getClientById(clientId: string): Promise<Client | null> {
    const clientRef = ref(database, `clients/${clientId}`)
    const snapshot = await get(clientRef)
    
    if (snapshot.exists()) {
      const client = snapshot.val()
      return {
        ...client,
        createdAt: new Date(client.createdAt),
        updatedAt: new Date(client.updatedAt),
        startDate: client.startDate ? new Date(client.startDate) : undefined,
        endDate: client.endDate ? new Date(client.endDate) : undefined
      }
    }
    
    return null
  },

  // Add this new function to check if a client with the same email already exists
  async getClientByEmail(email: string, companyId?: string | null): Promise<Client | null> {
    const clientsRef = ref(database, 'clients')
    const snapshot = await get(clientsRef)
    
    if (snapshot.exists()) {
      const clients = snapshot.val()
      const clientList = Object.values(clients)
        .map((client: any) => ({
          ...client,
          createdAt: new Date(client.createdAt),
          updatedAt: new Date(client.updatedAt),
          startDate: client.startDate ? new Date(client.startDate) : undefined,
          endDate: client.endDate ? new Date(client.endDate) : undefined
        }))
        .filter((client: Client) => !client.isArchived)
      
      // If companyId is provided, filter by company (multi-tenant)
      const filteredClients = companyId 
        ? clientList.filter((client: Client) => (client as any).companyId === companyId)
        : clientList
      
      // Find client with matching email (case insensitive)
      const existingClient = filteredClients.find((client: Client) => 
        client.email.toLowerCase() === email.toLowerCase()
      )
      
      return existingClient || null
    }
    
    return null
  },

  async updateClient(clientId: string, updates: Partial<CreateClientData>): Promise<void> {
    const clientRef = ref(database, `clients/${clientId}`)
    
    // Filter out undefined values and convert dates to ISO strings for Firebase storage
    const updatesToSave: any = {
      updatedAt: new Date().toISOString()
    }
    
    // Only include defined values
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof CreateClientData]
      if (value !== undefined) {
        if (key === 'startDate' || key === 'endDate') {
          // Convert dates to ISO strings
          updatesToSave[key] = value instanceof Date ? value.toISOString() : value
        } else {
          updatesToSave[key] = value
        }
      }
    })
    
    await update(clientRef, updatesToSave)
  },

  async deleteClient(clientId: string): Promise<void> {
    const clientRef = ref(database, `clients/${clientId}`)
    await remove(clientRef)
  },

  async archiveClient(clientId: string): Promise<void> {
    const clientRef = ref(database, `clients/${clientId}`)
    await update(clientRef, {
      isArchived: true,
      updatedAt: new Date()
    })
  },

  // Real-time listeners
  subscribeToProjects(
    callback: (projects: Project[]) => void,
    companyId?: string | null,
    limit?: number
  ): () => void {
    // Start with base reference
    let projectsQuery: any = ref(database, 'projects')
    
    // If companyId is provided, scope to that company
    if (companyId) {
      projectsQuery = query(projectsQuery, orderByChild('companyId'), equalTo(companyId))
    }
    
    // Add limit if provided
    if (limit) {
      projectsQuery = query(projectsQuery, limitToLast(limit))
    }
    
    const unsubscribe = onValue(projectsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const projects = snapshot.val()
        const formattedProjects = Object.values(projects)
          .map((project: any) => ({
            ...project,
            startDate: project.startDate ? new Date(project.startDate) : undefined,
            endDate: project.endDate ? new Date(project.endDate) : undefined,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt)
          }))
          .filter((project: Project) => !project.isArchived)
          .sort((a: Project, b: Project) => b.createdAt.getTime() - a.createdAt.getTime())
        
        callback(formattedProjects)
      } else {
        callback([])
      }
    })
    
    return unsubscribe
  },

  subscribeToClients(
    callback: (clients: Client[]) => void,
    companyId?: string | null,
    limit?: number
  ): () => void {
    // Start with base reference
    let clientsQuery: any = ref(database, 'clients')
    
    // If companyId is provided, scope to that company
    if (companyId) {
      clientsQuery = query(clientsQuery, orderByChild('companyId'), equalTo(companyId))
    }
    
    // Add limit if provided
    if (limit) {
      clientsQuery = query(clientsQuery, limitToLast(limit))
    }
    
    const unsubscribe = onValue(clientsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const clients = snapshot.val()
        const formattedClients = Object.values(clients)
          .map((client: any) => ({
            ...client,
            createdAt: new Date(client.createdAt),
            updatedAt: new Date(client.updatedAt),
            startDate: client.startDate ? new Date(client.startDate) : undefined,
            endDate: client.endDate ? new Date(client.endDate) : undefined
          }))
          .filter((client: Client) => !client.isArchived)
          .sort((a: Client, b: Client) => a.name.localeCompare(b.name))
        
        callback(formattedClients)
      } else {
        callback([])
      }
    })
    
    return unsubscribe
  }
}
