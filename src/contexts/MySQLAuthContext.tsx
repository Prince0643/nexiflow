import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthUser, LoginCredentials, SignupCredentials, Company } from '../types'
import { mysqlLoggingService } from '../services/mysqlLoggingService'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

function isJwtExpired(token: string): boolean {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return true

    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payloadJson = atob(padded)
    const payload = JSON.parse(payloadJson) as { exp?: number }

    if (!payload.exp) return true
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

interface MySQLAuthContextType {
  currentUser: AuthUser | null
  currentCompany: Company | null
  loading: boolean
  authActionLoading: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>
  signup: (
    credentials: SignupCredentials,
    companyName?: string
  ) => Promise<{ success: boolean; error?: string; requiresEmailVerification?: boolean }>
  logout: () => Promise<void>
  resetPassword?: (email: string) => Promise<{ success: boolean; error?: string }>
}

const MySQLAuthContext = createContext<MySQLAuthContextType | undefined>(undefined)

export function useMySQLAuth() {
  const context = useContext(MySQLAuthContext)
  if (context === undefined) {
    throw new Error('useMySQLAuth must be used within a MySQLAuthProvider')
  }
  return context
}

interface MySQLAuthProviderProps {
  children: ReactNode
}

export function MySQLAuthProvider({ children }: MySQLAuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [authActionLoading, setAuthActionLoading] = useState(false)

  // Load user from session storage on initial load
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        const storedUser = localStorage.getItem('currentUser')
        const storedCompany = localStorage.getItem('currentCompany')
        const storedToken = localStorage.getItem('authToken')

        if (storedToken && isJwtExpired(storedToken)) {
          localStorage.removeItem('currentUser')
          localStorage.removeItem('currentCompany')
          localStorage.removeItem('authToken')
          setCurrentUser(null)
          setCurrentCompany(null)
          return
        }

        if (storedUser && storedToken) {
          const user = JSON.parse(storedUser)
          setCurrentUser(user)
          
          if (storedCompany) {
            const company = JSON.parse(storedCompany)
            setCurrentCompany(company)
          }
        }
      } catch (error) {
        console.error('Error loading user from storage:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadUserFromStorage()
  }, [])

  // Function to clear expired token and redirect to login
  const clearExpiredToken = () => {
    // Clear state and localStorage
    setCurrentUser(null)
    setCurrentCompany(null)
    localStorage.removeItem('currentUser')
    localStorage.removeItem('currentCompany')
    localStorage.removeItem('authToken')
  }

  useEffect(() => {
    const handler = () => clearExpiredToken()
    window.addEventListener('auth:expired', handler as EventListener)
    return () => window.removeEventListener('auth:expired', handler as EventListener)
  }, [])

  async function login(credentials: LoginCredentials) {
    try {
      setAuthActionLoading(true)
      
      // Make API call to backend
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })
      
      let data
      try {
        data = await response.json()
      } catch {
        // If response is not valid JSON, use status text
        return { success: false, error: response.statusText || 'Login failed. Please try again.' }
      }
      
      if (!response.ok || !data.success) {
        if (response.status === 403 && (data?.error || data?.message)) {
          return { success: false, error: data.error || data.message }
        }
        return { success: false, error: data.error || data.message || 'Login failed. Please check your credentials.' }
      }
      
      // Create AuthUser object
      const authUser: AuthUser = {
        uid: data.user.id,
        email: data.user.email,
        role: data.user.role,
        name: data.user.name,
        companyId: data.user.companyId || null,
        teamId: data.user.teamId || null,
        teamRole: data.user.teamRole || null,
        avatar: data.user.avatar || null,
        emailVerified: data.user.emailVerified ?? true
      }
      
      // Store in state and localStorage
      setCurrentUser(authUser)
      localStorage.setItem('currentUser', JSON.stringify(authUser))
      localStorage.setItem('authToken', data.token)
      
      if (data.company) {
        setCurrentCompany(data.company)
        localStorage.setItem('currentCompany', JSON.stringify(data.company))
      }
      
      // Log successful login
      await mysqlLoggingService.logAuthEvent('login', data.user.id, data.user.name, true)
      
      return { success: true }
    } catch (error) {
      console.error('Error during login:', error)
      // Log failed login attempt
      await mysqlLoggingService.logAuthEvent('login', credentials.email, 'Unknown', false, { error: (error as Error).message })
      return { success: false, error: 'Login failed. Please try again.' }
    } finally {
      setAuthActionLoading(false)
    }
  }

  async function signup(credentials: SignupCredentials, companyName?: string) {
    try {
      setAuthActionLoading(true)
      
      // Make API call to backend
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: credentials.name,
          email: credentials.email,
          password: credentials.password,
          confirmPassword: credentials.confirmPassword,
          role: credentials.role,
          companyName: companyName
        }),
      })
      
      const data = await response.json()
      
      if (!data.success) {
        return { success: false, error: data.error || 'Signup failed. Please try again.' }
      }

      if (data.requiresEmailVerification) {
        localStorage.setItem('pendingVerificationEmail', credentials.email)
        return { success: true, requiresEmailVerification: true }
      }
      
      // Create AuthUser object
      const authUser: AuthUser = {
        uid: data.user.id,
        email: data.user.email,
        role: data.user.role,
        name: data.user.name,
        companyId: data.user.companyId || null,
        teamId: data.user.teamId || null,
        teamRole: data.user.teamRole || null,
        avatar: data.user.avatar || null,
        emailVerified: data.user.emailVerified ?? true
      }
      
      // Store in state and localStorage
      setCurrentUser(authUser)
      localStorage.setItem('currentUser', JSON.stringify(authUser))
      localStorage.setItem('authToken', data.token)
      
      if (data.company) {
        setCurrentCompany(data.company)
        localStorage.setItem('currentCompany', JSON.stringify(data.company))
      }
      
      // Log successful signup
      await mysqlLoggingService.logAuthEvent('signup', data.user.id, data.user.name, true)
      
      return { success: true }
    } catch (error) {
      console.error('Error during signup:', error)
      // Log failed signup attempt
      await mysqlLoggingService.logAuthEvent('signup', credentials.email, 'Unknown', false, { error: (error as Error).message })
      return { success: false, error: 'Signup failed. Please try again.' }
    } finally {
      setAuthActionLoading(false)
    }
  }

  async function logout() {
    try {
      const userId = currentUser?.uid
      const userName = currentUser?.name
      
      // Clear state and localStorage
      setCurrentUser(null)
      setCurrentCompany(null)
      localStorage.removeItem('currentUser')
      localStorage.removeItem('currentCompany')
      localStorage.removeItem('authToken')
      
      // Log successful logout
      if (userId && userName) {
        await mysqlLoggingService.logAuthEvent('logout', userId, userName, true)
      }
    } catch (error) {
      console.error('Error during logout:', error)
      throw error
    }
  }

  async function resetPassword(email: string) {
    try {
      setAuthActionLoading(true)

      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: data?.error || 'Failed to send reset email. Please try again.' }
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to send reset email. Please try again.' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error during password reset:', error)
      return { success: false, error: 'Password reset failed. Please try again.' }
    } finally {
      setAuthActionLoading(false)
    }
  }

  const value = {
    currentUser,
    currentCompany,
    loading,
    authActionLoading,
    login,
    signup,
    logout,
    resetPassword
  }

  return (
    <MySQLAuthContext.Provider value={value}>
      {children}
    </MySQLAuthContext.Provider>
  )
}
