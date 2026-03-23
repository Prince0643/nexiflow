import React from 'react'
import { X, ArrowUpRight, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SeatLimitModalProps {
  isOpen: boolean
  onClose: () => void
  currentUsers: number
  maxMembers: number
  pricingLevel: string
}

export default function SeatLimitModal({ 
  isOpen, 
  onClose, 
  currentUsers, 
  maxMembers, 
  pricingLevel
}: SeatLimitModalProps) {
  const navigate = useNavigate()

  const handleUpgrade = () => {
    onClose()
    navigate('/upgrade')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Seat Limit Reached
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your {pricingLevel.charAt(0).toUpperCase() + pricingLevel.slice(1)} plan includes {maxMembers} seat{maxMembers !== 1 ? 's' : ''}. 
            You currently have {currentUsers} active user{currentUsers !== 1 ? 's' : ''}.
          </p>
          <p className="text-gray-500 dark:text-gray-500 mt-4 text-sm">
            Upgrade your plan to add more users and unlock additional features.
          </p>
        </div>

        <button
          onClick={handleUpgrade}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center"
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Upgrade Plan
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          Only super admins can upgrade the plan.
        </p>
      </div>
    </div>
  )
}
