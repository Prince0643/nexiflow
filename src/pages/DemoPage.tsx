import { useState } from 'react'
import NotificationSoundDemo from '../components/demo/NotificationSoundDemo'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Feature Showcase</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Explore the enhanced notification system with custom sound alerts
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <NotificationSoundDemo />
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">About This Feature</h2>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p>
                The notification sound system is a custom implementation that creates pleasant audio alerts 
                for important events like mentions in chat or comments. Unlike typical messaging apps that 
                use generic notification sounds, our system generates a unique harmonic tone using the 
                Web Audio API.
              </p>
              
              <h3 className="text-xl font-semibold mt-6 mb-3">Technical Implementation</h3>
              <p>
                The sound is created by combining two sine wave oscillators:
              </p>
              <ul>
                <li><strong>880Hz</strong> - A5 note (main tone)</li>
                <li><strong>1320Hz</strong> - E6 note (perfect fifth harmonic)</li>
              </ul>
              <p>
                These frequencies create a distinctive "ding" sound that's both pleasant and attention-grabbing 
                without being annoying. The sound has a smooth fade-out effect to prevent abrupt cutoffs.
              </p>
              
              <h3 className="text-xl font-semibold mt-6 mb-3">User Experience</h3>
              <p>
                Users can enable or disable sound notifications through the Settings page. The preference is 
                saved in localStorage and persists between sessions. The sound plays automatically when:
              </p>
              <ul>
                <li>A user is mentioned in a chat message</li>
                <li>A user is mentioned in a comment or note</li>
                <li>New unread mention notifications are detected</li>
              </ul>
              
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Privacy & Performance</h4>
                <p className="text-green-700 dark:text-green-300">
                  Since the sound is generated dynamically in the browser, no external requests are made, 
                  ensuring privacy and fast performance. The implementation is lightweight and doesn't 
                  require downloading audio files.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}