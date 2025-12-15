import { ref, get, set, push } from 'firebase/database'
import { database } from '../config/firebase'
import { PDFSettings, PricingLevel, Company } from '../types'

export const companyService = {
  async getCompanies(): Promise<Company[]> {
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
    
    // Default PDF settings
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
  }
}