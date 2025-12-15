import { useState, useEffect } from 'react'
import { X, Users, Palette, User, Crown, Trash2, UserPlus } from 'lucide-react'
import { Team, CreateTeamData, UpdateTeamData, TeamMember } from '../../types'
import { teamService } from '../../services/teamService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

interface TeamModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  team?: Team | null
  onAddMember?: (team: Team) => void
  onEditMember?: (team: Team, member: TeamMember) => void
}

const TEAM_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
]

export default function TeamModal({ isOpen, onClose, onSuccess, team, onAddMember, onEditMember }: TeamModalProps) {
  const { currentUser } = useMySQLAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  })
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (team?.id && currentUser?.uid) {
      checkTeamLeadership();
    } else {
      setIsLeader(false);
    }
  }, [team?.id, currentUser?.uid]);

  const checkTeamLeadership = async () => {
    if (!team?.id || !currentUser?.uid) {
      setIsLeader(false);
      return;
    }
    
    const isTeamLeader = await teamService.isUserTeamLeader(currentUser.uid, team.id);
    setIsLeader(isTeamLeader);
  };

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name,
        description: team.description || '',
        color: team.color
      })
      if (isOpen) {
        loadTeamMembers()
      }
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6'
      })
      setTeamMembers([])
    }
    setError('')
  }, [team, isOpen])

  const loadTeamMembers = async () => {
    if (!team?.id) return
    
    setLoadingMembers(true)
    try {
      const members = await teamService.getTeamMembers(team.id)
      setTeamMembers(members)
    } catch (error) {
      console.error('Error loading team members:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    if (!team?.id) return
    
    if (window.confirm(`Are you sure you want to remove "${member.userName}" from the team?`)) {
      try {
        await teamService.removeTeamMember(team.id, member.userId)
        loadTeamMembers() // Reload members after removal
        onSuccess() // Refresh the parent component
      } catch (error) {
        setError('Failed to remove team member')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Team name is required')
      return
    }

    if (!currentUser) {
      setError('User not authenticated')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (team) {
        // Update existing team
        const updateData: UpdateTeamData = {
          name: formData.name.trim(),
          color: formData.color
        }
        
        // Only include description if it's not empty, otherwise explicitly set to null to remove it
        if (formData.description.trim()) {
          updateData.description = formData.description.trim()
        } else if (team.description) {
          // Only set to null if there was a previous description to remove
          updateData.description = null
        }
        
        await teamService.updateTeam(team.id, updateData)
      } else {
        // Create new team
        const createData: CreateTeamData = {
          name: formData.name.trim(),
          leaderId: currentUser.uid,
          color: formData.color
        }
        
        // Only include description if it's not empty
        if (formData.description.trim()) {
          createData.description = formData.description.trim()
        }
        
        await teamService.createTeam(
          createData, 
          currentUser.uid, 
          currentUser.name || 'Unknown User',
          currentUser.email || '',
          currentUser.companyId
        )
      }
      
      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to save team')
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
              <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {team ? 'Edit Team' : 'Create Team'}
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

          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter team name"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter team description (optional)"
              rows={3}
            />
          </div>

          {/* Team Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team Color
            </label>
            <div className="flex items-center space-x-3">
              <div
                className="w-8 h-8 rounded-lg border-2 border-gray-300"
                style={{ backgroundColor: formData.color }}
              />
              <div className="flex space-x-2">
                {TEAM_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-6 h-6 rounded border-2 ${
                      formData.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Team Leader Info */}
          {!team && currentUser && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-800 rounded-lg">
                  <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Team Leader</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{currentUser.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Team Members - Only show when editing existing team */}
          {team && isLeader && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Team Members
                </label>
                {onAddMember && (
                  <button
                    type="button"
                    onClick={() => onAddMember(team)}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center space-x-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Add Member</span>
                  </button>
                )}
              </div>
              
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                {loadingMembers ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading members...</p>
                  </div>
                ) : teamMembers.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {teamMembers.map((member, index) => (
                      <div key={member.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-800 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-300">
                              {member.userName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                              <span>{member.userName}</span>
                              {member.teamRole === 'leader' && (
                                <Crown className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                              )}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.userEmail}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{member.teamRole}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {onEditMember && (
                            <button
                              type="button"
                              onClick={() => onEditMember(team, member)}
                              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                              title="Edit member role"
                            >
                              <User className="h-4 w-4" />
                            </button>
                          )}
                          {member.teamRole !== 'leader' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="p-1 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 rounded"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">No team members yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
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
              {loading ? 'Saving...' : (team ? 'Update Team' : 'Create Team')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}