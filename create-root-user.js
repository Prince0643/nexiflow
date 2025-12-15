const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, set } = require('firebase/database');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://your-project-default-rtdb.firebaseio.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-messaging-sender-id",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

async function createRootUser() {
  try {
    console.log('Creating root user account...');
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      'assist@nexistrydigitalsolutions.com',
      'Assist123@'
    );
    
    const user = userCredential.user;
    console.log('✅ Firebase Auth user created:', user.uid);
    
    // Create user profile in Realtime Database
    const userProfile = {
      uid: user.uid,
      name: 'Nexistry Digital Solutions',
      email: 'assist@nexistrydigitalsolutions.com',
      role: 'root',
      companyId: null, // Root doesn't belong to any company
      teamId: null,
      teamRole: null,
      timezone: 'America/New_York',
      hourlyRate: 0, // Root doesn't have hourly rate
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await set(ref(database, `users/${user.uid}`), userProfile);
    console.log('✅ Root user profile created in database');
    
    console.log('🎉 Root user account created successfully!');
    console.log('Email: assist@nexistrydigitalsolutions.com');
    console.log('Password: Assist123@');
    console.log('Role: root');
    console.log('UID:', user.uid);
    
  } catch (error) {
    console.error('❌ Error creating root user:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️  User already exists. Updating to root role...');
      
      // If user exists, we need to update their role to root
      // This would require admin SDK, but for now we'll just show the message
      console.log('Please manually update the user role to "root" in Firebase Console');
    }
  }
}

// Run the script
createRootUser().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
