import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useMySQLAuth } from './MySQLAuthContext'

interface ThemeContextType {
  isDarkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (isDark: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { currentUser } = useMySQLAuth()
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check system preference as default
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // User-specific dark mode implementation:
  // - Each user has their own theme preference stored in localStorage
  // - Theme preference is tied to user.uid to prevent conflicts
  // - When user logs out, theme reverts to system preference
  // - When user logs in, their saved preference is restored

  // Load user's theme preference when user changes
  useEffect(() => {
    if (currentUser) {
      // Check user-specific localStorage
      const userThemeKey = `darkMode_${currentUser.uid}`
      const saved = localStorage.getItem(userThemeKey)
      if (saved !== null) {
        setIsDarkMode(JSON.parse(saved))
      } else {
        // Default to system preference for new users
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    } else {
      // No user logged in, use system preference
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [currentUser])

  // Save user's theme preference when it changes
  useEffect(() => {
    if (currentUser) {
      const userThemeKey = `darkMode_${currentUser.uid}`
      localStorage.setItem(userThemeKey, JSON.stringify(isDarkMode))
    }
  }, [isDarkMode, currentUser])

  // Apply theme to document html element (this is still needed for Tailwind)
  // Apply dark mode regardless of login status to support landing page theme toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Listen for system theme changes (only when no user is logged in)
  // This allows landing page to follow system preference by default
  useEffect(() => {
    if (!currentUser) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches)
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [currentUser])

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => !prev)
  }

  const setDarkMode = (isDark: boolean) => {
    setIsDarkMode(isDark)
  }

  const value = {
    isDarkMode,
    toggleDarkMode,
    setDarkMode
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}