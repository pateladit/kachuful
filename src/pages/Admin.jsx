import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
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

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 16, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.03em', color: accent ? V.accent : V.ink, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

export default function Admin() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('games')
      .select('id, name, status, created_by, started_at, ended_at, created_at, game_players(id, display_name, seat_order)')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setGames(data ?? [])
        setLoading(false)
      })
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.ink, marginBottom: 10 }}>Access denied</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, marginBottom: 20 }}>This page is for admins only.</div>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 14, color: V.accent, cursor: 'pointer', textDecoration: 'underline' }}>
            ← Back to setup
          </button>
        </div>
      </div>
    )
  }

  const total     = games.length
  const complete  = games.filter(g => g.status === 'complete').length
  const inProgress = games.filter(g => g.status === 'in_progress').length

  function openGame(g) {
    navigate(g.status === 'complete' ? `/game/${g.id}/final` : `/game/${g.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: V.bg }}>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${V.line}`, padding: '12px 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: V.ink }}>Ka·Chu·Fu·L</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginLeft: 8, letterSpacing: '.1em', textTransform: 'uppercase' }}>· Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/history')}
              style={{ background: 'none', border: `1px solid ${V.line}`, borderRadius: 10, padding: '7px 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: V.ink2, cursor: 'pointer' }}
            >
              ← My games
            </button>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 64px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
            Loading all games…
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, marginBottom: 8 }}>Failed to load</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted }}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
              <StatPill label="Total games" value={total} accent />
              <StatPill label="Complete" value={complete} />
              <StatPill label="In progress" value={inProgress} />
            </div>

            {/* Game list */}
            {games.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.muted }}>
                No games yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {games.map(g => {
                  const isComplete = g.status === 'complete'
                  const players = [...(g.game_players ?? [])].sort((a, b) => a.seat_order - b.seat_order)
                  const displayName = g.name || `Game · ${formatDate(g.created_at)}`

                  return (
                    <div
                      key={g.id}
                      onClick={() => openGame(g)}
                      style={{
                        background: V.surface, border: `1px solid ${V.line}`, borderRadius: 16,
                        padding: '16px 20px', cursor: 'pointer', transition: 'border-color .15s ease',
                        display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16,
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = isComplete ? V.accent : V.ink2}
                      onMouseLeave={e => e.currentTarget.style.borderColor = V.line}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: V.ink }}>{displayName}</span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
                            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                            background: isComplete
                              ? `color-mix(in oklab, ${V.accent} 15%, ${V.bg2})`
                              : `color-mix(in oklab, ${V.accent3} 12%, ${V.bg2})`,
                            color: isComplete ? V.accent : V.accent3,
                            border: `1px solid ${isComplete ? `color-mix(in oklab, ${V.accent} 40%, transparent)` : `color-mix(in oklab, ${V.accent3} 30%, transparent)`}`,
                          }}>
                            {isComplete ? '★ Complete' : '● Live'}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.1em' }}>
                          {formatDate(g.created_at)}
                          {' · '}
                          {players.length} player{players.length !== 1 ? 's' : ''}
                          {' · '}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>
                            creator: {g.created_by.slice(0, 8)}…
                          </span>
                        </div>
                        {players.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {players.map(p => (
                              <span key={p.id} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: V.ink2, background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 6, padding: '2px 8px' }}>
                                {p.display_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: isComplete ? V.accent : V.ink2, flexShrink: 0 }}>
                        View →
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
