import { useState, useEffect, useMemo } from 'react'
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

function StatCell({ label, val, sub, color }) {
  return (
    <div style={{ minWidth: 68, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: color ?? V.ink, letterSpacing: '-0.01em' }}>{val}</div>
      {sub ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{sub}</div> : null}
    </div>
  )
}

function HeroCard({ label, leftBorderColor, watermark, children }) {
  return (
    <div style={{
      background: V.bg2,
      border: `1px solid ${V.line}`,
      borderLeft: `4px solid ${leftBorderColor ?? V.line}`,
      borderRadius: 14,
      padding: '16px 18px',
      position: 'relative',
      overflow: 'hidden',
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
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 8 }}>
          {label}
        </div>
        {children}
      </div>
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

function PlayerDossier({ ps }) {
  const driftColor = ps.drift === null ? V.muted : Math.abs(ps.drift) < 0.3 ? V.accent3 : V.accent2
  const driftVal   = ps.drift === null ? '—' : ps.drift > 0 ? `+${ps.drift.toFixed(1)}` : ps.drift.toFixed(1)
  const nilCats    = [['Overall', ps.nil.overall], ['≤4c', ps.nil.small], ['5+c', ps.nil.large]].filter(([, g]) => g.count > 0)
  const allCnts    = Object.keys(ps.cards.byCnt).map(Number).sort((a, b) => a - b)

  return (
    <div className="stats-dossier-in">
      {/* Left callouts + right sections */}
      <div className="stats-dossier-split">

        {/* Left: 3 big callouts */}
        <div className="stats-dossier-left">
          {/* Accuracy */}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, color: ps.acc.total > 0 ? pctColor(ps.acc.pct) : V.muted, letterSpacing: '-0.05em', lineHeight: 1 }}>
              {ps.acc.total > 0 ? `${ps.acc.pct}%` : '—'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>Accuracy</div>
            {ps.acc.total > 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.ink2, marginTop: 3 }}>{ps.acc.made}/{ps.acc.total} made</div>
            ) : null}
          </div>

          {/* Streaks */}
          <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: ps.streaks.madeBest > 0 ? V.accent3 : V.muted, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {ps.streaks.madeBest}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 3 }}>🔥 best</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: ps.streaks.missedBest > 0 ? V.accent2 : V.muted, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {ps.streaks.missedBest}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 3 }}>🧊 worst</div>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 6 }}>streaks</div>
          </div>

          {/* Trump affinity */}
          <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 16, marginTop: 16 }}>
            {ps.trump ? (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: (ps.trump.id === 'hearts' || ps.trump.id === 'diamonds') ? V.accent2 : V.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {ps.trump.glyph}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink2, marginTop: 4 }}>{ps.trump.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{ps.trump.pct}% on {ps.trump.total}</div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: V.muted }}>—</div>
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>Best trump</div>
          </div>
        </div>

        {/* Right: compact sections */}
        <div className="stats-dossier-right">
          {/* Nil bids */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 8 }}>Zero bids</div>
            {nilCats.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted }}>No nil bids placed</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {nilCats.map(([label, g]) => (
                  <div key={label} style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: pctColor(g.pct) }}>{g.pct}%</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: V.muted }}>{g.made}/{g.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accuracy by count */}
          <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 14, marginTop: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 8 }}>Accuracy by count</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {[['1–4 cards', ps.cards.small], ['5+ cards', ps.cards.large]].map(([label, g]) => (
                <div key={label} style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 72 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: pctColor(g.pct) }}>
                    {g.pct !== null ? `${g.pct}%` : '—'}
                  </div>
                  {g.rounds > 0 ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: V.muted }}>{g.made}/{g.rounds}</div> : null}
                </div>
              ))}
            </div>
            {allCnts.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allCnts.map(cnt => {
                  const g = ps.cards.byCnt[cnt]
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

          {/* Dealer burden */}
          <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 14, marginTop: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 8 }}>Dealer burden</div>
            {ps.dealer.total === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted }}>Not dealt yet</div>
            ) : (
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: V.ink2, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {ps.dealer.total}×
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 2 }}>times dealt</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: pctColor(ps.dealer.pct), letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {ps.dealer.pct}%
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 2 }}>{ps.dealer.made}/{ps.dealer.total} made</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fun stats bar */}
      <div style={{ borderTop: `1px solid ${V.line}`, padding: '14px 20px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <StatCell
          label="Best round"
          val={ps.best !== null ? `+${ps.best}` : '—'}
          sub="highest score"
          color={ps.best !== null ? V.accent3 : V.muted}
        />
        <StatCell
          label="Risk appetite"
          val={ps.ratio !== null ? `${Math.round(ps.ratio * 100)}%` : '—'}
          sub="avg bid/cards"
          color={ps.ratio !== null ? (ps.ratio > 0.6 ? V.accent2 : ps.ratio > 0.4 ? V.accent : V.accent3) : V.muted}
        />
        <StatCell label="Bid drift" val={driftVal} sub="avg over/under" color={driftColor} />
        <StatCell
          label="Close calls"
          val={ps.cc}
          sub="missed by ±1"
          color={ps.cc > 0 ? V.accent : V.muted}
        />
      </div>
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
          <b style={{ color: V.ink2 }}>Risk appetite</b> — avg bid as % of cards dealt.
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
          <b style={{ color: V.ink2 }}>Bid drift</b> — avg (bid − took). Positive = overbids; negative = underbids.
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
  const [activeTab, setActiveTab]           = useState('glance')
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const variant = game.scoring_variant

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

  const effectiveId    = selectedPlayerId ?? sorted[0]?.id ?? null
  const selectedPlayer = players.find(p => p.id === effectiveId) ?? null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,14,21,.78)',
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
        {/* ── Header ── */}
        <div style={{ padding: '22px 28px 14px', borderBottom: `1px solid ${V.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
                Stats · {completedRounds.length} rounds
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: V.ink, margin: '5px 0 0' }} translate="no">
                {game.name || 'Ka·Chu·Fu·L'}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close stats"
              style={{ background: 'transparent', border: 'none', color: V.muted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px', marginTop: 2, touchAction: 'manipulation' }}
            >×</button>
          </div>
          {/* Tab pills */}
          <div role="tablist" style={{ display: 'flex', gap: 4 }}>
            {[['glance', 'At a Glance'], ['player', 'By Player']].map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: 'none',
                  background: activeTab === tab ? V.accent : 'transparent',
                  color: activeTab === tab ? '#2a1620' : V.muted,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab ? 700 : 400,
                  transition: 'background 0.15s ease, color 0.15s ease',
                  touchAction: 'manipulation',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {completedRounds.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: V.muted, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No completed rounds yet
          </div>
        ) : activeTab === 'glance' ? (
          <div key="glance" className="stats-tab-in" role="tabpanel">
            {/* 2×2 Hero grid */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${V.line}` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 10 }}>
                At a glance
              </div>
              <div className="stats-hero-grid">

                {/* Accuracy Leader */}
                <HeroCard
                  label="Accuracy Leader"
                  leftBorderColor={accLeader ? accLeader.players[0].color : V.line}
                  watermark={accLeader ? String(accLeader.pct) : '—'}
                >
                  {accLeader ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 40, color: accLeader.players[0].color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {accLeader.pct}%
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        {accLeader.players.slice(0, 2).map(p => (
                          <span key={p.id} style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: p.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
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
                    </>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>No data yet</div>
                  )}
                </HeroCard>

                {/* Most Dramatic Round */}
                <HeroCard
                  label="Most Dramatic"
                  leftBorderColor={V.accent2}
                  watermark={grpBid.mostChaotic ? String(grpBid.mostChaotic.roundNumber) : '?'}
                >
                  {grpBid.mostChaotic && grpBid.mostChaotic.failCount > 0 ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Round</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: V.accent2, letterSpacing: '-0.05em', lineHeight: 1 }}>
                        {grpBid.mostChaotic.roundNumber}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.accent2, marginTop: 4 }}>
                        {grpBid.mostChaotic.failCount}/{players.length} failed
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 6 }}>
                        {trumpById.get(grpBid.mostChaotic.trump)?.glyph ?? '?'} · {grpBid.mostChaotic.cards}c
                      </div>
                    </>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>No drama yet</div>
                  )}
                </HeroCard>

                {/* The Table */}
                <HeroCard label="The Table" leftBorderColor={V.accent} watermark="≡">
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: V.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                      {grpBid.loneWolfRounds}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 3 }}>lone wolf rounds</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>only 1 player fell</div>
                  </div>
                  <div style={{ marginTop: 12, borderTop: `1px solid ${V.line}`, paddingTop: 10 }}>
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
                  <HeroCard label="Group Trump" leftBorderColor={V.accent3} watermark={grpTrumpSorted[0].glyph}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>Best</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.accent3, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {grpTrumpSorted[0].glyph} {grpTrumpSorted[0].pct}%
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{grpTrumpSorted[0].name}</div>
                      </div>
                      <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 10 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>Worst</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.accent2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {grpTrumpSorted[grpTrumpSorted.length - 1].glyph} {grpTrumpSorted[grpTrumpSorted.length - 1].pct}%
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{grpTrumpSorted[grpTrumpSorted.length - 1].name}</div>
                      </div>
                    </div>
                  </HeroCard>
                ) : (
                  <HeroCard label="Group Trump" leftBorderColor={V.line} watermark="?">
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>Need 2+ suits played</div>
                  </HeroCard>
                )}
              </div>
            </div>

            {/* Honorary Titles */}
            <div style={{ padding: '18px 24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>
                Honorary Titles
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {TITLE_DEFS.map(def => {
                  const holders = titles[def.key]
                  if (!holders || holders.length === 0) return null
                  return <AwardPlaque key={def.key} def={def} holders={holders} />
                })}
              </div>
            </div>
          </div>
        ) : (
          <div key="player" className="stats-tab-in" role="tabpanel">
            {/* Player chip strip */}
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${V.line}`, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'thin' }}>
              {sorted.map(p => {
                const isActive = effectiveId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayerId(p.id)}
                    aria-label={`View stats for ${p.displayName}`}
                    style={{
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 12px',
                      background: isActive ? `${p.color}1a` : 'transparent',
                      border: `2px solid ${isActive ? p.color : 'transparent'}`,
                      borderRadius: 32,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      touchAction: 'manipulation',
                    }}
                  >
                    <Avatar player={p} size={26} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: isActive ? p.color : V.ink2, whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isActive ? p.color : V.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {totals[p.id]}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Player dossier */}
            {selectedPlayer ? (
              <PlayerDossier key={effectiveId} ps={stats[selectedPlayer.id]} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StatsModal(props) {
  if (!props.open || !props.game || props.players.length === 0) return null
  return <StatsModalContent {...props} />
}
