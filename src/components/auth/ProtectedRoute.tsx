import React from 'react'
import { Navigate } from 'react-router-dom'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { PricingLevel, UserRole } from '../../types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  allowedRoles?: UserRole[]
  allowedPlans?: PricingLevel[]
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  allowedPlans,
  redirectTo = '/'
}: ProtectedRouteProps) {
  const { currentUser, currentCompany, loading } = useMySQLAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/auth" replace />
  }

  // Root users can operate without a company context; don't block them on plan gating.
  if (currentUser.role === 'root') {
    return <>{children}</>
  }

  if (allowedPlans && allowedPlans.length > 0) {
    const plan = currentCompany?.pricingLevel
    if (!plan || !allowedPlans.includes(plan)) {
      return <Navigate to={redirectTo} replace />
    }
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={redirectTo} replace />
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    // Redirect to dashboard if user doesn't have required role
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
