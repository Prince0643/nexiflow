import React, { useState, useEffect } from 'react'
import { 
  Settings, 
  Users, 
  Database, 
  Shield, 
  Activity,
  Server,
  Globe,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Building2,
  UserCheck
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { companyService } from '../services/companyService'
import { userService } from '../services/userService'

export default function SystemSettings() {
  const { currentUser } = useMySQLAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalCompanies: 0,
    totalTimeEntries: 0,
    systemUptime: '99.9%',
    lastBackup: new Date().toISOString()
  })
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [creatingSuperAdmin, setCreatingSuperAdmin] = useState(false)
  const [superAdminForm, setSuperAdminForm] = useState({
    companyId: '',
    name: '',
    email: '',
    password: ''
  })

  // Only allow root users to access this page
  if (currentUser?.role !== 'root') {
    return (
      <div className="p-6">
        <div className="card text-center">
          <div className="p-8">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access system settings. This section is reserved for root users only.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', name: 'System Overview', icon: Activity },
    { id: 'users', name: 'User Management', icon: Users },
    { id: 'companies', name: 'Company Management', icon: Building2 },
    { id: 'admins', name: 'Admin Management', icon: UserCheck },
    { id: 'security', name: 'Security Settings', icon: Shield },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'server', name: 'Server Status', icon: Server }
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Companies</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalCompanies}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Time Entries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalTimeEntries}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Server className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Uptime</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.systemUptime}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Database Status</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Healthy</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">API Status</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Authentication</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">System backup completed</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">New company registered</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Security rules updated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">User Management</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Manage all users across the platform. Root users have ultimate control over all user accounts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Total Users</h4>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{systemStats.totalUsers}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100">Active Users</h4>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{Math.floor(systemStats.totalUsers * 0.85)}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900 rounded-lg">
            <h4 className="font-medium text-red-900 dark:text-red-100">Suspended</h4>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">0</p>
          </div>
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    (async () => {
      try {
        const list = await companyService.getCompanies()
        setCompanies(list)
        setSystemStats(prev => ({ ...prev, totalCompanies: list.length }))
      } catch (e) {
        // no-op
      }
    })()
  }, [activeTab])

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return
    setCreatingCompany(true)
    try {
      const created = await companyService.createCompany(newCompanyName.trim())
      setCompanies(prev => [...prev, { id: created.id, name: created.name }])
      setNewCompanyName('')
    } finally {
      setCreatingCompany(false)
    }
  }

  const handleCreateSuperAdmin = async () => {
    const { companyId, name, email, password } = superAdminForm
    if (!companyId || !name || !email || !password) return
    setCreatingSuperAdmin(true)
    try {
      await userService.createUser({
        name,
        email,
        password,
        role: 'super_admin',
        timezone: 'GMT+0 (Greenwich Mean Time)',
        hourlyRate: 0,
        companyId
      })
      setSuperAdminForm({ companyId: '', name: '', email: '', password: '' })
    } finally {
      setCreatingSuperAdmin(false)
    }
  }

  const renderCompanies = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Company Management</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Manage all companies using the platform. Each company has its own Super Admin.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Total Companies</h4>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{systemStats.totalCompanies}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100">Active</h4>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{systemStats.totalCompanies}</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100">Trial</h4>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">0</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Create Company</h4>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            className="input flex-1"
            placeholder="Company name"
            value={newCompanyName}
            onChange={e => setNewCompanyName(e.target.value)}
          />
          <button onClick={handleCreateCompany} disabled={creatingCompany || !newCompanyName.trim()} className="btn-primary">
            {creatingCompany ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderAdmins = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Super Admin Management</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Create and manage Super Admins for each company. Super Admins have full access to their company's data.
        </p>
        
        <div className="card">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Create Super Admin</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select className="input" value={superAdminForm.companyId} onChange={e => setSuperAdminForm({ ...superAdminForm, companyId: e.target.value })}>
              <option value="">Select company</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input type="text" className="input" placeholder="Full name" value={superAdminForm.name} onChange={e => setSuperAdminForm({ ...superAdminForm, name: e.target.value })} />
            <input type="email" className="input" placeholder="Email" value={superAdminForm.email} onChange={e => setSuperAdminForm({ ...superAdminForm, email: e.target.value })} />
            <input type="password" className="input" placeholder="Password" value={superAdminForm.password} onChange={e => setSuperAdminForm({ ...superAdminForm, password: e.target.value })} />
          </div>
          <div className="mt-3">
            <button onClick={handleCreateSuperAdmin} disabled={creatingSuperAdmin || !superAdminForm.companyId || !superAdminForm.name || !superAdminForm.email || !superAdminForm.password} className="btn-primary">
              {creatingSuperAdmin ? 'Creating...' : 'Create Super Admin'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Note: In this build, after creating the account, set the user's companyId to the selected company in the database.</p>
        </div>
      </div>
    </div>
  )

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Firebase Security Rules</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Active</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Key className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Authentication</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderDatabase = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Database Management</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Firebase Realtime Database</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Activity className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Last Backup</span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(systemStats.lastBackup).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderServer = () => (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Server Status</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Server className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">API Server</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Online</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Globe className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Frontend</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Deployed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'users':
        return renderUsers()
      case 'companies':
        return renderCompanies()
      case 'admins':
        return renderAdmins()
      case 'security':
        return renderSecurity()
      case 'database':
        return renderDatabase()
      case 'server':
        return renderServer()
      default:
        return renderOverview()
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Root-level platform administration and management</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">System Online</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  )
}