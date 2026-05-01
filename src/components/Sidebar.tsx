import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { 
  Clock, 
  BarChart3, 
  FolderOpen, 
  Settings, 
  X,
  Users,
  Kanban,
  UserCheck,
  DollarSign,
  Building2,
  MessageSquare,
  Calendar,
  FileText,
  Home,
  User,
  Shield,
  Crown,
  Chrome,
  ChevronDown,
  Check
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { canAccessFeature } from '../utils/permissions'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const { currentUser, currentCompany, companies, switchCompany } = useMySQLAuth()
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const [switchError, setSwitchError] = useState<string>('')
  const companyMenuRef = useRef<HTMLDivElement | null>(null)

  // Define navigation items based on user role
  const getNavigationItems = () => {
    // Special navigation for root users
    if (currentUser?.role === 'root') {
      return [
        { name: 'Root Dashboard', href: '/root', icon: Shield, requiredFeature: null },
        { name: 'System Settings', href: '/system', icon: Settings, requiredFeature: null },
      ]
    }

    // Regular navigation for other users
    let allNavigation = [
      { name: 'Dashboard', href: '/', icon: Home, requiredFeature: null },
      { name: 'Time Tracker', href: '/tracker', icon: Clock, requiredFeature: null },
      { name: 'Calendar', href: '/calendar', icon: Calendar, requiredFeature: null },
      { name: 'Projects', href: '/projects', icon: FolderOpen, requiredFeature: 'projects' },
      { name: 'Clients', href: '/clients', icon: Building2, requiredFeature: 'clients' },
      { name: 'Task Management', href: '/management', icon: Kanban, requiredFeature: null },
      { name: 'Teams', href: '/teams', icon: UserCheck, requiredFeature: 'teams' },
      { name: 'My Reports', href: '/reports', icon: BarChart3, requiredFeature: null },
      { name: 'Invoicing', href: '/invoicing', icon: FileText, requiredFeature: 'invoicing' },
      { name: 'Admin Dashboard', href: '/admin', icon: User, requiredFeature: 'admin-dashboard' },
      { name: 'Settings', href: '/settings', icon: Settings, requiredFeature: null },
      // Removed PDF Settings from sidebar - will be accessible through Settings page
    ]

    if (currentCompany?.pricingLevel === 'office' || currentCompany?.pricingLevel === 'enterprise') {
      allNavigation.splice(8, 0, {
        name: 'Chrome Extension',
        href: '/chrome-extension',
        icon: Chrome,
        requiredFeature: null
      })
    }

    // For solo pricing level, hide certain tabs and add Upgrade CTA
    if (currentCompany?.pricingLevel === 'solo') {
      // Hide certain tabs for Solo users
      allNavigation = allNavigation.filter(item => 
        !['Task Management', 'Teams', 'Reports', 'Invoicing', 'Chrome Extension'].includes(item.name)
      );
      
      // Add Upgrade CTA tab for Solo users
      allNavigation.push({ name: 'Upgrade', href: '/upgrade', icon: Crown, requiredFeature: null });
    }

    // Filter navigation based on user permissions
    return allNavigation.filter(item => 
      !item.requiredFeature || (currentUser?.role && canAccessFeature(currentUser.role, item.requiredFeature))
    )
  }

  const navigation = getNavigationItems()
  const canSwitchCompanies = Array.isArray(companies) && companies.length > 1

  useEffect(() => {
    if (!companyMenuOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCompanyMenuOpen(false)
    }

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (companyMenuRef.current && !companyMenuRef.current.contains(target)) {
        setCompanyMenuOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [companyMenuOpen])

  const handleCompanyRowClick = () => {
    setSwitchError('')
    if (!canSwitchCompanies) return
    setCompanyMenuOpen((v) => !v)
  }

  const handleSelectCompany = async (companyId: string) => {
    setSwitchError('')
    const result = await switchCompany(String(companyId))
    if (!result?.success) {
      setSwitchError(result?.error || 'Failed to switch company')
      return
    }
    setCompanyMenuOpen(false)
    setOpen(false)
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
      open ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="relative px-4 border-b border-gray-200 dark:border-gray-700 py-5" ref={companyMenuRef}>
        <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <img 
              src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
              alt="NexiFlow Logo" 
              className="h-8 w-auto"
            />
          </div>
          <div className="ml-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">NexiFlow</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400">Powered by Nexistry Digital Solutions</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-white focus:outline-none"
        >
          <X className="h-6 w-6" />
        </button>
        </div>

        <button
          type="button"
          onClick={handleCompanyRowClick}
          className={`mt-3 w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
            canSwitchCompanies
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : ''
          }`}
          aria-haspopup={canSwitchCompanies ? 'menu' : undefined}
          aria-expanded={canSwitchCompanies ? companyMenuOpen : undefined}
          title={canSwitchCompanies ? 'Switch company' : undefined}
        >
          <div className="min-w-0 flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Current company</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {currentCompany?.name || 'No company selected'}
              </div>
            </div>
          </div>
          {canSwitchCompanies && (
            <ChevronDown
              className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${
                companyMenuOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        {switchError && (
          <div className="mt-2 px-3 text-xs text-red-600 dark:text-red-400">
            {switchError}
          </div>
        )}

        {companyMenuOpen && canSwitchCompanies && (
          <div
            role="menu"
            className="absolute left-4 right-4 top-[132px] z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden"
          >
            {companies.map((company: any) => {
              const isCurrent = String(company?.id) === String(currentCompany?.id)
              return (
                <button
                  key={String(company?.id)}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectCompany(String(company?.id))}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm ${
                    isCurrent
                      ? 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="truncate">{company?.name || `Company ${company?.id}`}</span>
                  {isCurrent && <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setOpen(false)}
            >
              <item.icon className="flex-shrink-0 h-5 w-5 mr-3" />
              <span className="flex-1">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
