import React, { useState } from 'react'
import { X, CreditCard, AlertTriangle } from 'lucide-react'

interface SeatLimitModalProps {
  isOpen: boolean
  onClose: () => void
  currentUsers: number
  maxMembers: number
  pricingLevel: string
  onPurchaseSeats: (seats: number) => Promise<void>
}

export default function SeatLimitModal({ 
  isOpen, 
  onClose, 
  currentUsers, 
  maxMembers, 
  pricingLevel,
  onPurchaseSeats
}: SeatLimitModalProps) {
  const [loading, setLoading] = useState(false)
  const [additionalSeats, setAdditionalSeats] = useState(5)

  const pricePerSeat = pricingLevel === 'enterprise' ? 12 : 9
  const totalCost = additionalSeats * pricePerSeat

  const handlePurchaseSeats = async () => {
    setLoading(true)
    try {
      await onPurchaseSeats(additionalSeats)
    } catch (error) {
      console.error('Seat purchase error:', error)
      alert('Failed to initiate purchase. Please try again.')
    } finally {
      setLoading(false)
    }
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
            Your {pricingLevel.charAt(0).toUpperCase() + pricingLevel.slice(1)} plan includes {maxMembers} seats. 
            You currently have {currentUsers} active users.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional seats:
            </label>
            <span className="font-bold text-primary-600">{additionalSeats}</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={additionalSeats}
            onChange={(e) => setAdditionalSeats(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 seat</span>
            <span>50 seats</span>
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            ${totalCost}
            <span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            ${pricePerSeat} × {additionalSeats} seats
          </p>
        </div>

        <button
          onClick={handlePurchaseSeats}
          disabled={loading}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Purchase {additionalSeats} Seat{additionalSeats > 1 ? 's' : ''}
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          Only super admins can purchase additional seats.
        </p>
      </div>
    </div>
  )
}
