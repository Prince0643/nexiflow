import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { auth } from '../config/firebase'
import { applyActionCode, signOut } from 'firebase/auth'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function EmailVerification() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // If user is already logged in and verified, redirect to dashboard
    if (currentUser && currentUser.emailVerified) {
      navigate('/')
      return
    }

    // Check if this is an email verification callback
    const mode = searchParams.get('mode')
    const oobCode = searchParams.get('oobCode')
    
    if (mode === 'verifyEmail' && oobCode) {
      handleEmailVerification(oobCode)
    } else {
      // If not a verification link, show instructions
      setVerificationStatus('error')
      setMessage('Invalid verification link. Please check your email for the correct verification link.')
    }
  }, [searchParams, currentUser, navigate])

  const handleEmailVerification = async (oobCode: string) => {
    try {
      setVerificationStatus('pending')
      setMessage('Verifying your email address...')
      
      // Apply the email verification code
      await applyActionCode(auth, oobCode)
      
      // Sign out the user so they can sign in again after verification
      await signOut(auth)
      
      setVerificationStatus('success')
      setMessage('Your email has been successfully verified! You can now sign in to your account.')
    } catch (error) {
      setVerificationStatus('error')
      setMessage('Failed to verify email. The verification link may have expired.')
    }
  }

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