import { Home, Info, UserPlus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'
import SuperAdminSignupForm from '../components/auth/SuperAdminSignupForm'
import { useEffect, useMemo, useState } from 'react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser, refreshSession } = useMySQLAuth()
  const isDemo = searchParams.get('demo') === 'true'
  const [showSignup, setShowSignup] = useState(searchParams.get('signup') === 'super_admin')

  const mode = (searchParams.get('mode') || '').toLowerCase()
  const resetToken = searchParams.get('token')
  const isAcceptInviteMode = mode === 'accept-invite'
  const isSetPasswordMode = mode === 'set-password'
  const isResetMode = mode === 'reset-password' || (!!resetToken && !mode)
  const isPasswordFlow = isSetPasswordMode || isResetMode

  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteInfo, setInviteInfo] = useState<any>(null)
  const [inviteAccepted, setInviteAccepted] = useState(false)

  const inviteToken = useMemo(() => (isAcceptInviteMode ? resetToken : null), [isAcceptInviteMode, resetToken])

  useEffect(() => {
    if (!isAcceptInviteMode) return
    if (!inviteToken) {
      setInviteError('Invite token is missing.')
      return
    }

    // Persist so login can auto-accept.
    localStorage.setItem('pendingInviteToken', inviteToken)

    setInviteLoading(true)
    setInviteError('')
    fetch(`${API_BASE_URL}/company-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (!data?.success) {
          setInviteError(data?.error || 'Failed to load invite.')
          return
        }
        setInviteInfo(data.invite)
      })
      .catch((e) => setInviteError(e?.message || 'Failed to load invite.'))
      .finally(() => setInviteLoading(false))
  }, [API_BASE_URL, isAcceptInviteMode, inviteToken])

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
      setResetError(isSetPasswordMode ? 'Invite token is missing. Please request a new invite email.' : 'Reset token is missing. Please request a new password reset email.')
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
      const endpoint = isSetPasswordMode ? `${API_BASE_URL}/auth/set-password` : `${API_BASE_URL}/auth/reset-password`
      const response = await fetch(endpoint, {
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
        setResetError(
          data?.error || (isSetPasswordMode ? 'Failed to set password. Please try again.' : 'Failed to reset password. Please try again.')
        )
        return
      }

      setResetSuccess(
        isSetPasswordMode
          ? 'Password set successfully. You may now sign in.'
          : 'Password reset successful. You may now sign in with your new password.'
      )
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
          {isAcceptInviteMode ? (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Company Invite</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Sign in to review and accept this invite.</p>

              {inviteError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-200">{inviteError}</p>
                </div>
              )}

              {inviteAccepted && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-200">
                    Invite accepted. You can now switch to the new company from your profile menu.
                  </p>
                </div>
              )}

              {inviteLoading ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Loading invite…</div>
              ) : inviteInfo ? (
                <div className="mb-6 rounded-xl border border-gray-200 dark:border-white/20 p-4 bg-white/60 dark:bg-white/5">
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    <div><span className="font-semibold">Company:</span> {inviteInfo.companyName || inviteInfo.companyId}</div>
                    <div><span className="font-semibold">Role:</span> {inviteInfo.role}</div>
                    <div><span className="font-semibold">Invite for:</span> {inviteInfo.inviteeEmail}</div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full btn-primary py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={inviteLoading || inviteAccepted || !inviteToken}
                  onClick={async () => {
                    if (!inviteToken) return
                    setInviteLoading(true)
                    setInviteError('')
                    try {
                      const authToken = localStorage.getItem('authToken')
                      const response = await fetch(`${API_BASE_URL}/company-invites/accept`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                        },
                        body: JSON.stringify({ token: inviteToken })
                      })
                      const data = await response.json().catch(() => null)
                      if (!response.ok || !data?.success) {
                        setInviteError(data?.error || 'Failed to accept invite.')
                        return
                      }
                      localStorage.removeItem('pendingInviteToken')
                      if (data?.token) {
                        localStorage.setItem('authToken', data.token)
                      }
                      // Clear stale company caches and re-hydrate session using the newly issued token.
                      localStorage.removeItem('currentCompany')
                      localStorage.removeItem('companies')
                      await refreshSession()
                      setInviteAccepted(true)
                      window.setTimeout(() => navigate('/dashboard'), 900)
                    } catch (e: any) {
                      setInviteError(e?.message || 'Failed to accept invite.')
                    } finally {
                      setInviteLoading(false)
                    }
                  }}
                >
                  {inviteLoading ? 'Accepting…' : inviteAccepted ? 'Invite Accepted' : 'Accept Invite'}
                </button>

                {currentUser ? (
                  <button
                    type="button"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={inviteLoading || inviteAccepted || !inviteToken}
                    onClick={async () => {
                      if (!inviteToken) return
                      setInviteLoading(true)
                      setInviteError('')
                      try {
                        const authToken = localStorage.getItem('authToken')
                        const response = await fetch(`${API_BASE_URL}/company-invites/decline`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                          },
                          body: JSON.stringify({ token: inviteToken })
                        })
                        const data = await response.json().catch(() => null)
                        if (!response.ok || !data?.success) {
                          setInviteError(data?.error || 'Failed to decline invite.')
                          return
                        }
                        localStorage.removeItem('pendingInviteToken')
                        navigate('/auth')
                      } catch (e: any) {
                        setInviteError(e?.message || 'Failed to decline invite.')
                      } finally {
                        setInviteLoading(false)
                      }
                    }}
                  >
                    Decline
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    onClick={() => {
                      setShowSignup(false)
                      navigate('/auth')
                    }}
                  >
                    Go to Sign In
                  </button>
                )}
              </div>
            </div>
          ) : isPasswordFlow ? (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {isSetPasswordMode ? 'Set Password' : 'Reset Password'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {isSetPasswordMode ? 'Set a password to activate your account.' : 'Enter a new password for your account.'}
              </p>

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
                  {resetLoading ? 'Saving...' : isSetPasswordMode ? 'Set Password' : 'Reset Password'}
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
