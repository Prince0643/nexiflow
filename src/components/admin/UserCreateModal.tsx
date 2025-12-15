import { useState } from 'react'
import { X, User, Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react'
import { UserRole } from '../../types'
import { getRoleDisplayName, getRoleDescription, canManageUser } from '../../utils/permissions'

interface UserCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userData: CreateUserData) => Promise<void>
  currentUserRole: UserRole
}

interface CreateUserData {
  name: string
  email: string
  password: string
  role: UserRole
  hourlyRate?: number
  timezone: string
}

export default function UserCreateModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentUserRole 
}: UserCreateModalProps) {
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    hourlyRate: 25,
    timezone: 'America/New_York'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'hourlyRate' ? parseFloat(value) || 0 : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required')
      return
    }

    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }

    if (!formData.password.trim()) {
      setError('Password is required')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    // Check if current user can manage the selected role
    if (!canManageUser(currentUserRole, formData.role)) {
      setError(`You don't have permission to create ${getRoleDisplayName(formData.role)} accounts`)
      return
    }

    setLoading(true)

    try {
      await onSave(formData)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        hourlyRate: 25,
        timezone: 'America/New_York'
      })
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Get available roles - only employee, hr, and admin
  const availableRoles: UserRole[] = (['employee', 'hr', 'admin'] as UserRole[]).filter(role => 
    canManageUser(currentUserRole, role)
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create New User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              className="input"
              placeholder="Enter full name"
              disabled={loading}
            />
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="input"
              placeholder="Enter email address"
              disabled={loading}
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleInputChange}
                className="input pr-10"
                placeholder="Enter password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="input"
              disabled={loading}
            >
              {availableRoles.map(role => (
                <option key={role} value={role}>
                  {getRoleDisplayName(role)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {getRoleDescription(formData.role)}
            </p>
          </div>

          {/* Hourly Rate Field */}
          <div>
            <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hourly Rate ($)
            </label>
            <input
              id="hourlyRate"
              name="hourlyRate"
              type="number"
              step="0.01"
              min="0"
              value={formData.hourlyRate}
              onChange={handleInputChange}
              className="input"
              placeholder="25.00"
              disabled={loading}
            />
          </div>

          {/* Timezone Field */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              value={formData.timezone}
              onChange={handleInputChange}
              className="input"
              disabled={loading}
            >
              <option value="GMT-12 (International Date Line West)">GMT-12 (International Date Line West)</option>
              <option value="GMT-11 (Midway Island, Samoa)">GMT-11 (Midway Island, Samoa)</option>
              <option value="GMT-10 (Hawaii)">GMT-10 (Hawaii)</option>
              <option value="GMT-9 (Alaska)">GMT-9 (Alaska)</option>
              <option value="GMT-8 (Pacific Time)">GMT-8 (Pacific Time)</option>
              <option value="GMT-7 (Mountain Time)">GMT-7 (Mountain Time)</option>
              <option value="GMT-6 (Central Time)">GMT-6 (Central Time)</option>
              <option value="GMT-5 (Eastern Time)">GMT-5 (Eastern Time)</option>
              <option value="GMT-4 (Atlantic Time)">GMT-4 (Atlantic Time)</option>
              <option value="GMT-3:30 (Newfoundland)">GMT-3:30 (Newfoundland)</option>
              <option value="GMT-3 (Brasília Time)">GMT-3 (Brasília Time)</option>
              <option value="GMT-2 (Mid-Atlantic)">GMT-2 (Mid-Atlantic)</option>
              <option value="GMT-1 (Azores)">GMT-1 (Azores)</option>
              <option value="GMT+0 (Greenwich Mean Time)">GMT+0 (Greenwich Mean Time)</option>
              <option value="GMT+1 (Central European Time)">GMT+1 (Central European Time)</option>
              <option value="GMT+2 (Eastern European Time)">GMT+2 (Eastern European Time)</option>
              <option value="GMT+3 (Moscow Time)">GMT+3 (Moscow Time)</option>
              <option value="GMT+3:30 (Iran)">GMT+3:30 (Iran)</option>
              <option value="GMT+4 (Gulf Standard Time)">GMT+4 (Gulf Standard Time)</option>
              <option value="GMT+4:30 (Afghanistan)">GMT+4:30 (Afghanistan)</option>
              <option value="GMT+5 (Pakistan)">GMT+5 (Pakistan)</option>
              <option value="GMT+5:30 (India Standard Time)">GMT+5:30 (India Standard Time)</option>
              <option value="GMT+5:45 (Nepal)">GMT+5:45 (Nepal)</option>
              <option value="GMT+6 (Bangladesh)">GMT+6 (Bangladesh)</option>
              <option value="GMT+6:30 (Myanmar)">GMT+6:30 (Myanmar)</option>
              <option value="GMT+7 (Indochina Time)">GMT+7 (Indochina Time)</option>
              <option value="GMT+8 (China Standard Time)">GMT+8 (China Standard Time)</option>
              <option value="GMT+8:45 (Australia Eucla)">GMT+8:45 (Australia Eucla)</option>
              <option value="GMT+9 (Japan Standard Time)">GMT+9 (Japan Standard Time)</option>
              <option value="GMT+9:30 (Australian Central Time)">GMT+9:30 (Australian Central Time)</option>
              <option value="GMT+10 (Australian Eastern Time)">GMT+10 (Australian Eastern Time)</option>
              <option value="GMT+10:30 (Lord Howe Island)">GMT+10:30 (Lord Howe Island)</option>
              <option value="GMT+11 (Solomon Islands)">GMT+11 (Solomon Islands)</option>
              <option value="GMT+12 (New Zealand Time)">GMT+12 (New Zealand Time)</option>
              <option value="GMT+12:45 (Chatham Islands)">GMT+12:45 (Chatham Islands)</option>
              <option value="GMT+13 (Tonga)">GMT+13 (Tonga)</option>
              <option value="GMT+14 (Line Islands)">GMT+14 (Line Islands)</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}