import React from 'react'
import { Navigate } from 'react-router-dom'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'employee' | 'admin'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { currentUser, loading } = useMySQLAuth()

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

  if (requiredRole && currentUser.role !== requiredRole) {
    // Redirect to dashboard if user doesn't have required role
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}