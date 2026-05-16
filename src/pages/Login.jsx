import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { user, loading, signIn, signUp, signInWithGoogle, signInAnonymously } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [guestPending, setGuestPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  // Already logged in — skip straight to history
  if (!loading && user) return <Navigate to="/history" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate('/history', { replace: true })
      } else {
        await signUp(email, password, username)
        setConfirmationSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    setGooglePending(true)
    try {
      await signInWithGoogle()
      // OAuth redirect takes over; no navigate() needed here
    } catch (err) {
      setError(err.message)
      setGooglePending(false)
    }
  }

  async function handleGuestSignIn(e) {
    e.preventDefault()
    if (!guestName.trim()) return
    setError('')
    setGuestPending(true)
    try {
      await signInAnonymously(guestName.trim())
      navigate('/history', { replace: true })
    } catch (err) {
      setError(err.message)
      setGuestPending(false)
    }
  }

  function toggleMode() {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'))
    setError('')
    setConfirmationSent(false)
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="font-display font-bold text-3xl text-ink">Check your email</div>
          <p className="text-ink-2 text-sm leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="text-ink font-medium">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <button onClick={toggleMode} className="text-sm text-accent hover:underline">
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center">
          <div className="font-display font-bold text-4xl tracking-tight text-ink">
            Ka·Chu·Fu·L
          </div>
          <div className="mt-1.5 text-ink-2 text-sm">Score tracker for Judgement</div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
          {/* Google button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googlePending}
            className="w-full flex items-center justify-center gap-3 bg-bg-2 border border-line
                       rounded-xl px-4 py-3 text-sm font-medium text-ink
                       hover:bg-surface disabled:opacity-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googlePending ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-muted text-xs">or sign in with email</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full rounded-lg bg-bg border border-line px-3 py-2.5 text-sm
                             text-ink focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-bg border border-line px-3 py-2.5 text-sm
                           text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Password</label>
              <input
                type="password"
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg bg-bg border border-line px-3 py-2.5 text-sm
                           text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && <p className="text-sm text-accent-2">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold
                         text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {pending
                ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-accent hover:underline font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-muted text-xs">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Guest section */}
          <form onSubmit={handleGuestSignIn} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Your name</label>
              <input
                type="text"
                placeholder="Enter your name to play as guest"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                className="w-full rounded-lg bg-bg border border-line px-3 py-2.5 text-sm
                           text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={guestPending || !guestName.trim()}
              className="w-full rounded-xl bg-bg-2 border border-line px-4 py-2.5 text-sm
                         font-medium text-ink-2 hover:text-ink hover:border-muted
                         disabled:opacity-40 transition-colors"
            >
              {guestPending ? 'Joining…' : 'Continue without account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
