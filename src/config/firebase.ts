/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Your Firebase configuration
// Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const isFirebaseEnabled = Boolean(firebaseConfig.apiKey)

// Initialize Firebase only if the config is present.
// This prevents runtime crashes when migrating away from Firebase.
const app: any = isFirebaseEnabled ? initializeApp(firebaseConfig) : null

// Initialize Firebase services only when Firebase is enabled.
export const auth: any = isFirebaseEnabled ? getAuth(app) : null
export const database: any = isFirebaseEnabled ? getDatabase(app) : null
export const db: any = isFirebaseEnabled ? getFirestore(app) : null
export const functions: any = isFirebaseEnabled ? getFunctions(app) : null
export const storage: any = isFirebaseEnabled ? getStorage(app) : null

if (!isFirebaseEnabled) {
  console.warn('[firebase] Firebase is disabled (missing VITE_FIREBASE_API_KEY).')
}

export default app