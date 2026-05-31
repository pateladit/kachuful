import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import AccountMenu from '../components/AccountMenu'

const V = {
  bg:      'var(--color-bg)',
  bg2:     'var(--color-bg-2)',
  surface: 'var(--color-surface)',
  ink:     'var(--color-ink)',
  ink2:    'var(--color-ink-2)',
  muted:   'var(--color-muted)',
  line:    'var(--color-line)',
  accent:  'var(--color-accent)',
  accent2: 'var(--color-accent-2)',
  accent3: 'var(--color-accent-3)',
}

export default function Preferences() {
  const { user, upgradeWithEmail, linkWithGoogle } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const isAnonymous = !user?.email && !user?.user_metadata?.provider

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving]     = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const [upgradeErr, setUpgradeErr] = useState('')

  async function handleEmailUpgrade(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setUpgradeErr('')
    setUpgradeMsg('')
    try {
      await upgradeWithEmail(email.trim(), password)
      setUpgradeMsg('Confirmation email sent — check your inbox to activate your account.')
      setEmail('')
      setPassword('')
    } catch (err) {
      setUpgradeErr(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleGoogleLink() {
    try {
      await linkWithGoogle()
    } catch (err) {
      setUpgradeErr(err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg }}>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${V.line}`, padding: '12px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: V.ink }}>Ujagro</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginLeft: 8, letterSpacing: '.1em', textTransform: 'uppercase' }}>· Preferences</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'none', border: `1px solid ${V.line}`, borderRadius: 10, padding: '7px 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: V.ink2, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* ── Account upgrade (anonymous only) ── */}
        {isAnonymous && (
          <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '24px 28px', marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: V.ink, margin: '0 0 6px' }}>Account</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: V.ink2, margin: '0 0 20px', lineHeight: 1.5 }}>
              You're playing as a guest. Link an account to keep your history accessible on any device.
            </p>

            {upgradeMsg ? (
              <div style={{ background: `color-mix(in oklab, ${V.accent3} 18%, ${V.bg2})`, border: `1px solid color-mix(in oklab, ${V.accent3} 40%, transparent)`, borderRadius: 12, padding: '14px 18px', fontFamily: 'var(--font-body)', fontSize: 14, color: V.ink }}>
                {upgradeMsg}
              </div>
            ) : (
              <>
                {/* Google link */}
                <button
                  onClick={handleGoogleLink}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    width: '100%', padding: '12px 20px', borderRadius: 12,
                    background: V.bg2, border: `1px solid ${V.line}`,
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: V.ink,
                    cursor: 'pointer', marginBottom: 16, transition: 'border-color .15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = V.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = V.line}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: V.line }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.12em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: V.line }} />
                </div>

                {/* Email / password form */}
                <form onSubmit={handleEmailUpgrade} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{ background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 10, padding: '11px 14px', fontFamily: 'var(--font-body)', fontSize: 14, color: V.ink, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 10, padding: '11px 14px', fontFamily: 'var(--font-body)', fontSize: 14, color: V.ink, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                  {upgradeErr && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: V.accent2, margin: 0 }}>{upgradeErr}</p>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ background: V.accent, border: 'none', borderRadius: 10, padding: '12px 20px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: '#2a1620', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Save account'}
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {/* ── Appearance ── */}
        <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '24px 28px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: V.ink, margin: '0 0 20px' }}>Appearance</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { id: 'lantern', label: 'Lantern', description: 'Dark — deep plum & amber glow', swatches: ['#2a1620', '#3d2330', '#e89a3c', '#b6c97a'] },
              { id: 'mehfil',  label: 'Mehfil',  description: 'Light — warm cream & terracotta', swatches: ['#f6efe2', '#fffaf0', '#c14a2b', '#1f5c4a'] },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px', borderRadius: 14, border: `2px solid ${theme === opt.id ? V.accent : V.line}`,
                  background: theme === opt.id ? `color-mix(in oklab, ${V.accent} 8%, ${V.bg2})` : 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'all .15s ease',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${theme === opt.id ? V.accent : V.muted}`,
                  background: theme === opt.id ? V.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {theme === opt.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a1620' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: theme === opt.id ? V.accent : V.ink }}>{opt.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 2 }}>{opt.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {opt.swatches.map(c => (
                    <span key={c} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: `1px solid rgba(0,0,0,.15)`, display: 'inline-block' }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
