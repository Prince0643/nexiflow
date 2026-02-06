import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Send, 
  MoreVertical,
  Building2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { invoiceApiService } from '../services/invoiceApiService'
import { formatCurrency, formatSecondsToHHMMSS } from '../utils'
import { generateIndividualClientPDF } from '../utils/pdfExport'

export default function Invoicing() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read PDF blob'))
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('Failed to convert PDF blob'))
          return
        }
        const commaIndex = result.indexOf(',')
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
      }
      reader.readAsDataURL(blob)
    })
  }

  const buildPdfInputs = async (invoiceId: string) => {
    const details = await invoiceApiService.getInvoiceDetails(invoiceId)
    if (!details.success) {
      throw new Error('Failed to load invoice details')
    }

    const invoice = details.data.invoice
    const items = details.data.items || []

    const totalSeconds = Number(invoice.total_seconds || 0)
    const totalAmount = Number(invoice.total_amount || 0)

    const dailyTotals: Record<string, number> = {}
    for (const item of items) {
      const dateValue = item.start_time || item.created_at
      const date = dateValue ? new Date(dateValue) : null
      const key = date ? date.toISOString().slice(0, 10) : 'unknown'
      if (!dailyTotals[key]) dailyTotals[key] = 0
      dailyTotals[key] += Number(item.duration || 0)
    }

    const dailyTimeData = Object.keys(dailyTotals)
      .filter(k => k !== 'unknown')
      .map(dateKey => ({
        date: dateKey,
        hours: dailyTotals[dateKey] / 3600,
        formattedDate: new Date(dateKey).toLocaleDateString(undefined, { weekday: 'short' })
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const timeEntriesForPDF = items.map((item: any) => ({
      id: item.time_entry_id || item.id,
      description: item.description || '',
      projectName: item.project_name || item.project_id || 'No project',
      clientName: invoice.client_name || 'No client',
      startTime: item.start_time || null,
      endTime: item.end_time || null,
      duration: Number(item.duration || 0),
      formattedDuration: formatSecondsToHHMMSS(Number(item.duration || 0)),
      isBillable: true
    }))

    const start = invoice.start_date ? new Date(invoice.start_date) : new Date()
    const end = invoice.end_date ? new Date(invoice.end_date) : new Date()

    return {
      invoice,
      items,
      start,
      end,
      timeEntriesForPDF,
      dailyTimeData,
      clientName: invoice.client_name || 'Client'
    }
  }

  const generateInvoicePdfBlob = async (invoiceId: string): Promise<Blob> => {
    const { invoice, start, end, timeEntriesForPDF, dailyTimeData, clientName } = await buildPdfInputs(invoiceId)
    const blob = await generateIndividualClientPDF(
      `Invoice Report - ${clientName}`,
      {
        name: clientName,
        hours: Number(invoice.total_seconds || 0) / 3600,
        amount: Number(invoice.total_amount || 0),
        formattedTime: formatSecondsToHHMMSS(Number(invoice.total_seconds || 0)),
        currency: invoice.currency
      },
      'custom',
      start,
      end,
      null,
      undefined,
      timeEntriesForPDF,
      dailyTimeData,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    )

    return blob as Blob
  }

  const handleView = async (invoiceId: string) => {
    try {
      const blob = await generateInvoicePdfBlob(invoiceId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error('Failed to preview invoice PDF:', err)
      alert('Failed to preview invoice')
    }
  }

  const handleDownload = async (invoice: any) => {
    try {
      const blob = await generateInvoicePdfBlob(invoice.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number || 'invoice'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download invoice PDF:', err)
      alert('Failed to download invoice')
    }
  }

  const handleMore = async (invoice: any) => {
    const shouldSend = window.confirm('Send/Resend this invoice via email?')
    if (!shouldSend) return

    try {
      const blob = await generateInvoicePdfBlob(invoice.id)
      const pdfBase64 = await blobToBase64(blob)
      await invoiceApiService.sendInvoice(invoice.id, {
        pdfBase64,
        fileName: `${invoice.invoice_number || 'invoice'}.pdf`
      })
      alert('Invoice email sent successfully!')
      const refreshed = await invoiceApiService.getInvoices()
      if (refreshed.success) setInvoices(refreshed.data)
    } catch (err) {
      console.error('Failed to send invoice email:', err)
      alert('Failed to send invoice')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          <FileText className="h-3 w-3 mr-1" /> Draft
        </span>
      case 'sent':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <Send className="h-3 w-3 mr-1" /> Sent
        </span>
      case 'paid':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle className="h-3 w-3 mr-1" /> Paid
        </span>
      case 'overdue':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          <XCircle className="h-3 w-3 mr-1" /> Overdue
        </span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          {status}
        </span>
    }
  }

  useEffect(() => {
    const loadInvoices = async () => {
      setIsLoading(true)
      try {
        const response = await invoiceApiService.getInvoices()
        if (response.success) {
          setInvoices(response.data)
        } else {
          setInvoices([])
        }
      } catch (error) {
        console.error('Error loading invoices:', error)
        setInvoices([])
      } finally {
        setIsLoading(false)
      }
    }

    loadInvoices()
  }, [])

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = (invoice.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (invoice.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(i => i.status === 'paid').length
  const pendingInvoices = invoices.filter(i => i.status === 'sent').length
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoicing</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create, manage, and track client invoices
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Paid</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{paidInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{overdueInvoices}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search invoices..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <select
                className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button className="btn-secondary flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              <span>Filters</span>
            </button>
            <button 
              onClick={() => navigate('/invoicing/new')}
              className="btn-primary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>New Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.client_name || 'Unknown client'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.start_date ? new Date(invoice.start_date).toLocaleDateString() : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.end_date ? new Date(invoice.end_date).toLocaleDateString() : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(Number(invoice.total_amount || 0), invoice.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleView(invoice.id)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        type="button"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDownload(invoice)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        type="button"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleMore(invoice)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                        type="button"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {(isLoading || filteredInvoices.length === 0) && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            {isLoading ? (
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Loading invoices...</h3>
            ) : (
              <>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No invoices found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Try adjusting your search or filter criteria
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="flow-root">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            <li className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No recent activity
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}