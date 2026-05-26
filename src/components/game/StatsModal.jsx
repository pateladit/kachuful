import { useEffect } from 'react'
import Avatar from './Avatar'
import {
  TRUMPS,
  computeTotals,
  nilBidStats,
  cardCountStats,
  dealerBurden,
  playerStreaks,
  bestRoundScore,
  favoriteTrump,
  avgBidRatio,
  netBidDrift,
} from '../../lib/gameLogic'

const V = {
  bg:      'var(--color-bg, #2a1620)',
  bg2:     'var(--color-bg-2, #3a1f2c)',
  surface: 'var(--color-surface, #3d2330)',
  ink:     'var(--color-ink, #f6e7d3)',
  ink2:    'var(--color-ink-2, #d8b893)',
  muted:   'var(--color-muted, #9b7c6b)',
  line:    'var(--color-line, #5a3445)',
  accent:  'var(--color-accent, #e89a3c)',
  accent2: 'var(--color-accent-2, #d24a3d)',
  accent3: 'var(--color-accent-3, #b6c97a)',
}

function pctColor(pct) {
  if (pct === null) return V.muted
  return pct >= 50 ? V.accent3 : V.accent2
}

function Section({ label, children, last }) {
  return (
    <div style={{ padding: '20px 28px', ...(!last && { borderBottom: `1px solid ${V.line}` }) }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function StatCell({ label, val, sub, color }) {
  return (
    <div style={{ minWidth: 72, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: color ?? V.ink, letterSpacing: '-0.01em' }}>{val}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{sub}</div>}
    </div>
  )
}

export default function StatsModal({ open, onClose, game, players, completedRounds }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !game || players.length === 0) return null

  const variant = game.scoring_variant
  const totals = computeTotals(players, completedRounds, variant)
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])

  const stats = Object.fromEntries(players.map(p => [p.id, {
    nil:     nilBidStats(p.id, completedRounds),
    cards:   cardCountStats(p.id, completedRounds),
    dealer:  dealerBurden(p.id, completedRounds),
    streaks: playerStreaks(p.id, completedRounds),
    best:    bestRoundScore(p.id, completedRounds, variant),
    trump:   favoriteTrump(p.id, completedRounds),
    ratio:   avgBidRatio(p.id, completedRounds),
    drift:   netBidDrift(p.id, completedRounds),
  }]))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,14,21,.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 100, overflowY: 'auto',
        padding: '40px 16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 720, margin: '0 auto',
          background: V.surface,
          border: `1px solid ${V.line}`,
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${V.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
              Stats · {completedRounds.length} rounds played
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.01em', color: V.ink, margin: '6px 0 0' }}>
              {game.name || 'Ka·Chu·Fu·L'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: V.muted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            title="Close (Esc)"
          >×</button>
        </div>

        {completedRounds.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: V.muted, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No completed rounds yet
          </div>
        ) : (
          <>
            {/* ── Section 1: Zero bids ── */}
            <Section label="Zero bids · called nil">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: V.bg2 }}>
                      {['Player', 'Overall', '≤4 cards', '5+ cards'].map(h => (
                        <th key={h} style={{
                          textAlign: h === 'Player' ? 'left' : 'center',
                          padding: '8px 12px',
                          color: V.muted, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                          borderBottom: `1px solid ${V.line}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => {
                      const nil = stats[p.id].nil
                      const cell = (g) => g.count === 0
                        ? <span style={{ color: V.muted }}>—</span>
                        : (
                          <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: pctColor(g.pct) }}>
                              {g.pct}%
                            </div>
                            <div style={{ color: V.muted, fontSize: 9 }}>{g.made}/{g.count} made</div>
                          </div>
                        )
                      return (
                        <tr key={p.id} style={{ background: i % 2 === 0 ? V.bg2 : 'transparent' }}>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar player={p} size={28} />
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink }}>{p.displayName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}`, textAlign: 'center' }}>{cell(nil.overall)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}`, textAlign: 'center' }}>{cell(nil.small)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}`, textAlign: 'center' }}>{cell(nil.large)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ── Section 2: Accuracy by card count ── */}
            <Section label="Accuracy by card count">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map(p => {
                  const cs = stats[p.id].cards
                  const allCnts = Object.keys(cs.byCnt).map(Number).sort((a, b) => a - b)
                  return (
                    <div
                      key={p.id}
                      style={{ background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '14px 16px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: allCnts.length > 0 ? 10 : 0, flexWrap: 'wrap' }}>
                        <Avatar player={p} size={36} />
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink }}>{p.displayName}</div>
                        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                          {[['1–4', cs.small], ['5+', cs.large]].map(([label, g]) => (
                            <div key={label} style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 68 }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>{label} cards</div>
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: pctColor(g.pct) }}>
                                {g.pct !== null ? `${g.pct}%` : '—'}
                              </div>
                              {g.rounds > 0 && (
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{g.made}/{g.rounds}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {allCnts.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {allCnts.map(cnt => {
                            const g = cs.byCnt[cnt]
                            return (
                              <div key={cnt} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', gap: 3, alignItems: 'center' }}>
                                <span style={{ color: V.ink2 }}>{cnt}c</span>
                                <span style={{ color: pctColor(g.pct) }}>{g.made}/{g.rounds}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* ── Section 3: Dealer burden ── */}
            <Section label="Dealer burden">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: V.bg2 }}>
                      {['Player', 'Times dealt', 'Made/total', 'Success %'].map(h => (
                        <th key={h} style={{
                          textAlign: h === 'Player' ? 'left' : 'center',
                          padding: '8px 12px',
                          color: V.muted, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                          borderBottom: `1px solid ${V.line}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => {
                      const d = stats[p.id].dealer
                      return (
                        <tr key={p.id} style={{ background: i % 2 === 0 ? V.bg2 : 'transparent' }}>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar player={p} size={28} />
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink }}>{p.displayName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}`, textAlign: 'center', color: V.ink2 }}>{d.total}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}`, textAlign: 'center', color: V.ink2 }}>
                            {d.total > 0 ? `${d.made}/${d.total}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${V.line}`, textAlign: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: pctColor(d.pct) }}>
                              {d.pct !== null ? `${d.pct}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ── Section 4: Streaks ── */}
            <Section label="Best streaks">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map(p => {
                  const sk = stats[p.id].streaks
                  return (
                    <div
                      key={p.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 16px', flexWrap: 'wrap' }}
                    >
                      <Avatar player={p} size={44} />
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: V.ink, flex: 1, minWidth: 80 }}>{p.displayName}</div>
                      <div style={{ display: 'flex', gap: 24, textAlign: 'center' }}>
                        <StatCell label="Best made" val={sk.madeBest} sub="in a row" color={V.accent3} />
                        <StatCell label="Best missed" val={sk.missedBest} sub="in a row" color={sk.missedBest > 0 ? V.accent2 : V.muted} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* ── Section 5: Fun stats ── */}
            <Section label="Fun stats" last>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map(p => {
                  const { best, trump, ratio, drift } = stats[p.id]
                  const driftColor = drift === null ? V.muted : Math.abs(drift) < 0.3 ? V.accent3 : V.accent2
                  const driftVal = drift === null ? '—' : drift > 0 ? `+${drift.toFixed(1)}` : drift.toFixed(1)
                  return (
                    <div
                      key={p.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 16px', flexWrap: 'wrap' }}
                    >
                      <Avatar player={p} size={36} />
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink, minWidth: 80 }}>{p.displayName}</div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <StatCell
                          label="Best round"
                          val={best !== null ? `+${best}` : '—'}
                          sub="highest score"
                          color={best !== null ? V.accent3 : V.muted}
                        />
                        <StatCell
                          label="Trump affinity"
                          val={trump ? `${trump.glyph} ${trump.name}` : '—'}
                          sub={trump ? `${trump.pct}% on ${trump.total}` : undefined}
                        />
                        <StatCell
                          label="Risk appetite"
                          val={ratio !== null ? `${Math.round(ratio * 100)}%` : '—'}
                          sub="avg bid/cards"
                          color={ratio !== null ? (ratio > 0.6 ? V.accent2 : ratio > 0.4 ? V.accent : V.accent3) : V.muted}
                        />
                        <StatCell
                          label="Bid drift"
                          val={driftVal}
                          sub="avg over/under"
                          color={driftColor}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
                  <b style={{ color: V.ink2 }}>Risk appetite</b> — avg bid as % of cards dealt. Higher = more aggressive bidder.
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
                  <b style={{ color: V.ink2 }}>Bid drift</b> — avg (bid − took) per round. Positive = tends to overbid; negative = tends to underbid; near 0 = well-calibrated.
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
