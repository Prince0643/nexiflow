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
    const response = await apiRequest<{ success: boolean; data: any[] }>('/admin/companies')
    if (!response.success) return []
    return response.data.map((row: any) => ({
      id: row.id,
      name: row.name,
      isActive: Boolean(row.isActive),
      pricingLevel: row.pricingLevel || 'solo',
      maxMembers: row.maxMembers || 1,
      nextBillingDate: row.nextBillingDate ?? null,
      billingStatus: row.billingStatus ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      pdfSettings: row.pdfSettings
    }))
  },

  async getCompanyById(companyId: string): Promise<Company | null> {
    try {
      const companies = await this.getCompanies()
      return companies.find(c => c.id === companyId) || null
    } catch (error) {
      console.error('Error fetching company by ID:', error)
      return null
    }
  },

  async createCompany(name: string, pricingLevel: PricingLevel = 'solo'): Promise<Company> {
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
  },

  async downgradeCompany(companyId: string, reason?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return apiRequest<{ success: boolean; data: any }>(`/admin/companies/${companyId}/downgrade`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Manual downgrade by root' })
    })
  },

  async sendOverdueEmail(companyId: string): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
    return apiRequest<{ success: boolean; message?: string; data?: any; error?: string }>(
      `/admin/companies/${companyId}/send-overdue-email`,
      { method: 'POST' }
    )
  },

  async deleteCompany(companyId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return apiRequest<{ success: boolean; message?: string; error?: string }>(`/admin/companies/${companyId}`, {
      method: 'DELETE'
    })
  }
}

export type { Company }
