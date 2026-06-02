import { useState, useEffect, useMemo, useRef } from 'react'
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
              {n > 0 && <text x={x} y={padT + plotH + 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill={V.muted}>R{n}</text>}
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

        {hoverRound != null && (
          <g pointerEvents="none">
            <line x1={xFor(hoverRound)} x2={xFor(hoverRound)} y1={padT} y2={padT + plotH} stroke={V.accent} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
            {drawOrder.map(({ p, pts }) => {
              if (hiddenPlayers[p.id]) return null
              return <circle key={p.id} cx={xFor(hoverRound)} cy={yFor(pts[hoverRound])} r={5} fill={p.color} stroke={V.bg} strokeWidth="2" />
            })}
          </g>
        )}
      </svg>

      {hoverRound != null && tooltipRows.length > 0 && (
        <div style={{
          position: 'absolute', top: 6,
          left:  flipLeft ? 'auto' : `calc(${tipLeftPct}% + 10px)`,
          right: flipLeft ? `calc(${100 - tipLeftPct}% + 10px)` : 'auto',
          background: V.surface, border: `1px solid ${V.line}`, borderRadius: 10,
          padding: '8px 12px', pointerEvents: 'none', minWidth: 130,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginBottom: 6, display: 'flex', gap: 8 }}>
            <span>{hoverRound === 0 ? 'Start' : `After R${hoverRound}`}</span>
            {hovTrump && <span style={{ color: hovTrump.red ? 'var(--color-red-suit)' : V.ink2 }}>{hovTrump.glyph} {rounds[hoverRound - 1].cards}×</span>}
          </div>
          {tooltipRows.map(row => (
            <div key={row.p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.p.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: V.ink, flex: 1 }}>{row.p.displayName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: V.ink }}>{row.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Column definitions ─────────────────────────────────────────────────────────
// Each col: key, label (short), sub (tiny), getValue(ps)→number|null,
//           render(ps)→string, color(ps)→cssColor, highlight ('max'|'calibrated'),
//           divider (thick left border to separate groups)
const COLS = [
  { key: 'acc',       label: 'Acc%',    sub: 'overall',   divider: false, highlight: 'max',
    getValue: ps => ps.acc.total > 0 ? ps.acc.pct : null,
    render:   ps => ps.acc.total > 0 ? `${ps.acc.pct}%` : '—',
    color:    ps => ps.acc.total > 0 ? pctColor(ps.acc.pct) : V.muted },
  { key: 'nil_all',  label: 'Nil',     sub: 'overall',   divider: false, highlight: 'max',
    getValue: ps => ps.nil.overall.count > 0 ? ps.nil.overall.pct : null,
    render:   ps => ps.nil.overall.count > 0 ? `${ps.nil.overall.pct}%` : '—',
    color:    ps => ps.nil.overall.count > 0 ? pctColor(ps.nil.overall.pct) : V.muted },
  { key: 'nil_sm',   label: 'Nil ≤4c', sub: 'small rds', divider: false, highlight: 'max',
    getValue: ps => ps.nil.small.count > 0 ? ps.nil.small.pct : null,
    render:   ps => ps.nil.small.count > 0 ? `${ps.nil.small.pct}%` : '—',
    color:    ps => ps.nil.small.count > 0 ? pctColor(ps.nil.small.pct) : V.muted },
  { key: 'nil_lg',   label: 'Nil 5+c', sub: 'large rds', divider: false, highlight: 'max',
    getValue: ps => ps.nil.large.count > 0 ? ps.nil.large.pct : null,
    render:   ps => ps.nil.large.count > 0 ? `${ps.nil.large.pct}%` : '—',
    color:    ps => ps.nil.large.count > 0 ? pctColor(ps.nil.large.pct) : V.muted },
  { key: 'card_sm',  label: '1–4c',    sub: 'accuracy',  divider: false, highlight: 'max',
    getValue: ps => ps.cards.small.rounds > 0 ? ps.cards.small.pct : null,
    render:   ps => ps.cards.small.rounds > 0 ? `${ps.cards.small.pct}%` : '—',
    color:    ps => ps.cards.small.rounds > 0 ? pctColor(ps.cards.small.pct) : V.muted },
  { key: 'card_lg',  label: '5+c',     sub: 'accuracy',  divider: false, highlight: 'max',
    getValue: ps => ps.cards.large.rounds > 0 ? ps.cards.large.pct : null,
    render:   ps => ps.cards.large.rounds > 0 ? `${ps.cards.large.pct}%` : '—',
    color:    ps => ps.cards.large.rounds > 0 ? pctColor(ps.cards.large.pct) : V.muted },
  { key: 'dealt',    label: 'Dealt',   sub: 'times',     divider: false, highlight: 'max',
    getValue: ps => ps.dealer.total > 0 ? ps.dealer.total : null,
    render:   ps => `${ps.dealer.total}×`,
    color:    ()  => V.ink2 },
  { key: 'deal_acc', label: 'Dealer%', sub: 'as dealer', divider: false, highlight: 'max',
    getValue: ps => ps.dealer.total > 0 ? ps.dealer.pct : null,
    render:   ps => ps.dealer.total > 0 ? `${ps.dealer.pct}%` : '—',
    color:    ps => ps.dealer.total > 0 ? pctColor(ps.dealer.pct) : V.muted },
  // ── Character block (thicker left divider) ──
  { key: 'hot',      label: '🔥',      sub: 'best streak', divider: true, highlight: 'max',
    getValue: ps => ps.streaks.madeBest,
    render:   ps => `${ps.streaks.madeBest}`,
    color:    ps => ps.streaks.madeBest > 0 ? V.accent3 : V.muted },
  { key: 'cold',     label: '🧊',      sub: 'miss streak', divider: false, highlight: 'max',
    getValue: ps => ps.streaks.missedBest,
    render:   ps => `${ps.streaks.missedBest}`,
    color:    ps => ps.streaks.missedBest > 0 ? V.accent2 : V.muted },
  { key: 'best_rnd', label: 'Best rnd', sub: 'score',    divider: false, highlight: 'max',
    getValue: ps => ps.best,
    render:   ps => ps.best !== null ? `+${ps.best}` : '—',
    color:    ps => ps.best !== null ? V.accent3 : V.muted },
  { key: 'risk',     label: 'Risk%',   sub: 'bid/cards', divider: false, highlight: 'max',
    getValue: ps => ps.ratio,
    render:   ps => ps.ratio !== null ? `${Math.round(ps.ratio * 100)}%` : '—',
    color:    ps => ps.ratio !== null ? (ps.ratio > 0.6 ? V.accent2 : ps.ratio > 0.4 ? V.accent : V.accent3) : V.muted },
  { key: 'drift',    label: 'Drift',   sub: 'over/under', divider: false, highlight: 'calibrated',
    getValue: ps => ps.drift,
    render:   ps => ps.drift === null ? '—' : ps.drift > 0 ? `+${ps.drift.toFixed(1)}` : ps.drift.toFixed(1),
    color:    ps => ps.drift === null ? V.muted : Math.abs(ps.drift) < 0.3 ? V.accent3 : V.accent2 },
  { key: 'close',    label: 'Close',   sub: 'missed ±1', divider: false, highlight: 'max',
    getValue: ps => ps.cc > 0 ? ps.cc : null,
    render:   ps => `${ps.cc}`,
    color:    ps => ps.cc > 0 ? V.accent : V.muted },
  { key: 'trump',    label: 'Trump',   sub: 'affinity',  divider: false, highlight: 'max',
    getValue: ps => ps.trump?.pct ?? null,
    render:   ps => ps.trump ? `${ps.trump.glyph} ${ps.trump.pct}%` : '—',
    color:    ps => ps.trump ? pctColor(ps.trump.pct) : V.muted },
]

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
  { key: 'closest', icon: '≈',  label: 'Closest Call', desc: 'Most one-trick misses',  color: V.accent  },
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
      oracle:  maxAcc   > 0      ? players.filter(p => stats[p.id].acc.pct            === maxAcc)   : [],
      hothand: maxMade  > 0      ? players.filter(p => stats[p.id].streaks.madeBest   === maxMade)  : [],
      icecold: maxMissed > 0     ? players.filter(p => stats[p.id].streaks.missedBest === maxMissed): [],
      gambler: maxRatio !== null ? players.filter(p => stats[p.id].ratio              === maxRatio) : [],
      nil:     players.filter(p => stats[p.id].nil.overall.made > 0),
      closest: maxCC   > 0      ? players.filter(p => stats[p.id].cc                 === maxCC)    : [],
    }
  }, [players, stats])

  // Per-column highlight leaders
  const highlights = useMemo(() => {
    const result = {}
    for (const col of COLS) {
      const vals = sorted.map(p => ({ p, v: col.getValue(stats[p.id]) })).filter(x => x.v !== null)
      if (vals.length === 0) { result[col.key] = []; continue }
      if (col.highlight === 'calibrated') {
        const minAbs = Math.min(...vals.map(x => Math.abs(x.v)))
        result[col.key] = vals.filter(x => Math.abs(Math.abs(x.v) - minAbs) < 0.05).map(x => x.p)
      } else {
        const maxV = Math.max(...vals.map(x => x.v))
        result[col.key] = vals.filter(x => x.v === maxV).map(x => x.p)
      }
    }
    return result
  }, [sorted, stats])

  // Shared cell styles
  const thBase = { padding: '7px 10px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, whiteSpace: 'nowrap' }
  const tdBase = { padding: '9px 10px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, whiteSpace: 'nowrap' }

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

            {/* ── Group Statistics: score chart ── */}
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

            {/* ── Player Stats Table ── */}
            <div style={{ borderBottom: `1px solid ${V.line}` }}>
              <div style={{ padding: '18px 28px 12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>
                  Player Statistics
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11, tableLayout: 'auto', minWidth: '100%' }}>
                  <thead>
                    {/* Highlight row */}
                    <tr style={{ background: V.bg }}>
                      <th style={{ ...thBase, textAlign: 'left', paddingLeft: 16, position: 'sticky', left: 0, background: V.bg, zIndex: 2, borderRight: `1px solid ${V.line}`, minWidth: 130 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted }}>★ Leads</span>
                      </th>
                      {COLS.map(col => {
                        const leaders = highlights[col.key] ?? []
                        return (
                          <th key={col.key} style={{ ...thBase, borderLeft: col.divider ? `2px solid ${V.line}` : `1px solid ${V.line}`, minWidth: 64 }}>
                            {leaders.length === 0 ? (
                              <span style={{ color: V.muted, fontSize: 9 }}>—</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                {leaders.slice(0, 2).map(p => (
                                  <span key={p.id} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, color: p.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 58 }}>
                                    {p.displayName}
                                  </span>
                                ))}
                                {leaders.length > 2 ? <span style={{ color: V.muted, fontSize: 8 }}>+{leaders.length - 2}</span> : null}
                              </div>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                    {/* Column header row */}
                    <tr style={{ background: V.bg2 }}>
                      <th style={{ ...thBase, textAlign: 'left', paddingLeft: 16, position: 'sticky', left: 0, background: V.bg2, zIndex: 2, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, fontWeight: 600 }}>
                        Player
                      </th>
                      {COLS.map(col => (
                        <th key={col.key} style={{ ...thBase, borderLeft: col.divider ? `2px solid ${V.line}` : `1px solid ${V.line}` }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: V.muted, fontWeight: 600 }}>{col.label}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: V.muted, opacity: 0.6, marginTop: 1 }}>{col.sub}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => {
                      const ps = stats[p.id]
                      const rowBg = i % 2 === 0 ? V.bg2 : 'transparent'
                      return (
                        <tr key={p.id} style={{ background: rowBg }}>
                          {/* Sticky player name */}
                          <td style={{ ...tdBase, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: i % 2 === 0 ? V.bg2 : V.surface, borderRight: `1px solid ${V.line}`, borderLeft: `4px solid ${p.color}`, paddingLeft: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar player={p} size={22} />
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink, whiteSpace: 'nowrap' }}>{p.displayName}</span>
                            </div>
                          </td>
                          {/* Data cells */}
                          {COLS.map(col => {
                            const isLeader = highlights[col.key]?.some(lp => lp.id === p.id)
                            return (
                              <td
                                key={col.key}
                                style={{
                                  ...tdBase,
                                  borderLeft: col.divider ? `2px solid ${V.line}` : `1px solid ${V.line}`,
                                  background: isLeader ? `color-mix(in oklab, ${p.color} 12%, transparent)` : undefined,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <span style={{ fontSize: 12, fontWeight: isLeader ? 700 : 500, color: col.color(ps) }}>
                                  {col.render(ps)}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Glossary */}
              <div style={{ padding: '12px 28px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
                  <b style={{ color: V.ink2 }}>Risk%</b> — avg bid as % of cards dealt.
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
                  <b style={{ color: V.ink2 }}>Drift</b> — avg (bid − took). Near 0 = well-calibrated.
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, lineHeight: 1.5 }}>
                  <b style={{ color: V.ink2 }}>★ Leads</b> — highlights the column leader; Drift shows "most calibrated".
                </div>
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
