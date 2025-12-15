import React, { useState } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { SignupCredentials } from '../../types'
import { getRoleDisplayName, getRoleDescription } from '../../utils/permissions'

interface SignupFormProps {
  onSwitchToLogin: () => void
}

export default function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const [credentials, setCredentials] = useState<SignupCredentials>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'employee'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })
  
  const { signup } = useMySQLAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (credentials.password !== credentials.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (credentials.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const result = await signup(credentials)
      if (!result.success) {
        setError(result.error || 'Failed to create account. Please try again.')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }))

    // Update password strength indicators
    if (name === 'password') {
      setPasswordStrength({
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /\d/.test(value),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(value)
      })
    }
  }

  const getPasswordStrengthColor = (isValid: boolean) => {
    return isValid ? 'text-green-600' : 'text-gray-400'
  }

  const getPasswordStrengthIcon = (isValid: boolean) => {
    return isValid ? CheckCircle : AlertCircle
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-white">Create Account</h1>
        <p className="text-gray-600 dark:text-gray-400">Join NexiFlow and start tracking your time</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={credentials.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            placeholder="Enter your full name"
            disabled={loading}
          />
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={credentials.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            placeholder="Enter your email"
            disabled={loading}
          />
        </div>

        {/* Hidden Role Field - Default to employee for regular signup */}
        <input type="hidden" name="role" value="employee" />

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={credentials.password}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Create a strong password"
              disabled={loading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
              )}
            </button>
          </div>

          {/* Password Strength Indicators */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center space-x-2">
              {React.createElement(getPasswordStrengthIcon(passwordStrength.length), {
                className: `h-4 w-4 ${getPasswordStrengthColor(passwordStrength.length)}`
              })}
              <span className={`text-sm ${getPasswordStrengthColor(passwordStrength.length)}`}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {React.createElement(getPasswordStrengthIcon(passwordStrength.uppercase), {
                className: `h-4 w-4 ${getPasswordStrengthColor(passwordStrength.uppercase)}`
              })}
              <span className={`text-sm ${getPasswordStrengthColor(passwordStrength.uppercase)}`}>
                One uppercase letter
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {React.createElement(getPasswordStrengthIcon(passwordStrength.lowercase), {
                className: `h-4 w-4 ${getPasswordStrengthColor(passwordStrength.lowercase)}`
              })}
              <span className={`text-sm ${getPasswordStrengthColor(passwordStrength.lowercase)}`}>
                One lowercase letter
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {React.createElement(getPasswordStrengthIcon(passwordStrength.number), {
                className: `h-4 w-4 ${getPasswordStrengthColor(passwordStrength.number)}`
              })}
              <span className={`text-sm ${getPasswordStrengthColor(passwordStrength.number)}`}>
                One number
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {React.createElement(getPasswordStrengthIcon(passwordStrength.special), {
                className: `h-4 w-4 ${getPasswordStrengthColor(passwordStrength.special)}`
              })}
              <span className={`text-sm ${getPasswordStrengthColor(passwordStrength.special)}`}>
                One special character
              </span>
            </div>
          </div>
        </div>

        {/* Confirm Password Field */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={credentials.confirmPassword}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Confirm your password"
              disabled={loading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:border-red-800">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 dark:text-red-400" />
            <div className="text-sm text-red-700 dark:text-red-200">
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        {/* Login Link */}
        <div className="text-center">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400 dark:hover:text-primary-300"
            disabled={loading}
          >
            Already have an account? Sign in
          </button>
        </div>
      </form>
    </div>
  )
}