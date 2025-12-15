import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { projectService } from '../services/projectService'
import { Client } from '../types'
import ClientModal from '../components/projects/ClientModal'

export default function EditClient() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadClient()
  }, [clientId])

  const loadClient = async () => {
    if (!clientId) return

    setLoading(true)
    try {
      const clientData = await projectService.getClientById(clientId)
      if (clientData) {
        setClient(clientData)
      } else {
        setError('Client not found')
      }
    } catch (error) {
      console.error('Error loading client:', error)
      setError('Failed to load client')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    navigate('/clients')
  }

  const handleClose = () => {
    navigate('/clients')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => navigate('/clients')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Clients
          </button>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-900 dark:text-gray-100">Client not found</p>
          <button
            onClick={() => navigate('/clients')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Clients
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ClientModal
        isOpen={true}
        onClose={handleClose}
        client={client}
        onSuccess={handleSuccess}
      />
    </div>
  )
}