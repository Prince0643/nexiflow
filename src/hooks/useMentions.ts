import { useState, useCallback } from 'react'
import { User as UserType, Mention } from '../types'

export const useMentions = (currentUser: any, task: any) => {
  const [mentionSuggestions, setMentionSuggestions] = useState<UserType[]>([])
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionInput, setMentionInput] = useState('')
  const [mentionTarget, setMentionTarget] = useState<'comment' | 'note' | null>(null)

  // Load mentionable users (assigned user + project managers)
  // Regular employees can now mention project managers when assigned to a task
  const loadMentionableUsers = useCallback(async () => {
    if (!task || !currentUser) return []
    
    try {
      // Import teamService dynamically to avoid circular dependencies
      const { teamService } = await import('../services/teamService')
      
      // Use the team service method which handles permissions correctly
      // Note: currentUser has a uid property, not an id property
      const mentionableUsersData = await teamService.getTaskMentionableUsers(
        currentUser.uid,
        task.assigneeId,
        currentUser.companyId
      )
      
      // Convert to UserType format
      const mentionableUsers: UserType[] = mentionableUsersData.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: 'GMT+0 (Greenwich Mean Time)', // Default timezone
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      return mentionableUsers
    } catch (error) {
      console.error('Error loading mentionable users:', error)
      return []
    }
  }, [currentUser, task])

  // Handle mention input
  const handleMentionInput = useCallback(async (value: string, target: 'comment' | 'note', setTextInput: (text: string) => void) => {
    setTextInput(value)
    
    // Check for @ trigger
    const lastAtPos = value.lastIndexOf('@')
    const lastSpacePos = value.lastIndexOf(' ', lastAtPos)
    
    if (lastAtPos !== -1 && (lastSpacePos === -1 || lastSpacePos < lastAtPos)) {
      const query = value.substring(lastAtPos + 1)
      setMentionInput(query)
      setMentionTarget(target)
      
      if (query.length >= 1) {
        const mentionableUsers = await loadMentionableUsers()
        const filteredUsers = mentionableUsers.filter(user => 
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase())
        )
        setMentionSuggestions(filteredUsers)
        setShowMentionSuggestions(true)
      } else {
        setMentionSuggestions([])
        setShowMentionSuggestions(false)
      }
    } else {
      setShowMentionSuggestions(false)
    }
  }, [loadMentionableUsers])

  // Insert mention
  const insertMention = useCallback((user: UserType, target: 'comment' | 'note', 
    textInput: string, setTextInput: (text: string) => void,
    mentions: Mention[], setMentions: (mentions: Mention[]) => void) => {
    
    const lastAtPos = textInput.lastIndexOf('@')
    
    if (lastAtPos !== -1) {
      const beforeMention = textInput.substring(0, lastAtPos)
      const afterMention = textInput.substring(lastAtPos + mentionInput.length + 1)
      const mentionText = `@${user.name}`
      const newValue = `${beforeMention}${mentionText} ${afterMention}`
      
      setTextInput(newValue)
      
      // Add to mentions array
      const mention: Mention = {
        id: Date.now().toString(),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        startIndex: lastAtPos,
        endIndex: lastAtPos + mentionText.length
      }
      
      setMentions([...mentions, mention])
    }
    
    setShowMentionSuggestions(false)
    setMentionInput('')
    setMentionTarget(null)
  }, [mentionInput])

  // Remove mention
  const removeMention = useCallback((mentionId: string, 
    mentions: Mention[], setMentions: (mentions: Mention[]) => void) => {
    setMentions(mentions.filter(m => m.id !== mentionId))
  }, [])

  // Clear all mentions
  const clearMentions = useCallback((setMentions: (mentions: Mention[]) => void) => {
    setMentions([])
  }, [])

  return {
    // States
    mentionSuggestions,
    showMentionSuggestions,
    mentionInput,
    mentionTarget,
    
    // Functions
    loadMentionableUsers,
    handleMentionInput,
    insertMention,
    removeMention,
    clearMentions,
    setShowMentionSuggestions,
    setMentionInput,
    setMentionTarget
  }
}