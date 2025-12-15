import { TimeEntry, CreateTimeEntryData, TimeSummary } from '../types'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// Get auth token for authentication
const getAuthToken = async (): Promise<string | null> => {
  try {
    // In a real implementation, you would get the token from your auth context
    // For now, we'll return a placeholder - in practice, this would come from your auth system
    return localStorage.getItem('authToken') || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

// Generic API request function
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getAuthToken()
  
  const url = `${API_BASE_URL}${endpoint}`
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // If the error is due to an invalid or expired token, redirect to login
      if (response.status === 401 || response.status === 403) {
        // Clear the expired token from localStorage
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentCompany')
        
        // Redirect to login page
        window.location.href = '/login'
        
        throw new Error('Session expired. Please log in again.')
      }
      
      // If it's a bad request due to invalid company ID format, redirect to login
      if (response.status === 400 && errorData.error && errorData.error.includes('Invalid company ID format')) {
        // Clear the invalid data from localStorage
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('currentCompany')
        
        // Redirect to login page
        window.location.href = '/login'
        
        throw new Error('Invalid user data. Please log in again.')
      }
      
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error)
    throw error
  }
}

// Time Entry API Service
export const timeEntryApiService = {
  // Create a new time entry
  async createTimeEntry(entryData: CreateTimeEntryData, userId: string, projectName?: string, companyId?: string | null, clientName?: string): Promise<string> {
    const queryParams = new URLSearchParams();
    queryParams.append('userId', userId);
    if (projectName) queryParams.append('projectName', projectName);
    if (companyId) queryParams.append('companyId', companyId);
    if (clientName) queryParams.append('clientName', clientName);
    
    const queryString = queryParams.toString();
    const endpoint = `/time-entries${queryString ? `?${queryString}` : ''}`;
    
    // console.log('Creating time entry with:', {
    //   endpoint,
    //   entryData,
    //   userId,
    //   projectName,
    //   companyId,
    //   clientName
    // });
    
    const response = await apiRequest<{
      success: boolean
      data: { id: string }
      message: string
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(entryData),
    })
    
    // console.log('Create time entry response:', response);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to create time entry')
    }
    
    return response.data.id
  },

  // Get all time entries for a user
  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    const response = await apiRequest<{
      success: boolean
      data: TimeEntry[]
      count: number
    }>(`/time-entries/user/${userId}`)
    
    if (!response.success) {
      throw new Error('Failed to get time entries')
    }
    
    return response.data
  },

  // Get time entries for a specific date range
  async getTimeEntriesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    // For now, we'll get all entries and filter on the client side
    // In a production environment, this should be done on the server side
    const allEntries = await this.getTimeEntries(userId);
    
    // Adjust end date to end of day to include all entries for that day
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);
    
    return allEntries.filter((entry: TimeEntry) => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= startDate && entryDate <= adjustedEndDate;
    });
  },

  // Get currently running time entry for a user
  async getRunningTimeEntry(userId: string): Promise<TimeEntry | null> {
    const response = await apiRequest<{
      success: boolean
      data: TimeEntry | null
    }>(`/time-entries/user/${userId}/running`)
    
    if (!response.success) {
      throw new Error('Failed to get running time entry')
    }
    
    return response.data
  },

  // Stop a running time entry
  async stopTimeEntry(entryId: string): Promise<TimeEntry> {
    // Validate entryId
    if (!entryId) {
      throw new Error('Entry ID is required');
    }
    
    const response = await apiRequest<{
      success: boolean
      message: string
      data: TimeEntry
    }>(`/time-entries/${entryId}/stop`, {
      method: 'POST',
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to stop time entry')
    }
    
    return response.data
  },
  
  // Update a time entry
  async updateTimeEntry(entryId: string, updates: Partial<CreateTimeEntryData & { projectName?: string, clientName?: string }>): Promise<void> {
    // Validate entryId
    if (!entryId) {
      throw new Error('Entry ID is required');
    }
    
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/time-entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to update time entry')
    }
  },

  // Delete a time entry
  async deleteTimeEntry(entryId: string): Promise<void> {
    // Validate entryId
    if (!entryId) {
      throw new Error('Entry ID is required');
    }
    
    const response = await apiRequest<{
      success: boolean
      message: string
    }>(`/time-entries/${entryId}`, {
      method: 'DELETE',
    })
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete time entry')
    }
  },

  // Get time summary for dashboard
  async getTimeSummary(userId: string): Promise<TimeSummary> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayEntries, weekEntries, monthEntries] = await Promise.all([
      this.getTimeEntriesByDateRange(userId, startOfDay, now),
      this.getTimeEntriesByDateRange(userId, startOfWeek, now),
      this.getTimeEntriesByDateRange(userId, startOfMonth, now)
    ]);

    const calculateStats = (entries: TimeEntry[]) => {
      const total = entries.reduce((sum, entry) => sum + entry.duration, 0);
      const billable = entries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => sum + entry.duration, 0);
      return { total, billable, entries: entries.length };
    };

    return {
      today: calculateStats(todayEntries),
      thisWeek: calculateStats(weekEntries),
      thisMonth: calculateStats(monthEntries)
    };
  }
}

// Export default
export default timeEntryApiService