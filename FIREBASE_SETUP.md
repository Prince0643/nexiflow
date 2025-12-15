# Firebase Setup Guide for Clockistry

This guide will help you set up Firebase Authentication and Realtime Database for Clockistry.

## 🔥 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Enter your project name (e.g., "clockistry-app")
4. Enable Google Analytics (optional)
5. Click "Create project"

## 🔐 Step 2: Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

## 🗄️ Step 3: Create Realtime Database

1. Go to "Realtime Database" in the left sidebar
2. Click "Create database"
3. Choose a location (select the closest to your users)
4. Start in "test mode" for development (we'll secure it later)
5. Click "Done"

## ⚙️ Step 4: Get Configuration

1. Go to "Project settings" (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select web app
4. Register your app with a nickname
5. Copy the configuration object

## 🔧 Step 5: Update Firebase Config

1. Open `src/config/firebase.ts`
2. Replace the placeholder values with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com"
}
```

## 🔒 Step 6: Database Security Rules

Update your Realtime Database rules in the Firebase Console:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'"
      },
      ".read": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "projects": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "tasks": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "timeEntries": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["userId", "projectId", "startTime"]
    },
    "clients": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "tags": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    }
  }
}
```

## 🚀 Step 7: Test the Setup

1. Start your development server: `npm run dev`
2. Navigate to the app
3. Try creating a new account
4. Test login functionality
5. Verify user data is stored in Firebase

## 📱 User Roles

The system supports two user roles:

- **Employee**: Can track time, view projects, and manage their own entries
- **Admin**: Can manage projects, tasks, users, and view all data

### Admin Access Control:
- Admins can read and write all user data
- Admins can access the Admin Dashboard to monitor team activity
- Regular users can only access their own user data

## 🔍 Troubleshooting

### Common Issues:

1. **Authentication not working**: Check if Email/Password is enabled in Firebase
2. **Database access denied**: Verify your security rules and update them in Firebase Console
3. **Admin Dashboard access denied**: Ensure admin users have proper permissions in Firebase rules
4. **CORS errors**: Ensure your domain is added to authorized domains in Firebase
5. **Index errors**: Make sure `.indexOn` is properly configured in database rules

### Debug Mode:

Enable debug logging by adding this to your browser console:
```javascript
localStorage.setItem('debug', 'firebase:*')
```

## 📚 Next Steps

After setting up Firebase:

1. **User Management**: Add admin-only user management features
2. **Data Migration**: Move from mock data to Firebase
3. **Real-time Updates**: Implement live data synchronization
4. **Offline Support**: Add offline capabilities with Firebase
5. **Advanced Security**: Implement more granular access controls

## 🆘 Support

If you encounter issues:

1. Check Firebase Console for error logs
2. Verify your configuration values
3. Test with Firebase's built-in testing tools
4. Check the Firebase documentation for your specific use case

---

**Happy coding! 🎉**
