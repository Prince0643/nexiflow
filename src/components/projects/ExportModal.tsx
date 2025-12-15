import { useState, useEffect } from 'react'
import { 
  X, 
  FileText, 
  Clock, 
  DollarSign, 
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { format, startOfWeek, endOfWeek, subWeeks, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { Client, TimeEntry } from '../../types'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { canViewHourlyRates } from '../../utils/permissions'
import { timeEntryService } from '../../services/timeEntryService'
import { formatSecondsToHHMMSS, formatCurrency } from '../../utils'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: ExportData) => Promise<void>
  client: Client | null
  timeData: {
    totalHours: number
    billableAmount: number
    timeEntries: number
    formattedTime?: string
  }
  timeFilter: 'week' | 'month' | 'all' | 'custom'
  customStartDate?: Date
  customEndDate?: Date
  isExporting: boolean
  projects: any[] // Add projects prop to filter by client
}

interface ExportData {
  reportTitle: string
  reportDescription: string
  includeTimeBreakdown: boolean
  includeProjectDetails: boolean
  includeComments: boolean
  // Advanced time entries options
  includeTimeEntryDate: boolean
  includeTimeEntryDuration: boolean
  includeTimeEntryProject: boolean
  includeTimeEntryDescription: boolean
  includeTimeEntryBillableStatus: boolean
  customTimeData?: {
    totalHours: number
    billableAmount: number
  }
  customPeriod?: {
    startDate: Date
    endDate: Date
  }
}

export default function ExportModal({
  isOpen,
  onClose,
  onConfirm,
  client,
  timeData,
  timeFilter,
  customStartDate,
  customEndDate,
  isExporting,
  projects
}: ExportModalProps) {
  const { currentUser } = useMySQLAuth()
  const { isDarkMode } = useTheme()
  
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

  const [useCustomTimeData, setUseCustomTimeData] = useState(false)
  const [editableTimeData, setEditableTimeData] = useState({
    totalHours: timeData.totalHours,
    billableAmount: timeData.billableAmount
  })
  const [exportData, setExportData] = useState<ExportData>({
    reportTitle: client ? `${client.name} - Time Report` : 'Time Report',
    reportDescription: '',
    includeTimeBreakdown: true,
    includeProjectDetails: true,
    includeComments: true,
    // Advanced time entries options (default to true for backward compatibility)
    includeTimeEntryDate: true,
    includeTimeEntryDuration: true,
    includeTimeEntryProject: true,
    includeTimeEntryDescription: true,
    includeTimeEntryBillableStatus: true
  })
  const [customPeriod, setCustomPeriod] = useState({
    startDate: customStartDate || new Date(),
    endDate: customEndDate || new Date()
  })
  // Add state for export period filter
  const [exportPeriod, setExportPeriod] = useState<'this-week' | 'last-week' | 'yesterday' | 'this-month' | 'custom' | 'all'>('this-week')
  // Add state for dynamic time data
  const [dynamicTimeData, setDynamicTimeData] = useState(timeData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setExportData({
        reportTitle: client ? `${client.name} - Time Report` : 'Time Report',
        reportDescription: '',
        includeTimeBreakdown: true,
        includeProjectDetails: true,
        includeComments: true,
        // Advanced time entries options (default to true for backward compatibility)
        includeTimeEntryDate: true,
        includeTimeEntryDuration: true,
        includeTimeEntryProject: true,
        includeTimeEntryDescription: true,
        includeTimeEntryBillableStatus: true
      })
      setUseCustomTimeData(false)
      setEditableTimeData({
        totalHours: timeData.totalHours,
        billableAmount: timeData.billableAmount
      })
      setDynamicTimeData(timeData)
      setCustomPeriod({
        startDate: customStartDate || new Date(),
        endDate: customEndDate || new Date()
      })
      // Set the export period based on the current time filter
      switch (timeFilter) {
        case 'week':
          setExportPeriod('this-week')
          break
        case 'month':
          setExportPeriod('this-month')
          break
        case 'custom':
          setExportPeriod('custom')
          break
        default:
          setExportPeriod('all')
      }
      setError('')
    }
  }, [isOpen, client, timeData, customStartDate, customEndDate, timeFilter])

  // Load time data when export period changes
  useEffect(() => {
    if (!isOpen || !client) return
    
    const loadTimeDataForPeriod = async () => {
      setLoading(true)
      try {
        const { startDate, endDate } = getSelectedDateRange()
        const timeEntries = await timeEntryService.getAllTimeEntriesByDateRange(startDate, endDate)
        
        // Filter time entries for this client's projects
        const clientProjects = projects.filter(project => project.clientId === client.id)
        const clientProjectIds = clientProjects.map(project => project.id)
        
        const clientTimeEntries = timeEntries.filter(entry => 
          entry.projectId && clientProjectIds.includes(entry.projectId)
        )

        const totalSeconds = clientTimeEntries.reduce((sum, entry) => sum + entry.duration, 0)
        const totalHours = totalSeconds / 3600
        const billableAmount = totalHours * (client.hourlyRate || 0)
        
        const newTimeData = {
          totalHours,
          totalSeconds,
          billableAmount,
          timeEntries: clientTimeEntries.length,
          formattedTime: formatSecondsToHHMMSS(totalSeconds)
        }
        
        setDynamicTimeData(newTimeData)
        setEditableTimeData({
          totalHours: newTimeData.totalHours,
          billableAmount: newTimeData.billableAmount
        })
      } catch (err) {
        console.error('Error loading time data:', err)
        setError('Failed to load time data for selected period')
      } finally {
        setLoading(false)
      }
    }
    
    loadTimeDataForPeriod()
  }, [exportPeriod, customPeriod, isOpen, client, projects])

  const handleConfirm = async () => {
    if (!validateForm()) {
      return
    }

    try {
      const dataToSend: ExportData & { exportPeriod?: string } = {
        ...exportData,
        customPeriod: exportPeriod === 'custom' ? customPeriod : undefined,
        exportPeriod // Add the selected export period
      }

      if (useCustomTimeData) {
        dataToSend.customTimeData = editableTimeData
      }

      await onConfirm(dataToSend)
    } catch (error) {
      setError('Failed to generate export')
    }
  }

  const validateForm = () => {
    if (!exportData.reportTitle.trim()) {
      setError('Report title is required')
      return false
    }
    return true
  }

  const getPeriodText = () => {
    switch (exportPeriod) {
      case 'this-week':
        return 'This Week'
      case 'last-week':
        return 'Last Week'
      case 'yesterday':
        return 'Yesterday'
      case 'this-month':
        return 'This Month'
      case 'custom':
        return `${format(customPeriod.startDate, 'MMM dd')} - ${format(customPeriod.endDate, 'MMM dd, yyyy')}`
      default:
        return 'All Time'
    }
  }

  // Function to get date range based on selected period
  const getSelectedDateRange = () => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (exportPeriod) {
      case 'this-week':
        startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'last-week':
        const lastWeek = subWeeks(now, 1)
        startDate = startOfWeek(lastWeek, { weekStartsOn: 1 })
        endDate = endOfWeek(lastWeek, { weekStartsOn: 1 })
        break
      case 'yesterday':
        startDate = subDays(now, 1)
        endDate = subDays(now, 1)
        // Fix for same-day filtering: set end date to end of day
        endDate.setHours(23, 59, 59, 999)
        break
      case 'this-month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'custom':
        startDate = customPeriod.startDate
        endDate = customPeriod.endDate
        // Fix for date range filtering: set start date to beginning of day and end date to end of day
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        // All time - use a wide range
        startDate = new Date(2000, 0, 1)
        endDate = new Date(2100, 11, 31)
    }

    return { startDate, endDate }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Export Report</h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            disabled={isExporting}
          >
            <X className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className={`flex items-center space-x-2 p-3 rounded-lg ${isDarkMode ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
              <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              <p className={`text-sm ${isDarkMode ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          {/* Client Info (if exporting for a specific client) */}
          {client && (
            <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex items-center space-x-3 mb-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                  <FileText className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <div>
                  <h3 className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{client.name}</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Client Report</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Company:</span>
                  <span className={`ml-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{client.company || 'N/A'}</span>
                </div>
                {currentUser && canViewHourlyRates(currentUser.role) ? (
                  <>
                    <div>
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Rate:</span>
                      <span className={`ml-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{client ? formatCurrency(client.hourlyRate || 0, client.currency) : '$0.00'}</span>
                    </div>
                    <div>
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Billable Amount:</span>
                      <span className={`ml-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{client ? formatCurrency((dynamicTimeData.totalHours * (client.hourlyRate || 0)), client.currency) : '$0.00'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Rate:</span>
                      <span className={`ml-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>--</span>
                    </div>
                    <div>
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Billable Amount:</span>
                      <span className={`ml-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>--</span>
                    </div>
                  </>
                )}
                <div>
                  <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Period:</span>
                  <span className={`ml-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{getPeriodText()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Period Filter */}
          <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Select Period</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportPeriod('this-week')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  exportPeriod === 'this-week'
                    ? 'bg-primary-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setExportPeriod('last-week')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  exportPeriod === 'last-week'
                    ? 'bg-primary-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Last Week
              </button>
              <button
                onClick={() => setExportPeriod('yesterday')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  exportPeriod === 'yesterday'
                    ? 'bg-primary-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setExportPeriod('this-month')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  exportPeriod === 'this-month'
                    ? 'bg-primary-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setExportPeriod('all')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  exportPeriod === 'all'
                    ? 'bg-primary-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setExportPeriod('custom')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  exportPeriod === 'custom'
                    ? 'bg-primary-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Date Range */}
            {exportPeriod === 'custom' && (
              <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Custom Date Range</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Start Date</label>
                    <input
                      type="date"
                      value={formatDateForInput(customPeriod.startDate)}
                      onChange={(e) => {
                        const date = parseDateFromInput(e.target.value);
                        setCustomPeriod(prev => ({ ...prev, startDate: date }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      disabled={isExporting}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>End Date</label>
                    <input
                      type="date"
                      value={formatDateForInput(customPeriod.endDate)}
                      onChange={(e) => {
                        const date = parseDateFromInput(e.target.value);
                        setCustomPeriod(prev => ({ ...prev, endDate: date }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      disabled={isExporting}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Data Summary */}
          <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Time Data Summary</h3>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={useCustomTimeData}
                  onChange={(e) => setUseCustomTimeData(e.target.checked)}
                  className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                  disabled={isExporting}
                />
                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Edit values</span>
              </label>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            ) : useCustomTimeData ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Time (hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editableTimeData.totalHours}
                    onChange={(e) => setEditableTimeData(prev => ({ 
                      ...prev, 
                      totalHours: parseFloat(e.target.value) || 0 
                    }))}
                    className={`w-full px-3 py-2 text-center text-lg font-bold rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-400' : 'bg-white border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                </div>
                {currentUser && canViewHourlyRates(currentUser.role) ? (
                  <div>
                    <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Billable Amount {client ? `(${client.currency || '$'})` : '($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editableTimeData.billableAmount}
                      onChange={(e) => setEditableTimeData(prev => ({ 
                        ...prev, 
                        billableAmount: parseFloat(e.target.value) || 0 
                      }))}
                      className={`w-full px-3 py-2 text-center text-lg font-bold rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-green-400' : 'bg-white border-gray-300 text-green-600'}`}
                      disabled={isExporting}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Billable Amount {client ? `(${client.currency || '$'})` : '($)'}
                    </label>
                    <input
                      type="text"
                      value="--"
                      readOnly
                      className={`w-full px-3 py-2 text-center text-lg font-bold rounded-lg ${isDarkMode ? 'bg-gray-700 text-green-400' : 'bg-gray-100 text-green-600'}`}
                      disabled={isExporting}
                    />
                  </div>
                )}
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Time Entries</label>
                  <input
                    type="number"
                    min="0"
                    value={dynamicTimeData.timeEntries}
                    readOnly
                    className={`w-full px-3 py-2 text-center text-lg font-bold rounded-lg ${isDarkMode ? 'bg-gray-700 text-purple-400' : 'bg-gray-100 text-purple-600'}`}
                    disabled={isExporting}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{dynamicTimeData.formattedTime}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Time</div>
                </div>
                {currentUser && canViewHourlyRates(currentUser.role) ? (
                  <div>
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{client ? formatCurrency(dynamicTimeData.billableAmount, client.currency) : '$0.00'}</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Billable Amount</div>
                  </div>
                ) : (
                  <div>
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>--</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Billable Amount</div>
                  </div>
                )}
                <div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{dynamicTimeData.timeEntries}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Time Entries</div>
                </div>
              </div>
            )}
            
            {useCustomTimeData && (
              <div className={`mt-3 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>💡 <strong>Tip:</strong> You can override the actual tracked data with custom values for this export.</p>
              </div>
            )}
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <h3 className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Export Options</h3>
            
            {/* Report Title */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Report Title
              </label>
              <input
                type="text"
                value={exportData.reportTitle}
                onChange={(e) => setExportData(prev => ({ ...prev, reportTitle: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                placeholder="Enter report title"
                disabled={isExporting}
              />
            </div>

            {/* Report Description */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Report Description
              </label>
              <textarea
                value={exportData.reportDescription}
                onChange={(e) => setExportData(prev => ({ ...prev, reportDescription: e.target.value }))}
                rows={3}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                placeholder="Enter report description (optional)"
                disabled={isExporting}
              />
            </div>

            {/* Include Options */}
            <div className="space-y-3">
              <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Include in Report:</h4>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeTimeBreakdown}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeTimeBreakdown: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <div className="flex items-center space-x-2">
                    <Clock className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Time breakdown by day/project</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeProjectDetails}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeProjectDetails: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <div className="flex items-center space-x-2">
                    <FileText className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project details and descriptions</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeComments}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeComments: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <div className="flex items-center space-x-2">
                    <FileText className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Time entry comments and notes</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Advanced Time Entries Options */}
          {exportData.includeProjectDetails && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Time Entries Table Details:
              </h4>
              
              <div className="space-y-2 ml-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeTimeEntryDate}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeTimeEntryDate: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Include Date</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeTimeEntryDuration}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeTimeEntryDuration: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Include Duration</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeTimeEntryProject}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeTimeEntryProject: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Include Project Name</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeTimeEntryDescription}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeTimeEntryDescription: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Include Description</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportData.includeTimeEntryBillableStatus}
                    onChange={(e) => setExportData(prev => ({ ...prev, includeTimeEntryBillableStatus: e.target.checked }))}
                    className={`h-4 w-4 rounded focus:ring-blue-500 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-blue-500' : 'border-gray-300 text-blue-600'}`}
                    disabled={isExporting}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Include Billable Status</span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={`flex justify-end space-x-3 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center space-x-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={isExporting || loading}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}