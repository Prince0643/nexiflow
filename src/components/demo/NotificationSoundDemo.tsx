import { useState } from 'react'
import { Bell, Play, Volume2, VolumeX } from 'lucide-react'
import { playNotificationSound } from '../../utils/soundUtils'

export default function NotificationSoundDemo() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleToggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('soundNotifications', newValue.toString())
  }

  const handlePlaySound = () => {
    setIsPlaying(true)
    playNotificationSound()
    setTimeout(() => setIsPlaying(false), 1000)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sound Notifications</h2>
              <p className="text-gray-600 dark:text-gray-400">Custom audio alerts for mentions and notifications</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
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
                disabled={isPlaying}
                className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                  isPlaying 
                    ? 'bg-indigo-400 text-white cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <Play className="h-5 w-5" />
                <span>{isPlaying ? 'Playing...' : 'Play Test Sound'}</span>
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">How It Works</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start space-x-2">
                  <div className="mt-1 w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                  <span>Uses Web Audio API for dynamic sound generation</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="mt-1 w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                  <span>Creates harmonic tones (880Hz + 1320Hz)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="mt-1 w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                  <span>No external audio files required</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="mt-1 w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                  <span>User preference saved in localStorage</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Automatic Notifications</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              This sound plays automatically when you receive a mention notification in chat or comments. 
              Try mentioning yourself in a team chat to test it!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}