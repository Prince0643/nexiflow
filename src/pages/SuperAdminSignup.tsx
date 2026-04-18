import { useNavigate } from 'react-router-dom'
import SuperAdminSignupForm from '../components/auth/SuperAdminSignupForm'
import { Home } from 'lucide-react'

export default function SuperAdminSignup() {
  const navigate = useNavigate()

  const handleSwitchToLogin = () => {
    navigate('/auth')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      {/* Hero Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900 via-[#060b1d] to-black opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]/30" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,_transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,_transparent_1px)] bg-[length:120px_120px]" />
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
              <h1 className="text-2xl font-bold text-white">NexiFlow</h1>
              <p className="text-xs text-gray-400">Powered by Nexistry Digital Solutions</p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 backdrop-blur-xl">
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
          <p>&copy; 2025 NexiFlow. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}