import { useState, useEffect, useRef } from 'react'
import { Play, Square, Clock, DollarSign, Tag, FileText, Building2, X } from 'lucide-react'
import { TimeEntry, CreateTimeEntryData, Project, Client } from '../types'
// Replace direct MySQL service import with API service
import { timeEntryApiService as timeEntryService } from '../services/timeEntryApiService'
import { projectApiService as projectService } from '../services/projectApiService'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { formatDateTime } from '../utils'

interface TimeTrackerProps {
  onTimeUpdate?: (timeSummary: any) => void
}

// Define the structure for persisted form data
interface PersistedFormData {
  selectedClientId: string
  formData: CreateTimeEntryData
  newTag: string
}

export default function TimeTracker({ onTimeUpdate }: TimeTrackerProps) {
  const { currentUser, currentCompany } = useMySQLAuth()
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [formData, setFormData] = useState<CreateTimeEntryData>({
    projectId: '',
    description: '',
    isBillable: currentCompany?.pricingLevel === 'solo' ? true : false,
    tags: []
  })
  const [newTag, setNewTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLocalChanges, setHasLocalChanges] = useState(false) // Track if we have unsynced local changes
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const lastSyncRef = useRef<Date>(new Date(0)) // Initialize to epoch to ensure initial sync

  // Filter projects based on selected client
  const filteredProjects = selectedClientId 
    ? projects.filter(project => project.clientId === selectedClientId)
    : projects

  // Save form data to localStorage whenever it changes (with immediate execution)
  useEffect(() => {
    if (currentUser) {
      const persistedData: PersistedFormData = {
        selectedClientId,
        formData,
        newTag
      }
      // Always save, regardless of whether we've loaded data before
      localStorage.setItem(`timeTrackerFormData_${currentUser.uid}`, JSON.stringify(persistedData))
    }
  }, [selectedClientId, formData, newTag, currentUser])

  useEffect(() => {
    loadInitialData()
    // Subscribe to real-time running time entry updates
    let unsubscribe: (() => void) | null = null
    
    if (currentUser) {
      // Load persisted form data from localStorage
      const savedData = localStorage.getItem(`timeTrackerFormData_${currentUser.uid}`)
      if (savedData) {
        try {
          const parsedData: PersistedFormData = JSON.parse(savedData)
          setSelectedClientId(parsedData.selectedClientId)
          setFormData(parsedData.formData)
          setNewTag(parsedData.newTag)
        } catch (e) {
          console.error('Failed to parse persisted form data:', e)
        }
      }
      
      // Check for running timer on initial load
      checkForRunningTimer()
      
      // For MySQL version, we don't have real-time subscription
      // Instead, we'll poll for running entries periodically
      const pollInterval = setInterval(async () => {
        if (currentUser) {
          try {
            await checkForRunningTimer()
          } catch (error) {
            console.error('Error polling for running time entry:', error)
          }
        }
      }, 5000) // Poll every 5 seconds
      
      // Clean up interval
      return () => {
        clearInterval(pollInterval)
      }
    }
  }, [currentUser, projects]) // Removed isRunning from dependency array to prevent unnecessary re-renders

  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - startTimeRef.current!.getTime()) / 1000)
        setElapsedTime(Math.max(0, elapsed)) // Ensure non-negative
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning])

  // Update document title with running time
  useEffect(() => {
    if (isRunning) {
      document.title = `${formatElapsedTime(elapsedTime)} - NF`
    } else {
      // Reset to default title when timer is not running
      document.title = 'NexiFlow - Time Tracking & Project Management'
    }
  }, [isRunning, elapsedTime])

  // Effect to check for invalid state - if we have a currentEntry without an ID, reset it
  useEffect(() => {
    if (currentEntry && !currentEntry.id) {
      console.log('Invalid state: currentEntry exists but has no ID, resetting');
      setCurrentEntry(null);
      setIsRunning(false);
      setElapsedTime(0);
      startTimeRef.current = null;
    }
  }, [currentEntry]);

  // Extract the running timer check to a separate function
  const checkForRunningTimer = async () => {
    if (!currentUser) return
    
    try {
      const runningEntry = await timeEntryService.getRunningTimeEntry(currentUser.uid)
      // Debug log
      if (runningEntry && runningEntry.id) {
        // Debug log        // If projectName is missing but projectId exists, try to get it from projects
        if (!runningEntry.projectName && runningEntry.projectId) {
          const project = projects.find(p => p.id === runningEntry.projectId)
          if (project) {
            runningEntry.projectName = project.name
          }
        }
        
        // Preserve existing timer state if we're already running the same entry
        const isSameEntry = currentEntry?.id === runningEntry.id;
        const wasAlreadyRunning = isRunning;
        
        setCurrentEntry(runningEntry)
        setIsRunning(true)
        
        // Only update startTimeRef and reset elapsed time if this is a new entry or if we weren't running before
        if (!isSameEntry || !wasAlreadyRunning) {
          const startTime = new Date(runningEntry.startTime)
          startTimeRef.current = startTime
          const now = new Date()
          const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
          setElapsedTime(Math.max(0, elapsed))
        }
        
        // Set the selected client from the running entry
        if (runningEntry.clientId) {
          setSelectedClientId(runningEntry.clientId)
        }
        
        // Only update form data from the running entry if we don't have recent local changes
        // Check if we've made changes in the last 3 seconds (slightly less than poll interval)
        const timeSinceLastSync = new Date().getTime() - lastSyncRef.current.getTime();
        const shouldUpdateFormData = !hasLocalChanges || timeSinceLastSync > 3000;
        
        if (shouldUpdateFormData) {
          setFormData(prev => ({
            projectId: runningEntry.projectId || prev.projectId || '',
            description: runningEntry.description || prev.description || '',
            isBillable: currentCompany?.pricingLevel === 'solo' ? true : (runningEntry.isBillable !== undefined ? runningEntry.isBillable : (prev.isBillable || false)),
            tags: runningEntry.tags || prev.tags || []
          }));
          // Clear the local changes flag since we're updating from server
          setHasLocalChanges(false);
        }
      } else {
        console.log('No valid running entry found or missing ID'); // Debug log
        // No running entry found - timer was stopped
        // Only reset if we thought there was a timer running
        if (currentEntry || isRunning) {
          setCurrentEntry(null)
          setIsRunning(false)
          setElapsedTime(0)
          startTimeRef.current = null
        }
      }
    } catch (error) {
      console.error('Error checking for running time entry:', error)
    }
  }

  const loadInitialData = async () => {
    if (!currentUser) return
    
    try {
      // Load both clients and projects
      const [clientsData, projectsData] = await Promise.all([
        currentUser?.companyId 
          ? projectService.getClientsForCompany(currentUser.companyId)
          : projectService.getClients(),
        currentUser?.companyId 
          ? projectService.getProjectsForCompany(currentUser.companyId)
          : projectService.getProjects()
      ])
      
      setClients(clientsData)
      setProjects(projectsData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const startTimer = async () => {
    if (!currentUser) return
    
    setLoading(true)
    setError('')
    
    try {
      // Check if there's already a running timer before creating a new one
      // First, refresh our local state by checking the server
      await checkForRunningTimer()
      
      // Now check if we still have a running timer
      if (isRunning || currentEntry) {
        setError('Timer is already running. Please stop the current timer before starting a new one.')
        setLoading(false)
        return
      }
      
      // Create entry with minimal data - project and description can be added later
      const minimalEntryData: CreateTimeEntryData = {
        projectId: formData.projectId || undefined,
        description: formData.description || undefined,
        isBillable: currentCompany?.pricingLevel === 'solo' ? true : (formData.isBillable || false),
        tags: formData.tags || []
      }
      
      // Get project and client names for the entry
      const projectName = formData.projectId 
        ? projects.find(p => p.id === formData.projectId)?.name 
        : undefined
      const clientName = selectedClientId 
        ? clients.find(c => c.id === selectedClientId)?.name 
        : undefined
      
      // console.log('Creating time entry with data:', {
      //   minimalEntryData,
      //   userId: currentUser.uid,
      //   projectName,
      //   companyId: currentUser.companyId,
      //   clientName
      // });
      
      const entryId = await timeEntryService.createTimeEntry(
        minimalEntryData, 
        currentUser.uid, 
        projectName, 
        currentUser.companyId, 
        clientName
      )
      
      // console.log('Created time entry with ID:', entryId);
      
      // Fetch the newly created entry to get the full object
      const entry = await timeEntryService.getRunningTimeEntry(currentUser.uid)
      // console.log('Fetched running entry after creation:', entry);
      
      if (entry && entry.id) {
        setCurrentEntry(entry)
        setIsRunning(true)
        startTimeRef.current = new Date(entry.startTime)
        setElapsedTime(0)
        lastSyncRef.current = new Date(); // Update last sync time
        
        // Notify parent component of time update if callback provided
        if (onTimeUpdate) {
          onTimeUpdate({ isRunning: true, entry })
        }
      } else {
        // console.error('Failed to fetch valid running entry after creation');
        setError('Failed to start timer properly');
      }
    } catch (error: any) {
      // console.error('Error starting timer:', error)
      // console.error('Error details:', {
      //   message: error.message,
      //   stack: error.stack,
      //   name: error.name
      // })
      setError(error.message || 'Failed to start timer')
    } finally {
      setLoading(false)
    }
  }
  
  const stopTimer = async () => {
    if (!currentUser || !currentEntry) return
    
    setLoading(true)
    setError('')
    
    try {
      // Update entry with final data before stopping
      const updates: any = {
        projectId: formData.projectId || undefined,
        description: formData.description || undefined,
        isBillable: currentCompany?.pricingLevel === 'solo' ? true : (formData.isBillable || false),
        tags: formData.tags || []
      }
      
      // Add project and client names if IDs are provided
      if (formData.projectId) {
        const project = projects.find(p => p.id === formData.projectId)
        if (project) {
          updates.projectName = project.name
        }
      }
      
      if (selectedClientId) {
        const client = clients.find(c => c.id === selectedClientId)
        if (client) {
          updates.clientName = client.name
        }
      }
      
      await timeEntryService.updateTimeEntry(currentEntry.id, updates)
      const stoppedEntry = await timeEntryService.stopTimeEntry(currentEntry.id)
      
      // Debug log the raw response
      console.log('Raw stopped entry response:', stoppedEntry);
      
      // Calculate duration locally as a fallback
      let finalDuration: number | undefined = undefined;
      if (stoppedEntry && typeof stoppedEntry.duration === 'number') {
        finalDuration = stoppedEntry.duration;
        console.log('Using server-provided duration:', finalDuration);
      } else if (startTimeRef.current) {
        const endTime = new Date();
        finalDuration = Math.floor((endTime.getTime() - startTimeRef.current.getTime()) / 1000);
        console.log('Using locally calculated duration:', finalDuration);
      } else {
        console.log('No duration available - using 0');
        finalDuration = 0;
      }
      
      // Update the elapsed time with the final duration before stopping
      if (finalDuration !== undefined) {
        setElapsedTime(finalDuration);
      }
      
      // Log the final duration for debugging
      console.log('Stopped time entry response:', stoppedEntry);
      if (stoppedEntry && finalDuration !== undefined) {
        console.log('Stopped time entry with duration:', finalDuration);
      } else {
        console.warn('Stopped time entry missing duration, using calculated value:', finalDuration);
      }
      
      setCurrentEntry(null)
      setIsRunning(false)
      // Don't reset elapsed time to 0 here since we want to show the final duration
      startTimeRef.current = null
      
      // Reset form data for next entry
      setFormData({
        projectId: '',
        description: '',
        isBillable: currentCompany?.pricingLevel === 'solo' ? true : false,
        tags: []
      })
      setNewTag('')
      setSelectedClientId('')
      
      // Clear persisted data
      localStorage.removeItem(`timeTrackerFormData_${currentUser.uid}`)
      
      // Notify parent component of time update if callback provided
      if (onTimeUpdate) {
        onTimeUpdate({ isRunning: false })
      }
    } catch (error: any) {
      // console.error('Error stopping timer:', error)
      setError(error.message || 'Failed to stop timer')
    } finally {
      setLoading(false)
    }
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag()
    }
  }

  const handleBillableChange = async (isBillable: boolean) => {
    setFormData(prev => ({ ...prev, isBillable }));
    setHasLocalChanges(true); // Mark that we have local changes
    lastSyncRef.current = new Date(); // Update last sync time immediately to prevent server override
    
    // If there's a running timer, update it with the new billable status
    if (isRunning && currentEntry && currentUser && currentEntry.id) {
      try {
        // Debug log
        // console.log('Updating time entry with billable status:', { entryId: currentEntry.id, isBillable });
        
        await timeEntryService.updateTimeEntry(currentEntry.id, { isBillable });
        setHasLocalChanges(false); // Clear the local changes flag after successful sync
        lastSyncRef.current = new Date(); // Update last sync time
      } catch (error) {
        // console.error('Error updating billable status for running timer:', error);
        // console.error('Current entry details:', currentEntry);
        setError('Failed to update billable status for running timer');
      }
    } else if (isRunning && currentEntry) {
      // console.warn('Unable to update billable status: missing entry ID or user', {
      //   hasEntryId: !!currentEntry.id,
      //   hasUser: !!currentUser,
      //   entry: currentEntry
      // });
      if (!currentEntry.id) {
        setError('Cannot update timer: Missing entry ID');
      }
    }
  };

  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    // Reset project selection when client changes
    setFormData(prev => ({ ...prev, projectId: '' }));
    setHasLocalChanges(true); // Mark that we have local changes
    lastSyncRef.current = new Date(); // Update last sync time immediately to prevent server override
    
    // If there's a running timer, update it with the new client
    if (isRunning && currentEntry && currentUser && currentEntry.id) {
      try {
        const updates: any = {
          clientId: clientId || undefined,
          clientName: clientId ? clients.find(c => c.id === clientId)?.name : undefined
        };
        
        // Debug log
        // console.log('Updating time entry with client:', { entryId: currentEntry.id, updates });
        
        await timeEntryService.updateTimeEntry(currentEntry.id, updates);
        setHasLocalChanges(false); // Clear the local changes flag after successful sync
        lastSyncRef.current = new Date(); // Update last sync time
      } catch (error) {
        // console.error('Error updating client for running timer:', error);
        // console.error('Current entry details:', currentEntry);
        setError('Failed to update client for running timer');
      }
    } else if (isRunning && currentEntry) {
      // console.warn('Unable to update client: missing entry ID or user', {
      //   hasEntryId: !!currentEntry.id,
      //   hasUser: !!currentUser,
      //   entry: currentEntry
      // });
      if (!currentEntry.id) {
        setError('Cannot update timer: Missing entry ID');
      }
    }
  };

  const handleProjectChange = async (projectId: string) => {
    setFormData(prev => ({ ...prev, projectId }));
    setHasLocalChanges(true); // Mark that we have local changes
    lastSyncRef.current = new Date(); // Update last sync time immediately to prevent server override
    
    // If there's a running timer, update it with the new project
    if (isRunning && currentEntry && currentUser && currentEntry.id) {
      try {
        const updates: any = {
          projectId: projectId || undefined,
          projectName: projectId ? projects.find(p => p.id === projectId)?.name : undefined
        };
        
        // Debug log
        // console.log('Updating time entry with project:', { entryId: currentEntry.id, updates });
        
        await timeEntryService.updateTimeEntry(currentEntry.id, updates);
        setHasLocalChanges(false); // Clear the local changes flag after successful sync
        lastSyncRef.current = new Date(); // Update last sync time
      } catch (error) {
        // console.error('Error updating project for running timer:', error);
        // console.error('Current entry details:', currentEntry);
        setError('Failed to update project for running timer');
      }
    } else if (isRunning && currentEntry) {
      // console.warn('Unable to update project: missing entry ID or user', {
      //   hasEntryId: !!currentEntry.id,
      //   hasUser: !!currentUser,
      //   entry: currentEntry
      // });
      if (!currentEntry.id) {
        setError('Cannot update timer: Missing entry ID');
      }
    }
  };

  const handleDescriptionChange = async (description: string) => {
    setFormData(prev => ({ ...prev, description }));
    setHasLocalChanges(true); // Mark that we have local changes
    lastSyncRef.current = new Date(); // Update last sync time immediately to prevent server override
    
    // If there's a running timer, update it with the new description
    if (isRunning && currentEntry && currentUser && currentEntry.id) {
      try {
        // Debug log
        // console.log('Updating time entry with description:', { entryId: currentEntry.id, description });
        
        await timeEntryService.updateTimeEntry(currentEntry.id, { description });
        setHasLocalChanges(false); // Clear the local changes flag after successful sync
        lastSyncRef.current = new Date(); // Update last sync time
      } catch (error) {
        // console.error('Error updating description for running timer:', error);
        // console.error('Current entry details:', currentEntry);
        setError('Failed to update description for running timer');
      }
    } else if (isRunning && currentEntry) {
      // console.warn('Unable to update description: missing entry ID or user', {
      //   hasEntryId: !!currentEntry.id,
      //   hasUser: !!currentUser,
      //   entry: currentEntry
      // });
      if (!currentEntry.id) {
        setError('Cannot update timer: Missing entry ID');
      }
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    
    const updatedTags = [...(formData.tags || []), newTag.trim()];
    setFormData(prev => ({ ...prev, tags: updatedTags }));
    setNewTag('');
    setHasLocalChanges(true); // Mark that we have local changes
    lastSyncRef.current = new Date(); // Update last sync time immediately to prevent server override
    
    // If there's a running timer, update it with the new tags
    if (isRunning && currentEntry && currentUser && currentEntry.id) {
      try {
        // Debug log
        // console.log('Updating time entry with tags:', { entryId: currentEntry.id, tags: updatedTags });
        
        await timeEntryService.updateTimeEntry(currentEntry.id, { tags: updatedTags });
        setHasLocalChanges(false); // Clear the local changes flag after successful sync
        lastSyncRef.current = new Date(); // Update last sync time
      } catch (error) {
        // console.error('Error updating tags for running timer:', error);
        // console.error('Current entry details:', currentEntry);
        setError('Failed to update tags for running timer');
      }
    } else if (isRunning && currentEntry) {
      // console.warn('Unable to update tags: missing entry ID or user', {
      //   hasEntryId: !!currentEntry.id,
      //   hasUser: !!currentUser,
      //   entry: currentEntry
      // });
      if (!currentEntry.id) {
        setError('Cannot update timer: Missing entry ID');
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = (formData.tags || []).filter(tag => tag !== tagToRemove);
    setFormData(prev => ({ ...prev, tags: updatedTags }));
    setHasLocalChanges(true); // Mark that we have local changes
    lastSyncRef.current = new Date(); // Update last sync time immediately to prevent server override
    
    // If there's a running timer, update it with the new tags
    if (isRunning && currentEntry && currentUser && currentEntry.id) {
      try {
        // Debug log
        // console.log('Removing tag from time entry:', { entryId: currentEntry.id, tags: updatedTags });
        
        await timeEntryService.updateTimeEntry(currentEntry.id, { tags: updatedTags });
        setHasLocalChanges(false); // Clear the local changes flag after successful sync
        lastSyncRef.current = new Date(); // Update last sync time
      } catch (error) {
        // console.error('Error removing tag from running timer:', error);
        // console.error('Current entry details:', currentEntry);
        setError('Failed to remove tag from running timer');
      }
    } else if (isRunning && currentEntry) {
      // console.warn('Unable to remove tag: missing entry ID or user', {
      //   hasEntryId: !!currentEntry.id,
      //   hasUser: !!currentUser,
      //   entry: currentEntry
      // });
      if (!currentEntry.id) {
        setError('Cannot update timer: Missing entry ID');
      }
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Time Tracker</h2>
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
            {formatElapsedTime(elapsedTime)}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Select a client</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {/* Project Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project
          </label>
          <select
            value={formData.projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={!selectedClientId}
          >
            <option value="">Select a project</option>
            {filteredProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="What are you working on?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        {/* Billable Toggle */}
        {!currentCompany || currentCompany.pricingLevel !== 'solo' ? (
          <div className="flex items-center">
            <input
              id="billable"
              type="checkbox"
              checked={formData.isBillable}
              onChange={(e) => handleBillableChange(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="billable" className="ml-2 block text-sm text-gray-900 dark:text-white">
              Billable
            </label>
            <DollarSign className="ml-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
        ) : (
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <DollarSign className="mr-1 h-4 w-4" />
            All time entries are billable on Solo plan
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(formData.tags || []).map(tag => (
              <span 
                key={tag} 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 inline-flex items-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add a tag..."
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md shadow-sm text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
            >
              <Tag className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={startTimer}
              disabled={loading || !currentUser}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Timer
            </button>
          ) : (
            <button
              type="button"
              onClick={stopTimer}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Timer
            </button>
          )}
          
          {currentEntry && currentEntry.id && (
            <button
              type="button"
              onClick={async () => {
                if (!currentEntry.id) {
                  setError('Cannot delete time entry: Missing entry ID');
                  return;
                }
                
                if (window.confirm('Are you sure you want to discard this time entry?')) {
                  try {
                    await timeEntryService.deleteTimeEntry(currentEntry.id)
                    setCurrentEntry(null)
                    setIsRunning(false)
                    setElapsedTime(0)
                    startTimeRef.current = null
                    setFormData({
                      projectId: '',
                      description: '',
                      isBillable: currentCompany?.pricingLevel === 'solo' ? true : false,
                      tags: []
                    })
                    setNewTag('')
                    setSelectedClientId('')
                    
                    // Clear persisted data
                    if (currentUser) {
                      localStorage.removeItem(`timeTrackerFormData_${currentUser.uid}`)
                    }
                  } catch (error) {
                    console.error('Error discarding time entry:', error)
                    setError('Failed to discard time entry')
                  }
                }
              }}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4 mr-2" />
              Discard
            </button>
          )}
        </div>
      </div>
    </div>
  )
}