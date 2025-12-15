import React, { useEffect, useState } from 'react';
import { useMySQLAuth } from '../../contexts/MySQLAuthContext';
import { MentionNotificationService } from '../../services/mentionNotificationService';

const FirebaseNotificationTest: React.FC = () => {
  const { currentUser } = useMySQLAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    console.log('=== FirebaseNotificationTest: Setting up subscription ===');
    console.log('Current user ID:', currentUser.uid);

    const unsubscribe = MentionNotificationService.subscribeToNotifications(
      currentUser.uid,
      (firebaseNotifications) => {
        console.log('=== FirebaseNotificationTest: Received notifications ===');
        console.log('Firebase notifications:', firebaseNotifications);
        setNotifications(firebaseNotifications);
        setLoading(false);
      }
    );

    return () => {
      console.log('=== FirebaseNotificationTest: Cleaning up subscription ===');
      unsubscribe();
    };
  }, [currentUser]);

  if (!currentUser) {
    return <div className="p-4 bg-red-100 text-red-800">Not logged in</div>;
  }

  return (
    <div className="p-4 bg-blue-100 text-blue-800">
      <h3>Firebase Notification Test</h3>
      <p>User ID: {currentUser.uid}</p>
      {loading ? (
        <p>Loading notifications...</p>
      ) : (
        <div>
          <p>Notification count: {notifications.length}</p>
          {notifications.map((notification) => (
            <div key={notification.id} className="border p-2 mb-2">
              <p>ID: {notification.id}</p>
              <p>Title: {notification.title}</p>
              <p>Message: {notification.message}</p>
              <p>Mentioned User ID: {notification.mentionedUserId}</p>
              <p>Is Read: {notification.isRead ? 'Yes' : 'No'}</p>
              <p>Created At: {notification.createdAt?.toString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FirebaseNotificationTest;