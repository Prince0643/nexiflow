import React, { useState, useEffect } from 'react'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { pdfSettingsService } from '../../services/pdfSettingsService'
import { PDFSettings } from '../../types'
import PDFSettingsDemo from './PDFSettingsDemo' // Add this import

interface PDFSettingsFormProps {
  companyId: string
  onSettingsUpdate?: (settings: PDFSettings) => void
}

export default function PDFSettingsForm({ companyId, onSettingsUpdate }: PDFSettingsFormProps) {
  const { currentUser } = useMySQLAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState<PDFSettings>({
    companyName: '',
    logoUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    showPoweredBy: true,
    customFooterText: ''
  })

  useEffect(() => {
    loadPDFSettings()
  }, [companyId])

  const loadPDFSettings = async () => {
    setLoading(true)
    try {
      const settings = await pdfSettingsService.getPDFSettings(companyId)
      
      if (settings) {
        setFormData(settings)
      } else {
        // Initialize with default settings
        const defaultSettings = await pdfSettingsService.initializePDFSettings(companyId)
        setFormData(defaultSettings)
      }
    } catch (error) {
      console.error('Error loading PDF settings:', error)
      setError('Failed to load PDF settings')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    
    try {
      await pdfSettingsService.updatePDFSettings(companyId, formData)
      setSuccess('PDF settings updated successfully!')
      if (onSettingsUpdate) {
        onSettingsUpdate(formData)
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error updating PDF settings:', error)
      setError('Failed to update PDF settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">PDF Export Settings</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Your company name"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This name will appear in the PDF header instead of "NexiFlow"
            </p>
          </div>
          
          <div>
            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Logo URL
            </label>
            <input
              type="text"
              id="logoUrl"
              name="logoUrl"
              value={formData.logoUrl}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="https://example.com/logo.png"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              URL to your company logo (must be publicly accessible)
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="primaryColor"
                  name="primaryColor"
                  value={formData.primaryColor}
                  onChange={handleInputChange}
                  className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={handleInputChange}
                  name="primaryColor"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Used for PDF headers and accents
              </p>
            </div>
            
            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Secondary Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  id="secondaryColor"
                  name="secondaryColor"
                  value={formData.secondaryColor}
                  onChange={handleInputChange}
                  className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={handleInputChange}
                  name="secondaryColor"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Used for charts and other elements
              </p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Footer Options
            </label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showPoweredBy"
                  name="showPoweredBy"
                  checked={formData.showPoweredBy}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="showPoweredBy" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Show "Powered by Nexistry Digital Solutions" (always shown in footer)
                </label>
              </div>
              
              <div>
                <label htmlFor="customFooterText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Footer Text
                </label>
                <textarea
                  id="customFooterText"
                  name="customFooterText"
                  value={formData.customFooterText}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Additional text to appear in the PDF footer"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  If provided, this will appear below the "Generated by NexiFlow" text in the PDF footer
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save PDF Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
      
      {/* PDF Preview */}
      <PDFSettingsDemo pdfSettings={formData} />
    </div>
  )
}