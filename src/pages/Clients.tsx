import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Calendar, 
  Globe, 
  Clock, 
  TrendingUp,
  FileText,
  Users,
  DollarSign,
  BarChart3,
  Grid,
  List,
  Info
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, isSameDay, parseISO, subMonths } from 'date-fns'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { projectService } from '../services/projectService'
import { timeEntryService } from '../services/timeEntryService'
import { clientApiService } from '../services/clientApiService'
import { projectApiService } from '../services/projectApiService'
import { timeEntryApiService } from '../services/timeEntryApiService'
import { Client, Project, TimeEntry, PDFSettings } from '../types'
import ClientModal from '../components/projects/ClientModal'
import ExportModal from '../components/projects/ExportModal'
import SimpleChart from '../components/charts/SimpleChart'
import { canViewHourlyRates } from '../utils/permissions'
import { canAccessFeature } from '../utils/permissions'
import { generateClientReportPDF, generateIndividualClientPDF } from '../utils/pdfExport'
import { formatSecondsToHHMMSS, formatCurrency } from '../utils'

// Add helper functions for date formatting and parsing
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateFromInput = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Add this helper function to format duration
const formatDurationToHHMMSS = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function Clients() {
  const { currentUser, currentCompany } = useMySQLAuth()
  const navigate = useNavigate()
  
  // Helper function to format date for input field (YYYY-MM-DD format in local timezone)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Helper function to parse date from input field
  const parseDateFromInput = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showClientModal, setShowClientModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  // const [showPDFPreviewModal, setShowPDFPreviewModal] = useState(false)
  // const [pdfPreviewData, setPdfPreviewData] = useState<any>(null)
  // const [isIndividualClientExport, setIsIndividualClientExport] = useState(false)
  const [exportClient, setExportClient] = useState<Client | null>(null)
  const [viewingClientTimeEntries, setViewingClientTimeEntries] = useState<Client | null>(null) // For viewing time entries
  const [error, setError] = useState('')
  
  // Time tracking and billing states
  const [timeFilter, setTimeFilter] = useState<'this-week' | 'last-week' | 'this-month' | 'custom'>('this-week')
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [showTimeChart, setShowTimeChart] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  
  // PDF settings state
  const [pdfSettings, setPdfSettings] = useState<PDFSettings | null>(null)
  
  // Chart ref for PDF export
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadClients()
    loadPDFSettings() // Load PDF settings when component mounts
  }, [currentCompany])

  useEffect(() => {
    if (clients.length > 0) {
      loadTimeData()
    }
  }, [clients, timeFilter, customStartDate, customEndDate])

  // Load PDF settings from current company data
  const loadPDFSettings = () => {
    if (currentCompany?.pdfSettings) {
      setPdfSettings(currentCompany.pdfSettings)
    }
  }

  const loadClients = async () => {
    setLoading(true)
    try {
      // Use company-scoped data loading for multi-tenant isolation
      const [clientsData, projectsData] = await Promise.all([
        currentUser?.companyId 
          ? clientApiService.getClientsForCompany(currentUser.companyId)
          : clientApiService.getClients(),
        currentUser?.companyId 
          ? projectApiService.getProjectsForCompany(currentUser.companyId)
          : projectApiService.getProjects()
      ])
      setClients(clientsData)
      setProjects(projectsData)
    } catch (error) {
      setError('Failed to load clients')
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeData = async () => {
    if (!currentUser?.uid) return;
    
    try {
      const { startDate, endDate } = getDateRange()
      const timeEntriesData = await timeEntryApiService.getTimeEntriesByDateRange(currentUser.uid, startDate, endDate)
      setTimeEntries(timeEntriesData)
    } catch (error) {
      console.error('Error loading time data:', error)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (timeFilter) {
      case 'this-week':
        startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'last-week':
        const lastWeek = subWeeks(now, 1)
        startDate = startOfWeek(lastWeek, { weekStartsOn: 1 })
        endDate = endOfWeek(lastWeek, { weekStartsOn: 1 })
        break
      case 'this-month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'custom':
        startDate = customStartDate
        endDate = customEndDate
        // Fix for date range filtering: set start date to beginning of day and end date to end of day
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        startDate = startOfWeek(now, { weekStartsOn: 1 })
        endDate = endOfWeek(now, { weekStartsOn: 1 })
    }

    return { startDate, endDate }
  }

  const handleCreateClient = () => {
    // Check if user is on solo pricing level and has reached the client limit
    if (currentCompany?.pricingLevel === 'solo' && clients.length >= 1) {
      setError('Solo plan is limited to 1 client. Please upgrade to create more clients.')
      return
    }
    
    setSelectedClient(null)
    setShowClientModal(true)
  }

  const handleEditClient = (client: Client) => {
    setSelectedClient(client)
    setShowClientModal(true)
  }

  const handleDeleteClient = async (client: Client) => {
    if (window.confirm(`Are you sure you want to delete "${client.name}"? This action cannot be undone.`)) {
      try {
        await projectService.deleteClient(client.id)
        loadClients()
      } catch (error) {
        setError('Failed to delete client')
      }
    }
  }

  const handleViewClientTimeEntries = (client: Client) => {
    setViewingClientTimeEntries(client)
  }

  const getFilteredClients = () => {
    let filtered = clients

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.company && client.company.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filter by client type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(client => (client.clientType || 'full-time') === typeFilter)
    }

    return filtered
  }

  const getClientTypeColor = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300'
      case 'part-time':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
      case 'custom':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300'
      case 'gig':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
  }

  const getClientTypeIcon = (type: string) => {
    switch (type) {
      case 'full-time':
        return '🕐'
      case 'part-time':
        return '⏰'
      case 'custom':
        return '⚙️'
      case 'gig':
        return '📅'
      default:
        return '👤'
    }
  }

  const getClientStats = () => {
    const totalClients = clients.length
    const activeClients = clients.filter(client => !client.isArchived).length
    const totalHourlyRate = clients.reduce((sum, client) => sum + (client.hourlyRate || 0), 0)
    const averageRate = totalClients > 0 ? totalHourlyRate / totalClients : 0

    return {
      totalClients,
      activeClients,
      averageRate
    }
  }

  const getClientTimeData = (client: Client) => {
    // Get projects for this client
    const clientProjects = projects.filter(project => project.clientId === client.id)
    const clientProjectIds = clientProjects.map(project => project.id)
    
    const clientTimeEntries = timeEntries.filter(entry => 
      entry.projectId && clientProjectIds.includes(entry.projectId)
    )

    const totalSeconds = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
    const totalHours = totalSeconds / 3600
    const billableAmount = totalHours * (client.hourlyRate || 0)

    return {
      totalHours,
      totalSeconds,
      billableAmount,
      timeEntries: clientTimeEntries.length,
      formattedTime: formatSecondsToHHMMSS(totalSeconds) // Add formatted time
    }
  }

  const getTimeChartData = () => {
    const chartData = clients.map(client => {
      const timeData = getClientTimeData(client)
      return {
        name: client.name,
        hours: timeData.totalHours,
        amount: timeData.billableAmount,
        formattedTime: timeData.formattedTime // Add formatted time
      }
    }).filter(data => data.hours > 0)

    return {
      labels: chartData.map(item => item.name),
      datasets: [
        {
          label: 'Hours',
          data: chartData.map(item => item.hours),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
        },
        {
          label: 'Billable Amount',
          data: chartData.map(item => item.amount),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgba(34, 197, 94, 1)',
        }
      ],
      formattedTimes: chartData.map(item => item.formattedTime) // Add formattedTimes property
    }
  }

  const getBillingStats = () => {
    const totalBillableAmount = clients.reduce((sum, client) => {
      const timeData = getClientTimeData(client)
      return sum + timeData.billableAmount
    }, 0)

    const totalSeconds = clients.reduce((sum, client) => {
      const timeData = getClientTimeData(client)
      return sum + timeData.totalSeconds
    }, 0)

    const totalHours = totalSeconds / 3600
    const formattedTotalTime = formatSecondsToHHMMSS(totalSeconds) // Add formatted time

    const activeClientsWithTime = clients.filter(client => {
      const timeData = getClientTimeData(client)
      return timeData.totalHours > 0
    }).length

    return {
      totalBillableAmount,
      totalHours,
      formattedTotalTime, // Add formatted time
      activeClientsWithTime
    }
  }

  const handleExportPDF = () => {
    if (!chartRef.current || chartData.labels.length === 0) {
      setError('No chart data available to export')
      return
    }

    setExportClient(null) // Export all clients
    setShowExportModal(true)
  }

  const handleExportClientPDF = (client: Client) => {
    const timeData = getClientTimeData(client)
    
    if (timeData.totalHours === 0) {
      setError(`No time data available for ${client.name} in the selected period`)
      return
    }

    setExportClient(client)
    setShowExportModal(true)
  }

  const handleConfirmExport = async (exportData: any) => {
    setIsExportingPDF(true)
    setError('')

    try {
      // Get the selected export period from the exportData
      const selectedExportPeriod = exportData.exportPeriod || timeFilter
      
      if (exportClient) {
        // For individual client export, load the data for the selected period
        const getDateRangeForExport = () => {
          const now = new Date()
          let startDate: Date
          let endDate: Date

          switch (selectedExportPeriod) {
            case 'this-week':
              startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
              endDate = endOfWeek(now, { weekStartsOn: 1 })
              break
            case 'last-week':
              const lastWeek = subWeeks(now, 1)
              startDate = startOfWeek(lastWeek, { weekStartsOn: 1 })
              endDate = endOfWeek(lastWeek, { weekStartsOn: 1 })
              break
            case 'this-month':
              startDate = startOfMonth(now)
              endDate = endOfMonth(now)
              break
            case 'last-month':
              const lastMonth = subMonths(now, 1)
              startDate = startOfMonth(lastMonth)
              endDate = endOfMonth(lastMonth)
              break
            case 'custom':
              startDate = exportData.customPeriod?.startDate || customStartDate
              endDate = exportData.customPeriod?.endDate || customEndDate
              break
            default:
              // All time - use a wide range
              startDate = new Date(2000, 0, 1)
              endDate = new Date(2100, 11, 31)
          }

          return { startDate, endDate }
        }

        const { startDate, endDate } = getDateRangeForExport()
        
        // Load time data for the selected period
        const clientTimeEntries = await timeEntryService.getAllTimeEntriesByDateRange(startDate, endDate)
        
        // Get projects for this client
        const clientProjects = projects.filter(project => project.clientId === exportClient.id)
        const clientProjectIds = clientProjects.map(project => project.id)
        
        // Filter time entries for this client's projects
        const filteredClientTimeEntries = clientTimeEntries.filter(entry => 
          entry.projectId && clientProjectIds.includes(entry.projectId)
        )
        
        // Get daily time data for the selected period
        const dailyTimeData = getClientDailyTimeData(exportClient, filteredClientTimeEntries, startDate, endDate)
        
        // Get client time data for the period using the filtered time entries
        const clientTimeData = (() => {
          const totalSeconds = filteredClientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
          const totalHours = totalSeconds / 3600
          const billableAmount = totalHours * (exportClient.hourlyRate || 0)
          
          return {
            totalHours,
            totalSeconds,
            billableAmount,
            timeEntries: filteredClientTimeEntries.length,
            formattedTime: formatSecondsToHHMMSS(totalSeconds)
          }
        })()
        
        // Get final time data (with custom values if provided)
        const finalTimeData = exportData.customTimeData || {
          totalHours: clientTimeData.totalHours,
          billableAmount: clientTimeData.billableAmount,
          formattedTime: clientTimeData.formattedTime
        }
        
        // Debug: Log the daily time data
        console.log('Daily time data for client:', exportClient.name, dailyTimeData)

        // Prepare time entries data for PDF
        const timeEntriesForPDF = filteredClientTimeEntries.map((entry: TimeEntry) => ({
          id: entry.id,
          description: entry.description || '',
          projectName: entry.projectName || 'No project',
          clientName: entry.clientName || 'No client',
          startTime: entry.startTime,
          endTime: entry.endTime,
          duration: entry.duration,
          formattedDuration: formatDurationToHHMMSS(entry.duration),
          isBillable: entry.isBillable
        }))

        await generateIndividualClientPDF(
          exportData.reportTitle,
          {
            name: exportClient.name,
            hours: finalTimeData.totalHours,
            amount: finalTimeData.billableAmount,
            formattedTime: finalTimeData.formattedTime,
            currency: exportClient.currency // Add currency information
          },
          selectedExportPeriod,
          startDate,
          endDate,
          pdfSettings, // Pass PDF settings
          currentUser?.companyId || undefined, // Pass company ID, handling null case
          timeEntriesForPDF, // Pass time entries data
          dailyTimeData, // Pass daily time data for chart creation
          exportData.includeTimeBreakdown, // Pass time breakdown option
          exportData.includeBillingDetails, // Pass billing details option
          exportData.includeProjectDetails, // Pass project details option
          exportData.includeComments, // Pass comments option
          exportData.includeTimeEntryDate, // Pass time entry date option
          exportData.includeTimeEntryDuration, // Pass time entry duration option
          exportData.includeTimeEntryProject, // Pass time entry project option
          exportData.includeTimeEntryDescription, // Pass time entry description option
          exportData.includeTimeEntryBillableStatus // Pass time entry billable status option
        )
      } else {
        // Export all clients
        // Get date range based on selected export period
        const getDateRangeForExport = () => {
          const now = new Date()
          let startDate: Date
          let endDate: Date

          switch (selectedExportPeriod) {
            case 'this-week':
              startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
              endDate = endOfWeek(now, { weekStartsOn: 1 })
              break
            case 'last-week':
              const lastWeek = subWeeks(now, 1)
              startDate = startOfWeek(lastWeek, { weekStartsOn: 1 })
              endDate = endOfWeek(lastWeek, { weekStartsOn: 1 })
              break
            case 'this-month':
              startDate = startOfMonth(now)
              endDate = endOfMonth(now)
              break
            case 'last-month':
              const lastMonth = subMonths(now, 1)
              startDate = startOfMonth(lastMonth)
              endDate = endOfMonth(lastMonth)
              break
            case 'custom':
              startDate = exportData.customPeriod?.startDate || customStartDate
              endDate = exportData.customPeriod?.endDate || customEndDate
              break
            default:
              // All time - use a wide range
              startDate = new Date(2000, 0, 1)
              endDate = new Date(2100, 11, 31)
          }

          return { startDate, endDate }
        }

        const { startDate, endDate } = getDateRangeForExport()
        
        // Load time data for the selected period
        const timeEntriesForPeriod = await timeEntryService.getAllTimeEntriesByDateRange(startDate, endDate)
        
        // Update chart data for the selected period
        const chartDataForPeriod = getTimeChartDataForPeriod(timeEntriesForPeriod)
        
        // Update billing stats for the selected period
        const billingStatsForPeriod = getBillingStatsForPeriod(timeEntriesForPeriod)
        
        // Prepare time entries data for PDF
        const timeEntriesForPDF = timeEntriesForPeriod.map((entry: TimeEntry) => ({
          id: entry.id,
          description: entry.description || '',
          projectName: entry.projectName || 'No project',
          clientName: entry.clientName || 'No client',
          startTime: entry.startTime,
          endTime: entry.endTime,
          duration: entry.duration,
          formattedDuration: formatDurationToHHMMSS(entry.duration),
          isBillable: entry.isBillable
        }))

        await generateClientReportPDF(chartRef.current, {
          chartData: chartDataForPeriod.labels.map((label, index) => {
            // Find the client to get their currency
            const client = clients.find(c => c.name === label);
            return {
              name: label,
              hours: Number(chartDataForPeriod.datasets[0].data[index]),
              amount: Number(chartDataForPeriod.datasets[1].data[index]),
              formattedTime: chartDataForPeriod.formattedTimes?.[index] || formatSecondsToHHMMSS(Number(chartDataForPeriod.datasets[0].data[index]) * 3600),
              currency: client?.currency // Add currency information
            };
          }),
          billingStats: billingStatsForPeriod,
          timeFilter: selectedExportPeriod,
          customStartDate: startDate,
          customEndDate: endDate,
          companyName: 'NexiFlow',
          companyEmail: 'contact@clockistry.com',
          companyPhone: '+1 (555) 123-4567',
          pdfSettings, // Pass PDF settings
          companyId: currentUser?.companyId || undefined, // Pass company ID, handling null case
          timeEntries: timeEntriesForPDF, // Pass time entries data
          includeTimeBreakdown: exportData.includeTimeBreakdown, // Pass time breakdown option
          includeBillingDetails: exportData.includeBillingDetails, // Pass billing details option
          includeProjectDetails: exportData.includeProjectDetails, // Pass project details option
          includeComments: exportData.includeComments, // Pass comments option
          includeTimeEntryDate: exportData.includeTimeEntryDate, // Pass time entry date option
          includeTimeEntryDuration: exportData.includeTimeEntryDuration, // Pass time entry duration option
          includeTimeEntryProject: exportData.includeTimeEntryProject, // Pass time entry project option
          includeTimeEntryDescription: exportData.includeTimeEntryDescription, // Pass time entry description option
          includeTimeEntryBillableStatus: exportData.includeTimeEntryBillableStatus // Pass time entry billable status option
        })
      }
      
      setShowExportModal(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      setError(`Failed to generate PDF. Please try again.`)
    } finally {
      setIsExportingPDF(false)
    }
  }

  // Helper function to get period text for export
  const getPeriodTextForExport = (period: string, startDate: Date, endDate: Date) => {
    switch (period) {
      case 'this-week':
        return 'This Week'
      case 'last-week':
        return 'Last Week'
      case 'this-month':
        return 'This Month'
      case 'last-month':
        return 'Last Month'
      case 'custom':
        return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`
      default:
        return 'All Time'
    }
  }

  // Helper function to get chart data for a specific period
  const getTimeChartDataForPeriod = (timeEntriesForPeriod: TimeEntry[]) => {
    const chartData = clients.map(client => {
      // Get projects for this client
      const clientProjects = projects.filter(project => project.clientId === client.id)
      const clientProjectIds = clientProjects.map(project => project.id)
      
      const clientTimeEntries = timeEntriesForPeriod.filter(entry => 
        entry.projectId && clientProjectIds.includes(entry.projectId)
      )

      const totalSeconds = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
      const totalHours = totalSeconds / 3600
      const billableAmount = totalHours * (client.hourlyRate || 0)

      return {
        name: client.name,
        hours: totalHours,
        amount: billableAmount,
        formattedTime: formatSecondsToHHMMSS(totalSeconds)
      }
    }).filter(data => data.hours > 0)

    return {
      labels: chartData.map(item => item.name),
      datasets: [
        {
          label: 'Hours',
          data: chartData.map(item => item.hours),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
        },
        {
          label: 'Billable Amount',
          data: chartData.map(item => item.amount),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgba(34, 197, 94, 1)',
        }
      ],
      formattedTimes: chartData.map(item => item.formattedTime)
    }
  }

  // Helper function to get billing stats for a specific period
  const getBillingStatsForPeriod = (timeEntriesForPeriod: TimeEntry[]) => {
    const totalBillableAmount = clients.reduce((sum, client) => {
      // Get projects for this client
      const clientProjects = projects.filter(project => project.clientId === client.id)
      const clientProjectIds = clientProjects.map(project => project.id)
      
      const clientTimeEntries = timeEntriesForPeriod.filter(entry => 
        entry.projectId && clientProjectIds.includes(entry.projectId)
      )

      const totalSeconds = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
      const totalHours = totalSeconds / 3600
      const billableAmount = totalHours * (client.hourlyRate || 0)
      
      return sum + billableAmount
    }, 0)

    const totalSeconds = clients.reduce((sum, client) => {
      // Get projects for this client
      const clientProjects = projects.filter(project => project.clientId === client.id)
      const clientProjectIds = clientProjects.map(project => project.id)
      
      const clientTimeEntries = timeEntriesForPeriod.filter(entry => 
        entry.projectId && clientProjectIds.includes(entry.projectId)
      )

      return sum + clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
    }, 0)

    const totalHours = totalSeconds / 3600
    const formattedTotalTime = formatSecondsToHHMMSS(totalSeconds)

    const activeClientsWithTime = clients.filter(client => {
      // Get projects for this client
      const clientProjects = projects.filter(project => project.clientId === client.id)
      const clientProjectIds = clientProjects.map(project => project.id)
      
      const clientTimeEntries = timeEntriesForPeriod.filter(entry => 
        entry.projectId && clientProjectIds.includes(entry.projectId)
      )

      const totalSeconds = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
      const totalHours = totalSeconds / 3600
      
      return totalHours > 0
    }).length

    return {
      totalBillableAmount,
      totalHours,
      formattedTotalTime,
      activeClientsWithTime
    }
  }

  const getPeriodText = () => {
    switch (timeFilter) {
      case 'this-week':
        return 'This Week'
      case 'last-week':
        return 'Last Week'
      case 'this-month':
        return 'This Month'
      case 'custom':
        return `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd, yyyy')}`
      default:
        return 'This Week'
    }
  }

  // Helper function to get daily time data for a specific client
  const getClientDailyTimeData = (client: Client, timeEntriesForPeriod: TimeEntry[], startDate: Date, endDate: Date) => {
    // Get projects for this client
    const clientProjects = projects.filter(project => project.clientId === client.id)
    const clientProjectIds = clientProjects.map(project => project.id)
    
    // Filter time entries for this client's projects
    const clientTimeEntries = timeEntriesForPeriod.filter(entry => 
      entry.projectId && clientProjectIds.includes(entry.projectId)
    )
    
    // Fix for date range filtering: set end date to end of day to include all entries for that day
    const adjustedEndDate = new Date(endDate)
    adjustedEndDate.setHours(23, 59, 59, 999)
    
    // Group time entries by day
    const dailyData: { [date: string]: { hours: number, seconds: number } } = {}
    
    // Initialize all days in the period with 0 hours
    const currentDate = new Date(startDate)
    while (currentDate <= adjustedEndDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd')
      dailyData[dateKey] = { hours: 0, seconds: 0 }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Calculate hours for each day
    clientTimeEntries.forEach(entry => {
      const entryDate = new Date(entry.startTime)
      // Only include entries within our date range
      if (entryDate >= startDate && entryDate <= adjustedEndDate) {
        const dateKey = format(entryDate, 'yyyy-MM-dd')
        if (dailyData[dateKey]) {
          dailyData[dateKey].seconds += entry.duration
          dailyData[dateKey].hours = dailyData[dateKey].seconds / 3600
        }
      }
    })
    
    // Convert to array format for charting
    const chartData = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        hours: data.hours,
        formattedDate: format(new Date(date), 'EEE') // Short day name (Mon, Tue, etc.)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    return chartData
  }

  const stats = getClientStats()
  const billingStats = getBillingStats()
  const filteredClients = getFilteredClients()
  const chartData = getTimeChartData()

  if (!currentUser?.role || !canAccessFeature(currentUser.role, 'clients')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-center p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl sm:text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 scrollbar-visible">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Clients</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your client relationships and billing rates</p>
        </div>
        {currentUser?.role && canAccessFeature(currentUser.role, 'clients') && (
          <button
            onClick={handleCreateClient}
            disabled={currentCompany?.pricingLevel === 'solo' && clients.length >= 1}
            className={`flex items-center space-x-2 ${currentCompany?.pricingLevel === 'solo' && clients.length >= 1 ? 'btn-secondary cursor-not-allowed opacity-50' : 'btn-primary'}`}
            title={currentCompany?.pricingLevel === 'solo' && clients.length >= 1 ? 'Solo plan is limited to 1 client. Please upgrade to create more clients.' : ''}
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden xs:inline">Add Client</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Total Clients</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalClients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Active Clients</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeClients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Billable Amount</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">${billingStats.totalBillableAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Total Time</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{billingStats.formattedTotalTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Limit Info for Solo Plan */}
      {currentCompany?.pricingLevel === 'solo' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/30 dark:border-blue-800">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 dark:text-blue-400" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Client Limit</h3>
              <p className="text-sm text-blue-700 mt-1 dark:text-blue-300">
                Your Solo plan is limited to 1 client. You have {stats.totalClients} of 1 client slots used.
              </p>
              <p className="text-sm text-blue-700 mt-1 dark:text-blue-300">
                Upgrade to Office or Enterprise plan to create more clients.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Time Filter and Chart Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 flex-1">
              {/* Time Period Filter */}
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="this-week">This Week</option>
                  <option value="last-week">Last Week</option>
                  <option value="this-month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Range */}
              {timeFilter === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={formatDateForInput(customStartDate)}
                    onChange={(e) => {
                      const date = parseDateFromInput(e.target.value);
                      setCustomStartDate(date);
                    }}
                    className="px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                  <input
                    type="date"
                    value={formatDateForInput(customEndDate)}
                    onChange={(e) => {
                      const date = parseDateFromInput(e.target.value);
                      setCustomEndDate(date);
                    }}
                    className="px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {/* Chart Toggle */}
              <button
                onClick={() => setShowTimeChart(!showTimeChart)}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 py-1 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                  showTimeChart 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden xs:inline">{showTimeChart ? 'Hide Chart' : 'Show Time Chart'}</span>
                <span className="xs:hidden">{showTimeChart ? 'Hide' : 'Show'}</span>
              </button>

              {/* PDF Export Button */}
              {showTimeChart && chartData.labels.length > 0 && (
                currentCompany?.pricingLevel === 'solo' ? (
                  <button
                    disabled={true}
                    className="flex items-center space-x-1 sm:space-x-2 px-3 py-1 sm:px-4 sm:py-2 text-sm sm:text-base bg-gray-400 text-white rounded-lg cursor-not-allowed"
                    title="PDF export is not available on the Solo plan. Please upgrade to access this feature."
                  >
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Export All Clients PDF</span>
                    <span className="xs:hidden">Export</span>
                  </button>
                ) : (
                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    className="flex items-center space-x-1 sm:space-x-2 px-3 py-1 sm:px-4 sm:py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Export PDF report for all clients"
                  >
                    {isExportingPDF ? (
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                    ) : (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                    <span className="hidden xs:inline">{isExportingPDF ? 'Generating PDF...' : 'Export All Clients PDF'}</span>
                    <span className="xs:hidden">{isExportingPDF ? 'PDF...' : 'Export'}</span>
                  </button>
                )
              )}
            </div>

            {/* Period Display */}
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {timeFilter === 'custom' 
                ? `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd, yyyy')}`
                : timeFilter === 'this-week' 
                  ? 'This Week'
                  : timeFilter === 'last-week'
                    ? 'Last Week'
                    : 'This Month'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Time Chart */}
      {showTimeChart && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6" ref={chartRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Time Rendered by Client</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded"></div>
                <span>Hours</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded"></div>
                <span>Billable Amount</span>
              </div>
            </div>
          </div>
          <SimpleChart
            data={chartData}
            type="bar"
            height={200}
          />
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search clients by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Type Filter */}
            <div className="sm:w-48">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Types</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="custom">Custom</option>
                <option value="gig">Gig</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm sm:text-base ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm sm:text-base ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clients Display */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredClients.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6' : 'space-y-4'}>
          {filteredClients.map((client) => (
            <div key={client.id} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
              {viewMode === 'grid' ? (
                // Grid View
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">{client.name}</h3>
                        {client.company && (
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{client.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {(() => {
                        const timeData = getClientTimeData(client)
                        if (timeData.totalHours > 0) {
                          return currentCompany?.pricingLevel === 'solo' ? (
                            <button
                              disabled={true}
                              className="p-1 sm:p-2 text-gray-400 cursor-not-allowed"
                              title="PDF export is not available on the Solo plan. Please upgrade to access this feature."
                            >
                              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleExportClientPDF(client)}
                              disabled={isExportingPDF}
                              className="p-1 sm:p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-green-700 disabled:opacity-50"
                              title={currentUser && canViewHourlyRates(currentUser.role) ? `Export PDF report for ${client.name} (${timeData.formattedTime}, $${timeData.billableAmount.toFixed(2)})` : `Export PDF report for ${client.name} (${timeData.formattedTime})`}
                            >
                              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          )
                        } else {
                          return (
                            <div 
                              className="p-1 sm:p-2 text-gray-300 cursor-not-allowed"
                              title={`No time data for ${client.name} in selected period`}
                            >
                              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                            </div>
                          )
                        }
                      })()}
                      <button
                        onClick={() => handleEditClient(client)}
                        className="p-1 sm:p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                        title="Edit client"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client)}
                        className="p-1 sm:p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-red-700"
                        title="Delete client"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/clients/${client.id}`)}
                        className="p-1 sm:p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-purple-700"
                        title="View client details"
                      >
                        <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Type</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.clientType || 'full-time')}`}>
                        {getClientTypeIcon(client.clientType || 'full-time')} {(client.clientType || 'full-time').replace('-', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Hourly Rate</span>
                      {currentUser && canViewHourlyRates(currentUser.role) ? (
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{formatCurrency(client.hourlyRate || 0, client.currency || 'USD')}</span>
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">--</span>
                      )}
                    </div>

                    {/* Time and Billing Info */}
                    {(() => {
                      const timeData = getClientTimeData(client)
                      return timeData.totalHours > 0 ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Time Rendered</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{timeData.formattedTime}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Billable Amount</span>
                            {currentUser && canViewHourlyRates(currentUser.role) ? (
                              <span className="font-semibold text-green-600 dark:text-green-400 text-xs sm:text-sm">{formatCurrency(timeData.billableAmount, client.currency || 'USD')}</span>
                            ) : (
                              <span className="font-semibold text-green-600 dark:text-green-400 text-xs sm:text-sm">--</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Time Rendered</span>
                          <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">No time tracked</span>
                        </div>
                      )
                    })()}

                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Country</span>
                      <div className="flex items-center space-x-1">
                        <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{client.country || 'Not specified'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Timezone</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{client.timezone || 'Not specified'}</span>
                      </div>
                    </div>

                    {(client.clientType || 'full-time') === 'custom' && client.hoursPerWeek && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Hours/Week</span>
                        <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{client.hoursPerWeek}h</span>
                      </div>
                    )}

                    {(client.clientType || 'full-time') === 'gig' && client.startDate && client.endDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-500">Duration</span>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-xs sm:text-sm text-gray-900">
                            {format(client.startDate, 'MMM dd')} - {format(client.endDate, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 sm:pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Email</span>
                        <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate ml-2">{client.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // List View
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <Building2 className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{client.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.clientType || 'full-time')}`}>
                            {getClientTypeIcon(client.clientType || 'full-time')} {(client.clientType || 'full-time').replace('-', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>{client.email}</span>
                          {client.company && <span>• {client.company}</span>}
                          <span>• {client.country || 'Not specified'}</span>
                          <span>• {currentUser && canViewHourlyRates(currentUser.role) ? `$${client.hourlyRate || 0}/hr` : '--'}</span>
                          {(() => {
                            const timeData = getClientTimeData(client)
                            return timeData.totalHours > 0 ? (
                              <>
                                <span>• {timeData.formattedTime}</span>
                                {currentUser && canViewHourlyRates(currentUser.role) ? (
                                  <span className="text-green-600">• ${timeData.billableAmount.toFixed(2)}</span>
                                ) : (
                                  <span className="text-green-600">• --</span>
                                )}
                              </>
                            ) : null
                          })()}

                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {(() => {
                        const timeData = getClientTimeData(client)
                        if (timeData.totalHours > 0) {
                          return currentCompany?.pricingLevel === 'solo' ? (
                            <button
                              disabled={true}
                              className="p-1 text-gray-400 cursor-not-allowed"
                              title="PDF export is not available on the Solo plan. Please upgrade to access this feature."
                            >
                              <TrendingUp className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleExportClientPDF(client)}
                              disabled={isExportingPDF}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-green-700 disabled:opacity-50"
                              title={`Export PDF report for ${client.name} (${timeData.formattedTime}, $${timeData.billableAmount.toFixed(2)})`}
                            >
                              <TrendingUp className="h-4 w-4" />
                            </button>
                          )
                        } else {
                          return (
                            <div 
                              className="p-1 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                              title={`No time data for ${client.name} in selected period`}
                            >
                              <TrendingUp className="h-4 w-4" />
                            </div>
                          )
                        }
                      })()}
                      <button
                        onClick={() => handleViewClientTimeEntries(client)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-blue-700"
                        title="View time entries"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/clients/${client.id}`)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-purple-700"
                        title="View client details"
                      >
                        <Building2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditClient(client)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        title="Edit client"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-red-700"
                        title="Delete client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No clients found</h3>
          <p className="text-gray-500 mb-6 px-4">
            {searchTerm || typeFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first client.'
            }
          </p>
          {!searchTerm && typeFilter === 'all' && (
            <button
              onClick={handleCreateClient}
              disabled={currentCompany?.pricingLevel === 'solo' && clients.length >= 1}
              className={`flex items-center space-x-2 mx-auto ${currentCompany?.pricingLevel === 'solo' && clients.length >= 1 ? 'btn-secondary cursor-not-allowed opacity-50' : 'btn-primary'}`}
              title={currentCompany?.pricingLevel === 'solo' && clients.length >= 1 ? 'Solo plan is limited to 1 client. Please upgrade to create more clients.' : ''}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden xs:inline">Add Client</span>
            </button>
          )}
        </div>
      )}

      {/* Time Entries for Selected Client */}
      {viewingClientTimeEntries && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Time Entries for {viewingClientTimeEntries.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing time entries for all projects associated with this client
              </p>
            </div>
            <button
              onClick={() => setViewingClientTimeEntries(null)}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Close time entries view"
            >
              <Edit className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Billable
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(() => {
                  // Get projects for this client
                  const clientProjects = projects.filter(project => project.clientId === viewingClientTimeEntries.id)
                  const clientProjectIds = clientProjects.map(project => project.id)
                  
                  // Get time entries for this client's projects
                  const clientTimeEntries = timeEntries.filter(entry => 
                    entry.projectId && clientProjectIds.includes(entry.projectId)
                  )
                  
                  return clientTimeEntries.length > 0 ? (
                    clientTimeEntries.map((entry) => {
                      const project = clientProjects.find(p => p.id === entry.projectId)
                      
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {project?.name || 'Unknown Project'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {entry.startTime ? format(new Date(entry.startTime), 'MMM dd, yyyy') : 'No Date'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatDurationToHHMMSS(entry.duration)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {entry.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {entry.isBillable ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No time entries found for this client
                      </td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {(() => {
                  // Get projects for this client
                  const clientProjects = projects.filter(project => project.clientId === viewingClientTimeEntries.id)
                  const clientProjectIds = clientProjects.map(project => project.id)
                  
                  // Get time entries for this client's projects
                  const clientTimeEntries = timeEntries.filter(entry => 
                    entry.projectId && clientProjectIds.includes(entry.projectId)
                  )
                  
                  const totalDuration = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
                  const billableDuration = clientTimeEntries
                    .filter(entry => entry.isBillable)
                    .reduce((sum, entry) => sum + entry.duration, 0)
                  
                  return (
                    <>
                      <span className="font-medium">{clientTimeEntries.length}</span> time entries • 
                      <span className="font-medium ml-1">{formatDurationToHHMMSS(totalDuration)}</span> total time • 
                      <span className="font-medium ml-1">{formatDurationToHHMMSS(billableDuration)}</span> billable time
                    </>
                  )
                })()}
              </div>
              <button
                onClick={() => setViewingClientTimeEntries(null)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Modal */}
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        client={selectedClient}
        onSuccess={loadClients}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onConfirm={handleConfirmExport}
        client={exportClient}
        timeData={exportClient ? getClientTimeData(exportClient) : {
          totalHours: 0,
          totalSeconds: 0,
          billableAmount: 0,
          timeEntries: 0,
          formattedTime: '00:00:00'
        }}
        timeFilter={timeFilter === 'this-week' || timeFilter === 'last-week' ? 'week' : 
                   timeFilter === 'this-month' ? 'month' : 
                   timeFilter === 'custom' ? 'custom' : 'all'}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        isExporting={isExportingPDF}
        projects={projects}
      />

      {/* PDF Preview Modal */}
      {/* <PDFPreviewModal
        isOpen={showPDFPreviewModal}
        onClose={() => setShowPDFPreviewModal(false)}
        onExport={async (exportData) => {
          // Close the preview modal
          setShowPDFPreviewModal(false)
          
          // Generate the actual PDF
          try {
            setIsExportingPDF(true)
            if (isIndividualClientExport) {
              // For individual client export
              await generateIndividualClientPDF(
                exportData.name,
                {
                  name: exportData.name,
                  hours: exportData.hours,
                  amount: exportData.amount,
                  formattedTime: exportData.formattedTime
                },
                exportData.timeFilter,
                exportData.customStartDate,
                exportData.customEndDate,
                pdfSettings,
                currentUser?.companyId || undefined,
                exportData.timeEntries,
                [], // dailyTimeData - we're not passing it for now
                true, // includeTimeBreakdown
                true, // includeBillingDetails
                exportData.includeProjectDetails,
                true, // includeComments
                exportData.includeTimeEntryDate,
                exportData.includeTimeEntryDuration,
                exportData.includeTimeEntryProject,
                exportData.includeTimeEntryDescription,
                exportData.includeTimeEntryBillableStatus
              )
            } else {
              // For all clients export
              await generateClientReportPDF(chartRef.current, {
                chartData: exportData.chartData,
                billingStats: exportData.billingStats,
                timeFilter: exportData.timeFilter,
                customStartDate: exportData.customStartDate,
                customEndDate: exportData.customEndDate,
                companyName: exportData.companyName,
                companyEmail: exportData.companyEmail,
                companyPhone: exportData.companyPhone,
                pdfSettings: exportData.pdfSettings,
                companyId: exportData.companyId,
                timeEntries: exportData.timeEntries,
                includeTimeBreakdown: exportData.includeTimeBreakdown,
                includeBillingDetails: exportData.includeBillingDetails,
                includeProjectDetails: exportData.includeProjectDetails,
                includeComments: exportData.includeComments,
                includeTimeEntryDate: exportData.includeTimeEntryDate,
                includeTimeEntryDuration: exportData.includeTimeEntryDuration,
                includeTimeEntryProject: exportData.includeTimeEntryProject,
                includeTimeEntryDescription: exportData.includeTimeEntryDescription,
                includeTimeEntryBillableStatus: exportData.includeTimeEntryBillableStatus
              })
            }
          } catch (error) {
            console.error('Error generating PDF:', error)
            setError(`Failed to generate PDF. Please try again.`)
          } finally {
            setIsExportingPDF(false)
          }
        }}
        exportData={pdfPreviewData}
        isIndividualClient={isIndividualClientExport}
      /> */}

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
