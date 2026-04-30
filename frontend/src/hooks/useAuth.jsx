// src/hooks/useAuth.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const clearError = () => setError(null)

  // ── Google sign-in ─────────────────────────────────────────
  const signInWithGoogle = async () => {
    clearError()
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      return true
    } catch (err) {
      if (err.code !== 'auth/cancelled-popup-request') {
        setError(friendlyError(err.code))
      }
      return false
    }
  }

  // ── Email sign-in ──────────────────────────────────────────
  const signInWithEmail = async (email, password) => {
    clearError()
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (err) {
      setError(friendlyError(err.code))
      return false
    }
  }

  // ── Email sign-up ──────────────────────────────────────────
  const signUpWithEmail = async (email, password, displayName) => {
    clearError()
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) {
        await updateProfile(cred.user, { displayName })
      }
      return true
    } catch (err) {
      setError(friendlyError(err.code))
      return false
    }
  }

  // ── Password reset ─────────────────────────────────────────
  const resetPassword = async (email) => {
    clearError()
    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (err) {
      setError(friendlyError(err.code))
      return false
    }
  }

  // ── Sign out ───────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth)
  }

  const value = {
    user,
    loading,
    error,
    clearError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}

// ── Firebase error → human readable ──────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user': 'Sign-in cancelled.',
  }

  return map[code] || 'Authentication failed. Please try again.'
}