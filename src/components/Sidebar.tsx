import { Link, useLocation } from 'react-router-dom'
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
  Crown
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { canAccessFeature } from '../utils/permissions'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const { currentUser, currentCompany } = useMySQLAuth()

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
      { name: 'Reports', href: '/reports', icon: BarChart3, requiredFeature: null },
      { name: 'Invoicing', href: '/invoicing', icon: FileText, requiredFeature: null }, // Changed to Invoicing
      { name: 'Admin Dashboard', href: '/admin', icon: User, requiredFeature: 'admin-dashboard' },
      { name: 'Settings', href: '/settings', icon: Settings, requiredFeature: null },
      // Removed PDF Settings from sidebar - will be accessible through Settings page
    ]

    // For solo pricing level, hide certain tabs and add Upgrade CTA
    if (currentCompany?.pricingLevel === 'solo') {
      // Hide certain tabs for Solo users
      allNavigation = allNavigation.filter(item => 
        !['Task Management', 'Teams', 'Reports'].includes(item.name)
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

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
      open ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 py-5">
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