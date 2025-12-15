import { useState } from 'react'
import { Bell, Play, Volume2 } from 'lucide-react'
import { playNotificationSound } from '../../utils/soundUtils'

export default function SoundTest() {
  const [soundEnabled, setSoundEnabled] = useState(true)

  const handleToggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('soundNotifications', newValue.toString())
  }

  const handlePlaySound = () => {
    playNotificationSound()
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center space-x-3 mb-6">
        <Volume2 className="h-6 w-6 text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sound Test</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Sound Notifications</span>
          </div>
          <button
            onClick={handleToggleSound}
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

        <button
          onClick={handlePlaySound}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Play className="h-5 w-5" />
          <span>Play Test Sound</span>
        </button>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">Click the button above to test the notification sound.</p>
          <p>Toggle the switch to enable or disable sound notifications.</p>
        </div>
      </div>
    </div>
  )
}