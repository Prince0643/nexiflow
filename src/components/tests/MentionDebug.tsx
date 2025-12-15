import React, { useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';

const MentionDebug: React.FC = () => {
  const { notifications, unreadCount } = useNotifications();

  useEffect(() => {
    console.log('=== Mention Debug Info ===');
    console.log('Total notifications:', notifications.length);
    console.log('Unread count:', unreadCount);
    console.log('Notifications:', notifications);
    
    // Check for any mention notifications
    const mentionNotifications = notifications.filter(n => n.type === 'mention');
    console.log('Mention notifications:', mentionNotifications);
    
    if (mentionNotifications.length > 0) {
      console.log('Found mention notifications!');
    }
  }, [notifications, unreadCount]);

  return (
    <div className="p-2 bg-yellow-100 border border-yellow-400 rounded text-xs">
      <p>Mention Debug: {notifications.length} total, {unreadCount} unread</p>
      <button 
        onClick={() => {
          console.log('=== Current Notifications ===');
          console.log('Notifications:', notifications);
        }}
        className="mt-1 px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs"
      >
        Log Notifications
      </button>
    </div>
  );
};

export default MentionDebug;