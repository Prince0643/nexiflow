import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function EmailVerification() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // MySQL/JWT auth does not use Firebase email verification callbacks.
    // If user is logged in, just send them to the app.
    if (currentUser) {
      setVerificationStatus('success')
      setMessage('Your account is ready. Redirecting...')
      const t = window.setTimeout(() => navigate('/'), 800)
      return () => window.clearTimeout(t)
    }

    // If user arrived here from an old Firebase verification email, explain the migration.
    const mode = searchParams.get('mode')
    const oobCode = searchParams.get('oobCode')

    if (mode === 'verifyEmail' && oobCode) {
      setVerificationStatus('error')
      setMessage('Email verification is no longer handled by Firebase. Please sign in again.')
      return
    }

    setVerificationStatus('error')
    setMessage('Email verification is not required. Please sign in to continue.')
  }, [searchParams, currentUser, navigate])

  const handleSignIn = () => {
    navigate('/auth')
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
          {verificationStatus === 'pending' && (
            <div className="text-center">
              <Loader className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">{message}</p>
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
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2 dark:text-white">Verification Failed</h2>
              <p className="text-gray-600 mb-6 dark:text-gray-300">{message}</p>
              <button
                onClick={handleSignIn}
                className="w-full btn-primary py-3"
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}