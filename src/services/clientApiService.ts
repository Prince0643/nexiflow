import { Client } from '../types'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// Get auth token for authentication
const getAuthToken = async (): Promise<string | null> => {
  try {
    // In a real implementation, you would get the token from your auth context
    // For now, we'll return a placeholder - in practice, this would come from your auth system
    return localStorage.getItem('authToken') || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

// Generic API request function
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getAuthToken()
  
  const url = `${API_BASE_URL}${endpoint}`
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // If the error is due to an invalid or expired token, redirect to login
      if (response.status === 401 || response.status === 403) {
        // Clear the expired token from localStorage
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentCompany')
        
        // Redirect to login page
        window.location.href = '/login'
        
        throw new Error('Session expired. Please log in again.')
      }
      
      // If it's a bad request due to invalid company ID format, redirect to login
      if (response.status === 400 && errorData.error && errorData.error.includes('Invalid company ID format')) {
        // Clear the invalid data from localStorage
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentCompany')
        
        // Redirect to login page
        window.location.href = '/login'
        
        throw new Error('Invalid user data. Please log in again.')
      }
      
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error)
    throw error
  }
}

// Client API Service
export const clientApiService = {
  // Get clients for company
  async getClientsForCompany(companyId: string | null): Promise<Client[]> {
    if (!companyId) return []
    
    const response = await apiRequest<{
      success: boolean
      data: Client[]
      count: number
    }>(`/clients/company/${companyId}`)
    
    if (!response.success) {
      throw new Error('Failed to get clients for company')
    }
    
    return response.data
  },

  // Get all clients (fallback for when no company ID)
  async getClients(): Promise<Client[]> {
    const response = await apiRequest<{
      success: boolean
      data: Client[]
      count: number
    }>('/clients')
    
    if (!response.success) {
      throw new Error('Failed to get clients')
    }
    
    return response.data
  }
}

// Export default
export default clientApiService