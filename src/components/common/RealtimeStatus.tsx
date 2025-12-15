import { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff } from 'lucide-react'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

export default function RealtimeStatus() {
  const { currentUser } = useMySQLAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (currentUser) {
      // Check if real-time listeners are working
      const testConnection = () => {
        try {
          import('../../services/timeEntryService').then(({ timeEntryService }) => {
            if ((timeEntryService as any).subscribeToTimeEntries) {
              setIsConnected(true)
              
              // Subscribe to test real-time connectivity
              const unsubscribe = (timeEntryService as any).subscribeToTimeEntries(
                currentUser.uid,
                () => {
                  setLastUpdate(new Date())
                }
              )
              
              return () => {
                if (unsubscribe) unsubscribe()
              }
            } else {
              setIsConnected(false)
            }
          })
        } catch (error) {
          setIsConnected(false)
        }
      }
      
      testConnection()
    }
  }, [currentUser])

  return (
    <div className="flex items-center space-x-2 text-xs">
      {isConnected ? (
        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
          <Wifi className="h-3 w-3" />
          <span>Real-time</span>
          {lastUpdate && (
            <span className="text-gray-500">
              ({lastUpdate.toLocaleTimeString()})
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
          <WifiOff className="h-3 w-3" />
          <span>Manual refresh</span>
        </div>
      )}
    </div>
  )
}