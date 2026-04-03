import { ref, get, set, push } from 'firebase/database'
import { database } from '../config/firebase'
import { PDFSettings, PricingLevel, Company } from '../types'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('authToken')
  } catch {
    return null
  }
}

const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getAuthToken()
  if (!token) throw new Error('Authentication required')

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error || `HTTP error! status: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const companyService = {
  async getCompanies(): Promise<Company[]> {
    if (!database) {
      const response = await apiRequest<{ success: boolean; data: any[] }>('/admin/companies')
      if (!response.success) return []
      return response.data.map((row: any) => ({
        id: row.id,
        name: row.name,
        isActive: Boolean(row.isActive),
        pricingLevel: row.pricingLevel || 'solo',
        maxMembers: row.maxMembers || 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        pdfSettings: row.pdfSettings
      }))
    }

    const companiesRef = ref(database, 'companies')
    const snapshot = await get(companiesRef)
    if (!snapshot.exists()) return []
    const companies = snapshot.val()
    return Object.entries(companies).map(([id, value]: [string, any]) => ({
      id: value.id || id,
      name: value.name,
      isActive: Boolean(value.isActive),
      pricingLevel: value.pricingLevel || 'solo',
      maxMembers: value.maxMembers || 1,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      pdfSettings: value.pdfSettings
    }))
  },

  async getCompanyById(companyId: string): Promise<Company | null> {
    try {
      if (!database) {
        const companies = await this.getCompanies()
        return companies.find(c => c.id === companyId) || null
      }

      const companyRef = ref(database, `companies/${companyId}`)
      const snapshot = await get(companyRef)
      
      if (snapshot.exists()) {
        const value = snapshot.val()
        return {
          id: value.id || companyId,
          name: value.name,
          isActive: Boolean(value.isActive),
          pricingLevel: value.pricingLevel || 'solo',
          maxMembers: value.maxMembers || 1,
          createdAt: value.createdAt,
          updatedAt: value.updatedAt,
          pdfSettings: value.pdfSettings
        }
      }
      
      return null
    } catch (error) {
      console.error('Error fetching company by ID:', error)
      return null
    }
  },

  async createCompany(name: string, pricingLevel: PricingLevel = 'solo'): Promise<Company> {
    if (!database) {
      const response = await apiRequest<{ success: boolean; data: any }>('/admin/companies', {
        method: 'POST',
        body: JSON.stringify({ name, pricingLevel })
      })

      if (!response.success) {
        throw new Error('Failed to create company')
      }

      const row = response.data
      const defaultPdfSettings: PDFSettings = {
        companyName: name,
        logoUrl: '',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        showPoweredBy: true,
        customFooterText: ''
      }

      return {
        id: row.id,
        name: row.name,
        isActive: Boolean(row.isActive),
        pricingLevel: row.pricingLevel || pricingLevel,
        maxMembers: row.maxMembers || 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        pdfSettings: defaultPdfSettings
      }
    }

    const companiesRef = ref(database, 'companies')
    const newRef = push(companiesRef)
    const now = new Date().toISOString()
    
    // Set max members based on pricing level
    let maxMembers = 1
    if (pricingLevel === 'office') {
      maxMembers = 10
    } else if (pricingLevel === 'enterprise') {
      maxMembers = 100
    }
    
    const defaultPdfSettings: PDFSettings = {
      companyName: name,
      logoUrl: '',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      showPoweredBy: true,
      customFooterText: ''
    }
    
    const company: Company = {
      id: newRef.key as string,
      name,
      isActive: true,
      pricingLevel,
      maxMembers,
      createdAt: now,
      updatedAt: now,
      pdfSettings: defaultPdfSettings
    }
    await set(newRef, company)
    return company
  },

  async downgradeCompany(companyId: string, reason?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!database) {
      return apiRequest<{ success: boolean; data: any }>(`/admin/companies/${companyId}/downgrade`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Manual downgrade by root' })
      })
    }
    throw new Error('Downgrade not available in Firebase mode')
  },

  async deleteCompany(companyId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!database) {
      return apiRequest<{ success: boolean; message?: string; error?: string }>(`/admin/companies/${companyId}`, {
        method: 'DELETE'
      })
    }
    throw new Error('Delete not available in Firebase mode')
  }
}

export type { Company }
