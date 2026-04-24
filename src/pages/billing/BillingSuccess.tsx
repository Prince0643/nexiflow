import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function BillingSuccess() {
  const navigate = useNavigate()
  const hasAuthToken = !!localStorage.getItem('authToken')

  useEffect(() => {
    if (!hasAuthToken) return
    const timer = setTimeout(() => navigate('/settings'), 5000)

    return () => clearTimeout(timer)
  }, [navigate, hasAuthToken])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">
          Thank you for upgrading your plan. Your subscription has been activated.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
          <p className="text-green-800 text-sm">
            Your company plan has been upgraded. You now have access to all features included in your new plan.
          </p>
        </div>
        {hasAuthToken ? (
          <>
            <p className="text-sm text-gray-500">Redirecting to settings in 5 seconds...</p>
            <button
              onClick={() => navigate('/settings')}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Settings
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Please verify your email, then sign in to access your upgraded plan.
            </p>
            <button
              onClick={() => navigate('/verify-email')}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Verify Email
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="mt-3 w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Sign In
            </button>
          </>
        )}
      </div>
    </div>
  )
}
