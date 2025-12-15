import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { 
  ArrowLeft, 
  Calendar,
  User,
  Building2,
  FileText,
  Clock,
  Tag,
  Download,
  Paperclip
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { timeEntryService } from '../services/timeEntryService'
import { projectService } from '../services/projectService'
import { pdfSettingsService } from '../services/pdfSettingsService'
import { Client, TimeEntry, Project } from '../types'
import { formatSecondsToHHMMSS, formatCurrency } from '../utils'
import { generateIndividualClientPDF } from '../utils/pdfExport'

interface TimeEntryWithProject extends TimeEntry {
  projectName?: string
  formattedDuration: string
}

export default function NewInvoice() {
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()
  
  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [notes, setNotes] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntryWithProject[]>([])
  const [filteredEntries, setFilteredEntries] = useState<TimeEntryWithProject[]>([])
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [generatedPDF, setGeneratedPDF] = useState<Blob | null>(null)
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfSettings, setPdfSettings] = useState<any>(null)
  
  // Refs
  const pdfBlobRef = useRef<Blob | null>(null)
  
  // Load clients, projects, and PDF settings
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load clients
        const clientsData = await projectService.getClients()
        setClients(clientsData)
        
        // Load projects
        const projectsData = await projectService.getProjects()
        setProjects(projectsData)
        
        // Load PDF settings if user is logged in and has a company
        if (currentUser?.companyId) {
          try {
            const settings = await pdfSettingsService.getPDFSettings(currentUser.companyId)
            setPdfSettings(settings)
          } catch (error) {
            console.error('Error loading PDF settings:', error)
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    
    loadData()
  }, [currentUser])
  
  // Filter time entries based on date range and client
  useEffect(() => {
    const loadTimeEntries = async () => {
      if (!startDate || !endDate || !selectedClient) {
        setFilteredEntries([])
        return
      }
      
      try {
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Include the entire end day
        
        // Load time entries for the date range
        const entries = await timeEntryService.getAllTimeEntriesByDateRange(start, end)
        
        // Filter for the selected client and billable entries
        const clientProjects = projects.filter(project => project.clientId === selectedClient)
        const clientProjectIds = clientProjects.map(project => project.id)
        
        const filtered = entries
          .filter(entry => 
            entry.isBillable &&
            entry.projectId && 
            clientProjectIds.includes(entry.projectId)
          )
          .map(entry => ({
            ...entry,
            projectName: entry.projectName || 'No project',
            formattedDuration: formatSecondsToHHMMSS(entry.duration)
          }))
        
        setFilteredEntries(filtered)
      } catch (error) {
        console.error('Error loading time entries:', error)
      }
    }
    
    loadTimeEntries()
  }, [startDate, endDate, selectedClient, projects])
  
  // Calculate totals
  const calculateTotals = () => {
    const client = clients.find(c => c.id === selectedClient)
    const hourlyRate = client?.hourlyRate || 0
    
    const totalSeconds = filteredEntries.reduce((sum, entry) => sum + entry.duration, 0)
    const totalHours = totalSeconds / 3600
    const totalAmount = totalHours * hourlyRate
    
    return {
      totalHours: totalHours.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    }
  }
  
  const totals = calculateTotals()
  
  // Generate invoice number
  useEffect(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    setInvoiceNumber(`INV-${year}${month}${day}-${random}`)
  }, [])
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }
  
  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  
  // Generate PDF report
  const generatePDFReport = async () => {
    if (!selectedClient || !startDate || !endDate || filteredEntries.length === 0) {
      alert('Please select a client, date range, and ensure there are billable time entries')
      return
    }
    
    setIsGeneratingPDF(true)
    
    try {
      const client = clients.find(c => c.id === selectedClient)
      if (!client) {
        throw new Error('Client not found')
      }
      
      // Get the selected export period
      const getExportPeriod = () => {
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        // Check if it matches predefined periods
        const now = new Date()
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
        const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        const thisMonthStart = startOfMonth(now)
        const thisMonthEnd = endOfMonth(now)
        
        if (isSameDay(start, thisWeekStart) && isSameDay(end, thisWeekEnd)) {
          return 'this-week'
        } else if (isSameDay(start, lastWeekStart) && isSameDay(end, lastWeekEnd)) {
          return 'last-week'
        } else if (isSameDay(start, thisMonthStart) && isSameDay(end, thisMonthEnd)) {
          return 'this-month'
        } else {
          return 'custom'
        }
      }
      
      const exportPeriod = getExportPeriod()
      
      // Prepare time entries data for PDF
      const timeEntriesForPDF = filteredEntries.map(entry => ({
        id: entry.id,
        description: entry.description || '',
        projectName: entry.projectName || 'No project',
        clientName: entry.clientName || 'No client',
        startTime: entry.startTime,
        endTime: entry.endTime,
        duration: entry.duration,
        formattedDuration: entry.formattedDuration,
        isBillable: entry.isBillable
      }))
      
      // Aggregate time entries by day for the daily time data
      const dailyTimeData: any[] = []
      
      // Create a map to store daily totals
      const dailyTotals: { [date: string]: number } = {}
      
      // Aggregate time entries by date
      filteredEntries.forEach(entry => {
        const entryDate = new Date(entry.startTime)
        const dateKey = format(entryDate, 'yyyy-MM-dd')
        
        if (!dailyTotals[dateKey]) {
          dailyTotals[dateKey] = 0
        }
        
        dailyTotals[dateKey] += entry.duration
      })
      
      // Convert to the format expected by the PDF generator
      Object.keys(dailyTotals).forEach(dateKey => {
        const hours = dailyTotals[dateKey] / 3600 // Convert seconds to hours
        dailyTimeData.push({
          date: dateKey,
          hours: hours,
          formattedDate: format(new Date(dateKey), 'EEE') // Short day name (Mon, Tue, etc.)
        })
      })
      
      // Sort by date
      dailyTimeData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      // Use the existing PDF generation function directly
      // This will automatically trigger the download
      await generateIndividualClientPDF(
        `Invoice Report - ${client.name}`,
        {
          name: client.name,
          hours: parseFloat(totals.totalHours),
          amount: parseFloat(totals.totalAmount),
          formattedTime: formatSecondsToHHMMSS(parseFloat(totals.totalHours) * 3600),
          currency: client.currency
        },
        exportPeriod,
        new Date(startDate),
        new Date(endDate),
        pdfSettings, // Pass the loaded PDF settings
        currentUser?.companyId || undefined, // Pass company ID, handling null case
        timeEntriesForPDF,
        dailyTimeData, // Pass the daily time data for the bar graph
        true, // includeTimeBreakdown
        true, // includeBillingDetails
        true, // includeProjectDetails
        true, // includeComments
        true, // includeTimeEntryDate
        true, // includeTimeEntryDuration
        true, // includeTimeEntryProject
        true, // includeTimeEntryDescription
        true  // includeTimeEntryBillableStatus
      )
      
      alert('PDF report generated and downloaded successfully!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF report')
    } finally {
      setIsGeneratingPDF(false)
    }
  }
  
  // Helper function to compare dates
  const isSameDate = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }
  
  // Download PDF
  const downloadPDF = () => {
    if (!generatedPDF || !pdfFileName) return
    
    const url = URL.createObjectURL(generatedPDF)
    const a = document.createElement('a')
    a.href = url
    a.download = pdfFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent, action: 'save' | 'send') => {
    e.preventDefault()
    
    // Validation
    if (!selectedClient) {
      alert('Please select a client')
      return
    }
    
    if (!startDate || !endDate) {
      alert('Please select both start and end dates')
      return
    }
    
    if (filteredEntries.length === 0) {
      alert('No billable time entries found for the selected criteria')
      return
    }
    
    // In a real app, you would save the invoice data here
    console.log({
      invoiceNumber,
      startDate,
      endDate,
      clientId: selectedClient,
      timeEntries: filteredEntries.map(entry => entry.id),
      totalHours: totals.totalHours,
      totalAmount: totals.totalAmount,
      notes,
      status: action === 'send' ? 'sent' : 'draft'
    })
    
    // Show success message
    alert(`Invoice ${action === 'send' ? 'sent' : 'saved'} successfully!`)
    
    // Navigate back to invoicing page
    navigate('/invoicing')
  }
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/invoicing')}
          className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Invoice</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Generate invoice from billable time entries
        </p>
      </div>
      
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
          {/* Invoice Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client
              </label>
              <select
                id="client"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select a client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({formatCurrency(client.hourlyRate || 0, client.currency)})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          
          {/* PDF Generation */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                PDF Report
              </h2>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={generatePDFReport}
                  disabled={!selectedClient || !startDate || !endDate || filteredEntries.length === 0 || isGeneratingPDF}
                  className="btn-secondary flex items-center"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate PDF
                    </>
                  )}
                </button>
                
                {generatedPDF && (
                  <button
                    type="button"
                    onClick={downloadPDF}
                    className="btn-primary flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                )}
              </div>
            </div>
            
            {generatedPDF && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center">
                  <Paperclip className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      PDF Report Generated
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {pdfFileName}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Time Entries Preview */}
          {startDate && endDate && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Billable Time Entries ({formatDate(startDate)} - {formatDate(endDate)})
              </h2>
              
              {filteredEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Description
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Project
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {new Date(entry.startTime).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {entry.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {entry.projectName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {entry.formattedDuration}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No billable time entries</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No billable time entries found for the selected date range and client.
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                placeholder="Additional notes or terms..."
              />
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Total Hours:</span>
                  <span className="font-medium">{totals.totalHours} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Hourly Rate:</span>
                  <span className="font-medium">
                    {clients.find(c => c.id === selectedClient) 
                      ? formatCurrency(clients.find(c => c.id === selectedClient)!.hourlyRate || 0, clients.find(c => c.id === selectedClient)!.currency)
                      : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Total Amount:</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {clients.find(c => c.id === selectedClient) 
                      ? formatCurrency(parseFloat(totals.totalAmount), clients.find(c => c.id === selectedClient)!.currency)
                      : '$0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/invoicing')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'save')}
              className="btn-secondary flex items-center"
              disabled={!selectedClient || !startDate || !endDate || filteredEntries.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'send')}
              className="btn-primary flex items-center"
              disabled={!selectedClient || !startDate || !endDate || filteredEntries.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Send Invoice
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}