import { useState, useEffect } from 'react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { TimeEntry, Project, Client, ClientType } from '../types'
import { formatDateTime, formatDurationToHHMMSS } from '../utils'

// Mock data for frontend-only version
const mockTimeEntries: TimeEntry[] = [
  {
    id: '1',
    userId: 'user1',
    description: 'Working on project proposal',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(),
    duration: 3600, // 1 hour in seconds
    isRunning: false,
    isBillable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'proj1',
    projectName: 'Website Redesign',
    clientId: 'client1',
    clientName: 'Acme Corp'
  },
  {
    id: '2',
    userId: 'user1',
    description: 'Team meeting',
    startTime: new Date(Date.now() - 7200000), // 2 hours ago
    endTime: new Date(Date.now() - 3600000), // 1 hour ago
    duration: 3600, // 1 hour in seconds
    isRunning: false,
    isBillable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'proj2',
    projectName: 'Mobile App Development',
    clientId: 'client2',
    clientName: 'Globex Inc'
  },
  {
    id: '3',
    userId: 'user1',
    description: 'Code review',
    startTime: new Date(Date.now() - 10800000), // 3 hours ago
    endTime: new Date(Date.now() - 7200000), // 2 hours ago
    duration: 3600, // 1 hour in seconds
    isRunning: false,
    isBillable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'proj1',
    projectName: 'Website Redesign',
    clientId: 'client1',
    clientName: 'Acme Corp'
  }
]

const mockProjects: Project[] = [
  {
    id: 'proj1',
    name: 'Website Redesign',
    description: 'Complete redesign of company website',
    color: '#3B82F6',
    status: 'active',
    priority: 'high',
    isArchived: false,
    createdBy: 'user1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'proj2',
    name: 'Mobile App Development',
    description: 'iOS and Android application',
    color: '#10B981',
    status: 'active',
    priority: 'medium',
    isArchived: false,
    createdBy: 'user1',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

const mockClients: Client[] = [
  {
    id: 'client1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    country: 'USA',
    timezone: 'America/New_York',
    clientType: 'full-time' as ClientType,
    hourlyRate: 50,
    isArchived: false,
    createdBy: 'user1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'client2',
    name: 'Globex Inc',
    email: 'info@globex.com',
    country: 'USA',
    timezone: 'America/Los_Angeles',
    clientType: 'part-time' as ClientType,
    hourlyRate: 75,
    isArchived: false,
    createdBy: 'user1',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

const mockTimeSummary = {
  daily: { totalDuration: 7200 }, // 2 hours
  weekly: { totalDuration: 21600 }, // 6 hours
  monthly: { totalDuration: 86400 } // 24 hours
}

export default function Dashboard() {
  const { currentUser } = useMySQLAuth()
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [timeSummary, setTimeSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setRecentEntries(mockTimeEntries)
      setProjects(mockProjects)
      setClients(mockClients)
      setTimeSummary(mockTimeSummary)
      setLoading(false)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [currentUser])

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'No Client'
    const client = clients.find(c => c.id === clientId)
    return client ? client.name : 'Unknown Client'
  }

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'No Project'
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {currentUser?.name}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Here's what's happening with your account today.
        </p>
      </div>

      {/* Time Summary Cards */}
      {timeSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Today</h3>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatDurationToHHMMSS(timeSummary.daily.totalDuration)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">This Week</h3>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatDurationToHHMMSS(timeSummary.weekly.totalDuration)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-3">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">This Month</h3>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatDurationToHHMMSS(timeSummary.monthly.totalDuration)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Time Entries */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Time Entries</h2>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {recentEntries.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No time entries yet.</p>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Project
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(entry.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {getClientName(entry.clientId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {getProjectName(entry.projectId)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {entry.description || 'No description'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDurationToHHMMSS(entry.duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}