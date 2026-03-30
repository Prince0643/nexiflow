import { useNavigate } from 'react-router-dom'
import SuperAdminSignupForm from '../components/auth/SuperAdminSignupForm'
import { Home } from 'lucide-react'

export default function SuperAdminSignup() {
  const navigate = useNavigate()

  const handleSwitchToLogin = () => {
    navigate('/auth')
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-900 p-8`}>
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img
              src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
              alt="NexiFlow Logo"
              className="h-12 w-auto"
            />
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">NexiFlow</h1>
              <p className="text-xs text-gray-400">Powered by Nexistry Digital Solutions</p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 dark:bg-gray-800 dark:border-gray-700">
          <SuperAdminSignupForm onSwitchToLogin={handleSwitchToLogin} />
        </div>

        {/* Back to App Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/landing')}
            className="inline-flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
          >
            <Home className="h-4 w-4" />
            <span>Back to homepage</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          <p>&copy; 2024 NexiFlow. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}