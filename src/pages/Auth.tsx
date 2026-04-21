import { Home, Info, UserPlus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'
import SuperAdminSignupForm from '../components/auth/SuperAdminSignupForm'
import { useState } from 'react'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
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
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden bg-white text-gray-900 dark:bg-[#020617] dark:text-white">
      {/* Hero Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white dark:from-blue-900 dark:via-[#060b1d] dark:to-black opacity-100 dark:opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_55%)]/60 dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]/30" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,_transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,_transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.07)_1px,_transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,_transparent_1px)] bg-[length:120px_120px]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 right-10 w-56 h-56 bg-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-80px] left-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img
              src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
              alt="NexiFlow Logo"
              className="h-12 w-auto"
            />
            <div className="text-left">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">NexiFlow</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">Powered by Nexistry Digital Solutions</p>
            </div>
          </div>
        </div>

        {/* Demo Notice */}
        {isDemo && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/30 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-200">
                <strong>Demo Mode:</strong> Contact your administrator to create an account and explore all features of NexiFlow.
              </p>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white/80 rounded-3xl shadow-2xl border border-gray-200 p-8 backdrop-blur-xl dark:bg-white/10 dark:border-white/20">
          {isResetMode ? (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Reset Password</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Enter a new password for your account.</p>

              {resetError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-200">{resetError}</p>
                </div>
              )}

              {resetSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-200">{resetSuccess}</p>
                </div>
              )}

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter new password"
                    disabled={resetLoading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
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
                  className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
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
              className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
            >
              <span>Already have an account? Sign in</span>
            </button>
          ) : (
            <button
              onClick={toggleForm}
              className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
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
            className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
          >
            <Home className="h-4 w-4" />
            <span>Back to homepage</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500">
          <p>&copy; 2025 NexiFlow. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
