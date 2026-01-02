import { Link } from 'react-router-dom'
import { BarChart3, Clock, FolderKanban, Plus, RefreshCw } from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'

export default function Dashboard() {
  const { currentUser } = useMySQLAuth()

  const displayName = currentUser?.name || currentUser?.email || 'User'
  const roleLabel = currentUser?.role
    ? currentUser.role
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : ''

  return (
    <div className="w-full space-y-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-base text-gray-600 dark:text-gray-400">
            Welcome back, {displayName}{roleLabel ? ` ${roleLabel}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/tracker"
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Clock className="h-4 w-4" />
            Start Timer
          </Link>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex min-h-[320px] items-center rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800/60 sm:p-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600/10 dark:bg-primary-500/15">
            <Clock className="h-7 w-7 text-primary-600 dark:text-primary-400" />
          </div>

          <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">Welcome to NexiFlow</h2>
          <p className="mt-2 max-w-xl text-base text-gray-600 dark:text-gray-300">
            Your time tracking application is ready. The system has been rebuilt with a clean foundation.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/tracker"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Clock className="h-4 w-4" />
              Start Tracking
            </Link>
            <Link
              to="/projects"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <FolderKanban className="h-4 w-4" />
              Manage Projects
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          to="/tracker"
          className="group flex min-h-[110px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-800/60"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600/10 dark:bg-primary-500/15">
              <Clock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 dark:text-white">Start Timer</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Begin tracking time for a new task
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/projects"
          className="group flex min-h-[110px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-800/60"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600/10 dark:bg-green-500/15">
              <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 dark:text-white">New Project</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Create a new project to organize work
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="group flex min-h-[110px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-800/60"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600/10 dark:bg-purple-500/15">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 dark:text-white">View Reports</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Analyze your time and productivity
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}