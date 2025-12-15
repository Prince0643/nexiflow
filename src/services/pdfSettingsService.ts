import { ref, get, set, update } from 'firebase/database'
import { database } from '../config/firebase'
import { PDFSettings } from '../types'

export interface CompanyPDFSettings {
  id: string
  pdfSettings?: PDFSettings
}

export const pdfSettingsService = {
  // Get PDF settings for a company
  async getPDFSettings(companyId: string): Promise<PDFSettings | null> {
    try {
      const companyRef = ref(database, `companies/${companyId}`)
      const snapshot = await get(companyRef)
      
      if (snapshot.exists()) {
        const companyData = snapshot.val()
        return companyData.pdfSettings || null
      }
      
      return null
    } catch (error) {
      console.error('Error fetching PDF settings:', error)
      throw error
    }
  },

  // Update PDF settings for a company
  async updatePDFSettings(companyId: string, pdfSettings: PDFSettings): Promise<void> {
    try {
      const companyRef = ref(database, `companies/${companyId}`)
      
      // Update only the pdfSettings field
      await update(companyRef, {
        pdfSettings,
        updatedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error updating PDF settings:', error)
      throw error
    }
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