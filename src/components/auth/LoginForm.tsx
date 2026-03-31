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
  const errorRef = useRef('') // Ref to persist error across renders
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  
  const { login, resetPassword } = useMySQLAuth()
  const navigate = useNavigate()
  const forgotPasswordRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close forgot password form
  useEffect(() => {
    if (!showForgotPassword) return // Only add listener when form is open
    
    const handleClickOutside = (event: MouseEvent) => {
      if (forgotPasswordRef.current && !forgotPasswordRef.current.contains(event.target as Node)) {
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

  const handleSubmit = async () => {
    errorRef.current = ''
    setError('')
    setLoading(true)

    try {
      const result = await login(credentials)
      
      if (!result.success) {
        const errorMsg = result.error || 'Failed to login. Please try again.'
        errorRef.current = errorMsg
        setError(errorMsg)
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to login. Please try again.'
      errorRef.current = errorMsg
      setError(errorMsg)
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
        <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-sm">Welcome Back</h1>
        <p className="text-white/70">Sign in to your NexiFlow account</p>
      </div>

      <form className="space-y-5" action="#" method="post">
        {/* Email Field */}
        <div className="group">
          <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2 ml-1">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={credentials.email}
            onChange={handleInputChange}
            className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all"
            placeholder="Enter your email"
            disabled={loading}
          />
        </div>

        {/* Password Field */}
        <div className="group">
          <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-2 ml-1">
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
              className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all pr-12"
              placeholder="Enter your password"
              disabled={loading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
              ) : (
                <Eye className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {(error || errorRef.current) ? (
          <div className="flex items-center space-x-3 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl backdrop-blur-sm">
            <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0" />
            <div className="text-sm text-red-100 font-medium">
              {error || errorRef.current}
            </div>
          </div>
        ) : (
          <div className="h-0" /> /* placeholder to maintain layout */
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-white text-blue-900 font-semibold text-lg shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        {/* Forgot Password Link */}
        <div className="text-center">
          <button
            type="button"
            className="text-sm text-white/70 hover:text-white font-medium transition-colors"
            disabled={loading}
            onClick={() => setShowForgotPassword(true)}
          >
            Forgot your password?
          </button>
        </div>
      </form>

      {/* Contact Admin for Account */}
      <div className="mt-8 text-center">
        <p className="text-white/60">
          Don't have an account?{' '}
          <span className="text-white/90 font-medium">
            Contact your administrator
          </span>
        </p>
        <p className="text-sm text-white/40 mt-2">
          Employee account creation is managed by HR and Super Admin users
        </p>
      </div>

      {/* Forgot Password Form */}
      {showForgotPassword && (
        <div className="mt-8 p-6 bg-white/10 border border-white/20 rounded-3xl backdrop-blur-xl" ref={forgotPasswordRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Forgot Password</h2>
            <button
              type="button"
              className="text-white/60 hover:text-white transition-colors"
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setResetSuccess(false);
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {resetSuccess ? (
            <div className="bg-green-500/20 border border-green-400/30 rounded-2xl p-4 mb-4 backdrop-blur-sm">
              <p className="text-green-100">
                Password reset instructions sent to {resetEmail}. Please check your email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="resetEmail" className="block text-sm font-medium text-white/80 mb-2 ml-1">
                  Email Address
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-white text-blue-900 font-semibold shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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