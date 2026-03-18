import React, { useState, useEffect } from 'react'
import { AlertTriangle, Clock, CheckCircle, CreditCard, X } from 'lucide-react'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

interface BillingStatus {
  companyId: string
  companyName: string
  pricingLevel: string
  maxMembers: number
  nextBillingDate: string | null
  lastPaymentDate: string | null
  gracePeriodEndDate: string | null
  isInGracePeriod: boolean
  billingStatus: string
  daysUntilDue: number | null
  isOverdue: boolean
  statusMessage: string
  statusType: 'info' | 'warning' | 'danger'
  canUpgrade: boolean
  needsPayment: boolean
}

export default function BillingStatusBanner() {
  const { currentCompany } = useMySQLAuth()
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!currentCompany || currentCompany.pricingLevel === 'solo') {
      setLoading(false)
      return
    }

    const fetchBillingStatus = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) {
          setLoading(false)
          return
        }

        const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
        const response = await fetch(`${API_BASE_URL}/billing/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setBillingStatus(data.data)
          }
        }
      } catch (error) {
        console.error('Error fetching billing status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBillingStatus()
  }, [currentCompany])

  // Don't show for solo plans or if dismissed
  if (loading || !billingStatus || dismissed) {
    return null
  }

  // Don't show if no payment needed and not urgent
  if (!billingStatus.needsPayment && billingStatus.statusType === 'info') {
    return null
  }

  const getBgColor = () => {
    switch (billingStatus.statusType) {
      case 'danger':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    }
  }

  const getTextColor = () => {
    switch (billingStatus.statusType) {
      case 'danger':
        return 'text-red-800 dark:text-red-200'
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200'
      default:
        return 'text-blue-800 dark:text-blue-200'
    }
  }

  const getIcon = () => {
    switch (billingStatus.statusType) {
      case 'danger':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
      case 'warning':
        return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
      default:
        return <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
    }
  }

  const handlePayNow = () => {
    // Navigate to upgrade page for renewal
    window.location.href = '/upgrade'
  }

  const handleDismiss = () => {
    setDismissed(true)
    // Store dismissal in localStorage for 24 hours
    localStorage.setItem('billingBannerDismissed', Date.now().toString())
  }

  // Check if previously dismissed (within last 24 hours)
  useEffect(() => {
    const dismissedTime = localStorage.getItem('billingBannerDismissed')
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60)
      if (hoursSinceDismissed < 24) {
        setDismissed(true)
      } else {
        localStorage.removeItem('billingBannerDismissed')
      }
    }
  }, [])

  return (
    <div className={`w-full border-b ${getBgColor()} px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getIcon()}
          <div className="flex items-center space-x-2">
            <span className={`font-medium ${getTextColor()}`}>
              {billingStatus.statusMessage}
            </span>
            {billingStatus.nextBillingDate && (
              <span className={`text-sm ${getTextColor()} opacity-80`}>
                (Next billing: {new Date(billingStatus.nextBillingDate).toLocaleDateString()})
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {billingStatus.needsPayment && (
            <button
              onClick={handlePayNow}
              className="inline-flex items-center space-x-1 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>Pay Now</span>
            </button>
          )}
          
          <button
            onClick={handleDismiss}
            className={`p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${getTextColor()}`}
            title="Dismiss for 24 hours"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
