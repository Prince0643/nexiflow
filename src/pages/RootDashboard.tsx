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
  UserCheck,
  LayoutDashboard,
  Building,
  Crown,
  ArrowDownCircle,
  AlertTriangle
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { companyService } from '../services/companyService'
import { userService } from '../services/userService'
import { User } from '../types'

export default function RootDashboard() {
  const { currentUser } = useMySQLAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'superadmins'>('overview')
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
  const [downgradingCompanyId, setDowngradingCompanyId] = useState<string | null>(null)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string; pricingLevel: string } | null>(null)

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

  const handleDowngrade = async (company: { id: string; name: string; pricingLevel: string }) => {
    if (company.pricingLevel === 'solo') {
      alert('Company is already on solo plan')
      return
    }
    setSelectedCompany(company)
    setShowDowngradeModal(true)
  }

  const confirmDowngrade = async () => {
    if (!selectedCompany) return
    
    setDowngradingCompanyId(selectedCompany.id)
    try {
      const result = await companyService.downgradeCompany(selectedCompany.id, 'Manual downgrade by root')
      if (result.success) {
        alert(`Successfully downgraded ${selectedCompany.name} to solo plan`)
        const companiesList = await companyService.getCompanies()
        setCompanies(companiesList)
      } else {
        alert(`Failed to downgrade: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error downgrading company:', error)
      alert('Failed to downgrade company')
    } finally {
      setDowngradingCompanyId(null)
      setShowDowngradeModal(false)
      setSelectedCompany(null)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [companiesList, usersList] = await Promise.all([
        companyService.getCompanies(),
        userService.getAllUsers()
      ])
      setCompanies(companiesList)
      const uniqueUsers = Array.from(
        new Map((usersList || []).map(u => [u.id, u])).values()
      )
      setUsers(uniqueUsers)
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

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: LayoutDashboard },
            { id: 'companies', name: 'Companies', icon: Building },
            { id: 'superadmins', name: 'Super Admins', icon: Crown }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <>
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
        </>
      )}

      {activeTab === 'companies' && (
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {companies.map((company: any) => {
                    const companyUsers = users.filter(user => user.companyId === company.id).length
                    const isDowngrading = downgradingCompanyId === company.id
                    return (
                      <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{company.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{company.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            company.pricingLevel === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                            company.pricingLevel === 'office' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {company.pricingLevel || 'solo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{companyUsers}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {company.pricingLevel !== 'solo' && (
                            <button
                              onClick={() => handleDowngrade(company)}
                              disabled={isDowngrading}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
                              title="Downgrade to solo plan"
                            >
                              {isDowngrading ? (
                                <Activity className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4" />
                              )}
                              <span className="ml-1 text-xs">Downgrade</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'superadmins' && (
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
      )}

      {/* Downgrade Confirmation Modal */}
      {showDowngradeModal && selectedCompany && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Downgrade
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to downgrade <strong>{selectedCompany.name}</strong> to the <strong>solo plan</strong>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This will:
              <ul className="list-disc ml-5 mt-2">
                <li>Reduce max members to 1</li>
                <li>Send downgrade notification emails to all super admins</li>
                <li>This action cannot be undone easily</li>
              </ul>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDowngradeModal(false)
                  setSelectedCompany(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDowngrade}
                disabled={downgradingCompanyId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {downgradingCompanyId === selectedCompany.id ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin mr-2" />
                    Downgrading...
                  </>
                ) : (
                  <>
                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                    Confirm Downgrade
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}