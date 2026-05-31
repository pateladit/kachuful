import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── Shared Google logo ─────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── Shared field ───────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-muted)',
      }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--color-line)',
  padding: '10px 0',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--color-ink)',
  outline: 'none',
  caretColor: 'var(--color-accent)',
  transition: 'border-color 0.2s',
  width: '100%',
}

export default function Login() {
  const { user, loading, signIn, signUp, signInWithGoogle, signInAnonymously } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]                     = useState('signin')   // 'signin' | 'signup' | 'guest'
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [username, setUsername]           = useState('')
  const [guestName, setGuestName]         = useState('')
  const [error, setError]                 = useState('')
  const [pending, setPending]             = useState(false)
  const [guestPending, setGuestPending]   = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  // Already logged in — skip straight to history
  if (!loading && user) return <Navigate to="/history" replace />

  function switchTab(t) { setTab(t); setError(''); setConfirmationSent(false) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      if (tab === 'signin') {
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

  // ── Confirmation screen ────────────────────────────────────────────
  if (confirmationSent) {
    return (
      <Page>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: 'var(--color-ink)', marginBottom: 12 }}>
            Check your email
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
            We sent a confirmation link to{' '}
            <strong style={{ color: 'var(--color-ink)' }}>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <button
            onClick={() => switchTab('signin')}
            style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Back to sign in
          </button>
        </div>
      </Page>
    )
  }

  // ── Main login ─────────────────────────────────────────────────────
  return (
    <Page>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36, animation: 'rise 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(48px, 13vw, 68px)', letterSpacing: '-0.04em', color: 'var(--color-ink)', lineHeight: 1 }}>
            Uja<span style={{ color: 'var(--color-accent)' }}>gro</span>
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-ink-2)', marginTop: 10 }}>
            Where every game night begins.
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-muted)', marginTop: 3 }}>
            જ્યાં રાત શરૂ થાય.
          </div>
        </div>

        {/* Decorative rule */}
        <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, animation: 'rise 0.6s ease 0.3s both' }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--color-line), transparent)' }} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--color-accent)', opacity: 0.5, letterSpacing: 5 }}>♠ ♦ ♣ ♥</div>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--color-line), transparent)' }} />
        </div>

        {/* Tab switcher */}
        <div role="tablist" aria-label="Sign in method" style={{ display: 'flex', gap: 0, background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 12, padding: 3, marginBottom: 24, animation: 'rise 0.6s ease 0.4s both' }}>
          {[['signin','Sign in'],['signup','Sign up'],['guest','Guest']].map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              style={{
                flex: 1, background: tab === t ? 'var(--color-surface)' : 'none',
                border: 'none', borderRadius: 9, padding: '8px 0',
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--color-ink)' : 'var(--color-muted)',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.35)' : 'none',
              }}
            >{label}</button>
          ))}
        </div>

        {/* ── Sign in panel ── */}
        {tab === 'signin' && (
          <div style={{ animation: 'rise 0.45s ease both' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <GoogleButton onClick={handleGoogleSignIn} pending={googlePending} />
              <OrDivider />
              <Field label="Email">
                <input type="email" required autoComplete="email" name="email" spellCheck={false}
                  placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
                />
              </Field>
              <Field label="Password">
                <input type="password" required autoComplete="current-password" name="password"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
                />
              </Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <PrimaryButton type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in →'}
              </PrimaryButton>
            </form>
            <ToggleLink>
              No account?{' '}
              <button type="button" onClick={() => switchTab('signup')} style={toggleBtnStyle}>Sign up</button>
            </ToggleLink>
          </div>
        )}

        {/* ── Sign up panel ── */}
        {tab === 'signup' && (
          <div style={{ animation: 'rise 0.45s ease both' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <GoogleButton onClick={handleGoogleSignIn} pending={googlePending} />
              <OrDivider />
              <Field label="Username">
                <input type="text" required autoComplete="username" name="username"
                  placeholder="your name…" value={username} onChange={e => setUsername(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
                />
              </Field>
              <Field label="Email">
                <input type="email" required autoComplete="email" name="email" spellCheck={false}
                  placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
                />
              </Field>
              <Field label="Password">
                <input type="password" required autoComplete="new-password" name="password"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
                />
              </Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <PrimaryButton type="submit" disabled={pending}>
                {pending ? 'Creating account…' : 'Create account →'}
              </PrimaryButton>
            </form>
            <ToggleLink>
              Already have one?{' '}
              <button type="button" onClick={() => switchTab('signin')} style={toggleBtnStyle}>Sign in</button>
            </ToggleLink>
          </div>
        )}

        {/* ── Guest panel ── */}
        {tab === 'guest' && (
          <div style={{ animation: 'rise 0.45s ease both' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--color-ink-2)', marginBottom: 6 }}>
                Just here for the game?
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', letterSpacing: '.08em' }}>
                No account needed · history saved on this device
              </div>
            </div>
            <form onSubmit={handleGuestSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field label="Your name">
                <input type="text" autoComplete="name" name="guest-name"
                  placeholder="what should we call you…" value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
                />
              </Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <PrimaryButton type="submit" disabled={guestPending || !guestName.trim()}>
                {guestPending ? 'Joining…' : 'Join the table →'}
              </PrimaryButton>
            </form>
            <ToggleLink>
              Want to save history?{' '}
              <button type="button" onClick={() => switchTab('signup')} style={toggleBtnStyle}>Sign up</button>
            </ToggleLink>
          </div>
        )}

      </div>
    </Page>
  )
}

// ── Atmosphere wrapper ─────────────────────────────────────────────────
function Page({ children }) {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 60px', background: 'var(--color-bg)' }}>

      {/* Warm lamp glow from above */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 90% 60% at 50% -5%, color-mix(in oklab, var(--color-accent) 11%, var(--color-bg)) 0%, var(--color-bg) 65%)', pointerEvents: 'none' }} />

      {/* Diamond lattice — card back pattern */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, color-mix(in oklab, var(--color-accent) 4%, transparent) 18px, color-mix(in oklab, var(--color-accent) 4%, transparent) 19px), repeating-linear-gradient(-45deg, transparent, transparent 18px, color-mix(in oklab, var(--color-accent) 4%, transparent) 18px, color-mix(in oklab, var(--color-accent) 4%, transparent) 19px)', pointerEvents: 'none' }} />

      {/* Corner suit marks — playing card corners */}
      {[
        { top: 20, left: 20 },
        { top: 20, right: 20, transform: 'rotate(180deg)' },
        { bottom: 20, left: 20, transform: 'rotate(180deg)' },
        { bottom: 20, right: 20 },
      ].map((pos, i) => (
        <div key={i} aria-hidden="true" style={{ position: 'fixed', ...pos, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: 0.12, pointerEvents: 'none', color: 'var(--color-accent)' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, lineHeight: 1 }}>♠</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em' }}>U</span>
        </div>
      ))}

      {/* Ambient center suit — breathing */}
      <div aria-hidden="true" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 'min(55vw, 420px)', color: 'var(--color-accent)', opacity: 0.022, pointerEvents: 'none', fontFamily: 'Georgia, serif', userSelect: 'none', animation: 'breathe 8s ease-in-out infinite' }} >♠</div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>

      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.022; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.028; transform: translate(-50%, -50%) scale(1.02); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── Shared small components ────────────────────────────────────────────
function GoogleButton({ onClick, pending }) {
  return (
    <button type="button" onClick={onClick} disabled={pending}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '13px 20px', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-muted)'; e.currentTarget.style.background = 'var(--color-surface)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-line)'; e.currentTarget.style.background = 'var(--color-bg-2)' }}
    >
      <GoogleLogo />
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </button>
  )
}

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
    </div>
  )
}

function PrimaryButton({ children, ...props }) {
  return (
    <button {...props}
      style={{ width: '100%', background: 'var(--color-accent)', border: 'none', borderRadius: 12, padding: '13px 20px', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--color-bg)', cursor: 'pointer', letterSpacing: '-0.01em', transition: 'opacity 0.2s', opacity: props.disabled ? 0.4 : 1 }}
      onMouseEnter={e => { if (!props.disabled) e.currentTarget.style.opacity = '0.88' }}
      onMouseLeave={e => { if (!props.disabled) e.currentTarget.style.opacity = '1' }}
    >{children}</button>
  )
}

function ErrorMsg({ children }) {
  return <p role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-accent-2)', margin: 0 }}>{children}</p>
}

function ToggleLink({ children }) {
  return <p style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)', marginTop: 16 }}>{children}</p>
}

const toggleBtnStyle = {
  background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 13,
  fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer',
  textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
}
