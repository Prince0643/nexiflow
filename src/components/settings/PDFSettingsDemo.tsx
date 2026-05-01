import React, { useEffect, useState } from 'react'
import { PDFSettings } from '../../types'

interface PDFSettingsDemoProps {
  pdfSettings: PDFSettings | null
}

export default function PDFSettingsDemo({ pdfSettings }: PDFSettingsDemoProps) {
  const [logoFailed, setLogoFailed] = useState(false)

  // Default values if no settings are provided
  const settings = pdfSettings || {
    companyName: '',
    logoUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    showPoweredBy: true,
    customFooterText: ''
  }

  useEffect(() => {
    setLogoFailed(false)
  }, [settings.logoUrl])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">PDF Preview</h3>
      
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* PDF Header Preview */}
        <div 
          className="p-4"
          style={{ backgroundColor: settings.primaryColor }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {settings.companyName || 'NexiFlow'}
              </h2>
              <p className="text-white text-opacity-80 text-sm">Time Tracking Report</p>
            </div>
            {settings.logoUrl && !logoFailed ? (
              <div className="bg-white rounded p-1 shrink-0">
                <img
                  src={settings.logoUrl}
                  alt="Company logo"
                  className="w-10 h-10 object-contain"
                  onError={() => setLogoFailed(true)}
                />
              </div>
            ) : settings.logoUrl ? (
              <div className="bg-white rounded p-1 shrink-0">
                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
              </div>
            ) : null}
          </div>
        </div>
        
        {/* PDF Content Preview */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Report Period: This Week</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Generated on: {new Date().toLocaleDateString()}</p>
          </div>
          
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">Summary</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Time</p>
                <p className="font-semibold">42:30:00</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Billable Amount</p>
                <p className="font-semibold text-green-600">$1,275.00</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Clients</p>
                <p className="font-semibold">8</p>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">Time Tracking by Client</h4>
            <div className="h-48 bg-gray-50 dark:bg-gray-700 rounded flex items-end justify-center p-4">
              <div className="flex items-end space-x-2 h-full">
                <div 
                  className="w-8 rounded-t"
                  style={{ backgroundColor: settings.secondaryColor, height: '70%' }}
                ></div>
                <div 
                  className="w-8 rounded-t"
                  style={{ backgroundColor: settings.primaryColor, height: '45%' }}
                ></div>
                <div 
                  className="w-8 rounded-t"
                  style={{ backgroundColor: settings.secondaryColor, height: '90%' }}
                ></div>
                <div 
                  className="w-8 rounded-t"
                  style={{ backgroundColor: settings.primaryColor, height: '60%' }}
                ></div>
                <div 
                  className="w-8 rounded-t"
                  style={{ height: '70%' }}
                ></div>
                <div
                  className="w-8 rounded-t"
                  style={{ backgroundColor: settings.secondaryColor, height: '30%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* PDF Footer Preview */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {settings.customFooterText ? (
              <div>{settings.customFooterText}</div>
            ) : null}
            <div>Generated by NexiFlow Powered by Nexistry Digital Solutions</div>
            {settings.showPoweredBy ? (
              <div className="text-gray-400 dark:text-gray-500">Powered by Nexistry Digital Solutions</div>
            ) : null}
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>This is a preview of how your PDF exports will look with the current settings.</p>
      </div>
    </div>
  )
}
