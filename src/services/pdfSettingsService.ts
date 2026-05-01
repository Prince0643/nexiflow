import { PDFSettings } from '../types'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// Get auth token for authentication
const getAuthToken = async (): Promise<string | null> => {
  try {
    return localStorage.getItem('authToken') || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

// Generic API request function
const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = await getAuthToken()
  const url = `${API_BASE_URL}${endpoint}`

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  }

  const response = await fetch(url, config)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let errorMessage = `HTTP error! status: ${response.status}`
    try {
      const parsed = text ? JSON.parse(text) : {}
      if (parsed && typeof parsed.error === 'string') {
        errorMessage = parsed.error
      }
    } catch {
      // ignore non-JSON body
    }

    // If the server didn't return JSON, still provide a useful 404 message.
    if (response.status === 404 && errorMessage.startsWith('HTTP error!')) {
      errorMessage = 'API endpoint not found'
    }

    throw new Error(errorMessage)
  }

  return response.json()
}

export interface CompanyPDFSettings {
  id: string
  pdfSettings?: PDFSettings
}

export const pdfSettingsService = {
  // Get PDF settings for a company
  async getPDFSettings(companyId: string): Promise<PDFSettings | null> {
    const response = await apiRequest<{ success: boolean; data: PDFSettings | null }>(
      `/companies/${companyId}/pdf-settings`
    )

    if (!response.success) {
      throw new Error('Failed to get PDF settings')
    }

    // If settings are not yet configured, API returns null.
    return response.data
  },

  // Update PDF settings for a company
  async updatePDFSettings(companyId: string, pdfSettings: PDFSettings): Promise<void> {
    const response = await apiRequest<{ success: boolean; data: PDFSettings }>(
      `/companies/${companyId}/pdf-settings`,
      {
        method: 'PUT',
        body: JSON.stringify(pdfSettings)
      }
    )

    if (!response.success) {
      throw new Error('Failed to update PDF settings')
    }
  },

  async uploadCompanyLogo(companyId: string, file: File): Promise<string> {
    const token = await getAuthToken()
    const url = `${API_BASE_URL}/companies/${companyId}/pdf-logo`

    const formData = new FormData()
    formData.append('logo', file)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    })

    const text = await response.text().catch(() => '')
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    if (!response.ok || !json?.success) {
      const msg = (json && typeof json.error === 'string' && json.error) || `HTTP error! status: ${response.status}`
      throw new Error(msg)
    }

    const logoUrl = json?.data?.logoUrl
    if (!logoUrl || typeof logoUrl !== 'string') {
      throw new Error('Logo upload failed')
    }

    return logoUrl
  },

  // Initialize default PDF settings for a company
  async initializePDFSettings(companyId: string): Promise<PDFSettings> {
    try {
      const defaultSettings: PDFSettings = {
        companyName: '',
        logoUrl: '',
        primaryColor: '#3B82F6', // Default blue
        secondaryColor: '#10B981', // Default green
        showPoweredBy: true,
        customFooterText: ''
      }

      await this.updatePDFSettings(companyId, defaultSettings)
      return defaultSettings
    } catch (error) {
      console.error('Error initializing PDF settings:', error)
      throw error
    }
  },

  // Get company name for PDF header
  getCompanyNameForPDF(companyName: string, pdfSettings?: PDFSettings | null): string {
    if (pdfSettings?.companyName) {
      return pdfSettings.companyName
    }
    return companyName
  },

  // Get logo URL for PDF
  getLogoUrlForPDF(pdfSettings?: PDFSettings | null): string | null {
    if (pdfSettings?.logoUrl) {
      return pdfSettings.logoUrl
    }
    return null
  },

  // Get primary color for PDF styling
  getPrimaryColorForPDF(pdfSettings?: PDFSettings | null): string {
    if (pdfSettings?.primaryColor) {
      return pdfSettings.primaryColor
    }
    return '#3B82F6' // Default blue
  },

  // Get secondary color for PDF styling
  getSecondaryColorForPDF(pdfSettings?: PDFSettings | null): string {
    if (pdfSettings?.secondaryColor) {
      return pdfSettings.secondaryColor
    }
    return '#10B981' // Default green
  },

  // Check if "Powered by" should be shown
  shouldShowPoweredBy(pdfSettings?: PDFSettings | null): boolean {
    // Default to true if not specified
    if (pdfSettings?.showPoweredBy === undefined) {
      return true
    }
    return pdfSettings.showPoweredBy
  },

  // Get custom footer text
  getCustomFooterText(pdfSettings?: PDFSettings | null): string {
    if (pdfSettings?.customFooterText) {
      return pdfSettings.customFooterText
    }
    return ''
  }
}
