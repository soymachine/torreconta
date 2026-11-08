import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const env = import.meta.env

const useEmulators = env.VITE_USE_EMULATORS === 'true'

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  // Con emuladores basta un id "demo-*": no toca ningún proyecto real.
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-torreconta',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
