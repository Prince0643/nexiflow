import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { X, User, Calendar, Clock, CheckCircle2, MessageSquare, Send, StickyNote, Paperclip, Smile, Trash2, Building2, AtSign, XCircle, Save } from 'lucide-react'
import { Task, TaskStatus, TaskPriority, TaskComment, Team, User as UserType, Mention } from '../../types'
import { taskApiService as taskService } from '../../services/taskApiService'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { canDeleteTask } from '../../utils/permissions'
import { useMentions } from '../../hooks/useMentions'
import MentionNotificationService from '../../services/mentionNotificationService'

interface TaskViewModalProps {
  isOpen: boolean
  onClose: () => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  task: Task | null
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  teams?: Team[]
  defaultActiveTab?: 'comments' | 'notes'
  onTaskUpdate?: (task: Task) => void
}

const PRIORITY_ICONS = {
  low: '○',
  medium: '▶',
  high: '⚠',
  urgent: '🚩'
}

const PRIORITY_COLORS = {
  low: 'text-gray-500 dark:text-gray-400',
  medium: 'text-blue-500 dark:text-blue-400',
  high: 'text-orange-500 dark:text-orange-400',
  urgent: 'text-red-500 dark:text-red-400'
}

export default function TaskViewModal({ 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  task, 
  statuses, 
  priorities,
  teams = [],
  defaultActiveTab = 'comments',
  onTaskUpdate
}: TaskViewModalProps) {
  const { currentUser } = useMySQLAuth()
  const { addNotification } = useNotifications()
  const [description, setDescription] = useState('')
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [newCommentMentions, setNewCommentMentions] = useState<Mention[]>([])
  const [notes, setNotes] = useState('')
  const [notesMentions, setNotesMentions] = useState<Mention[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'notes'>(defaultActiveTab)
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const notesInputRef = useRef<HTMLTextAreaElement>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Use the mentions hook
  const {
    mentionSuggestions,
    showMentionSuggestions,
    mentionInput,
    mentionTarget,
    loadMentionableUsers,
    handleMentionInput: handleMentionInputHook,
    insertMention: insertMentionHook,
    removeMention: removeMentionHook,
    clearMentions: clearMentionsHook,
    setShowMentionSuggestions,
    setMentionInput,
    setMentionTarget
  } = useMentions(currentUser, task)

  // Update activeTab when defaultActiveTab changes
  useEffect(() => {
    setActiveTab(defaultActiveTab)
  }, [defaultActiveTab])

  // Set initial state when task changes
  useEffect(() => {
    if (task) {
      setDescription(task.description || '')
      setComments(task.comments || [])
      setNotes(task.notes || '')
    }
  }, [task])

  // Set up polling for task updates
  useEffect(() => {
    // Clean up previous polling interval if it exists
    if (unsubscribeRef.current) {
      clearInterval(unsubscribeRef.current);
      unsubscribeRef.current = null;
    }
    
    if (task && isOpen && task.id) {
      // Set up polling interval for task updates
      const pollInterval = setInterval(async () => {
        try {
          // Fetch updated task data from API
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
          const response = await fetch(`${baseUrl}/api/tasks?projectId=${task.projectId}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const updatedTask = data.data.find((t: Task) => t.id === task.id);
              
              if (updatedTask) {
                // Update local state with polled data
                if (updatedTask.description !== undefined) {
                  setDescription(updatedTask.description || '');
                }
                
                if (updatedTask.comments !== undefined) {
                  // Only update comments if they've actually changed
                  setComments(prevComments => {
                    const newCommentsString = JSON.stringify(updatedTask.comments);
                    const prevCommentsString = JSON.stringify(prevComments);
                    if (newCommentsString !== prevCommentsString) {
                      return updatedTask.comments;
                    }
                    return prevComments;
                  });
                }
                
                if (updatedTask.notes !== undefined) {
                  // Only update notes if they've actually changed
                  setNotes(prevNotes => {
                    if (prevNotes !== updatedTask.notes) {
                      return updatedTask.notes || '';
                    }
                    return prevNotes;
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('Error polling task updates:', error);
        }
      }, 5000); // Poll every 5 seconds

      // Store interval ID
      unsubscribeRef.current = pollInterval;
    }
    
    // Cleanup polling interval on unmount
    return () => {
      if (unsubscribeRef.current) {
        clearInterval(unsubscribeRef.current);
        unsubscribeRef.current = null;
      }
    };
  }, [task?.id, isOpen, task?.projectId])

  // Auto-scroll to bottom of comments when new comment is added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Handle mention input for comments and notes
  const handleMentionInput = useCallback((value: string, target: 'comment' | 'note') => {
    handleMentionInputHook(value, target, target === 'comment' ? setNewComment : setNotes)
  }, [handleMentionInputHook])

  // Insert mention for comments and notes
  const insertMention = useCallback((user: UserType, target: 'comment' | 'note') => {
    if (target === 'comment') {
      insertMentionHook(user, target, newComment, setNewComment, newCommentMentions, setNewCommentMentions)
    } else {
      insertMentionHook(user, target, notes, setNotes, notesMentions, setNotesMentions)
    }
  }, [insertMentionHook, newComment, notes, newCommentMentions, notesMentions])

  // Remove mention for comments and notes
  const removeMention = useCallback((mentionId: string, target: 'comment' | 'note') => {
    if (target === 'comment') {
      removeMentionHook(mentionId, newCommentMentions, setNewCommentMentions)
    } else {
      removeMentionHook(mentionId, notesMentions, setNotesMentions)
    }
  }, [removeMentionHook, newCommentMentions, notesMentions])

  // Clear mentions for comments and notes
  const clearMentions = useCallback((target: 'comment' | 'note') => {
    if (target === 'comment') {
      clearMentionsHook(setNewCommentMentions)
    } else {
      clearMentionsHook(setNotesMentions)
    }
  }, [clearMentionsHook])

  // Send mention notifications to mentioned users
  const sendMentionNotifications = async (mentions: Mention[], contextType: 'comment' | 'note') => {
    if (!task || !currentUser) return;
    
    for (const mention of mentions) {
      try {
        // Skip notifying the current user (don't notify yourself)
        if (mention.userId === currentUser.uid) continue;
        
        // Create a more descriptive context title
        const contextTitle = task.title || 'Untitled Task';
        
        // Send notification to the mentioned user (not the current user)
        await MentionNotificationService.sendNotificationToUser(
          mention.userId,
          {
            type: 'mention',
            title: 'You were mentioned',
            message: `${currentUser.name} mentioned you in a ${contextType} on task: ${contextTitle}`,
            mentionedBy: currentUser.name || 'Someone',
            mentionedByName: currentUser.name || 'Someone',
            contextType: contextType,
            contextId: task.id,
            contextTitle: contextTitle,
            projectId: task.projectId,
            taskId: task.id,
            // Enhanced action URL with query parameters for tab and content type
            actionUrl: `/management?taskId=${task.id}&tab=${contextType === 'comment' ? 'comments' : 'notes'}&mentionId=${mention.id}`
          }
        );
      } catch (error) {
        console.error('Error sending mention notification:', error);
      }
    }
  };

  const handleDescriptionUpdate = async () => {
    if (!task || !currentUser) return
    
    setIsUpdating(true)
    try {
      await taskService.updateTask(task.id, { description })
    } catch (error) {
      console.error('Error updating description:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleNotesUpdate = async () => {
    if (!task || !currentUser) return;
    
    setIsUpdating(true);
    try {
      // Send mention notifications for notes to mentioned users
      await sendMentionNotifications(notesMentions, 'note');
      
      // Clear mentions when saving notes
      clearMentions('note');
      
      // Update task with new notes
      await taskService.updateTask(task.id, { notes });
      
      // Update local state to reflect the saved notes
      if (onTaskUpdate && task) {
        onTaskUpdate({ ...task, notes });
      }
    } catch (error) {
      console.error('Error updating notes:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || !currentUser || !newComment.trim()) return
    
    const comment: TaskComment = {
      id: Date.now().toString(),
      content: newComment.trim(),
      authorId: currentUser.uid,
      authorName: currentUser.name || 'Unknown User',
      authorEmail: currentUser.email || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      mentions: newCommentMentions.map(m => m.userId) // Store user IDs for mentions
    }

    try {
      // Send mention notifications for comments to mentioned users
      await sendMentionNotifications(newCommentMentions, 'comment');
      
      // Add comment to local state immediately for better UX
      setComments(prev => [...prev, comment])
      setNewComment('')
      clearMentions('comment')
      
      // Update task with new comment
      await taskService.updateTask(task.id, { 
        comments: [...comments, comment]
      } as any)
    } catch (error) {
      console.error('Error adding comment:', error)
      // Revert on error
      setComments(prev => prev.filter(c => c.id !== comment.id))
    }
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPriorityIcon = (priority: TaskPriority) => {
    if (!priority || !priority.name) return '○';
    return PRIORITY_ICONS[priority.name.toLowerCase() as keyof typeof PRIORITY_ICONS] || '○'
  }

  const getPriorityColor = (priority: TaskPriority) => {
    if (!priority || !priority.name) return 'text-gray-500';
    return PRIORITY_COLORS[priority.name.toLowerCase() as keyof typeof PRIORITY_COLORS] || 'text-gray-500'
  }

  if (!isOpen || !task) return null

  // Safety check for required task properties
  if (!task.priority || !task.status) return null

  const priority = task.priority || { name: 'Unknown', color: '#6B7280' }
  const status = task.status || { name: 'Unknown', color: '#6B7280' }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: priority?.color || '#6B7280' }}
            />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {task.title}
            </h2>
            <span 
              className="px-2 py-1 text-xs rounded-full text-white"
              style={{ backgroundColor: status?.color || '#6B7280' }}
            >
              {status?.name || 'Unknown Status'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(task)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
            {currentUser && canDeleteTask(currentUser.role, task.createdBy, currentUser.uid) && (
              <button
                onClick={() => onDelete(task.id)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Task Details */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                {/* Priority */}
                <div className="flex items-center space-x-2">
                  <span className={`text-lg ${getPriorityColor(priority)}`}>
                    {getPriorityIcon(priority)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {priority?.name || 'Unknown Priority'} priority
                  </span>
                </div>

                {/* Project */}
                {task.projectName && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {task.projectName}
                    </span>
                  </div>
                )}

                {/* Creator */}
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Created by {task.createdByName || 'Unknown'}
                  </span>
                </div>

                {/* Assignee */}
                {task.assigneeName && (
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Assigned to {task.assigneeName}
                    </span>
                  </div>
                )}

                {/* Due Date */}
                {task.dueDate && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Due {formatDate(task.dueDate)}
                    </span>
                  </div>
                )}

                {/* Estimated Hours */}
                {task.estimatedHours && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {task.estimatedHours}h estimated
                    </span>
                  </div>
                )}

                {/* Actual Hours */}
                {task.actualHours && task.actualHours > 0 && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {task.actualHours}h logged
                    </span>
                  </div>
                )}

                {/* Team */}
                {task.teamId && (
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Team: {teams.find(t => t.id === task.teamId)?.name || task.teamId}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column - Description & Chat */}
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <div className="space-y-2">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={handleDescriptionUpdate}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      rows={3}
                      placeholder="Add a description..."
                    />
                    {isUpdating && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Updating...</p>
                    )}
                  </div>
                </div>

                {/* Chat Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setActiveTab('comments')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === 'comments'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Comments ({comments.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('notes')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === 'notes'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <StickyNote className="h-4 w-4" />
                      <span>Notes</span>
                    </button>
                  </nav>
                </div>

                {/* Chat Content */}
                <div className="h-80 flex flex-col">
                  {activeTab === 'comments' ? (
                    <>
                      {/* Comments List - Chat Style */}
                      <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {comments.length === 0 ? (
                          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No comments yet. Start the conversation!</p>
                          </div>
                        ) : (
                          comments.map((comment) => (
                            <div key={comment.id} className="flex space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                  {comment.authorName.charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {comment.authorName}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDateTime(comment.createdAt)}
                                  </span>
                                </div>
                                <div className="bg-white dark:bg-gray-700 rounded-lg px-3 py-2 shadow-sm">
                                  <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {comment.content}
                                  </span>
                                </div>
                                {/* Display mentions */}
                                {comment.mentions && comment.mentions.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {comment.mentions.map((userId, index) => (
                                      <span key={`mention-${comment.id}-${userId}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                        <AtSign className="h-3 w-3 mr-1" />
                                        {userId}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={commentsEndRef} />
                      </div>

                      {/* Add Comment - Chat Input with Mentions */}
                      <div className="mt-3 flex space-x-2 relative">
                        <div className="flex-1">
                          <textarea
                            ref={commentInputRef}
                            value={newComment}
                            onChange={(e) => handleMentionInput(e.target.value, 'comment')}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !showMentionSuggestions) {
                                e.preventDefault()
                                handleAddComment()
                              }
                            }}
                            placeholder="Type a message"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                            rows={1}
                          />
                          {/* Mention Suggestions */}
                          {showMentionSuggestions && mentionTarget === 'comment' && (
                            <div className="absolute bottom-full mb-2 left-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                              {mentionSuggestions.map((user) => (
                                <div
                                  key={`comment-${user.id}`} 
                                  onClick={() => insertMention(user, 'comment')}
                                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                                >
                                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium mr-2">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          className="px-4 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Display selected mentions for comments */}
                      {newCommentMentions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {newCommentMentions.map((mention) => (
                            <div key={`comment-mention-${mention.id}`} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                              <AtSign className="h-4 w-4 mr-1" />
                              {mention.userName}
                              <button 
                                onClick={() => removeMention(mention.id, 'comment')}
                                className="ml-2 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Notes Section with Mentions */}
                      <div className="flex-1 relative">
                        <div className="h-full">
                          <textarea
                            ref={notesInputRef}
                            value={notes}
                            onChange={(e) => handleMentionInput(e.target.value, 'note')}
                            placeholder="Add collaborative notes here... Use @ to mention users"
                            className="w-full h-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                            rows={12}
                          />
                          {/* Mention Suggestions */}
                          {showMentionSuggestions && mentionTarget === 'note' && (
                            <div className="absolute bottom-full mb-2 left-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                              {mentionSuggestions.map((user) => (
                                <div
                                  key={`note-${user.id}`}
                                  onClick={() => insertMention(user, 'note')}
                                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                                >
                                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium mr-2">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Save Notes Button */}
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={handleNotesUpdate}
                            disabled={isUpdating}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                          >
                            <Save className="h-4 w-4" />
                            <span>Save Note</span>
                          </button>
                        </div>
                        {isUpdating && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Saving notes...</p>
                        )}
                      </div>
                      {/* Display selected mentions for notes */}
                      {notesMentions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {notesMentions.map((mention) => (
                            <div key={`note-mention-${mention.id}`} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                              <AtSign className="h-4 w-4 mr-1" />
                              {mention.userName}
                              <button 
                                onClick={() => removeMention(mention.id, 'note')}
                                className="ml-2 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}