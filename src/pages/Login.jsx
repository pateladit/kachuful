import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
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
        // Supabase sends a confirmation email by default.
        // onAuthStateChange will fire automatically if confirmation is disabled.
        setConfirmationSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  function toggleMode() {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'))
    setError('')
    setConfirmationSent(false)
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-gray-600">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account and then sign in.
          </p>
          <button
            onClick={toggleMode}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ka Chu Fu L</h1>
          <p className="mt-1 text-gray-500 text-sm">
            {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold
                       text-white hover:bg-blue-700 disabled:opacity-50
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pending
              ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
              : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="text-blue-600 hover:underline font-medium"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
