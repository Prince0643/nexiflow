import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Clock, FolderKanban, Plus, RefreshCw } from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'

export default function Dashboard() {
  const { currentUser } = useMySQLAuth()

  const userTimezoneRaw = (currentUser as any)?.timezone as string | undefined
  const timezoneLabel = userTimezoneRaw || 'Local time'

  const tzConfig = useMemo(() => {
    const tz = (userTimezoneRaw || '').trim()

    if (!tz) return { type: 'local' as const }

    if (tz.toUpperCase() === 'UTC') return { type: 'iana' as const, iana: 'UTC' }

    if (tz.includes('/')) return { type: 'iana' as const, iana: tz }

    const gmtMatch = tz.match(/GMT\s*([+-])\s*(\d{1,2})/i)
    if (gmtMatch) {
      const sign = gmtMatch[1] === '-' ? -1 : 1
      const hours = Number.parseInt(gmtMatch[2], 10)
      if (Number.isFinite(hours)) {
        return { type: 'offset' as const, offsetHours: sign * hours }
      }
    }

    return { type: 'local' as const }
  }, [userTimezoneRaw])

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const timeText = useMemo(() => {
    try {
      if (tzConfig.type === 'iana') {
        return new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: tzConfig.iana
        }).format(now)
      }

      if (tzConfig.type === 'offset') {
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000
        const shifted = new Date(utcMs + tzConfig.offsetHours * 60 * 60 * 1000)
        return shifted.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      }

      return now.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    } catch {
      return now.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    }
  }, [now, tzConfig])

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

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-7xl">
          {timeText}
        </div>
        <div className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">
          {timezoneLabel}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/60 sm:p-8">
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
              className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
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
          className="group flex min-h-[110px] rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60"
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
          className="group flex min-h-[110px] rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60"
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
          className="group flex min-h-[110px] rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60"
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