import { useState } from 'react'
import { Bell, Play, VolumeX, Volume2 } from 'lucide-react'
import { playNotificationSound } from '../../utils/soundUtils'

export default function NotificationSoundTest() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [testMessage, setTestMessage] = useState('')

  const handleToggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('soundNotifications', newValue.toString())
    setTestMessage(newValue ? 'Sound notifications enabled' : 'Sound notifications disabled')
    setTimeout(() => setTestMessage(''), 3000)
  }

  const handlePlaySound = () => {
    const isEnabled = localStorage.getItem('soundNotifications') !== 'false'
    if (isEnabled) {
      playNotificationSound()
      setTestMessage('Playing notification sound...')
      setTimeout(() => setTestMessage(''), 3000)
    } else {
      setTestMessage('Sound notifications are disabled. Enable them first.')
      setTimeout(() => setTestMessage(''), 3000)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center space-x-3 mb-6">
        <Bell className="h-6 w-6 text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notification Sound Test</h2>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-green-500" />
            ) : (
              <VolumeX className="h-5 w-5 text-red-500" />
            )}
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">Sound Notifications</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {soundEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleSound}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              soundEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
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

        {testMessage && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-lg text-center">
            {testMessage}
          </div>
        )}

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">How It Works</h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Toggle the switch to enable/disable sound notifications</li>
            <li>Click "Play Test Sound" to hear the custom notification sound</li>
            <li>The sound uses Web Audio API with harmonic tones</li>
            <li>Sound will only play if notifications are enabled</li>
          </ul>
        </div>
      </div>
    </div>
  )
}