import { useState } from 'react'
import { Bell, Play, Volume2, VolumeX } from 'lucide-react'
import { playNotificationSound } from '../utils/soundUtils'
import NotificationSoundTest from '../components/tests/NotificationSoundTest'

export default function TestNotifications() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Notification System Test</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the custom sound notifications for mentions and other alerts
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <NotificationSoundTest />
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">About Notification Sounds</h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Our custom sound notification system uses the Web Audio API to generate a pleasant "ding" sound 
                when you receive mentions or other important notifications.
              </p>
              <p>
                The sound is created with two oscillators playing in harmony:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>880Hz sine wave (A5 note)</li>
                <li>1320Hz sine wave (E6 note, a perfect fifth above)</li>
              </ul>
              <p>
                This creates a distinctive and pleasant sound that's different from typical messaging apps.
              </p>
              
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Settings</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  You can enable or disable sound notifications in the Settings page under the Notifications tab.
                </p>
              </div>
              
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">How It Works</h3>
                <ul className="text-sm text-green-700 dark:text-green-300 list-disc list-inside space-y-1 ml-4">
                  <li>Sound plays automatically when you receive a mention notification</li>
                  <li>Sound also plays when new unread mentions are detected</li>
                  <li>User preference is saved in localStorage</li>
                  <li>Works across all browsers that support Web Audio API</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Technical Details</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              The notification sound system is implemented using the Web Audio API, which provides powerful 
              audio processing capabilities directly in the browser. Here's how it works:
            </p>
            <ol>
              <li>
                <strong>Audio Context Creation:</strong> An AudioContext is created to manage audio operations
              </li>
              <li>
                <strong>Oscillator Setup:</strong> Two oscillators are created to generate sine waves at 880Hz and 1320Hz
              </li>
              <li>
                <strong>Gain Control:</strong> Gain nodes control the volume and create a smooth fade-out effect
              </li>
              <li>
                <strong>Harmonic Combination:</strong> The two tones play together to create a pleasant harmonic sound
              </li>
              <li>
                <strong>User Preferences:</strong> Sound settings are stored in localStorage for persistence
              </li>
            </ol>
            <p>
              This approach ensures that the sound is generated dynamically without requiring external audio files,
              making it lightweight and customizable.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}