import { useEffect } from 'react'
import Avatar from './Avatar'
import {
  trumpById,
  computeTotals,
  computeRanks,
  playerStreaks,
  playerAccuracy,
  scoreFor,
} from '../../lib/gameLogic'
import { trumpTint, formatRank, rankBg } from '../../lib/gameColors'

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

const LATTICE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M18 0 L36 18 L18 36 L0 18 Z' fill='none' stroke='white' stroke-width='0.6'/%3E%3C/svg%3E")`

function totalColor(score, min, max) {
  if (max === min) return V.ink
  const t = (score - min) / (max - min)
  return `color-mix(in oklab, ${V.accent3} ${Math.round(t * 100)}%, ${V.accent2})`
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
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !game || players.length === 0) return null

  const variant    = game.scoring_variant
  const totals     = computeTotals(players, completedRounds, variant)
  const ranks      = computeRanks(players, totals)
  const sorted     = players.toSorted((a, b) => totals[b.id] - totals[a.id])
  const leader     = sorted[0]
  const second     = sorted[1]
  const margin     = leader && second ? totals[leader.id] - totals[second.id] : 0
  let minTotal = Infinity, maxTotal = -Infinity
  for (const p of players) {
    const s = totals[p.id]
    if (s < minTotal) minTotal = s
    if (s > maxTotal) maxTotal = s
  }

  const currentTrump = trumpById.get(pendingRound?.trump)
  const tint         = trumpTint(currentTrump)

  const allRoundsForTab = pendingRound
    ? [...completedRounds, pendingRound]
    : completedRounds

  const hasData = completedRounds.length > 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(18,8,14,.82)',
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: '32px 16px',
      }}
    >
      {/* Diamond lattice on backdrop */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: LATTICE_SVG,
          backgroundSize: '36px 36px',
          opacity: 0.022,
        }}
      />

      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-modal-title"
        className="summary-modal-panel"
        style={{
          position: 'relative', zIndex: 1,
          maxWidth: 760,
          margin: '0 auto',
          background: `color-mix(in oklab, ${tint.pageBleed ?? V.bg} 22%, ${V.surface})`,
          border: `1px solid ${V.line}`,
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >

        {/* ── Header ── */}
        <div style={{
          padding: '20px 28px 18px',
          borderBottom: `1px solid ${V.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: V.muted, marginBottom: 5 }}>
              Game Summary · timer paused
            </div>
            <h2 id="summary-modal-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: V.ink, margin: '0 0 6px' }} translate="no">
              {game.name || 'Ka·Chu·Fu·L'}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, display: 'flex', gap: 10, letterSpacing: '.04em', flexWrap: 'wrap' }}>
              <span>Round <b style={{ color: V.ink2 }}>{roundNumber}</b></span>
              <span aria-hidden>·</span>
              <span><b style={{ color: V.ink2 }}>{players.length}</b> players</span>
              <span aria-hidden>·</span>
              <span>{scoringLabels[variant]}</span>
              {currentTrump ? (
                <>
                  <span aria-hidden>·</span>
                  <span style={{ color: currentTrump.red ? 'var(--color-red-suit, #e57860)' : V.ink2 }}>
                    {currentTrump.glyph} {currentTrump.name}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close summary (Esc)"
            title="Close (Esc)"
            className="stats-close-btn"
            autoFocus
            style={{ background: 'transparent', border: 'none', color: V.muted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px', touchAction: 'manipulation' }}
          >×</button>
        </div>

        {/* ── Leader Hero ── */}
        {leader && hasData ? (
          <div style={{
            position: 'relative',
            padding: '28px 32px 24px',
            borderBottom: `1px solid ${V.line}`,
            overflow: 'hidden',
            background: `color-mix(in oklab, ${leader.color} 6%, transparent)`,
          }}>
            {/* Left border flash in leader's color */}
            <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: leader.color, opacity: 0.9 }} />

            {/* Trump watermark */}
            {currentTrump ? (
              <div aria-hidden style={{
                position: 'absolute', right: 20, top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: 'var(--font-display)', fontSize: 172, fontWeight: 700,
                color: tint.glyphColor ?? V.muted,
                opacity: 0.08, lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
                letterSpacing: '-0.05em',
              }}>
                {currentTrump.glyph}
              </div>
            ) : null}

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: V.muted, marginBottom: 14 }}>
                Leading after {completedRounds.length} round{completedRounds.length !== 1 ? 's' : ''}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <Avatar player={leader} size={72} glow />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34,
                    color: leader.color, letterSpacing: '-0.02em', lineHeight: 1.1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {leader.displayName}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 60,
                    color: V.ink, letterSpacing: '-0.04em', lineHeight: 1.05,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {totals[leader.id]}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: V.muted, marginLeft: 10, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', verticalAlign: 'middle' }}>pts</span>
                  </div>
                  {second ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, marginTop: 4 }}>
                      <b style={{ color: V.accent3 }}>+{margin}</b> ahead of{' '}
                      <span style={{ color: second.color, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{second.displayName}</span>
                      {' '}<span style={{ fontVariantNumeric: 'tabular-nums' }}>({totals[second.id]})</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Standings — compact rows ── */}
        {hasData ? (
          <div style={{ padding: '18px 28px', borderBottom: `1px solid ${V.line}` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: V.muted, marginBottom: 10 }}>
              Standings · {players.length} players
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorted.map(p => {
                const streak = playerStreaks(p.id, completedRounds)
                const acc    = playerAccuracy(p.id, completedRounds)
                const rk     = ranks[p.id]
                const isLeading = p.id === leader?.id
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: isLeading
                        ? `color-mix(in oklab, ${p.color} 10%, ${V.bg2})`
                        : V.bg2,
                      borderLeft: `4px solid ${p.color}`,
                      borderRadius: 10,
                      padding: '10px 14px',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: V.muted, minWidth: 26, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRank(rk)}
                    </span>
                    <Avatar player={p} size={36} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: isLeading ? V.accent : V.ink, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', minWidth: 42, textAlign: 'right' }}>
                      {totals[p.id]}
                    </span>
                    {/* Stat chips */}
                    <div style={{ display: 'flex', gap: 12, marginLeft: 6 }}>
                      {[
                        { label: 'Acc', val: `${acc.pct}%`, color: acc.pct >= 50 ? V.accent3 : V.accent2 },
                        { label: '🔥', val: streak.madeBest,   color: V.accent3 },
                        { label: '🧊', val: streak.missedBest, color: streak.missedBest > 0 ? V.accent2 : V.muted },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ textAlign: 'center', minWidth: 32 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted, lineHeight: 1.3 }}>{label}</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ── Running tab ── */}
        <div style={{ padding: '18px 28px', borderBottom: `1px solid ${V.line}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: V.muted, marginBottom: 10 }}>
            Full running tab · {allRoundsForTab.length} round{allRoundsForTab.length !== 1 ? 's' : ''}
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '42vh', borderRadius: 12, border: `1px solid ${V.line}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11, tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                <tr style={{ background: V.surface }}>
                  <th
                    scope="col"
                    style={{ textAlign: 'left', padding: '9px 12px', borderBottom: `1px solid ${V.line}`, color: V.muted, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600, width: 72 }}
                  >Round</th>
                  {players.map(p => (
                    <th key={p.id} scope="col" style={{ padding: '9px 6px', borderBottom: `1px solid ${V.line}`, borderLeft: `1px solid ${V.line}`, textAlign: 'center' }}>
                      <Avatar player={p} size={22} />
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: V.ink, fontWeight: 600, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRoundsForTab.map(r => {
                  const tr      = trumpById.get(r.trump)
                  const isPending = r.took === null || r.took === undefined
                  return (
                    <tr key={r.id} style={{ background: isPending ? `color-mix(in oklab, ${V.accent} 6%, ${V.bg2})` : V.bg2 }}>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, color: isPending ? V.accent : V.ink, fontVariantNumeric: 'tabular-nums' }}>
                        R{r.roundNumber}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 5 }}>
                          <span style={{ color: tr?.red ? 'var(--color-red-suit, #e57860)' : V.muted }}>{tr?.glyph}</span>
                          <span style={{ color: V.muted }}> {r.cards}</span>
                        </span>
                      </td>
                      {players.map(p => {
                        if (isPending) {
                          const b = r.bids[p.id]
                          return (
                            <td key={p.id} style={{ padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderLeft: `1px solid ${V.line}`, textAlign: 'center' }}>
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: V.muted }}>—</div>
                              <div style={{ fontSize: 9, color: V.muted, fontVariantNumeric: 'tabular-nums' }}>{b !== undefined ? `bid ${b}` : '—'}</div>
                            </td>
                          )
                        }
                        const b    = r.bids[p.id]
                        const k    = r.took[p.id]
                        const made = b === k
                        const pts  = scoreFor(b, k, variant)
                        return (
                          <td
                            key={p.id}
                            style={{
                              padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderLeft: `1px solid ${V.line}`,
                              textAlign: 'center',
                              background: made
                                ? `color-mix(in oklab, ${V.accent3} 14%, transparent)`
                                : `color-mix(in oklab, ${V.accent2} 14%, transparent)`,
                            }}
                          >
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: made ? V.accent3 : V.accent2, fontVariantNumeric: 'tabular-nums' }}>
                              {made ? `+${pts}` : '0'}
                            </div>
                            <div style={{ fontSize: 9, color: V.muted, fontVariantNumeric: 'tabular-nums' }}>{b}/{k}</div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              {hasData ? (
                <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
                  <tr style={{ background: V.surface }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderTop: `2px solid ${V.line}` }}>TOTAL</td>
                    {players.map(p => (
                      <td key={p.id} style={{ padding: '10px 6px', borderLeft: `1px solid ${V.line}`, borderTop: `2px solid ${V.line}`, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: totalColor(totals[p.id], minTotal, maxTotal), background: rankBg(ranks[p.id]?.rank, players.length), fontVariantNumeric: 'tabular-nums' }}>
                        {totals[p.id]}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: V.bg2 }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, background: V.bg2 }}>RANK</td>
                    {players.map(p => (
                      <td key={p.id} style={{ padding: '8px 6px', borderLeft: `1px solid ${V.line}`, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: p.id === leader?.id ? V.accent : V.ink2, background: rankBg(ranks[p.id]?.rank, players.length) }}>
                        {formatRank(ranks[p.id])}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, lineHeight: 1.5 }}>
            Closing resumes the round ·{' '}
            <b style={{ color: V.ink2 }}>End game</b> jumps to the final scoreboard
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              onClick={onClose}
              className="game-icon-btn"
              style={{
                background: 'transparent',
                border: `1px solid ${V.line}`,
                color: V.ink,
                fontFamily: 'var(--font-mono)',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '12px 20px', borderRadius: 12,
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              Back to game
            </button>
            <button
              onClick={onEndGame}
              className="game-icon-btn"
              style={{
                background: `color-mix(in oklab, ${V.accent2} 18%, ${V.surface})`,
                border: `1px solid ${V.accent2}`,
                color: V.accent2,
                fontFamily: 'var(--font-mono)',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '12px 20px', borderRadius: 12,
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              End game →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
