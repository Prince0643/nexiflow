import { useState, useEffect } from 'react'
import { X, UserPlus, User, Crown, UserCheck } from 'lucide-react'
import { TeamMember, AddTeamMemberData, TeamRole, User as UserType } from '../../types'
import { teamService } from '../../services/teamService'
import { userService } from '../../services/userService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

interface TeamMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  teamId: string
  member?: TeamMember | null
}

export default function TeamMemberModal({ isOpen, onClose, onSuccess, teamId, member }: TeamMemberModalProps) {
  const { currentUser } = useMySQLAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserType[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [formData, setFormData] = useState({
    userId: '',
    role: 'member' as TeamRole
  })

  useEffect(() => {
    if (member) {
      setFormData({
        userId: member.userId,
        role: member.teamRole
      })
    } else {
      setFormData({
        userId: '',
        role: 'member'
      })
    }
    setError('')
  }, [member, isOpen])

  // Load users when modal opens
  useEffect(() => {
    if (isOpen && !member) {
      loadUsers()
    }
  }, [isOpen, member])

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      // Pass company ID to ensure only users from the same company are shown
      const availableUsers = await userService.getUsersNotInTeam(teamId, currentUser?.companyId)
      setUsers(availableUsers)
    } catch (error) {
      console.error('Error loading users:', error)
      setError('Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.userId) {
      setError('Please select a user')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (member) {
        // Update existing member role
        await teamService.updateTeamMemberRole(teamId, member.userId, formData.role)
      } else {
        // Add new member
        const selectedUser = users.find(user => user.id === formData.userId)
        
        if (!selectedUser) {
          setError('Selected user not found')
          return
        }

        const addData: AddTeamMemberData = {
          userId: formData.userId,
          role: formData.role
        }
        await teamService.addTeamMember(teamId, addData, selectedUser.name, selectedUser.email)
      }
      
      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to save team member')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-800 rounded-lg">
              <UserPlus className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {member ? 'Edit Team Member' : 'Add Team Member'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.userId}
              onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              disabled={!!member || loadingUsers} // Can't change user for existing members or while loading
            >
              <option key="placeholder" value="">
                {loadingUsers ? 'Loading users...' : 'Select a user'}
              </option>
              {users.length === 0 && !loadingUsers ? (
                <option key="no-users" value="" disabled>
                  No available users to add
                </option>
              ) : (
                users.map((user) => (
                  <option key={`user-${user.id}`} value={user.id}>
                    {user.name} ({user.email}) - {user.role}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  name="role"
                  value="member"
                  checked={formData.role === 'member'}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as TeamRole }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                />
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Member</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Can view and manage their own tasks</p>
                  </div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  name="role"
                  value="leader"
                  checked={formData.role === 'leader'}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as TeamRole }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                />
                <div className="flex items-center space-x-2">
                  <Crown className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Leader</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Can manage team members and view team overview</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : (member ? 'Update Member' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
