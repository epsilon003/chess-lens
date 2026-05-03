// src/pages/AuthPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { SEO } from '../hooks/useSEO'
import './AuthPage.css'

export default function AuthPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, error, clearError } = useAuth()
  const navigate = useNavigate()

  const [mode,     setMode]     = useState('signin')  // signin | signup | reset
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const switchMode = (m) => { setMode(m); clearError(); setResetSent(false) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    let ok = false

    if (mode === 'signin') {
      ok = await signInWithEmail(email, password)
    } else if (mode === 'signup') {
      ok = await signUpWithEmail(email, password, name)
    } else if (mode === 'reset') {
      ok = await resetPassword(email)
      if (ok) setResetSent(true)
    }

    setLoading(false)
    if (ok && mode !== 'reset') navigate('/analyze')
  }

  const handleGoogle = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
    navigate('/analyze')
  }

  return (
    <div className="auth-page">
      <SEO
        title="Sign In"
        description="Sign in to ChessLens to save games and access pattern analysis."
        canonical="/auth"
        noindex={true}
      />
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-icon">&#9819;</span>
          <span className="auth-logo-name">Chess<span>Lens</span></span>
        </div>

        {/* Title */}
        <h1 className="auth-title">
          {mode === 'signin' && 'Sign in'}
          {mode === 'signup' && 'Create account'}
          {mode === 'reset'  && 'Reset password'}
        </h1>

        {/* Error */}
        {error && (
          <div className="auth-error">{error}</div>
        )}

        {/* Reset sent confirmation */}
        {resetSent && (
          <div className="auth-success">
            Password reset email sent. Check your inbox.
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>

          {mode === 'signup' && (
            <div className="auth-field">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email address"
              autoComplete="email"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div className="auth-field">
              <div className="auth-field-header">
                <label>Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => switchMode('reset')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (
              mode === 'signin' ? 'Sign in' :
              mode === 'signup' ? 'Create account' :
              'Send reset email'
            )}
          </button>
        </form>

        {/* Divider — only show on signin/signup */}
        {mode !== 'reset' && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>

            <button
              className="btn auth-google-btn"
              onClick={handleGoogle}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        )}

        {/* Footer links */}
        <div className="auth-footer">
          {mode === 'signin' && (
            <>
              No account?{' '}
              <button className="auth-link" onClick={() => switchMode('signup')}>
                Sign up
              </button>
            </>
          )}
          {mode === 'signup' && (
            <>
              Already have an account?{' '}
              <button className="auth-link" onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </>
          )}
          {mode === 'reset' && (
            <button className="auth-link" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
