import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

export default function EmailVerification() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const initialEmail = useMemo(() => {
    const qEmail = (searchParams.get('email') || '').trim()
    if (qEmail) return qEmail
    return (localStorage.getItem('pendingVerificationEmail') || '').trim()
  }, [searchParams])

  const [email, setEmail] = useState(initialEmail)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'idle'
  )
  const [message, setMessage] = useState(token ? 'Verifying your email…' : 'Check your inbox to verify your email.')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const run = async () => {
      setVerificationStatus('verifying')
      setMessage('Verifying your email…')

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.success) {
          const err = data?.error || 'Verification failed. Please request a new link.'
          if (!cancelled) {
            setVerificationStatus('error')
            setMessage(err)
          }
          return
        }

        if (!cancelled) {
          localStorage.removeItem('pendingVerificationEmail')
          setVerificationStatus('success')
          setMessage('Email verified. Redirecting to sign in…')
          window.setTimeout(() => navigate('/auth'), 1200)
        }
      } catch (err: any) {
        if (!cancelled) {
          setVerificationStatus('error')
          setMessage(err?.message || 'Verification failed. Please try again.')
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [token, navigate])

  const handleSignIn = () => {
    navigate('/auth')
  }

  const handleResend = async () => {
    const normalized = email.trim()
    if (!normalized) {
      setMessage('Please enter your email address to resend the verification email.')
      setVerificationStatus('error')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        setVerificationStatus('error')
        setMessage(data?.error || 'Failed to resend verification email. Please try again.')
        return
      }

      localStorage.setItem('pendingVerificationEmail', normalized)
      setVerificationStatus('idle')
      setMessage('If that email is registered and unverified, a new verification link has been sent.')
    } catch (err: any) {
      setVerificationStatus('error')
      setMessage(err?.message || 'Failed to resend verification email. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
              alt="NexiFlow Logo" 
              className="h-12 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Verification</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 dark:bg-gray-800 dark:border-gray-700">
          {verificationStatus === 'verifying' && (
            <div className="text-center">
              <Loader className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">{message}</p>
            </div>
          )}

          {verificationStatus === 'idle' && (
            <div className="text-center space-y-5">
              <CheckCircle className="h-12 w-12 text-primary-600 mx-auto" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2 dark:text-white">Check your email</h2>
                <p className="text-gray-600 dark:text-gray-300">{message}</p>
              </div>

              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="you@company.com"
                  disabled={actionLoading}
                />
              </div>

              <button onClick={handleResend} disabled={actionLoading} className="w-full btn-primary py-3">
                {actionLoading ? 'Sending…' : 'Resend verification email'}
              </button>

              <button onClick={handleSignIn} className="w-full btn-secondary py-3">
                Return to Sign In
              </button>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2 dark:text-white">Email Verified!</h2>
              <p className="text-gray-600 mb-6 dark:text-gray-300">{message}</p>
              <button
                onClick={handleSignIn}
                className="w-full btn-primary py-3"
              >
                Sign In to Your Account
              </button>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="text-center space-y-5">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2 dark:text-white">Verification Failed</h2>
              <p className="text-gray-600 dark:text-gray-300">{message}</p>

              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="you@company.com"
                  disabled={actionLoading}
                />
              </div>

              <button onClick={handleResend} disabled={actionLoading} className="w-full btn-primary py-3">
                {actionLoading ? 'Sending…' : 'Resend verification email'}
              </button>

              <button onClick={handleSignIn} className="w-full btn-secondary py-3">
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
