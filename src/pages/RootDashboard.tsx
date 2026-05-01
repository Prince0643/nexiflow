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
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight
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
  const [companiesTotalCount, setCompaniesTotalCount] = useState(0)
  const [companiesTotalPages, setCompaniesTotalPages] = useState(1)
  const [companiesPage, setCompaniesPage] = useState(1)
  const companiesPageSize = 25
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
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null)
  const [sendingOverdueCompanyId, setSendingOverdueCompanyId] = useState<string | null>(null)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string; pricingLevel: string } | null>(null)
  const [companySearch, setCompanySearch] = useState('')
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState('')
  const [companyPlanFilter, setCompanyPlanFilter] = useState<'all' | string>('all')
  const [companyBillingFilter, setCompanyBillingFilter] = useState<'all' | string>('all')
  const [companyOverdueOnly, setCompanyOverdueOnly] = useState(false)
  const [companyTabLoading, setCompanyTabLoading] = useState(false)
  const [companySearchForAdmin, setCompanySearchForAdmin] = useState('')
  const [companySearchResults, setCompanySearchResults] = useState<{ id: string; name: string }[]>([])
  const [companySearchLoading, setCompanySearchLoading] = useState(false)

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

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedCompanySearch(companySearch)
    }, 300)
    return () => window.clearTimeout(id)
  }, [companySearch])

  useEffect(() => {
    if (activeTab !== 'companies') return
    void loadCompaniesPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, debouncedCompanySearch, companyPlanFilter, companyBillingFilter, companyOverdueOnly, companiesPage])

  const handleDowngrade = async (company: { id: string; name: string; pricingLevel: string }) => {
    if (company.pricingLevel === 'solo') {
      alert('Company is already on solo plan')
      return
    }
    setSelectedCompany(company)
    setShowDowngradeModal(true)
  }

  const handleDelete = (company: { id: string; name: string; pricingLevel: string }) => {
    setSelectedCompany(company)
    setShowDeleteModal(true)
  }

  const confirmDowngrade = async () => {
    if (!selectedCompany) return
    
    setDowngradingCompanyId(selectedCompany.id)
    try {
      const result = await companyService.downgradeCompany(selectedCompany.id, 'Manual downgrade by root')
      if (result.success) {
        alert(`Successfully downgraded ${selectedCompany.name} to solo plan`)
        await loadCompaniesPage()
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

  const confirmDelete = async () => {
    if (!selectedCompany) return

    setDeletingCompanyId(selectedCompany.id)
    try {
      const result = await companyService.deleteCompany(selectedCompany.id)
      if (result.success) {
        alert(`Successfully deleted ${selectedCompany.name}`)
        await loadData()
      } else {
        alert(`Failed to delete: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting company:', error)
      alert('Failed to delete company')
    } finally {
      setDeletingCompanyId(null)
      setShowDeleteModal(false)
      setSelectedCompany(null)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersList, companyMeta] = await Promise.all([
        userService.getAllUsers(),
        companyService.getCompaniesPaged({ page: 1, limit: 1 })
      ])
      const uniqueUsers = Array.from(
        new Map((usersList || []).map(u => [u.id, u])).values()
      )
      setUsers(uniqueUsers)
      setCompaniesTotalCount(companyMeta.count)
      setCompaniesTotalPages(companyMeta.totalPages)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCompaniesPage = async () => {
    setCompanyTabLoading(true)
    try {
      const result = await companyService.getCompaniesPaged({
        page: companiesPage,
        limit: companiesPageSize,
        q: debouncedCompanySearch.trim() || undefined,
        plan: companyPlanFilter === 'all' ? undefined : companyPlanFilter,
        billingStatus: companyBillingFilter === 'all' ? undefined : companyBillingFilter,
        overdueOnly: companyOverdueOnly ? true : undefined
      })
      setCompanies(result.companies)
      setCompaniesTotalCount(result.count)
      setCompaniesTotalPages(result.totalPages)
    } catch (error) {
      console.error('Error loading companies page:', error)
    } finally {
      setCompanyTabLoading(false)
    }
  }

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return
    setCreatingCompany(true)
    try {
      const created = await companyService.createCompany(newCompanyName.trim())
      setCompaniesTotalCount(prev => prev + 1)
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

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString()
  }

  const isCompanyOverdue = (company: any) => {
    const billingStatus = String(company?.billingStatus || '').toLowerCase()
    if (billingStatus === 'overdue') return true
    if (!company?.nextBillingDate) return false
    const next = new Date(company.nextBillingDate)
    if (Number.isNaN(next.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return next < today
  }

  const handleSendOverdueEmail = async (company: any) => {
    if (!company?.id) return
    const overdue = isCompanyOverdue(company)
    if (!overdue) return

    const confirmed = window.confirm(`Send overdue email to all super admins of "${company.name}"?`)
    if (!confirmed) return

    setSendingOverdueCompanyId(company.id)
    try {
      const result = await companyService.sendOverdueEmail(company.id)
      if ((result as any)?.success) {
        const sentTo = (result as any)?.data?.sentTo || []
        alert(`Overdue email sent to ${sentTo.length} recipient(s).`)
        await loadCompaniesPage()
      } else {
        alert((result as any)?.error || 'Failed to send overdue email')
      }
    } catch (error: any) {
      console.error('Error sending overdue email:', error)
      alert(error?.message || 'Failed to send overdue email')
    } finally {
      setSendingOverdueCompanyId(null)
    }
  }

  const clearCompanyFilters = () => {
    setCompanySearch('')
    setDebouncedCompanySearch('')
    setCompanyPlanFilter('all')
    setCompanyBillingFilter('all')
    setCompanyOverdueOnly(false)
    setCompaniesPage(1)
  }

  const handleSearchCompaniesForAdmin = async () => {
    const q = companySearchForAdmin.trim()
    if (!q) {
      setCompanySearchResults([])
      return
    }

    setCompanySearchLoading(true)
    try {
      const result = await companyService.getCompaniesPaged({ page: 1, limit: 10, q })
      setCompanySearchResults(result.companies.map(c => ({ id: c.id, name: c.name })))
    } catch (error) {
      console.error('Error searching companies:', error)
    } finally {
      setCompanySearchLoading(false)
    }
  }

  const handleSelectCompanyForAdmin = (company: { id: string; name: string }) => {
    setSuperAdminForm(prev => ({ ...prev, companyId: company.id }))
    setCompanySearchForAdmin(company.name)
    setCompanySearchResults([])
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
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{companiesTotalCount}</p>
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Search company by name or ID..."
                      value={companySearchForAdmin}
                      onChange={e => setCompanySearchForAdmin(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleSearchCompaniesForAdmin()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearchCompaniesForAdmin}
                      className="btn-primary whitespace-nowrap"
                      disabled={companySearchLoading || !companySearchForAdmin.trim()}
                    >
                      {companySearchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  {companySearchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {companySearchResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCompanyForAdmin(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          {c.name} <span className="text-xs text-gray-500 dark:text-gray-400">({c.id})</span>
                        </button>
                      ))}
                    </div>
                  )}
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
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Companies</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Page {companiesPage} of {companiesTotalPages} • {companiesTotalCount} result(s)
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  className="input w-full pl-9"
                  placeholder="Search by company name or ID..."
                  value={companySearch}
                  onChange={e => {
                    setCompanySearch(e.target.value)
                    setCompaniesPage(1)
                  }}
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <select
                className="input w-full"
                value={companyPlanFilter}
                onChange={e => {
                  setCompanyPlanFilter(e.target.value)
                  setCompaniesPage(1)
                }}
              >
                <option value="all">All plans</option>
                <option value="solo">solo</option>
                <option value="office">office</option>
                <option value="enterprise">enterprise</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <select
                className="input w-full"
                value={companyBillingFilter}
                onChange={e => {
                  setCompanyBillingFilter(e.target.value)
                  setCompaniesPage(1)
                }}
              >
                <option value="all">All billing statuses</option>
                <option value="active">active</option>
                <option value="overdue">overdue</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
            <div className="md:col-span-1 flex items-center justify-between md:justify-end gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={companyOverdueOnly}
                  onChange={e => {
                    setCompanyOverdueOnly(e.target.checked)
                    setCompaniesPage(1)
                  }}
                />
                Overdue
              </label>
              <button
                type="button"
                onClick={clearCompanyFilters}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear
              </button>
            </div>
          </div>

          {loading || companyTabLoading ? (
            <div className="flex justify-center py-8">
              <Activity className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (companies as any[]).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No companies found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Next Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(companies as any[]).map((company: any) => {
                    const companyUsers = users.filter(user => user.companyId === company.id).length
                    const isDowngrading = downgradingCompanyId === company.id
                    const overdue = isCompanyOverdue(company)
                    const isSendingOverdue = sendingOverdueCompanyId === company.id
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
                          {company.billingStatus ? (
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              String(company.billingStatus).toLowerCase() === 'overdue' ? 'bg-red-100 text-red-800' :
                              String(company.billingStatus).toLowerCase() === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {company.billingStatus}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(company.nextBillingDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{companyUsers}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleSendOverdueEmail(company)}
                            disabled={!overdue || isSendingOverdue || isDowngrading || deletingCompanyId === company.id}
                            className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded ${
                              overdue
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                            }`}
                            title={overdue ? 'Send overdue email to super admins' : 'Company is not overdue'}
                          >
                            {isSendingOverdue ? (
                              <Activity className="h-4 w-4 animate-spin" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                            <span className="ml-1 text-xs">Overdue Email</span>
                          </button>
                          {company.pricingLevel !== 'solo' && (
                            <button
                              onClick={() => handleDowngrade(company)}
                              disabled={isDowngrading || deletingCompanyId === company.id}
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
                          <button
                            onClick={() => handleDelete(company)}
                            disabled={isDowngrading || deletingCompanyId === company.id}
                            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 inline-flex items-center"
                            title="Delete company"
                          >
                            {deletingCompanyId === company.id ? (
                              <Activity className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            <span className="ml-1 text-xs">Delete</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCompaniesPage(p => Math.max(p - 1, 1))}
                  disabled={companiesPage <= 1 || companyTabLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Page {companiesPage} of {companiesTotalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setCompaniesPage(p => Math.min(p + 1, companiesTotalPages))}
                  disabled={companiesPage >= companiesTotalPages || companyTabLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {company?.name || user.companyId || 'N/A'}
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
      {showDeleteModal && selectedCompany && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Delete
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Deleting <strong>{selectedCompany.name}</strong> removes the company, its users, billing data, and all related records permanently.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedCompany(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingCompanyId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {deletingCompanyId === selectedCompany.id ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Confirm Delete
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
