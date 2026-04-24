import { useNavigate } from 'react-router-dom'
import { XCircle } from 'lucide-react'

export default function BillingCancel() {
  const navigate = useNavigate()
  const hasAuthToken = !!localStorage.getItem('authToken')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <XCircle className="h-16 w-16 text-orange-500 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Payment Cancelled</h2>
        <p className="text-gray-600 mb-6">
          Your payment was cancelled. No charges have been made to your account.
        </p>
        <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-6">
          <p className="text-orange-800 text-sm">
            You can upgrade your plan anytime from the settings page.
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => navigate(hasAuthToken ? '/upgrade' : '/auth')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate(hasAuthToken ? '/settings' : '/verify-email')}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
          >
            {hasAuthToken ? 'Go to Settings' : 'Verify Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
