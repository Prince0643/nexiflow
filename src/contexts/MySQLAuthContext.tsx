import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthUser, LoginCredentials, SignupCredentials, Company } from '../types'
import { mysqlLoggingService } from '../services/mysqlLoggingService'

interface MySQLAuthContextType {
  currentUser: AuthUser | null
  currentCompany: Company | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>
  signup: (credentials: SignupCredentials, companyName?: string) => Promise<{ success: boolean; error?: string }>
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

  // Load user from session storage on initial load
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        const storedUser = localStorage.getItem('currentUser')
        const storedCompany = localStorage.getItem('currentCompany')
        const storedToken = localStorage.getItem('authToken')
        
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

  async function login(credentials: LoginCredentials) {
    try {
      setLoading(true)
      
      // Make API call to backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })
      
      const data = await response.json()
      
      if (!data.success) {
        return { success: false, error: data.error }
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
        emailVerified: true // MySQL doesn't have email verification like Firebase
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
      setLoading(false)
    }
  }

  async function signup(credentials: SignupCredentials, companyName?: string) {
    try {
      setLoading(true)
      
      // Make API call to backend
      const response = await fetch('/api/auth/signup', {
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
        return { success: false, error: data.error }
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
        emailVerified: true
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
      setLoading(false)
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
      // In a real implementation, you would:
      // 1. Generate a password reset token
      // 2. Store it in the database
      // 3. Send an email with a reset link
      // 4. Handle the reset link to allow password change
      
      console.log(`Password reset requested for email: ${email}`)
      // Simulate success
      return { success: true }
    } catch (error) {
      console.error('Error during password reset:', error)
      return { success: false, error: 'Password reset failed. Please try again.' }
    }
  }

  const value = {
    currentUser,
    currentCompany,
    loading,
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