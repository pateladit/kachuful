import { useState, useEffect, useMemo, useRef, memo } from 'react'
import Avatar from './Avatar'
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

  const series = players.map(p => ({
    p,
    pts: cumulativeScoreByRound(p.id, rounds, variant),
  }))
  const maxY   = Math.max(...series.flatMap(s => s.pts), 10)
  const yTicks = Math.max(1, Math.ceil(maxY / 50))

  const xFor = n => padL + (N > 0 ? (n / N) : 0) * plotW
  const yFor = v => padT + plotH - (v / (yTicks * 50)) * plotH

  const drawOrder = [...series].sort((a, b) =>
    a.p.id === leader?.id ? 1 : b.p.id === leader?.id ? -1 : 0,
  )

  const svgRef = useRef(null)
  const [hoverRound, setHoverRound] = useState(null)

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
        .map(p => ({ p, total: series.find(s => s.p.id === p.id).pts[hoverRound] }))
        .sort((a, b) => b.total - a.total)
    : []
  const tipLeftPct = hoverRound != null ? (xFor(hoverRound) / W) * 100 : 0
  const flipLeft   = tipLeftPct > 62
  const hovTrump   = hoverRound != null && hoverRound > 0
    ? TRUMPS.find(t => t.id === rounds[hoverRound - 1].trump) ?? null
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: V.ink }}>{row.total}</span>
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
  const ranked = useMemo(() => {
    const withData = sorted.filter(p => card.getValue(stats[p.id]) !== null)
    const noData   = sorted.filter(p => card.getValue(stats[p.id]) === null)
    const sortedWith = [...withData].sort((a, b) => {
      if (card.sort === 'calibrated') {
        return Math.abs(card.getValue(stats[a.id])) - Math.abs(card.getValue(stats[b.id]))
      }
      return card.getValue(stats[b.id]) - card.getValue(stats[a.id])
    })
    return [...sortedWith, ...noData]
  }, [card, sorted, stats])

  const topVal = ranked.length > 0 ? card.getValue(stats[ranked[0].id]) : null

  const isLeader = p => {
    const val = card.getValue(stats[p.id])
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
        const val      = card.getValue(stats[p.id])
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

// ── Honorary titles ────────────────────────────────────────────────────────────
function AwardPlaque({ def, holders }) {
  return (
    <div style={{ background: V.bg2, border: `1px solid ${V.line}`, borderLeft: `4px solid ${def.color}`, borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', right: 4, bottom: -12, fontSize: 76, color: def.color, opacity: 0.07, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
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
  { key: 'closest', icon: '±',  label: 'Closest Call', desc: 'Most one-trick misses',  color: V.accent  },
]

// ── Main modal content ─────────────────────────────────────────────────────────
function StatsModalContent({ onClose, game, players, completedRounds }) {
  const [hiddenPlayers, setHiddenPlayers] = useState({})

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const variant    = game.scoring_variant
  const isComplete = game.status === 'complete'

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
    const list = players.map(p => ({ p, pct: stats[p.id].acc.pct }))
    const maxPct = Math.max(...list.map(x => x.pct))
    if (maxPct === 0) return null
    return { players: list.filter(x => x.pct === maxPct).map(x => x.p), pct: maxPct }
  }, [players, stats, completedRounds.length])

  const streakLeaders = useMemo(() => {
    const maxMade   = Math.max(...players.map(p => stats[p.id].streaks.madeBest))
    const maxMissed = Math.max(...players.map(p => stats[p.id].streaks.missedBest))
    return {
      hot:        maxMade   > 0 ? players.filter(p => stats[p.id].streaks.madeBest   === maxMade)   : [],
      cold:       maxMissed > 0 ? players.filter(p => stats[p.id].streaks.missedBest === maxMissed) : [],
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
      oracle:  maxAcc    > 0      ? players.filter(p => stats[p.id].acc.pct            === maxAcc)    : [],
      hothand: maxMade   > 0      ? players.filter(p => stats[p.id].streaks.madeBest   === maxMade)   : [],
      icecold: maxMissed > 0      ? players.filter(p => stats[p.id].streaks.missedBest === maxMissed) : [],
      gambler: maxRatio !== null  ? players.filter(p => stats[p.id].ratio              === maxRatio)  : [],
      nil:     players.filter(p => stats[p.id].nil.overall.made > 0),
      closest: maxCC    > 0       ? players.filter(p => stats[p.id].cc                === maxCC)     : [],
    }
  }, [players, stats])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,21,.75)', backdropFilter: 'blur(6px)', zIndex: 100, overflowY: 'auto', padding: '40px 16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 760, margin: '0 auto', background: V.surface, border: `1px solid ${V.line}`, borderRadius: 24, overflow: 'hidden' }}
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
          <button onClick={onClose} aria-label="Close stats" style={{ background: 'transparent', border: 'none', color: V.muted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px', touchAction: 'manipulation' }}>×</button>
        </div>

        {completedRounds.length === 0 ? (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: V.muted, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No completed rounds yet
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
                  <div
                    key={p.id}
                    onClick={() => setHiddenPlayers(cur => ({ ...cur, [p.id]: !cur[p.id] }))}
                    role="button"
                    aria-pressed={!!hiddenPlayers[p.id]}
                    aria-label={`${hiddenPlayers[p.id] ? 'Show' : 'Hide'} ${p.displayName}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${hiddenPlayers[p.id] ? V.line : p.color}`,
                      background: hiddenPlayers[p.id] ? 'transparent' : `color-mix(in oklab, ${p.color} 15%, ${V.surface})`,
                      opacity: hiddenPlayers[p.id] ? 0.45 : 1,
                      transition: 'all .15s ease',
                      touchAction: 'manipulation',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: V.ink }}>{p.displayName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, fontVariantNumeric: 'tabular-nums' }}>· {totals[p.id]}</span>
                  </div>
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

            {/* ── Honorary Titles — end-game only ── */}
            {isComplete ? (
              <div style={{ padding: '20px 28px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>
                  Honorary Titles
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {TITLE_DEFS.map(def => {
                    const holders = titles[def.key]
                    if (!holders || holders.length === 0) return null
                    return <AwardPlaque key={def.key} def={def} holders={holders} />
                  })}
                </div>
              </div>
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
