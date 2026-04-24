import { useState, useEffect } from 'react'
import { Bell, Volume2, VolumeX } from 'lucide-react'
import { soundManager } from '../../utils/soundManager'

export default function NotificationSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [desktopEnabled, setDesktopEnabled] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSoundEnabled = localStorage.getItem('soundNotifications')
    if (savedSoundEnabled !== null) {
      setSoundEnabled(savedSoundEnabled !== 'false')
    }
    
    // Check if user has interacted
    setUserInteracted(soundManager.hasUserInteracted())
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('soundNotifications', soundEnabled.toString())
    // Update sound manager
    soundManager.setSoundEnabled(soundEnabled)
  }, [soundEnabled])

  const handleSoundToggle = () => {
    setSoundEnabled(!soundEnabled)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Notification Settings</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sound Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Play a sound when you receive notifications</p>
              {soundEnabled && !userInteracted && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Click anywhere on the page to enable sound playback
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSoundToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              soundEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Volume2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Email Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receive email notifications for important updates</p>
            </div>
          </div>
          <button
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              emailEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                emailEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <VolumeX className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Desktop Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Show desktop notifications when the app is in background</p>
            </div>
          </div>
          <button
            onClick={() => setDesktopEnabled(!desktopEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              desktopEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                desktopEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
