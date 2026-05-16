import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const V = {
  bg2:     'var(--color-bg-2, #3a1f2c)',
  surface: 'var(--color-surface, #3d2330)',
  ink:     'var(--color-ink, #f6e7d3)',
  ink2:    'var(--color-ink-2, #d8b893)',
  muted:   'var(--color-muted, #9b7c6b)',
  line:    'var(--color-line, #5a3445)',
  accent:  'var(--color-accent, #e89a3c)',
  accent2: 'var(--color-accent-2, #d24a3d)',
}

export default function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onOutsideClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  async function handleSignOut() {
    setOpen(false)
    try { await signOut() } catch (_) {}
    navigate('/login')
  }

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  const label = user?.email
    ? user.email.split('@')[0]
    : (user?.user_metadata?.username ?? 'Guest')

  const isAnonymous = !user?.email && !user?.user_metadata?.provider

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: open ? V.surface : 'transparent',
          border: `1px solid ${open ? V.accent : V.line}`,
          borderRadius: 12,
          padding: '8px 14px',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: open ? V.ink : V.ink2,
          cursor: 'pointer',
          transition: 'all .15s ease',
        }}
      >
        {/* Avatar dot */}
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: V.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
          color: '#2a1620', flexShrink: 0,
        }}>
          {label[0]?.toUpperCase()}
        </span>
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: V.muted, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          background: V.surface,
          border: `1px solid ${V.line}`,
          borderRadius: 14,
          padding: '6px',
          minWidth: 200,
          zIndex: 100,
          boxShadow: '0 12px 32px -8px rgba(0,0,0,.5)',
        }}>
          {/* User info */}
          <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${V.line}`, marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: V.ink }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>
              {isAnonymous ? 'Guest session' : user?.email ?? ''}
            </div>
          </div>

          <MenuItem icon="◷" label="Game history" onClick={() => go('/history')} />
          <MenuItem icon="◈" label="Preferences" onClick={() => {}} muted subtitle="Coming soon" />

          <div style={{ borderTop: `1px solid ${V.line}`, marginTop: 4, paddingTop: 4 }}>
            <MenuItem icon="→" label="Sign out" onClick={handleSignOut} danger />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, muted, subtitle, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 12px',
        borderRadius: 8,
        border: 'none',
        background: hover && !muted ? 'var(--color-bg-2, #3a1f2c)' : 'transparent',
        cursor: muted ? 'default' : 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 14, color: danger ? V.accent2 : muted ? V.muted : V.muted, width: 16, textAlign: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: danger ? V.accent2 : muted ? V.muted : V.ink }}>{label}</div>
        {subtitle && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </button>
  )
}
