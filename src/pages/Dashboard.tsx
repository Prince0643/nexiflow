import { Link } from 'react-router-dom'
import {
  Clock,
  Calendar,
  FolderKanban,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  Shield,
  FileText
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'

type DashboardCard = {
  title: string
  description: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  show?: boolean
}

export default function Dashboard() {
  const { currentUser } = useMySQLAuth()

  const role = currentUser?.role
  const isAdminRole = role === 'admin' || role === 'super_admin' || role === 'hr'
  const isRoot = role === 'root'

  const cards: DashboardCard[] = [
    {
      title: 'Start Time Tracker',
      description: 'Clock in and start tracking time now',
      to: '/tracker',
      icon: Clock,
      show: !isRoot
    },
    {
      title: 'Calendar',
      description: 'View your time entries by day and week',
      to: '/calendar',
      icon: Calendar,
      show: !isRoot
    },
    {
      title: 'Projects',
      description: 'Browse and manage projects',
      to: '/projects',
      icon: FolderKanban,
      show: !isRoot
    },
    {
      title: 'Teams',
      description: 'See your team and members',
      to: '/teams',
      icon: Users,
      show: !isRoot
    },
    {
      title: 'Reports',
      description: 'Analyze productivity and billing insights',
      to: '/reports',
      icon: BarChart3,
      show: !isRoot
    },
    {
      title: 'Settings',
      description: 'Profile, notifications, and preferences',
      to: '/settings',
      icon: SettingsIcon,
      show: true
    },
    {
      title: 'Admin Dashboard',
      description: 'User management and admin tools',
      to: '/admin',
      icon: Shield,
      show: isAdminRole
    },
    {
      title: 'Root Dashboard',
      description: 'System-level management',
      to: '/root',
      icon: Shield,
      show: isRoot
    },
    {
      title: 'PDF Settings',
      description: 'Customize invoice and PDF exports',
      to: '/pdf-settings',
      icon: FileText,
      show: isAdminRole || isRoot
    }
  ]

  const visibleCards = cards.filter(c => c.show !== false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isRoot ? 'Root Home' : 'Dashboard'}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Choose where you want to go.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-11 w-11 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {card.title}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {card.description}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}