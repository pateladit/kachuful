import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import Avatar from '../components/game/Avatar'
import {
  TRUMPS,
  computeTotals,
  computeRanks,
  scoreFor,
  playerStreaks,
  playerAccuracy,
} from '../lib/gameLogic'

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

function formatRank(rk) {
  if (!rk) return '—'
  const n = rk.rank
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const totalMin = Math.floor(Math.max(0, ms) / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function cumulativeScoreByRound(playerId, rounds, variant) {
  const out = [0]
  let running = 0
  for (const r of rounds) {
    running += scoreFor(r.bids[playerId], r.took[playerId], variant)
    out.push(running)
  }
  return out
}

function findOvertakeRound(winner, players, rounds, variant) {
  const cumByPlayer = {}
  for (const p of players) cumByPlayer[p.id] = cumulativeScoreByRound(p.id, rounds, variant)
  for (let n = 1; n <= rounds.length; n++) {
    let okAllAfter = true
    for (let m = n; m <= rounds.length; m++) {
      const w = cumByPlayer[winner.id][m]
      const tied = players.some(p => p.id !== winner.id && cumByPlayer[p.id][m] >= w)
      if (tied) { okAllAfter = false; break }
    }
    if (okAllAfter) return n
  }
  return rounds.length
}

// ── Progression chart ─────────────────────────────────────────────────────────
function ProgressionChart({ players, rounds, variant, hiddenPlayers, winner }) {
  const W = 1200, H = 360
  const padLeft = 48, padRight = 110, padTop = 18, padBottom = 32
  const plotW = W - padLeft - padRight
  const plotH = H - padTop - padBottom
  const N = rounds.length

  const series = players.map(p => ({
    player: p,
    pts: cumulativeScoreByRound(p.id, rounds, variant),
  }))
  const maxY = Math.max(...series.flatMap(s => s.pts), 10)
  const yTicks = Math.max(1, Math.ceil(maxY / 50))

  const xFor = n => padLeft + (N > 0 ? (n / N) : 0) * plotW
  const yFor = v => padTop + plotH - (v / (yTicks * 50)) * plotH

  const drawOrder = [...series].sort((a, b) => {
    if (a.player.id === winner.id) return 1
    if (b.player.id === winner.id) return -1
    return 0
  })

  const svgRef = useRef(null)
  const [hoverRound, setHoverRound] = useState(null)
  const onMove = e => {
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const xInSvg = ((e.clientX - r.left) / r.width) * W
    const raw = ((xInSvg - padLeft) / plotW) * N
    setHoverRound(Math.max(0, Math.min(N, Math.round(raw))))
  }
  const onLeave = () => setHoverRound(null)

  const tooltipRows = hoverRound != null
    ? players
        .filter(p => !hiddenPlayers[p.id])
        .map(p => ({ player: p, total: series.find(x => x.player.id === p.id).pts[hoverRound] }))
        .sort((a, b) => b.total - a.total)
    : []
  const tooltipLeftPct = hoverRound != null ? (xFor(hoverRound) / W) * 100 : 0
  const flipLeft = tooltipLeftPct > 65
  const hoveredTrump = hoverRound != null && hoverRound > 0
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
        onMouseLeave={onLeave}
      >
        {/* Grid + y labels */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padTop + plotH - (i / yTicks) * plotH
          const val = i * 50
          return (
            <g key={i}>
              <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke={V.line} strokeWidth="1" opacity="0.5" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fill={V.muted}>{val}</text>
            </g>
          )
        })}
        {/* X axis ticks */}
        {Array.from({ length: N + 1 }).map((_, n) => {
          const x = xFor(n)
          return (
            <g key={n}>
              <line x1={x} x2={x} y1={padTop + plotH} y2={padTop + plotH + 4} stroke={V.line} strokeWidth="1" />
              {n > 0 && <text x={x} y={padTop + plotH + 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={V.muted}>R{n}</text>}
            </g>
          )
        })}
        {/* Axis lines */}
        <line x1={padLeft} x2={padLeft + plotW} y1={padTop + plotH} y2={padTop + plotH} stroke={V.line} strokeWidth="1.5" />
        <line x1={padLeft} x2={padLeft} y1={padTop} y2={padTop + plotH} stroke={V.line} strokeWidth="1.5" />

        {/* Series */}
        {drawOrder.map(({ player, pts }) => {
          if (hiddenPlayers[player.id]) return null
          const isWinner = player.id === winner.id
          const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ')
          return (
            <g key={player.id}>
              <path d={d} fill="none" stroke={player.color} strokeWidth={isWinner ? 3 : 1.5} opacity={isWinner ? 1 : 0.6} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={isWinner ? 4 : 3} fill={player.color} opacity={isWinner ? 1 : 0.6} />
              ))}
              <text x={xFor(N) + 8} y={yFor(pts[N]) + 4} fontFamily="var(--font-mono)" fontSize="11" fill={player.color} opacity={isWinner ? 1 : 0.8}>
                {player.displayName} · {pts[N]}
              </text>
            </g>
          )
        })}

        {/* Hover guideline */}
        {hoverRound != null && (
          <g pointerEvents="none">
            <line x1={xFor(hoverRound)} x2={xFor(hoverRound)} y1={padTop} y2={padTop + plotH} stroke={V.accent} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
            {drawOrder.map(({ player, pts }) => {
              if (hiddenPlayers[player.id]) return null
              return (
                <circle key={player.id} cx={xFor(hoverRound)} cy={yFor(pts[hoverRound])} r={6} fill={player.color} stroke={V.bg} strokeWidth="2.5" />
              )
            })}
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoverRound != null && tooltipRows.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 8,
          left:  flipLeft ? 'auto' : `calc(${tooltipLeftPct}% + 12px)`,
          right: flipLeft ? `calc(${100 - tooltipLeftPct}% + 12px)` : 'auto',
          background: V.surface,
          border: `1px solid ${V.line}`,
          borderRadius: 10,
          padding: '8px 12px',
          pointerEvents: 'none',
          minWidth: 140,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginBottom: 6, display: 'flex', gap: 8 }}>
            <span>{hoverRound === 0 ? 'Before R1' : `After R${hoverRound}`}</span>
            {hoveredTrump && (
              <span style={{ color: hoveredTrump.red ? 'var(--color-red-suit)' : hoveredTrump.nt ? V.accent : V.ink2 }}>
                {hoveredTrump.glyph} {rounds[hoverRound - 1].cards}×
              </span>
            )}
          </div>
          {tooltipRows.map(row => (
            <div key={row.player.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.player.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: V.ink, flex: 1 }}>{row.player.displayName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: V.ink }}>{row.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Full running tab ───────────────────────────────────────────────────────────
function RunningTab({ players, rounds, totals, ranks, variant, winnerId }) {
  return (
    <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, margin: 0 }}>
          Full running tab
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
            {rounds.length} rounds · top: points · bottom: bid/took
          </small>
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
          Made <span style={{ color: V.accent3 }}>●</span> · Missed <span style={{ color: V.accent2 }}>●</span>
        </span>
      </div>
      <div style={{ borderTop: `1px solid ${V.line}`, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 72, textAlign: 'left', paddingLeft: 16, padding: '10px 6px', background: V.bg2, color: V.muted, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}` }}>Round</th>
              {players.map((p, pi) => (
                <th key={p.id} style={{ padding: '10px 6px', background: V.bg2, textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                  <Avatar player={p} size={26} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: p.id === winnerId ? V.accent : V.ink, display: 'block', marginTop: 3, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map(r => {
              const tr = TRUMPS.find(t => t.id === r.trump)
              return (
                <tr key={r.id}>
                  <td style={{ textAlign: 'left', paddingLeft: 16, padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink }}>
                    R{r.roundNumber}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginLeft: 4 }}><span style={{ color: tr?.red ? 'var(--color-red-suit)' : undefined }}>{tr?.glyph}</span> {r.cards}</span>
                  </td>
                  {players.map((p, pi) => {
                    const b = r.bids[p.id], k = r.took?.[p.id]
                    const made = b !== undefined && k !== undefined && b === k
                    const pts = b !== undefined && k !== undefined ? scoreFor(b, k, variant) : null
                    return (
                      <td key={p.id} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', background: pts === null ? 'transparent' : made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)` }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: made ? V.accent3 : V.accent2 }}>{made ? `+${pts}` : '0'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.ink2, opacity: .75 }}>{b}/{k}</span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr>
              <td style={{ padding: '10px 6px', paddingLeft: 16, background: V.surface, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}>TOTAL</td>
              {players.map((p, pi) => (
                <td key={p.id} style={{ padding: '10px 6px', background: V.surface, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: p.id === winnerId ? V.accent : V.ink, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                  {totals[p.id]}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding: '8px 6px', paddingLeft: 16, background: V.bg2, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}>RANK</td>
              {players.map((p, pi) => (
                <td key={p.id} style={{ padding: '8px 6px', background: V.bg2, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: p.id === winnerId ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                  {formatRank(ranks[p.id])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FinalResults() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { game, players, completedRounds, phase, error, reload } = useGame(id)
  const [hiddenPlayers, setHiddenPlayers] = useState({})

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: V.ink }}>Ka·Chu·Fu·L</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 8 }}>Loading results…</div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.ink }}>Something went wrong</div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: V.ink2, margin: '12px 0' }}>{error}</p>
          <button onClick={reload} style={{ background: 'transparent', border: 'none', color: V.accent, fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>Try again</button>
        </div>
      </div>
    )
  }

  // If game is still in progress (shouldn't happen normally), redirect back
  if (phase !== 'complete') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.ink }}>Game still in progress</div>
          <button onClick={() => navigate(`/game/${id}`)} style={{ background: 'transparent', border: 'none', color: V.accent, fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', marginTop: 12, display: 'block', margin: '12px auto 0' }}>
            Back to game
          </button>
        </div>
      </div>
    )
  }

  const variant = game.scoring_variant
  const totals = computeTotals(players, completedRounds, variant)
  const ranks = computeRanks(players, totals)
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])

  const winner = sorted[0]
  const winnerScore = totals[winner.id]
  const lastPlace = sorted[sorted.length - 1]
  const overtakeRound = completedRounds.length > 1
    ? findOvertakeRound(winner, players, completedRounds, variant)
    : 1
  const elapsedStr = formatDuration(game.started_at, game.ended_at)

  function togglePlayer(pid) {
    setHiddenPlayers(cur => ({ ...cur, [pid]: !cur[pid] }))
  }

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 32px 48px', minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto auto auto auto auto auto auto', gap: 24 }}>

      {/* ─── Top bar ─── */}
      <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
            Ka<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Chu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Fu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />L
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
            {game.name ? `${game.name} · ` : ''}Final Results
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `color-mix(in oklab, ${V.accent} 15%, ${V.surface})`, border: `1px solid color-mix(in oklab, ${V.accent} 40%, transparent)`, padding: '7px 16px', borderRadius: 999, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: V.accent }}>
          ★ Game complete
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', background: V.bg2, color: V.ink2, border: `1px solid ${V.line}`, padding: '6px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10 }}>⏱</span>
            <b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: V.ink }}>{elapsedStr}</b>
            <span>elapsed</span>
          </div>
        </div>
      </header>

      {/* ─── Headline ─── */}
      <section style={{ paddingBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: V.muted, marginBottom: 8 }}>
          Final · {completedRounds.length} rounds played
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 48, letterSpacing: '-0.03em', color: V.ink, margin: '0 0 14px' }}>
          {winner.displayName} takes the night.
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 13, color: V.ink2 }}>
          <span><b style={{ color: V.ink }}>{winnerScore}</b> points</span>
          {sorted.length > 1 && <><span style={{ color: V.muted }}>·</span><span><b style={{ color: V.ink }}>+{winnerScore - totals[sorted[1].id]}</b> over {sorted[1].displayName}</span></>}
          <span style={{ color: V.muted }}>·</span>
          <span><b style={{ color: V.ink }}>{elapsedStr}</b> elapsed</span>
          <span style={{ color: V.muted }}>·</span>
          <span><b style={{ color: V.ink }}>{completedRounds.length}</b> rounds played</span>
        </div>
      </section>

      {/* ─── Standings table ─── */}
      <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${V.line}` }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, margin: 0 }}>
            Standings
            <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>medals · score · stats</small>
          </h2>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>Sorted by total points</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 14 }}>
          <thead>
            <tr style={{ background: V.bg2 }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: V.muted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${V.line}` }}>Rank</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: V.muted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${V.line}` }}>Player</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: V.muted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${V.line}` }}>Total</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: V.muted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${V.line}` }}>Accuracy</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: V.muted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${V.line}` }}>Made streak</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: V.muted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${V.line}` }}>Missed streak</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isWinner = p.id === winner.id
              const isLast = p.id === lastPlace.id && sorted.length > 1
              const acc = playerAccuracy(p.id, completedRounds)
              const s = playerStreaks(p.id, completedRounds)
              const behind = winnerScore - totals[p.id]

              const medals = ['🥇', '🥈', '🥉']
              const medalGlyph = i < 3 ? medals[i] : (isLast ? '🥄' : `${i + 1}`)

              return (
                <tr key={p.id} style={{ background: isWinner ? `color-mix(in oklab, ${V.accent} 6%, ${V.surface})` : 'transparent', borderBottom: `1px solid ${V.line}` }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{medalGlyph}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: isWinner ? V.accent : V.muted }}>{formatRank(ranks[p.id])}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar player={p} size={40} />
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: isWinner ? V.accent : V.ink }}>{p.displayName}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: isWinner ? V.accent : isLast ? V.accent2 : V.muted, marginTop: 2 }}>
                          {isWinner ? '★ WINNER' : isLast ? '🥄 wooden spoon' : `position ${i + 1}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: isWinner ? V.accent : V.ink }}>{totals[p.id]}</div>
                    {!isWinner && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>{behind} behind</div>}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: acc.pct >= 60 ? V.accent3 : acc.pct >= 40 ? V.ink : V.accent2 }}>{acc.pct}%</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>{acc.made}/{acc.total} made</div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: V.ink }}>{s.madeBest}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>in a row</div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: s.missedBest === 0 ? V.muted : V.accent2 }}>{s.missedBest}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>in a row</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* ─── Score progression chart ─── */}
      <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, margin: 0 }}>
            Score progression
            <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>cumulative points by round · hover to inspect</small>
          </h2>
          {completedRounds.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
              {completedRounds.length} rounds · {winner.displayName} pulled ahead from R{overtakeRound}
            </div>
          )}
        </div>
        <ProgressionChart
          players={players}
          rounds={completedRounds}
          variant={variant}
          hiddenPlayers={hiddenPlayers}
          winner={winner}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {sorted.map(p => (
            <div
              key={p.id}
              onClick={() => togglePlayer(p.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, border: `1px solid ${hiddenPlayers[p.id] ? V.line : p.color}`, background: hiddenPlayers[p.id] ? 'transparent' : `color-mix(in oklab, ${p.color} 15%, ${V.surface})`, cursor: 'pointer', opacity: hiddenPlayers[p.id] ? 0.45 : 1, transition: 'all .15s ease' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: V.ink }}>{p.displayName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted }}>· {totals[p.id]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Full running tab ─── */}
      <RunningTab
        players={players}
        rounds={completedRounds}
        totals={totals}
        ranks={ranks}
        variant={variant}
        winnerId={winner.id}
      />

      {/* ─── Footer actions ─── */}
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${V.line}`, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
          {sorted.length} players · {completedRounds.length} rounds · {elapsedStr} elapsed
        </div>
        <button
          onClick={() => navigate('/')}
          style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 22px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          ← Back to setup
        </button>
      </footer>
    </div>
  )
}
