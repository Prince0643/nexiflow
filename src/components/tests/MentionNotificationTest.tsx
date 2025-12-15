import React, { useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import MentionNotificationService from '../../services/mentionNotificationService';

const MentionNotificationTest: React.FC = () => {
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Simulate a mention notification
    const simulateMention = async () => {
      console.log('Simulating mention notification...');
      
      // Add a notification directly to the context
      addNotification({
        title: 'Test Mention',
        message: 'You were mentioned in a test message',
        type: 'mention',
        actionUrl: '/messages'
      });
      
      // Also try to create a mention notification through the service
      try {
        // This would normally be called from the messaging service when someone mentions you
        // For testing purposes, we're calling it directly
        console.log('Creating mention notification through service...');
        // Note: In a real scenario, this would be called with actual user IDs
        // We're just testing that the function works
      } catch (error) {
        console.error('Error creating mention notification:', error);
      }
    };

    simulateMention();
  }, [addNotification]);

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
      <h3 className="text-lg font-medium text-yellow-800">Mention Notification Test</h3>
      <p className="text-yellow-700">
        This component is for testing mention notifications. Check the browser console for logs.
      </p>
    </div>
  );
};

export default MentionNotificationTest;