import { useState, useEffect, useMemo, useRef, memo } from 'react'
import Avatar from './Avatar'
import { TITLE_DEFS, computeTitleLeaderboards } from '../../lib/gameTitles'
import {
  TRUMPS,
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
  scoreFor,
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

// ── Score progression chart ────────────────────────────────────────────────────
function cumulativeScoreByRound(playerId, rounds, variant) {
  const out = [0]
  let running = 0
  for (const r of rounds) {
    running += scoreFor(r.bids[playerId], r.took[playerId], variant)
    out.push(running)
  }
  return out
}

function ProgressionChart({ players, rounds, variant, hiddenPlayers, leader }) {
  const W = 900, H = 260
  const padL = 40, padR = 100, padT = 14, padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const N = rounds.length

  const series = useMemo(() => players.map(p => ({
    p,
    pts: cumulativeScoreByRound(p.id, rounds, variant),
  })), [players, rounds, variant])

  const seriesById = useMemo(() => new Map(series.map(s => [s.p.id, s.pts])), [series])

  const drawOrder = useMemo(() => [...series].sort((a, b) =>
    a.p.id === leader?.id ? 1 : b.p.id === leader?.id ? -1 : 0,
  ), [series, leader])

  const svgRef = useRef(null)
  const [hoverRound, setHoverRound] = useState(null)

  const maxY   = Math.max(...series.flatMap(s => s.pts), 10)
  const yTicks = Math.max(1, Math.ceil(maxY / 50))

  const xFor = n => padL + (N > 0 ? (n / N) : 0) * plotW
  const yFor = v => padT + plotH - (v / (yTicks * 50)) * plotH

  const onMove = e => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xSvg = ((e.clientX - rect.left) / rect.width) * W
    const raw  = ((xSvg - padL) / plotW) * N
    setHoverRound(Math.max(0, Math.min(N, Math.round(raw))))
  }

  const tooltipRows = hoverRound != null
    ? players
        .filter(p => !hiddenPlayers[p.id])
        .map(p => ({ p, total: seriesById.get(p.id)[hoverRound] }))
        .sort((a, b) => b.total - a.total)
    : []
  const tipLeftPct = hoverRound != null ? (xFor(hoverRound) / W) * 100 : 0
  const flipLeft   = tipLeftPct > 62
  const hovTrump   = hoverRound != null && hoverRound > 0
    ? trumpById.get(rounds[hoverRound - 1].trump) ?? null
    : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', display: 'block' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverRound(null)}
      >
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + plotH - (i / yTicks) * plotH
          return (
            <g key={i}>
              <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke={V.line} strokeWidth="1" opacity="0.5" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill={V.muted}>{i * 50}</text>
            </g>
          )
        })}
        {Array.from({ length: N + 1 }).map((_, n) => {
          const x = xFor(n)
          return (
            <g key={n}>
              <line x1={x} x2={x} y1={padT + plotH} y2={padT + plotH + 4} stroke={V.line} strokeWidth="1" />
              {n > 0 ? <text x={x} y={padT + plotH + 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill={V.muted}>R{n}</text> : null}
            </g>
          )
        })}
        <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke={V.line} strokeWidth="1.5" />
        <line x1={padL} x2={padL}         y1={padT}         y2={padT + plotH} stroke={V.line} strokeWidth="1.5" />

        {drawOrder.map(({ p, pts }) => {
          if (hiddenPlayers[p.id]) return null
          const isLeader = p.id === leader?.id
          const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ')
          return (
            <g key={p.id}>
              <path d={d} fill="none" stroke={p.color} strokeWidth={isLeader ? 2.5 : 1.5} opacity={isLeader ? 1 : 0.55} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={isLeader ? 3.5 : 2.5} fill={p.color} opacity={isLeader ? 1 : 0.55} />
              ))}
              <text x={xFor(N) + 7} y={yFor(pts[N]) + 4} fontFamily="var(--font-mono)" fontSize="10" fill={p.color} opacity={isLeader ? 1 : 0.75}>
                {p.displayName} · {pts[N]}
              </text>
            </g>
          )
        })}

        {hoverRound != null ? (
          <g pointerEvents="none">
            <line x1={xFor(hoverRound)} x2={xFor(hoverRound)} y1={padT} y2={padT + plotH} stroke={V.accent} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
            {drawOrder.map(({ p, pts }) => {
              if (hiddenPlayers[p.id]) return null
              return <circle key={p.id} cx={xFor(hoverRound)} cy={yFor(pts[hoverRound])} r={5} fill={p.color} stroke={V.bg} strokeWidth="2" />
            })}
          </g>
        ) : null}
      </svg>

      {hoverRound != null && tooltipRows.length > 0 ? (
        <div style={{
          position: 'absolute', top: 6,
          left:  flipLeft ? 'auto' : `calc(${tipLeftPct}% + 10px)`,
          right: flipLeft ? `calc(${100 - tipLeftPct}% + 10px)` : 'auto',
          background: V.surface, border: `1px solid ${V.line}`, borderRadius: 10,
          padding: '8px 12px', pointerEvents: 'none', minWidth: 130,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginBottom: 6, display: 'flex', gap: 8 }}>
            <span>{hoverRound === 0 ? 'Start' : `After R${hoverRound}`}</span>
            {hovTrump ? <span style={{ color: hovTrump.red ? 'var(--color-red-suit)' : V.ink2 }}>{hovTrump.glyph} {rounds[hoverRound - 1].cards}×</span> : null}
          </div>
          {tooltipRows.map(row => (
            <div key={row.p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.p.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: V.ink, flex: 1 }}>{row.p.displayName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: V.ink, fontVariantNumeric: 'tabular-nums' }}>{row.total}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── Metric card definitions ───────────────────────────────────────────────────
// Each: key, label, sub, icon, iconColor,
//   sort: 'max' (highest wins) | 'calibrated' (nearest 0 wins)
//   getValue(ps) → number|null, render(ps) → string|null, color(ps) → cssColor
const METRIC_CARDS = [
  { key: 'acc',
    label: 'Accuracy', sub: 'overall bid accuracy', icon: '◎', iconColor: V.accent3,
    sort: 'max',
    getValue: ps => ps.acc.total > 0 ? ps.acc.pct : null,
    render:   ps => ps.acc.total > 0 ? `${ps.acc.pct}%` : null,
    color:    ps => pctColor(ps.acc.pct) },
  { key: 'nil',
    label: 'Nil Mastery', sub: 'bid zero · took zero', icon: '○', iconColor: V.accent3,
    sort: 'max',
    getValue: ps => ps.nil.overall.count > 0 ? ps.nil.overall.pct : null,
    render:   ps => ps.nil.overall.count > 0 ? `${ps.nil.overall.pct}% · ${ps.nil.overall.count}×` : null,
    color:    ps => pctColor(ps.nil.overall.pct) },
  { key: 'card_sm',
    label: 'Small Rounds', sub: '1–4 card accuracy', icon: '≤4', iconColor: V.accent,
    sort: 'max',
    getValue: ps => ps.cards.small.rounds > 0 ? ps.cards.small.pct : null,
    render:   ps => ps.cards.small.rounds > 0 ? `${ps.cards.small.pct}%` : null,
    color:    ps => pctColor(ps.cards.small.pct) },
  { key: 'card_lg',
    label: 'Large Rounds', sub: '5+ card accuracy', icon: '5+', iconColor: V.accent,
    sort: 'max',
    getValue: ps => ps.cards.large.rounds > 0 ? ps.cards.large.pct : null,
    render:   ps => ps.cards.large.rounds > 0 ? `${ps.cards.large.pct}%` : null,
    color:    ps => pctColor(ps.cards.large.pct) },
  { key: 'dealer',
    label: 'Dealer Accuracy', sub: 'accuracy when dealing', icon: '◑', iconColor: V.accent,
    sort: 'max',
    getValue: ps => ps.dealer.total > 0 ? ps.dealer.pct : null,
    render:   ps => ps.dealer.total > 0 ? `${ps.dealer.pct}% · ${ps.dealer.total}×` : null,
    color:    ps => pctColor(ps.dealer.pct) },
  { key: 'hot',
    label: 'Win Streak', sub: 'best made run', icon: '🔥', iconColor: V.accent3,
    sort: 'max',
    getValue: ps => ps.streaks.madeBest > 0 ? ps.streaks.madeBest : null,
    render:   ps => ps.streaks.madeBest > 0 ? `${ps.streaks.madeBest} in a row` : null,
    color:    () => V.accent3 },
  { key: 'cold',
    label: 'Lose Streak', sub: 'worst miss run', icon: '🧊', iconColor: V.accent2,
    sort: 'max',
    getValue: ps => ps.streaks.missedBest > 0 ? ps.streaks.missedBest : null,
    render:   ps => ps.streaks.missedBest > 0 ? `${ps.streaks.missedBest} in a row` : null,
    color:    () => V.accent2 },
  { key: 'best',
    label: 'Best Round', sub: 'highest single-round score', icon: '★', iconColor: V.accent3,
    sort: 'max',
    getValue: ps => ps.best,
    render:   ps => ps.best !== null ? `+${ps.best} pts` : null,
    color:    () => V.accent3 },
  { key: 'risk',
    label: 'Risk Appetite', sub: 'avg bid as % of cards dealt', icon: '◈', iconColor: V.accent,
    sort: 'max',
    getValue: ps => ps.ratio,
    render:   ps => ps.ratio !== null ? `${Math.round(ps.ratio * 100)}%` : null,
    color:    ps => ps.ratio !== null ? (ps.ratio > 0.6 ? V.accent2 : ps.ratio > 0.4 ? V.accent : V.accent3) : V.muted },
  { key: 'drift',
    label: 'Bid Drift', sub: 'avg bid − took · near 0 = calibrated', icon: '≈', iconColor: V.accent,
    sort: 'calibrated',
    getValue: ps => ps.drift,
    render:   ps => ps.drift !== null ? (ps.drift > 0 ? `+${ps.drift.toFixed(1)}` : ps.drift.toFixed(1)) : null,
    color:    ps => ps.drift === null ? V.muted : Math.abs(ps.drift) < 0.3 ? V.accent3 : V.accent2 },
  { key: 'close',
    label: 'Close Calls', sub: 'times missed by exactly 1', icon: '±1', iconColor: V.accent,
    sort: 'max',
    getValue: ps => ps.cc > 0 ? ps.cc : null,
    render:   ps => ps.cc > 0 ? `${ps.cc}×` : null,
    color:    () => V.accent },
  { key: 'trump',
    label: 'Best Trump', sub: 'strongest performing suit', icon: '♠', iconColor: V.ink2,
    sort: 'max',
    getValue: ps => ps.trump?.pct ?? null,
    render:   ps => ps.trump ? `${ps.trump.glyph} ${ps.trump.pct}%` : null,
    color:    ps => ps.trump ? pctColor(ps.trump.pct) : V.muted },
]

// ── MetricCard ─────────────────────────────────────────────────────────────────
function MetricCardInner({ card, sorted, stats }) {
  const { ranked, vals } = useMemo(() => {
    const vals     = new Map()
    const withData = []
    const noData   = []
    for (const p of sorted) {
      const val = card.getValue(stats[p.id])
      vals.set(p.id, val)
      ;(val !== null ? withData : noData).push(p)
    }
    withData.sort((a, b) =>
      card.sort === 'calibrated'
        ? Math.abs(vals.get(a.id)) - Math.abs(vals.get(b.id))
        : vals.get(b.id) - vals.get(a.id)
    )
    return { ranked: [...withData, ...noData], vals }
  }, [card, sorted, stats])

  const topVal = ranked.length > 0 ? vals.get(ranked[0].id) : null

  const isLeader = p => {
    const val = vals.get(p.id)
    if (val === null || topVal === null) return false
    if (card.sort === 'calibrated') return Math.abs(Math.abs(val) - Math.abs(topVal)) < 0.05
    return val === topVal
  }

  return (
    <div style={{ background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: card.iconColor, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
          {card.icon}
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: V.ink2 }}>
            {card.label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: V.muted, marginTop: 1 }}>
            {card.sub}
          </div>
        </div>
      </div>
      {ranked.map((p, i) => {
        const val      = vals.get(p.id)
        const rendered = card.render(stats[p.id])
        const leader   = isLeader(p)
        return (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 14px',
              borderBottom: i < ranked.length - 1 ? `1px solid ${V.line}` : 'none',
              background: leader ? `color-mix(in oklab, ${p.color} 10%, transparent)` : 'transparent',
            }}
          >
            <div style={{ width: 3, height: 22, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.displayName}
            </span>
            {leader ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: p.color }} aria-hidden="true">★</span> : null}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: leader ? 700 : 500, color: val !== null ? card.color(stats[p.id]) : V.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {rendered ?? '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const MetricCard = memo(MetricCardInner)

// ── Hero card (at-a-glance strip) ─────────────────────────────────────────────
function HeroCard({ leftBorderColor, watermark, children }) {
  return (
    <div style={{
      flexShrink: 0, width: 192,
      background: V.bg2, border: `1px solid ${V.line}`,
      borderLeft: leftBorderColor ? `4px solid ${leftBorderColor}` : `1px solid ${V.line}`,
      borderRadius: 14, padding: '14px 16px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {watermark ? (
        <div aria-hidden="true" style={{ position: 'absolute', right: -4, bottom: -14, fontFamily: 'var(--font-display)', fontSize: 96, fontWeight: 700, color: leftBorderColor ?? V.line, opacity: 0.07, lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-0.05em' }}>
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

// ── Title leaderboard card (Titles tab) ───────────────────────────────────────
function TitleLeaderboardCard({ def, board }) {
  if (!board?.available) {
    return (
      <div style={{ background: V.bg2, border: `1px solid ${V.line}`, borderLeft: `3px solid ${V.line}`, borderRadius: 10, padding: '12px 14px', opacity: 0.45 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }} aria-hidden>{def.icon}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: V.muted }}>{def.label}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 4 }}>Not enough rounds</div>
      </div>
    )
  }
  return (
    <div style={{ background: V.bg2, border: `1px solid ${V.line}`, borderLeft: `3px solid ${def.color}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px 9px', borderBottom: `1px solid ${V.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, lineHeight: 1, color: def.color }} aria-hidden>{def.icon}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: def.color }}>{def.label}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: V.muted, marginTop: 3, letterSpacing: '.06em' }}>{def.desc}</div>
      </div>
      {board.rows.map((row, i) => (
        <div
          key={row.player.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 14px',
            borderBottom: i < board.rows.length - 1 ? `1px solid ${V.line}` : 'none',
            background: row.isWinner ? `color-mix(in oklab, ${def.color} 9%, transparent)` : 'transparent',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, width: 12, flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.player.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: row.isWinner ? 700 : 600, fontSize: 12, color: row.isWinner ? def.color : V.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.player.displayName}
          </span>
          {row.isWinner ? <span style={{ fontSize: 8, color: def.color }} aria-hidden>★</span> : null}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: row.isWinner ? 700 : 500, color: row.isWinner ? def.color : V.ink2, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {row.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main modal content ─────────────────────────────────────────────────────────
function StatsModalContent({ onClose, game, players, completedRounds }) {
  const [hiddenPlayers, setHiddenPlayers] = useState({})

  const variant    = game.scoring_variant
  const isComplete = game.status === 'complete'

  const [activeTab, setActiveTab] = useState(isComplete ? 'titles' : 'stats')

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totals = useMemo(() => computeTotals(players, completedRounds, variant), [players, completedRounds, variant])
  const sorted = useMemo(() => [...players].sort((a, b) => totals[b.id] - totals[a.id]), [players, totals])
  const leader = sorted[0] ?? null

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
    let maxPct = 0
    for (const p of players) {
      const pct = stats[p.id].acc.pct
      if (pct > maxPct) maxPct = pct
    }
    if (maxPct === 0) return null
    return { players: players.filter(p => stats[p.id].acc.pct === maxPct), pct: maxPct }
  }, [players, stats, completedRounds.length])

  const streakLeaders = useMemo(() => {
    let maxMade = 0, maxMissed = 0
    for (const p of players) {
      const s = stats[p.id].streaks
      if (s.madeBest   > maxMade)   maxMade   = s.madeBest
      if (s.missedBest > maxMissed) maxMissed = s.missedBest
    }
    return {
      hot:        maxMade   > 0 ? players.filter(p => stats[p.id].streaks.madeBest   === maxMade)   : [],
      cold:       maxMissed > 0 ? players.filter(p => stats[p.id].streaks.missedBest === maxMissed) : [],
      hotStreak:  maxMade,
      coldStreak: maxMissed,
    }
  }, [players, stats])

  const titleBoards = useMemo(
    () => isComplete ? computeTitleLeaderboards(players, completedRounds, variant) : {},
    [isComplete, players, completedRounds, variant]
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,21,.75)', backdropFilter: 'blur(6px)', zIndex: 100, overflowY: 'auto', overscrollBehavior: 'contain', padding: '40px 16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
        style={{ maxWidth: 760, margin: '0 auto', background: V.surface, border: `1px solid ${V.line}`, borderRadius: 24, overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${V.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
              Stats · {completedRounds.length} rounds played
            </div>
            <h2 id="stats-modal-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.01em', color: V.ink, margin: '6px 0 0' }} translate="no">
              {game.name || 'Ka·Chu·Fu·L'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close stats" className="stats-close-btn" style={{ background: 'transparent', border: 'none', color: V.muted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px', touchAction: 'manipulation' }}>×</button>
        </div>

        {/* ── Tab bar — shown only when game is complete ── */}
        {isComplete && completedRounds.length > 0 ? (
          <div style={{ display: 'flex', borderBottom: `1px solid ${V.line}`, padding: '0 28px', gap: 4 }}>
            {[{ key: 'titles', label: '★ Titles' }, { key: 'stats', label: '◎ Stats' }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? V.accent : 'transparent'}`,
                  padding: '11px 0', marginRight: 20, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
                  color: activeTab === tab.key ? V.accent : V.muted,
                  transition: 'color .15s ease, border-color .15s ease',
                  touchAction: 'manipulation',
                }}
              >{tab.label}</button>
            ))}
          </div>
        ) : null}

        {completedRounds.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: V.muted, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No completed rounds yet
          </div>
        ) : activeTab === 'titles' ? (
          /* ── Titles tab ── */
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 14 }}>
              Where everyone stood · {completedRounds.length} rounds
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {TITLE_DEFS.filter(d => d.key !== 'woodenspoon' && d.key !== 'averagejoe').map(def => (
                <TitleLeaderboardCard key={def.key} def={def} board={titleBoards[def.key]} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Hero Cards Strip ── */}
            <div style={{ padding: '18px 28px 0', borderBottom: `1px solid ${V.line}` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 10 }}>At a glance</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 18, scrollbarWidth: 'thin' }}>

                {accLeader ? (
                  <HeroCard leftBorderColor={accLeader.players[0].color} watermark={String(accLeader.pct)}>
                    <HeroLabel>Accuracy Leader</HeroLabel>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: accLeader.players[0].color, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
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
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{streakLeaders.hot[0].displayName} · {streakLeaders.hotStreak}</span>
                        </div>
                      ) : null}
                      {streakLeaders.cold.length > 0 ? (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.accent2, display: 'flex', gap: 5, overflow: 'hidden' }}>
                          <span aria-hidden="true">🧊</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{streakLeaders.cold[0].displayName} · {streakLeaders.coldStreak}</span>
                        </div>
                      ) : null}
                    </div>
                  </HeroCard>
                ) : null}

                {grpBid.mostChaotic && grpBid.mostChaotic.failCount > 0 ? (
                  <HeroCard leftBorderColor={V.accent2} watermark={String(grpBid.mostChaotic.roundNumber)}>
                    <HeroLabel>Most Dramatic</HeroLabel>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>Round</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: V.accent2, letterSpacing: '-0.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {grpBid.mostChaotic.roundNumber}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.accent2, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {grpBid.mostChaotic.failCount}/{players.length} failed
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 6 }}>
                      {trumpById.get(grpBid.mostChaotic.trump)?.glyph ?? '?'} · {grpBid.mostChaotic.cards}c
                    </div>
                  </HeroCard>
                ) : null}

                <HeroCard leftBorderColor={V.accent} watermark="≡">
                  <HeroLabel>The Table</HeroLabel>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, color: V.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>{grpBid.loneWolfRounds}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 3 }}>lone wolf rounds</div>
                  <div style={{ marginTop: 10, borderTop: `1px solid ${V.line}`, paddingTop: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.ink2 }}>{grpBid.overRounds} over · {grpBid.underRounds} under</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginTop: 4 }}>{grpBid.totalTricks} total tricks</div>
                  </div>
                </HeroCard>

                {grpTrumpSorted.length >= 2 ? (
                  <HeroCard leftBorderColor={V.accent3} watermark={grpTrumpSorted[0].glyph}>
                    <HeroLabel>Group Trump</HeroLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>Best</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.accent3, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{grpTrumpSorted[0].glyph} {grpTrumpSorted[0].pct}%</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{grpTrumpSorted[0].name}</div>
                      </div>
                      <div style={{ borderTop: `1px solid ${V.line}`, paddingTop: 8 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: V.muted }}>Worst</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.accent2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{grpTrumpSorted[grpTrumpSorted.length - 1].glyph} {grpTrumpSorted[grpTrumpSorted.length - 1].pct}%</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted }}>{grpTrumpSorted[grpTrumpSorted.length - 1].name}</div>
                      </div>
                    </div>
                  </HeroCard>
                ) : null}
              </div>
            </div>

            {/* ── Score Progression chart ── */}
            <div style={{ padding: '20px 28px', borderBottom: `1px solid ${V.line}` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 14 }}>
                Score Progression
              </div>
              <ProgressionChart
                players={players}
                rounds={completedRounds}
                variant={variant}
                hiddenPlayers={hiddenPlayers}
                leader={leader}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {sorted.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setHiddenPlayers(cur => ({ ...cur, [p.id]: !cur[p.id] }))}
                    aria-pressed={!!hiddenPlayers[p.id]}
                    aria-label={`${hiddenPlayers[p.id] ? 'Show' : 'Hide'} ${p.displayName}`}
                    className="stats-player-chip"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${hiddenPlayers[p.id] ? V.line : p.color}`,
                      background: hiddenPlayers[p.id] ? 'transparent' : `color-mix(in oklab, ${p.color} 15%, ${V.surface})`,
                      opacity: hiddenPlayers[p.id] ? 0.45 : 1,
                      transition: 'border-color .15s ease, background .15s ease, opacity .15s ease',
                      touchAction: 'manipulation',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: V.ink }}>{p.displayName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, fontVariantNumeric: 'tabular-nums' }}>· {totals[p.id]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Player Stats — Metric Cards Grid ── */}
            <div style={{ borderBottom: `1px solid ${V.line}` }}>
              <div style={{ padding: '18px 20px 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
                  Player Statistics
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, padding: '14px 20px 20px' }}>
                {METRIC_CARDS.map(card => (
                  <MetricCard key={card.key} card={card} sorted={sorted} stats={stats} />
                ))}
              </div>
            </div>

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
