import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Your Firebase configuration
// Copy this file to firebase.ts and replace with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your_api_key_here",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your_project_id.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://your_project_id-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your_project_id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your_project_id.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your_messaging_sender_id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your_app_id",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "your_measurement_id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Firebase Realtime Database and get a reference to the service
export const database = getDatabase(app)

export default app
