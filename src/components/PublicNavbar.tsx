import { useState } from 'react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export type PublicNavLink = {
  id: string
  label: string
}

type PublicNavbarProps = {
  links: PublicNavLink[]
  onLinkClick: (id: string) => void
  onLogin: () => void
  onAccess: () => void
  extraLink?: { label: string; onClick: () => void }
}

export default function PublicNavbar({ links, onLinkClick, onLogin, onAccess, extraLink }: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isDarkMode, toggleDarkMode } = useTheme()

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200/60 dark:border-gray-700/60">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img
            src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
            alt="NexiFlow logo"
            className="h-8 w-auto sm:h-10"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight sm:text-lg">NexiFlow</p>
            <p className="hidden text-[11px] text-gray-400 sm:block">Powered by Nexistry Digital Solutions</p>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-8 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-gray-600 dark:text-gray-300">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => onLinkClick(link.id)}
              className="transition-colors hover:text-blue-600"
            >
              {link.label}
            </button>
          ))}
          {extraLink && (
            <button onClick={extraLink.onClick} className="transition-colors hover:text-blue-600">
              {extraLink.label}
            </button>
          )}
        </nav>

        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={onLogin} className="text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900">
            Log In
          </button>
          <button
            onClick={onAccess}
            className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
          >
            Access NexiFlow
          </button>
        </div>

        <div className="lg:hidden flex items-center gap-1">
          <button
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold tracking-[0.3em] uppercase text-gray-500">Menu</span>
            <button onClick={() => setMobileOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 pb-4 space-y-3">
            {links.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  onLinkClick(link.id)
                  setMobileOpen(false)
                }}
                className="w-full text-left text-gray-700 dark:text-gray-200 font-semibold tracking-wide"
              >
                {link.label}
              </button>
            ))}
            {extraLink && (
              <button
                onClick={() => {
                  extraLink.onClick()
                  setMobileOpen(false)
                }}
                className="w-full text-left text-gray-700 dark:text-gray-200 font-semibold tracking-wide"
              >
                {extraLink.label}
              </button>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={onLogin} className="text-left text-gray-600 dark:text-gray-300 font-semibold">
                Log In
              </button>
              <button onClick={onAccess} className="px-4 py-2 rounded-full bg-blue-600 text-white font-semibold text-sm">
                Access NexiFlow
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

