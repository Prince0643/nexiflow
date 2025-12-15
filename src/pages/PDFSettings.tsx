import React, { useState, useEffect } from 'react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { companyService } from '../services/companyService'
import { pdfSettingsService } from '../services/pdfSettingsService'
import PDFSettingsForm from '../components/settings/PDFSettingsForm'
import { Company, CompanyWithPDFSettings } from '../types'

export default function PDFSettingsPage() {
  const { currentUser } = useMySQLAuth()
  const [company, setCompany] = useState<CompanyWithPDFSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCompany()
  }, [])

  const loadCompany = async () => {
    setLoading(true)
    try {
      // Super admins should only see their own company
      if (currentUser?.companyId) {
        const companiesData = await companyService.getCompanies()
        const userCompany = companiesData.find(c => c.id === currentUser.companyId) || null
        if (userCompany) {
          // Type assertion to include pdfSettings property
          setCompany(userCompany as CompanyWithPDFSettings)
        }
      } else if (currentUser?.role === 'root') {
        // Root user can see all companies, but we'll still show the company selector for root
        const companiesData = await companyService.getCompanies()
        if (companiesData.length > 0) {
          // Type assertion to include pdfSettings property
          setCompany(companiesData[0] as CompanyWithPDFSettings)
        }
      }
    } catch (error) {
      console.error('Error loading company:', error)
      setError('Failed to load company')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'root')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-700">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  // For super admins, only show their company
  if (currentUser.role === 'super_admin') {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">PDF Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize PDF exports for your company
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {company ? (
            <PDFSettingsForm 
              companyId={company.id} 
              onSettingsUpdate={(settings) => {
                setCompany({ ...company, pdfSettings: settings })
              }}
            />
          ) : (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Company Found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                You are not associated with any company.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // For root users, keep the original multi-company view
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">PDF Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Customize PDF exports for each company
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Company List Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Companies</h2>
            <div className="space-y-2">
              {company ? (
                <button
                  key={company.id}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200'
                  }`}
                >
                  <div className="font-medium">{company.name}</div>
                </button>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 p-2">
                  No companies found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PDF Settings Form */}
        <div className="lg:col-span-3">
          {company ? (
            <PDFSettingsForm 
              companyId={company.id} 
              onSettingsUpdate={(settings) => {
                setCompany({ ...company, pdfSettings: settings })
              }}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select a Company
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a company from the list to customize its PDF export settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}