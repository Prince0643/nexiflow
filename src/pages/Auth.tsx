import { ArrowLeft, Home, Info, UserPlus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import LoginForm from '../components/auth/LoginForm'
import SuperAdminSignupForm from '../components/auth/SuperAdminSignupForm'
import { useState, useEffect, useRef } from 'react'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const isDemo = searchParams.get('demo') === 'true'
  const [showSignup, setShowSignup] = useState(searchParams.get('signup') === 'super_admin')

  const mode = (searchParams.get('mode') || '').toLowerCase()
  const resetToken = searchParams.get('token')
  const isResetMode = mode === 'reset-password' || (!!resetToken && !mode)

  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const brandingRef = useRef<HTMLDivElement>(null)

  const toggleForm = () => {
    setShowSignup(!showSignup)
  }

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetSuccess('')

    if (!resetToken) {
      setResetError('Reset token is missing. Please request a new password reset email.')
      return
    }
    if (!resetPassword || resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters.')
      return
    }
    if (resetPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.')
      return
    }

    setResetLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: resetToken,
          password: resetPassword,
          confirmPassword: resetConfirmPassword
        })
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        setResetError(data?.error || 'Failed to reset password. Please try again.')
        return
      }

      setResetSuccess('Password reset successful. You may now sign in with your new password.')
      setResetPassword('')
      setResetConfirmPassword('')

      window.setTimeout(() => {
        navigate('/auth')
      }, 1200)
    } catch (err: any) {
      setResetError(err?.message || 'Failed to reset password. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex bg-gray-900`}>
      {/* Left Side - Branding */}
      <div 
        ref={brandingRef}
        className="hidden lg:flex lg:w-1/2 bg-[#020617] text-white p-12 flex-col justify-center relative overflow-hidden"
      >
        {/* Enhanced static glow effects with consistent color scheme */}
        <div className="absolute top-[-180px] right-[-120px] w-[500px] h-[500px] bg-blue-500/20 dark:bg-blue-700/30 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-200px] left-[-150px] w-[480px] h-[480px] bg-indigo-400/15 dark:bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute top-[45%] left-[25%] w-[300px] h-[300px] bg-purple-400/10 dark:bg-purple-500/10 rounded-full blur-[160px] pointer-events-none"></div>
        {/* Additional glow orbs for richer visual effect */}
        <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] rounded-full bg-[#091845] blur-[120px] opacity-25 pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/3 w-[200px] h-[200px] rounded-full bg-blue-500 blur-[100px] opacity-20 pointer-events-none"></div>

        <div className="max-w-lg relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <img 
                  src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
                  alt="NexiFlow Logo" 
                  className="h-12 w-auto"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">NexiFlow</h1>
                <p className="text-sm text-gray-400">Powered by Nexistry Digital Solutions</p>
              </div>
            </div>
            {/* Removed dark mode toggle */}
          </div>
          
          <h2 className="text-4xl font-bold mb-6 text-white">
            Track Time, Boost Productivity
          </h2>
          
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Join thousands of professionals who use NexiFlow to manage their time, 
            track projects, and improve their productivity. Simple, powerful, and designed for teams.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Employee time tracking</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Project management</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Advanced analytics</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Team collaboration</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Authentication Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <img 
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
                    alt="NexiFlow Logo" 
                    className="h-10 w-auto mx-auto"
                  />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-primary-400">NexiFlow</h1>
                  <p className="text-xs text-gray-400">Powered by Nexistry Digital Solutions</p>
                </div>
              </div>
              {/* Removed dark mode toggle */}
            </div>
            <p className="text-gray-400">Time tracking made simple</p>
          </div>

          {/* Demo Notice */}
          {isDemo && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-400" />
                <p className="text-sm text-blue-200">
                  <strong>Demo Mode:</strong> Contact your administrator to create an account and explore all features of NexiFlow.
                </p>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-8">
            {isResetMode ? (
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
                <p className="text-sm text-gray-400 mb-6">Enter a new password for your account.</p>

                {resetError && (
                  <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg">
                    <p className="text-sm text-red-200">{resetError}</p>
                  </div>
                )}

                {resetSuccess && (
                  <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-lg">
                    <p className="text-sm text-green-200">{resetSuccess}</p>
                  </div>
                )}

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Enter new password"
                      disabled={resetLoading}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Confirm new password"
                      disabled={resetLoading}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full btn-primary py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => navigate('/auth')}
                    className="inline-flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    disabled={resetLoading}
                  >
                    <span>Back to sign in</span>
                  </button>
                </div>
              </div>
            ) : showSignup ? (
              <SuperAdminSignupForm onSwitchToLogin={toggleForm} />
            ) : (
              <LoginForm key="login-form" />
            )}
          </div>

          {/* Toggle Form Link */}
          <div className="mt-6 text-center">
            {isResetMode ? null : showSignup ? (
              <button
                onClick={toggleForm}
                className="inline-flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                <span>Already have an account? Sign in</span>
              </button>
            ) : (
              <button
                onClick={toggleForm}
                className="inline-flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Your Account</span>
              </button>
            )}
          </div>

          {/* Back to App Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/landing')}
              className="inline-flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Back to homepage</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>© 2024 NexiFlow. All rights reserved.</p>
            <div className="mt-2 space-x-4">
              <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Support</a>
            </div>
          </div>


        </div>
      </div>
    </div>
  )
}