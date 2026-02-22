import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyB3hZwjJ-rit-9EHF8uar7oLKMQ-x_JREQ",
  authDomain: "chess-lens-8eb7a.firebaseapp.com",
  projectId: "chess-lens-8eb7a",
  storageBucket: "chess-lens-8eb7a.firebasestorage.app",
  messagingSenderId: "422679029109",
  appId: "1:422679029109:web:324c80809c599a34b89f3c"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()