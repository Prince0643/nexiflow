// Utility to test environment variable loading
export const envTest = {
  isOpenAIConfigured: (): boolean => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    return !!apiKey && apiKey.length > 0
  },
  
  getFirebaseConfig: () => {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    }
  },
  
  getOpenAIKey: (): string | undefined => {
    return import.meta.env.VITE_OPENAI_API_KEY
  }
}