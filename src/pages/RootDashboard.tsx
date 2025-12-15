import React, { useState, useEffect } from 'react'
import { 
  Building2, 
  Users, 
  Shield, 
  Activity,
  Server,
  Globe,
  Key,
  CheckCircle,
  XCircle,
  Plus,
  UserCheck
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { companyService } from '../services/companyService'
import { userService } from '../services/userService'
import { User } from '../types'

export default function RootDashboard() {
  const { currentUser } = useMySQLAuth()
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [creatingSuperAdmin, setCreatingSuperAdmin] = useState(false)
  const [superAdminForm, setSuperAdminForm] = useState({
    companyId: '',
    name: '',
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(true)

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
              You don't have permission to access root dashboard.
            </p>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [companiesList, usersList] = await Promise.all([
        companyService.getCompanies(),
        userService.getAllUsers()
      ])
      setCompanies(companiesList)
      setUsers(usersList)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

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
      // Refresh users list
      const usersList = await userService.getAllUsers()
      setUsers(usersList)
    } finally {
      setCreatingSuperAdmin(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Root Administration</h1>
          <p className="text-gray-600 dark:text-gray-400">Platform administration and management</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">System Online</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Companies</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{companies.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Root User</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">1</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Company */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            Create New Company
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="Enter company name"
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
              />
            </div>
            <button 
              onClick={handleCreateCompany} 
              disabled={creatingCompany || !newCompanyName.trim()} 
              className="btn-primary w-full flex items-center justify-center"
            >
              {creatingCompany ? (
                <>
                  <Activity className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Company
                </>
              )}
            </button>
          </div>
        </div>

        {/* Create Super Admin */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <UserCheck className="h-5 w-5 mr-2" />
            Create Super Admin
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company
              </label>
              <select 
                className="input w-full"
                value={superAdminForm.companyId} 
                onChange={e => setSuperAdminForm({ ...superAdminForm, companyId: e.target.value })}
              >
                <option value="">Select company</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input 
                type="text" 
                className="input w-full" 
                placeholder="Enter full name" 
                value={superAdminForm.name} 
                onChange={e => setSuperAdminForm({ ...superAdminForm, name: e.target.value })} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input 
                type="email" 
                className="input w-full" 
                placeholder="Enter email" 
                value={superAdminForm.email} 
                onChange={e => setSuperAdminForm({ ...superAdminForm, email: e.target.value })} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input 
                type="password" 
                className="input w-full" 
                placeholder="Enter password" 
                value={superAdminForm.password} 
                onChange={e => setSuperAdminForm({ ...superAdminForm, password: e.target.value })} 
              />
            </div>
            <button 
              onClick={handleCreateSuperAdmin} 
              disabled={creatingSuperAdmin || !superAdminForm.companyId || !superAdminForm.name || !superAdminForm.email || !superAdminForm.password} 
              className="btn-primary w-full flex items-center justify-center"
            >
              {creatingSuperAdmin ? (
                <>
                  <Activity className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Create Super Admin
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Companies</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Activity className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No companies found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Users</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {companies.map((company) => {
                  const companyUsers = users.filter(user => user.companyId === company.id).length
                  return (
                    <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{company.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{company.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{companyUsers}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Super Admins List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Super Admins</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Activity className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : users.filter(user => user.role === 'super_admin').length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No super admins found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.filter(user => user.role === 'super_admin').map((user) => {
                  const company = companies.find(c => c.id === user.companyId)
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{company?.name || 'N/A'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}