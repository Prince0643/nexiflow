import React, { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, AlertCircle, Mail, ArrowLeft, X } from 'lucide-react'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { LoginCredentials } from '../../types'
import { useNavigate } from 'react-router-dom'

interface LoginFormProps {}

export default function LoginForm({}: LoginFormProps) {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  
  const { login, resetPassword } = useMySQLAuth()
  const navigate = useNavigate()
  const forgotPasswordRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close forgot password form
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showForgotPassword && forgotPasswordRef.current && !forgotPasswordRef.current.contains(event.target as Node)) {
        setShowForgotPassword(false)
        setError('')
        setResetSuccess(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showForgotPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(credentials)
      if (!result.success) {
        if (result.error?.includes('verify your email')) {
          setError(`${result.error} `)
        } else {
          setError(result.error || 'Failed to login. Please try again.')
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to login. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetSuccess(false)
    setLoading(true)

    try {
      const result = await resetPassword?.(resetEmail)
      if (result?.success) {
        setResetSuccess(true)
      } else {
        setError(result?.error || 'Failed to send reset email. Please try again.')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-white">Welcome Back</h1>
        <p className="text-gray-600 dark:text-gray-400">Sign in to your NexiFlow account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              placeholder="Enter your password"
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
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        {/* Forgot Password Link */}
        <div className="text-center">
          <button
            type="button"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400 dark:hover:text-primary-300"
            disabled={loading}
            onClick={() => setShowForgotPassword(true)}
          >
            Forgot your password?
          </button>
        </div>
      </form>

      {/* Contact Admin for Account */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <span className="text-primary-600 font-medium dark:text-primary-400">
            Contact your administrator
          </span>
        </p>
        <p className="text-sm text-gray-500 mt-2 dark:text-gray-500">
          Employee account creation is managed by HR and Super Admin users
        </p>
      </div>

      {/* Forgot Password Form */}
      {showForgotPassword && (
        <div className="mt-8" ref={forgotPasswordRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot Password</h2>
            <button
              type="button"
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setResetSuccess(false);
              }}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {resetSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 dark:bg-green-900/30 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200">
                Password reset instructions sent to {resetEmail}. Please check your email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Email Address
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Instructions'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}