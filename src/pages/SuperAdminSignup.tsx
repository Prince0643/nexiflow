import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import SuperAdminSignupForm from '../components/auth/SuperAdminSignupForm'
import { Home } from 'lucide-react'

export default function SuperAdminSignup() {
  const navigate = useNavigate()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const [showLogin, setShowLogin] = useState(false)
  const brandingRef = useRef<HTMLDivElement>(null)

  const handleSwitchToLogin = () => {
    navigate('/auth')
  }

  return (
    <div className={`min-h-screen flex bg-gray-900`}>
      {/* Left Side - Branding */}
      <div 
        ref={brandingRef}
        className="hidden lg:flex lg:w-1/2 bg-[#020617] text-white p-12 flex-col justify-center relative overflow-hidden"
      >
        {/* Static glow effects with consistent color scheme */}
        <div className="absolute top-[-180px] right-[-120px] w-[500px] h-[500px] bg-blue-500/20 dark:bg-blue-700/30 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-200px] left-[-150px] w-[480px] h-[480px] bg-indigo-400/15 dark:bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute top-[45%] left-[25%] w-[300px] h-[300px] bg-purple-400/10 dark:bg-purple-500/10 rounded-full blur-[160px] pointer-events-none"></div>
        {/* Additional glow orbs for richer visual effect */}
        <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] rounded-full bg-[#091845] blur-[120px] opacity-25 pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/3 w-[200px] h-[200px] rounded-full bg-blue-500 blur-[100px] opacity-20 pointer-events-none"></div>

        <div className="max-w-lg relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <img 
                  src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
                  alt="NexiFlow Logo" 
                  className="h-12 w-auto"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold">NexiFlow</h1>
                <p className="text-sm text-gray-400">Powered by Nexistry Digital Solutions</p>
              </div>
            </div>
            {/* Removed dark mode toggle */}
          </div>
          
          <h2 className="text-4xl font-bold mb-6 text-white">
            Track Time, Boost Productivity
          </h2>
          
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Join thousands of professionals who use NexiFlow to manage their time, 
            track projects, and improve their productivity. Simple, powerful, and designed for teams.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Employee time tracking</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Project management</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Advanced analytics</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-gray-300">Team collaboration</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-start justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile Branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <img 
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
                    alt="NexiFlow Logo" 
                    className="h-10 w-auto mx-auto"
                  />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-white">NexiFlow</h1>
                  <p className="text-xs text-gray-400">Powered by Nexistry Digital Solutions</p>
                </div>
              </div>
              {/* Removed dark mode toggle */}
            </div>
            <p className="text-gray-600 dark:text-gray-400">Time tracking made simple</p>
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
            <p>© 2024 NexiFlow. All rights reserved.</p>
            <div className="mt-2 space-x-4">
              <a href="#" className="hover:text-gray-600 transition-colors dark:hover:text-gray-300">Privacy Policy</a>
              <a href="#" className="hover:text-gray-600 transition-colors dark:hover:text-gray-300">Terms of Service</a>
              <a href="#" className="hover:text-gray-600 transition-colors dark:hover:text-gray-300">Support</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}