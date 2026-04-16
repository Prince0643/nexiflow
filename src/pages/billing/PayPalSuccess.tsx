import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function PayPalSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [capturing, setCapturing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token') // PayPal returns the order ID as 'token'
    
    if (!token) {
      setError('Invalid PayPal response. Missing order ID.')
      setCapturing(false)
      return
    }

    const capturePayment = async () => {
      try {
        const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
        
        const response = await fetch(`${API_BASE_URL}/billing/capture-paypal-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ orderId: token })
        })

        const data = await response.json()

        if (data.success) {
          setCapturing(false)
          // Redirect to settings after 3 seconds
          setTimeout(() => {
            navigate('/settings')
          }, 3000)
        } else {
          setError(data.error || 'Failed to capture payment. Please contact support.')
          setCapturing(false)
        }
      } catch (err) {
        console.error('PayPal capture error:', err)
        setError('An error occurred while processing your payment. Please contact support.')
        setCapturing(false)
      }
    }

    capturePayment()
  }, [searchParams, navigate])

  if (capturing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <Loader2 className="h-16 w-16 text-blue-500 mx-auto animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Processing Payment...</h2>
          <p className="text-gray-600">
            Please wait while we confirm your PayPal payment.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-red-600 text-2xl">!</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-red-600">Payment Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/upgrade')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">
          Thank you for your PayPal payment. Your subscription has been activated.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
          <p className="text-green-800 text-sm">
            Your company plan has been upgraded. You now have access to all features included in your new plan.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Redirecting to settings in 3 seconds...
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Go to Settings
        </button>
      </div>
    </div>
  )
}
