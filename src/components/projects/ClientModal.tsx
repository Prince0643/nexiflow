import React, { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { Client, CreateClientData, ClientType } from '../../types'
import { projectService } from '../../services/projectService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { canAccessFeature, canEditHourlyRates } from '../../utils/permissions'
import { countries, timezones } from '../../data/countriesAndTimezones'
import CurrencySelector from './CurrencySelector'

interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  client?: Client | null
  onSuccess: () => void
}

export default function ClientModal({ isOpen, onClose, client, onSuccess }: ClientModalProps) {
  const { currentUser } = useMySQLAuth()
  const { isDarkMode } = useTheme()
  
  // Helper function to format date for input field (YYYY-MM-DD format in local timezone)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Helper function to parse date from input field
  const parseDateFromInput = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const [formData, setFormData] = useState<CreateClientData>({
    name: '',
    email: '',
    country: '',
    timezone: '',
    clientType: 'full-time',
    hourlyRate: 25,
    hoursPerWeek: 40,
    phone: '',
    company: '',
    address: '',
    currency: 'USD' // Add default currency
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!client
  const canEditRates = currentUser?.role ? canEditHourlyRates(currentUser.role) : false

  useEffect(() => {
    if (isOpen) {
      if (client) {
        setFormData({
          name: client.name,
          email: client.email,
          country: client.country,
          timezone: client.timezone,
          clientType: client.clientType,
          hourlyRate: client.hourlyRate,
          hoursPerWeek: client.hoursPerWeek || 40,
          startDate: client.startDate,
          endDate: client.endDate,
          phone: client.phone || '',
          company: client.company || '',
          address: client.address || '',
          currency: client.currency || 'USD' // Add currency
        })
      } else {
        setFormData({
          name: '',
          email: '',
          country: '',
          timezone: '',
          clientType: 'full-time',
          hourlyRate: 25,
          hoursPerWeek: 40,
          phone: '',
          company: '',
          address: '',
          currency: 'USD' // Add default currency
        })
      }
      setError('')
    }
  }, [isOpen, client])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    // Permission check
    if (!currentUser.role || !canAccessFeature(currentUser.role, 'clients')) {
      setError('You do not have permission to manage clients')
      return
    }

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isEdit && client) {
        await projectService.updateClient(client.id, formData)
      } else {
        // Check if client with same email already exists
        const existingClient = await projectService.getClientByEmail(formData.email, currentUser.companyId)
        if (existingClient) {
          throw new Error('A client with this email already exists. Please use a different email address.')
        }
        
        await projectService.createClient(formData, currentUser.uid, currentUser.companyId)
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to save client')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Automatically select timezone when country is selected
    if (name === 'country' && value) {
      const selectedCountry = countries.find(country => country.name === value)
      if (selectedCountry) {
        setFormData(prev => ({
          ...prev,
          timezone: selectedCountry.timezone
        }))
      }
    }
  }

  const handleClientTypeChange = (clientType: ClientType) => {
    setFormData(prev => ({
      ...prev,
      clientType,
      // Reset conditional fields when changing type
      hoursPerWeek: clientType === 'custom' ? prev.hoursPerWeek : undefined,
      startDate: clientType === 'gig' ? prev.startDate : undefined,
      endDate: clientType === 'gig' ? prev.endDate : undefined
    }))
  }

  const getClientTypeDescription = (type: ClientType) => {
    switch (type) {
      case 'full-time':
        return '40 hours per week'
      case 'part-time':
        return '20 hours per week'
      case 'custom':
        return 'Custom hours per week'
      case 'gig':
        return 'Project-based with start and end dates'
      default:
        return ''
    }
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Client name is required')
      return false
    }
    if (!formData.email.trim()) {
      setError('Email is required')
      return false
    }
    if (!formData.country.trim()) {
      setError('Country is required')
      return false
    }
    if (!formData.timezone.trim()) {
      setError('Timezone is required')
      return false
    }
    if (!formData.hourlyRate || formData.hourlyRate <= 0) {
      setError('Hourly rate must be greater than 0')
      return false
    }
    if (formData.clientType === 'custom' && (!formData.hoursPerWeek || formData.hoursPerWeek <= 0)) {
      setError('Hours per week must be greater than 0 for custom type')
      return false
    }
    if (formData.clientType === 'gig') {
      if (!formData.startDate) {
        setError('Start date is required for gig type')
        return false
      }
      if (!formData.endDate) {
        setError('End date is required for gig type')
        return false
      }
      if (formData.startDate >= formData.endDate) {
        setError('End date must be after start date')
        return false
      }
    }
    return true
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {isEdit ? 'Edit Client' : 'Add New Client'}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className={`flex items-center space-x-2 p-3 rounded-lg ${isDarkMode ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
              <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              <p className={`text-sm ${isDarkMode ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          {/* Client Name */}
          <div>
            <label htmlFor="name" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Client Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              placeholder="Enter client name"
              required
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              placeholder="Enter email address"
              required
              disabled={loading}
            />
          </div>

          {/* Country and Timezone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="country" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Country *
              </label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                required
                disabled={loading}
              >
                <option value="">Select Country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="timezone" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Timezone *
              </label>
              <select
                id="timezone"
                name="timezone"
                value={formData.timezone}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                required
                disabled={loading}
              >
                <option value="">Select Timezone</option>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Timezone is automatically selected based on country, but you can change it if needed.
              </p>
            </div>
          </div>

          {/* Client Type */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Client Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['full-time', 'part-time', 'custom', 'gig'] as ClientType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleClientTypeChange(type)}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    formData.clientType === type
                      ? isDarkMode 
                        ? 'border-primary-500 bg-primary-900 text-primary-300' 
                        : 'border-primary-500 bg-primary-50 text-primary-700'
                      : isDarkMode 
                        ? 'border-gray-600 hover:border-gray-400 bg-gray-700 text-gray-200' 
                        : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700'
                  }`}
                  disabled={loading}
                >
                  <div className="font-medium capitalize">{type.replace('-', ' ')}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getClientTypeDescription(type)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Rate */}
          <div>
            <label htmlFor="hourlyRate" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Hourly Rate *
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                id="hourlyRate"
                name="hourlyRate"
                value={formData.hourlyRate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                className={`flex-1 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!canEditRates ? (isDarkMode ? 'bg-gray-700 cursor-not-allowed' : 'bg-gray-100 cursor-not-allowed') : isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                placeholder="25.00"
                step="0.01"
                min="0"
                required
                disabled={loading || !canEditRates}
              />
              <CurrencySelector
                value={formData.currency || 'USD'}
                onChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                disabled={loading}
              />
            </div>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Rate per hour for this client
              {!canEditRates && (
                <span className={`block text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Only HR and Super Admin users can edit hourly rates
                </span>
              )}
            </p>
          </div>

          {/* Custom Hours Per Week */}
          {formData.clientType === 'custom' && (
            <div>
              <label htmlFor="hoursPerWeek" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Hours Per Week *
              </label>
              <input
                type="number"
                id="hoursPerWeek"
                name="hoursPerWeek"
                value={formData.hoursPerWeek || ''}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                placeholder="Enter hours per week"
                min="1"
                max="168"
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Gig Type Dates */}
          {formData.clientType === 'gig' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Start Date *
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate ? formatDateForInput(formData.startDate) : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value ? parseDateFromInput(e.target.value) : undefined }))}
                  className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="endDate" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  End Date *
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate ? formatDateForInput(formData.endDate) : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value ? parseDateFromInput(e.target.value) : undefined }))}
                  className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Company */}
          <div>
            <label htmlFor="company" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Company
            </label>
            <input
              type="text"
              id="company"
              name="company"
              value={formData.company}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              placeholder="Enter company name"
              disabled={loading}
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              placeholder="Enter phone number"
              disabled={loading}
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Address
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
              rows={3}
              placeholder="Enter address"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className={`flex justify-end space-x-3 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEdit ? 'Update Client' : 'Add Client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}