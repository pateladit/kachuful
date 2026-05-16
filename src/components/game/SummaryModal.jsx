import { useEffect } from 'react'
import Avatar from './Avatar'
import {
  TRUMPS,
  computeTotals,
  computeRanks,
  playerStreaks,
  playerAccuracy,
  trumpPerformance,
  scoreFor,
} from '../../lib/gameLogic'

const V = {
  bg:       'var(--color-bg, #2a1620)',
  bg2:      'var(--color-bg-2, #3a1f2c)',
  surface:  'var(--color-surface, #3d2330)',
  ink:      'var(--color-ink, #f6e7d3)',
  ink2:     'var(--color-ink-2, #d8b893)',
  muted:    'var(--color-muted, #9b7c6b)',
  line:     'var(--color-line, #5a3445)',
  accent:   'var(--color-accent, #e89a3c)',
  accent2:  'var(--color-accent-2, #d24a3d)',
  accent3:  'var(--color-accent-3, #b6c97a)',
}

function formatRank(rk) {
  if (!rk) return '—'
  const n = rk.rank
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

const scoringLabels = {
  1: 'Classic · 10+bid',
  2: '10×bid+1',
  3: '10×bid+1 · Nil=10',
}

export default function SummaryModal({
  open,
  onClose,
  onEndGame,
  game,
  players,
  completedRounds,
  pendingRound,
  roundNumber,
}) {
  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !game || players.length === 0) return null

  const variant = game.scoring_variant
  const totals = computeTotals(players, completedRounds, variant)
  const ranks = computeRanks(players, totals)
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])
  const leader = sorted[0]
  const second = sorted[1]
  const margin = leader && second ? totals[leader.id] - totals[second.id] : 0

  const allRoundsForTab = pendingRound
    ? [...completedRounds, pendingRound]
    : completedRounds

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,14,21,.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        overflowY: 'auto',
        padding: '40px 16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 720,
          margin: '0 auto',
          background: V.surface,
          border: `1px solid ${V.line}`,
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: `1px solid ${V.line}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
              Game Summary · timer paused
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.01em', color: V.ink, margin: '6px 0 4px' }}>
              {game.name || 'Ka·Chu·Fu·L'}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, display: 'flex', gap: 12, letterSpacing: '.04em' }}>
              <span>Round <b style={{ color: V.ink }}>{roundNumber}</b></span>
              <span>·</span>
              <span><b style={{ color: V.ink }}>{players.length}</b> players</span>
              <span>·</span>
              <span>Scoring · <b style={{ color: V.ink }}>{scoringLabels[variant]}</b></span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: V.muted,
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Winner card */}
        {leader && completedRounds.length > 0 && (
          <div style={{ padding: '20px 28px', borderBottom: `1px solid ${V.line}` }}>
            <div
              style={{
                background: V.bg2,
                border: `1px solid ${V.line}`,
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <div style={{ textAlign: 'center', minWidth: 48 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>LEADER</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: V.accent, letterSpacing: '-0.01em' }}>1</div>
              </div>
              <Avatar player={leader} size={64} glow />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.ink, letterSpacing: '-0.01em' }}>
                  {leader.displayName}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, color: V.accent, letterSpacing: '-0.02em' }}>
                  {totals[leader.id]}
                  <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginLeft: 6, letterSpacing: '.1em' }}>POINTS</small>
                </div>
                {second && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
                    <b style={{ color: V.ink }}>+{margin}</b> ahead of{' '}
                    <span style={{ color: second.color, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{second.displayName}</span>
                    {' '}({totals[second.id]})
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Per-player stats */}
        {completedRounds.length > 0 && (
          <div style={{ padding: '20px 28px', borderBottom: `1px solid ${V.line}` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>
              Per-player record · {completedRounds.length} rounds
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(p => {
                const streak = playerStreaks(p.id, completedRounds)
                const acc = playerAccuracy(p.id, completedRounds)
                const rk = ranks[p.id]
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      background: p.id === leader?.id ? `color-mix(in oklab, ${V.accent} 8%, ${V.bg2})` : V.bg2,
                      border: `1px solid ${p.id === leader?.id ? V.accent : V.line}`,
                      borderRadius: 12,
                      padding: '12px 16px',
                    }}
                  >
                    <Avatar player={p} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: V.ink }}>{p.displayName}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.04em' }}>{formatRank(rk)} · {totals[p.id]} pts</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, textAlign: 'center' }}>
                      {[
                        { label: 'Accuracy', val: `${acc.pct}%`, sub: `${acc.made}/${acc.total}` },
                        { label: 'Best made', val: streak.madeBest, sub: 'in a row' },
                        { label: 'Best missed', val: streak.missedBest, sub: 'in a row', warn: streak.missedBest > 0 },
                      ].map(({ label, val, sub, warn }) => (
                        <div key={label} style={{ minWidth: 52 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: warn ? V.accent2 : V.ink, letterSpacing: '-0.01em' }}>{val}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Running tab */}
        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${V.line}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>
            Full running tab · {allRoundsForTab.length} rounds
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: V.surface }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${V.line}`, color: V.muted, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', width: 72 }}>Round</th>
                  {players.map(p => (
                    <th key={p.id} style={{ padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderLeft: `1px solid ${V.line}`, textAlign: 'center' }}>
                      <Avatar player={p} size={24} />
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: V.ink, fontWeight: 600, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRoundsForTab.map(r => {
                  const tr = TRUMPS.find(t => t.id === r.trump)
                  const isCurrent = r.took === null
                  return (
                    <tr key={r.id} style={{ background: isCurrent ? `color-mix(in oklab, ${V.accent} 6%, ${V.bg2})` : V.bg2 }}>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${V.line}`, color: isCurrent ? V.accent : V.ink, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                        R{r.roundNumber}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isCurrent ? V.accent : V.muted, marginLeft: 4 }}>
                          <span style={{ color: tr?.red ? '#e57860' : undefined }}>{tr?.glyph}</span> {r.cards}
                        </span>
                      </td>
                      {players.map(p => {
                        if (isCurrent) {
                          const b = r.bids[p.id]
                          return (
                            <td key={p.id} style={{ padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderLeft: `1px solid ${V.line}`, textAlign: 'center' }}>
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: V.muted }}>—</div>
                              <div style={{ fontSize: 9, color: V.muted }}>{b !== undefined ? `bid ${b}` : '—/—'}</div>
                            </td>
                          )
                        }
                        const b = r.bids[p.id]
                        const k = r.took[p.id]
                        const made = b === k
                        const pts = scoreFor(b, k, variant)
                        return (
                          <td key={p.id} style={{ padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderLeft: `1px solid ${V.line}`, textAlign: 'center', background: made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)` }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: made ? V.accent3 : V.accent2 }}>{made ? `+${pts}` : '0'}</div>
                            <div style={{ fontSize: 9, color: V.muted }}>{b}/{k}</div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {completedRounds.length > 0 && (
                  <tr style={{ background: V.surface }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>TOTAL</td>
                    {players.map(p => (
                      <td key={p.id} style={{ padding: '10px 6px', borderLeft: `1px solid ${V.line}`, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: p.id === leader?.id ? V.accent : V.ink }}>
                        {totals[p.id]}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
            Closing resumes the round · <b style={{ color: V.ink }}>End game now</b> jumps to the final scoreboard
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `1px solid ${V.line}`,
                color: V.ink,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                padding: '12px 20px',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Back to game
            </button>
            <button
              onClick={onEndGame}
              style={{
                background: `color-mix(in oklab, ${V.accent2} 22%, ${V.surface})`,
                border: `1px solid ${V.accent2}`,
                color: V.accent2,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                padding: '12px 20px',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              End game now →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
