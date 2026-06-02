import { useEffect, useMemo } from 'react'
import Avatar from './Avatar'
import {
  trumpById,
  computeTotals,
  playerAccuracy,
  nilBidStats,
  cardCountStats,
  dealerBurden,
  playerStreaks,
  bestRoundScore,
  favoriteTrump,
  avgBidRatio,
  netBidDrift,
  groupBidStats,
  groupTrumpStats,
  closestCallCount,
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
      {sub ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{sub}</div> : null}
    </div>
  )
}

function HeroCard({ leftBorderColor, watermark, children }) {
  return (
    <div style={{
      flexShrink: 0,
      width: 192,
      background: V.bg2,
      border: `1px solid ${V.line}`,
      borderLeft: leftBorderColor ? `4px solid ${leftBorderColor}` : `1px solid ${V.line}`,
      borderRadius: 14,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {watermark ? (
        <div aria-hidden="true" style={{
          position: 'absolute', right: -4, bottom: -14,
          fontFamily: 'var(--font-display)', fontSize: 96, fontWeight: 700,
          color: leftBorderColor ?? V.line, opacity: 0.07, lineHeight: 1,
          userSelect: 'none', pointerEvents: 'none', letterSpacing: '-0.05em',
        }}>
          {watermark}
        </div>
      ) : null}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function HeroLabel({ children }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 4 }}>
      {children}
    </div>
  )
}

function AwardPlaque({ def, holders }) {
  return (
    <div style={{
      background: V.bg2,
      border: `1px solid ${V.line}`,
      borderLeft: `4px solid ${def.color}`,
      borderRadius: 10,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', right: 4, bottom: -12,
        fontSize: 76, color: def.color, opacity: 0.07, lineHeight: 1,
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {def.icon}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, lineHeight: 1 }} aria-hidden="true">{def.icon}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: def.color }}>{def.label}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginBottom: 9 }}>{def.desc}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {holders.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.displayName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const TITLE_DEFS = [
  { key: 'oracle',  icon: '◎', label: 'The Oracle',   desc: 'Highest accuracy',       color: V.accent3 },
  { key: 'hothand', icon: '🔥', label: 'Hot Hand',     desc: 'Longest made streak',    color: V.accent3 },
  { key: 'icecold', icon: '❄',  label: 'Ice Cold',     desc: 'Longest miss streak',    color: V.accent2 },
  { key: 'gambler', icon: '◈',  label: 'The Gambler',  desc: 'Most aggressive bidder', color: V.accent  },
  { key: 'nil',     icon: '○',  label: 'Nil Achiever', desc: 'Bid zero · held zero',   color: V.accent3 },
  { key: 'closest', icon: '≈',  label: 'Closest Call', desc: 'Most one-trick misses',  color: V.accent  },
]

function StatsModalContent({ onClose, game, players, completedRounds }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const variant = game.scoring_variant
  const isComplete = game.status === 'complete'

  const totals = useMemo(
    () => computeTotals(players, completedRounds, variant),
    [players, completedRounds, variant],
  )
  const sorted = useMemo(
    () => [...players].sort((a, b) => totals[b.id] - totals[a.id]),
    [players, totals],
  )
  const stats = useMemo(() => Object.fromEntries(players.map(p => [p.id, {
    nil:     nilBidStats(p.id, completedRounds),
    cards:   cardCountStats(p.id, completedRounds),
    dealer:  dealerBurden(p.id, completedRounds),
    streaks: playerStreaks(p.id, completedRounds),
    best:    bestRoundScore(p.id, completedRounds, variant),
    trump:   favoriteTrump(p.id, completedRounds),
    ratio:   avgBidRatio(p.id, completedRounds),
    drift:   netBidDrift(p.id, completedRounds),
    acc:     playerAccuracy(p.id, completedRounds),
    cc:      closestCallCount(p.id, completedRounds),
  }])), [players, completedRounds, variant])

  const grpBid         = useMemo(() => groupBidStats(players, completedRounds),   [players, completedRounds])
  const grpTrump       = useMemo(() => groupTrumpStats(players, completedRounds), [players, completedRounds])
  const grpTrumpSorted = useMemo(() => [...grpTrump].sort((a, b) => b.pct - a.pct), [grpTrump])

  const accLeader = useMemo(() => {
    if (completedRounds.length === 0) return null
    const list = players.map(p => ({ p, pct: stats[p.id].acc.pct }))
    const maxPct = Math.max(...list.map(x => x.pct))
    if (maxPct === 0) return null
    return { players: list.filter(x => x.pct === maxPct).map(x => x.p), pct: maxPct }
  }, [players, stats, completedRounds.length])

  const streakLeaders = useMemo(() => {
    const maxMade   = Math.max(...players.map(p => stats[p.id].streaks.madeBest))
    const maxMissed = Math.max(...players.map(p => stats[p.id].streaks.missedBest))
    return {
      hot:       maxMade   > 0 ? players.filter(p => stats[p.id].streaks.madeBest   === maxMade)   : [],
      cold:      maxMissed > 0 ? players.filter(p => stats[p.id].streaks.missedBest === maxMissed) : [],
      hotStreak:  maxMade,
      coldStreak: maxMissed,
    }
  }, [players, stats])

  const titles = useMemo(() => {
    const maxAcc    = Math.max(...players.map(p => stats[p.id].acc.pct))
    const maxMade   = Math.max(...players.map(p => stats[p.id].streaks.madeBest))
    const maxMissed = Math.max(...players.map(p => stats[p.id].streaks.missedBest))
    const rList     = players.filter(p => stats[p.id].ratio !== null)
    const maxRatio  = rList.length > 0 ? Math.max(...rList.map(p => stats[p.id].ratio)) : null
    const maxCC     = Math.max(...players.map(p => stats[p.id].cc))
    return {
      oracle:  maxAcc   > 0       ? players.filter(p => stats[p.id].acc.pct            === maxAcc)   : [],
      hothand: maxMade  > 0       ? players.filter(p => stats[p.id].streaks.madeBest   === maxMade)  : [],
      icecold: maxMissed > 0      ? players.filter(p => stats[p.id].streaks.missedBest === maxMissed): [],
      gambler: maxRatio !== null  ? players.filter(p => stats[p.id].ratio              === maxRatio) : [],
      nil:     players.filter(p => stats[p.id].nil.overall.made > 0),
      closest: maxCC   > 0       ? players.filter(p => stats[p.id].cc                 === maxCC)    : [],
    }
  }, [players, stats])

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
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.01em', color: V.ink, margin: '6px 0 0' }} translate="no">
              {game.name || 'Ka·Chu·Fu·L'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close stats"
            style={{ background: 'transparent', border: 'none', color: V.muted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px', touchAction: 'manipulation' }}
          >×</button>
        </div>

        {completedRounds.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: V.muted, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No completed rounds yet
          </div>
        ) : (
          <>
            {/* ── Hero Cards Strip ── */}
            <div style={{ padding: '18px 28px 0', borderBottom: `1px solid ${V.line}` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 10 }}>
                At a glance
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 18, scrollbarWidth: 'thin' }}>

                {/* Accuracy Leader */}
                {accLeader ? (
                  <HeroCard leftBorderColor={accLeader.players[0].color} watermark={String(accLeader.pct)}>
                    <HeroLabel>Accuracy Leader</HeroLabel>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: accLeader.players[0].color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                      {accLeader.pct}%
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {accLeader.players.slice(0, 2).map(p => (
                        <span key={p.id} style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: p.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 88 }}>
                          {p.displayName}
                        </span>
                      ))}
                      {accLeader.players.length > 2 ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>+{accLeader.players.length - 2}</span> : null}
                    </div>
                    <div style={{ marginTop: 10, borderTop: `1px solid ${V.line}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {streakLeaders.hot.length > 0 ? (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.accent3, display: 'flex', gap: 5, overflow: 'hidden' }}>
                          <span aria-hidden="true">🔥</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {streakLeaders.hot[0].displayName} · {streakLeaders.hotStreak}
                          </span>
                        </div>
                      ) : null}
                      {streakLeaders.cold.length > 0 ? (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.accent2, display: 'flex', gap: 5, overflow: 'hidden' }}>
                          <span aria-hidden="true">🧊</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {streakLeaders.cold[0].displayName} · {streakLeaders.coldStreak}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </HeroCard>
                ) : null}

                {/* Most Dramatic Round */}
                {grpBid.mostChaotic && grpBid.mostChaotic.failCount > 0 ? (
                  <HeroCard leftBorderColor={V.accent2} watermark={String(grpBid.mostChaotic.roundNumber)}>
                    <HeroLabel>Most Dramatic</HeroLabel>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Round</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: V.accent2, letterSpacing: '-0.05em', lineHeight: 1 }}>
                      {grpBid.mostChaotic.roundNumber}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.accent2, marginTop: 4 }}>
                      {grpBid.mostChaotic.failCount}/{players.length} failed
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 6 }}>
                      {trumpById.get(grpBid.mostChaotic.trump)?.glyph ?? '?'} · {grpBid.mostChaotic.cards}c
                    </div>
                  </HeroCard>
                ) : null}

                {/* The Table */}
                <HeroCard leftBorderColor={V.accent} watermark="≡">
                  <HeroLabel>The Table</HeroLabel>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, color: V.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                      {grpBid.loneWolfRounds}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 3 }}>lone wolf rounds</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>only 1 player fell</div>
                  </div>
                  <div style={{ marginTop: 10, borderTop: `1px solid ${V.line}`, paddingTop: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.ink2 }}>
                      {grpBid.overRounds} over · {grpBid.underRounds} under
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 4 }}>
                      {grpBid.totalTricks} total tricks
                    </div>
                  </div>
                </HeroCard>

                {/* Group Trump */}
                {grpTrumpSorted.length >= 2 ? (
                  <HeroCard leftBorderColor={V.accent3} watermark={grpTrumpSorted[0].glyph}>
                    <HeroLabel>Group Trump</HeroLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>Best</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.accent3, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {grpTrumpSorted[0].glyph} {grpTrumpSorted[0].pct}%
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{grpTrumpSorted[0].name}</div>
                      </div>
                      <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 8 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>Worst</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.accent2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {grpTrumpSorted[grpTrumpSorted.length - 1].glyph} {grpTrumpSorted[grpTrumpSorted.length - 1].pct}%
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{grpTrumpSorted[grpTrumpSorted.length - 1].name}</div>
                      </div>
                    </div>
                  </HeroCard>
                ) : null}
              </div>
            </div>

            {/* ── Section 1: Zero bids ── */}
            <Section label="Zero bids · called nil">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: V.bg2 }}>
                      {['Player', 'Overall', '≤4 cards', '5+ cards'].map(h => (
                        <th key={h} scope="col" style={{
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
                      const cell = g => g.count === 0
                        ? <span style={{ color: V.muted }}>—</span>
                        : (
                          <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: pctColor(g.pct) }}>{g.pct}%</div>
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
                    <div key={p.id} style={{ background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '14px 16px' }}>
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
                              {g.rounds > 0 ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{g.made}/{g.rounds}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                      {allCnts.length > 0 ? (
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
                      ) : null}
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
                        <th key={h} scope="col" style={{
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
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
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
            <Section label="Fun stats" last={!isComplete}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map(p => {
                  const { best, trump, ratio, drift, cc } = stats[p.id]
                  const driftColor = drift === null ? V.muted : Math.abs(drift) < 0.3 ? V.accent3 : V.accent2
                  const driftVal   = drift === null ? '—' : drift > 0 ? `+${drift.toFixed(1)}` : drift.toFixed(1)
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                      <Avatar player={p} size={36} />
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink, minWidth: 80 }}>{p.displayName}</div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <StatCell label="Best round" val={best !== null ? `+${best}` : '—'} sub="highest score" color={best !== null ? V.accent3 : V.muted} />
                        <StatCell label="Trump affinity" val={trump ? `${trump.glyph} ${trump.name}` : '—'} sub={trump ? `${trump.pct}% on ${trump.total}` : undefined} />
                        <StatCell label="Risk appetite" val={ratio !== null ? `${Math.round(ratio * 100)}%` : '—'} sub="avg bid/cards" color={ratio !== null ? (ratio > 0.6 ? V.accent2 : ratio > 0.4 ? V.accent : V.accent3) : V.muted} />
                        <StatCell label="Bid drift" val={driftVal} sub="avg over/under" color={driftColor} />
                        <StatCell label="Close calls" val={cc} sub="missed by ±1" color={cc > 0 ? V.accent : V.muted} />
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

            {/* ── Section 6: Honorary Titles — end-game only ── */}
            {isComplete ? (
              <Section label="Honorary Titles" last>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {TITLE_DEFS.map(def => {
                    const holders = titles[def.key]
                    if (!holders || holders.length === 0) return null
                    return <AwardPlaque key={def.key} def={def} holders={holders} />
                  })}
                </div>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default function StatsModal(props) {
  if (!props.open || !props.game || props.players.length === 0) return null
  return <StatsModalContent {...props} />
}
