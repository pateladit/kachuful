import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useCountUp } from '../../hooks/useCountUp'
import Avatar from './Avatar'
import GameTimer from './GameTimer'
import SummaryModal from './SummaryModal'
import StatsModal from './StatsModal'
import AccountMenu from '../AccountMenu'
import {
  TRUMPS,
  trumpById,
  computeTotals,
  computeRanks,
  scoreFor,
  playerStreaks,
} from '../../lib/gameLogic'
import { trumpTint } from '../../lib/gameColors'

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

function totalColor(score, min, max) {
  if (max === min) return V.ink
  const t = (score - min) / (max - min)
  return `color-mix(in oklab, ${V.accent3} ${Math.round(t * 100)}%, ${V.accent2})`
}

function rankBg(rank, n) {
  if (n <= 1 || !rank) return 'transparent'
  const t = (rank - 1) / (n - 1)
  const base = `color-mix(in oklab, #ef4444 ${Math.round(t * 100)}%, #22c55e)`
  return `color-mix(in oklab, ${base} 40%, transparent)`
}

function AnimatedTotal({ value }) {
  const displayed = useCountUp(value, { duration: 700 })
  return <span>{displayed}</span>
}

// ── Stats sub-components ────────────────────────────────────────────────────

const StreakCard = React.memo(function StreakCard({ completedRounds, topStreak }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Hottest streak</div>
      {completedRounds.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Avatar player={topStreak.player} size={36} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{topStreak.streak}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>/{completedRounds.length} rounds made</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 10 }}>
            <b style={{ color: V.ink }}>{topStreak.player.displayName}</b> · {topStreak.streak} in a row
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 12 }}>No completed rounds yet</div>
      )}
    </div>
  )
})

const BiggestBidCard = React.memo(function BiggestBidCard({ biggest }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Biggest bid called</div>
      {biggest.bid > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Avatar player={biggest.player} size={36} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{biggest.bid}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>{biggest.bid === 1 ? 'TRICK' : 'TRICKS'}</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 10 }}>
            <b style={{ color: V.ink }}>{biggest.player.displayName}</b> in R{biggest.roundNumber}
            {biggest.made === true ? ' · and made it' : biggest.made === false ? ' · and missed' : ' · playing now'}
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 12 }}>No bids yet</div>
      )}
    </div>
  )
})

const DealerBurdenCard = React.memo(function DealerBurdenCard({ recent3 }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>Dealer&#8217;s burden</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent3.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>No completed rounds yet</div>
        ) : recent3.map(({ round: r, dealer, bid, took, made }) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: V.bg2, border: `1px solid ${made ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : `color-mix(in oklab, ${V.accent2} 50%, transparent)`}`, borderRadius: 10, padding: '8px 12px' }}>
            <Avatar player={dealer} size={28} isDealer />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: V.ink }}>{dealer.displayName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted }}>R{r.roundNumber} · {bid}/{took}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: made ? V.accent3 : V.accent2 }}>{made ? 'MADE' : 'MISS'}</div>
          </div>
        ))}
      </div>
    </div>
  )
})

function PauseOverlay({ paused, onToggle, roundNumber, trump, cards, pauseMm, pauseSs }) {
  const resumeRef = useRef(null)

  useEffect(() => {
    if (paused && resumeRef.current) resumeRef.current.focus()
  }, [paused])

  useEffect(() => {
    if (!paused) return
    function onKey(e) { if (e.key === 'Escape') onToggle() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [paused, onToggle])

  return (
    <div
      onClick={onToggle}
      role="dialog"
      aria-modal="true"
      aria-label="Game paused"
      style={{
        position: 'fixed', inset: 0,
        background: 'color-mix(in oklab, var(--color-bg, #2a1620) 88%, black)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        opacity: paused ? 1 : 0,
        pointerEvents: paused ? 'auto' : 'none',
        transition: 'opacity .25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: V.surface,
          border: `1px solid ${V.accent}`,
          borderRadius: 28,
          padding: '48px 56px',
          textAlign: 'center',
          maxWidth: 480,
          boxShadow: '0 24px 48px -12px rgba(0,0,0,.6)',
          transform: paused ? 'scale(1)' : 'scale(.92)',
          transition: 'transform .25s ease',
        }}
      >
        <div aria-hidden style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>☕</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 6 }}>
          PAUSED <b style={{ color: V.ink, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', textTransform: 'none', display: 'block' }}>{pauseMm}:{pauseSs}</b>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.accent, margin: '0 0 10px' }}>Chai break.</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.ink2, letterSpacing: '.04em', lineHeight: 1.55, margin: '0 0 24px' }}>
          Round {roundNumber} on hold · {trump?.name} trump · {cards} cards in hand. Resume when everyone&#8217;s ready.
        </p>
        <button
          ref={resumeRef}
          onClick={onToggle}
          className="game-cta-btn"
          style={{ background: V.accent, border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: '#2a1620', cursor: 'pointer', letterSpacing: '-0.01em', touchAction: 'manipulation' }}
        >
          ▶ Resume Round
        </button>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function PlayingScreen({
  game, players, completedRounds, pendingRound,
  roundNumber, trump, dealerIdx, endGame, onEnterResults,
}) {
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [expanded, setExpanded] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  // Only tick when actually paused — avoids 1 re-render/sec during active play
  useEffect(() => {
    if (!paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  const togglePause = useCallback(() => {
    setPaused(p => {
      if (p) { setPausedAt(null); return false }
      setPausedAt(Date.now()); setNow(Date.now()); return true
    })
  }, [])

  const pauseSec = paused && pausedAt ? Math.floor((now - pausedAt) / 1000) : 0
  const pauseMm = String(Math.floor(pauseSec / 60)).padStart(2, '0')
  const pauseSs = String(pauseSec % 60).padStart(2, '0')

  const variant = game.scoring_variant

  const totals  = useMemo(() => computeTotals(players, completedRounds, variant), [players, completedRounds, variant])
  const ranks   = useMemo(() => computeRanks(players, totals), [players, totals])
  const sorted  = useMemo(() => [...players].sort((a, b) => totals[b.id] - totals[a.id]), [players, totals])
  const leaderId = sorted[0]?.id

  const { totalScores, minTotal, maxTotal } = useMemo(() => {
    const scores = players.map(p => totals[p.id])
    return { totalScores: scores, minTotal: Math.min(...scores), maxTotal: Math.max(...scores) }
  }, [players, totals])

  const cards      = pendingRound?.cards ?? 0
  const sumOfBids  = useMemo(() => players.reduce((acc, p) => acc + (pendingRound?.bids[p.id] ?? 0), 0), [players, pendingRound])
  const overBy     = sumOfBids - cards
  const sumStatus  = overBy > 0 ? 'over' : 'under'
  const sumLabel   = overBy > 0
    ? `OVER · ${overBy} EXTRA BID${overBy > 1 ? 'S' : ''}`
    : `UNDER · ${cards - sumOfBids} SHORT`

  const topStreak = useMemo(() => {
    const data = players.map(p => ({ player: p, streak: playerStreaks(p.id, completedRounds).madeBest }))
    data.sort((a, b) => b.streak - a.streak)
    return data[0] ?? { player: players[0], streak: 0 }
  }, [players, completedRounds])

  const biggest = useMemo(() => {
    const allRounds = pendingRound ? [...completedRounds, pendingRound] : completedRounds
    let best = { player: players[0], bid: 0, made: null, roundNumber: 0 }
    for (const r of allRounds) {
      for (const p of players) {
        const b = r.bids[p.id] ?? 0
        if (b > best.bid) {
          best = { player: p, bid: b, made: r.took ? (r.bids[p.id] === r.took[p.id]) : null, roundNumber: r.roundNumber }
        }
      }
    }
    return best
  }, [players, completedRounds, pendingRound])

  const recent3 = useMemo(() => completedRounds.slice(-3).reverse().map(r => {
    const dealer = players.find(p => p.id === r.dealerId)
    if (!dealer) return null
    return { round: r, dealer, bid: r.bids[r.dealerId], took: r.took[r.dealerId], made: r.bids[r.dealerId] === r.took[r.dealerId] }
  }).filter(Boolean), [completedRounds, players])

  const tabRounds = useMemo(
    () => expanded ? completedRounds : completedRounds.slice(-5),
    [completedRounds, expanded]
  )

  const tint = trumpTint(trump)

  const handleEndGame = useCallback(async () => {
    setSummaryOpen(false)
    setStatsOpen(false)
    try { await endGame() } catch (_) {}
  }, [endGame])

  return (
    <>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 32px 32px', minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto auto auto auto auto', gap: 20 }}>

        {/* ─── Header ─── */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }} translate="no">
              Ka
              <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
              Chu
              <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
              Fu
              <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
              L
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
              {game.name ? `${game.name} · ` : ''}Round {roundNumber} · playing
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GameTimer startedAt={game.started_at} />
            <button
              className="game-icon-btn"
              onClick={() => setSummaryOpen(true)}
              aria-label="Game Summary"
              title="Game Summary"
              style={{ background: V.surface, border: `1px solid ${V.line}`, color: V.ink2, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 15 }}
            >◍</button>
            <button
              className="game-icon-btn"
              onClick={() => setStatsOpen(true)}
              aria-label="Player Stats"
              title="Player Stats"
              style={{ background: V.surface, border: `1px solid ${V.line}`, color: V.ink2, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 14 }}
            >⊞</button>
            <button
              className="game-icon-btn"
              onClick={togglePause}
              aria-label={paused ? 'Resume game' : 'Pause for chai'}
              title={paused ? 'Resume' : 'Pause for chai'}
              style={{
                background: paused ? `color-mix(in oklab, ${V.accent2} 18%, ${V.surface})` : V.surface,
                border: `1px solid ${paused ? V.accent2 : V.line}`,
                color: paused ? V.accent2 : V.ink2,
                width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 15,
              }}
            >{paused ? '▶' : '☕'}</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AccountMenu />
          </div>
        </header>

        {/* ─── Hero ─── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 14 }} aria-label="Round information">

          {/* Trump — suit-tinted, glyph-first */}
          <div style={{ background: tint.bg, border: tint.border, borderRadius: 20, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div aria-hidden style={{ fontSize: 80, lineHeight: 1, color: tint.glyphColor, flexShrink: 0 }}>
              {trump?.glyph ?? '?'}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: V.muted }}>
                {trump?.nt ? 'No Trump' : 'Trump suit'} · R{roundNumber}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1, color: tint.glyphColor, marginTop: 4 }}>
                {trump?.name ?? '—'}
              </div>
            </div>
          </div>

          {/* Cards in hand */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Cards in hand</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: V.ink, marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
              {cards}
              <small style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, fontWeight: 500, letterSpacing: '.1em' }}>{cards === 1 ? 'CARD' : 'CARDS'}</small>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 8 }}>
              {sumOfBids} of {cards} tricks called
            </div>
          </div>

          {/* Bid sum */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Bid sum vs cards</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', color: V.ink, fontVariantNumeric: 'tabular-nums' }}>{sumOfBids}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: V.muted, fontWeight: 600 }}>/ <b style={{ color: V.ink }}>{cards}</b></span>
            </div>
            <div className="game-progress-bar-wrap" style={{ height: 8, background: V.bg2, borderRadius: 999, marginTop: 12, position: 'relative', overflow: 'hidden' }}>
              <div className="game-progress-bar" style={{ position: 'absolute', inset: 0, width: `${Math.min(100, cards > 0 ? (sumOfBids / cards) * 100 : 0)}%`, background: sumStatus === 'over' ? V.accent2 : V.accent, borderRadius: 999, transition: 'width .25s ease' }} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 10, padding: '6px 12px', borderRadius: 999, background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 22%, transparent)` : V.bg2, color: sumStatus === 'over' ? V.accent2 : V.ink2, border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 50%, transparent)` : V.line}` }}>
              <span aria-hidden>{sumStatus === 'over' ? '▲' : '○'}</span> {sumLabel}
            </div>
          </div>
        </section>

        {/* ─── Main content: locked bids + running tab sidebar ─── */}
        <div className="game-content">

          {/* Locked bids grid */}
          <section aria-label="Locked bids" style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, marginBottom: 16, margin: '0 0 16px' }}>
              Bids locked in
              <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
                {sumOfBids} of {cards} called · {overBy > 0 ? `${overBy} over` : `${cards - sumOfBids} short`}
              </small>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {players.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    background: i === dealerIdx ? `color-mix(in oklab, ${V.accent} 12%, ${V.bg2})` : V.bg2,
                    border: `1px solid ${i === dealerIdx ? V.accent : V.line}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    position: 'relative',
                  }}
                >
                  {i === dealerIdx ? (
                    <div style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', background: `color-mix(in oklab, ${V.accent} 22%, transparent)`, color: V.accent, padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>DEALER</div>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Avatar player={p} size={32} isDealer={i === dealerIdx} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.displayName}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: V.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {pendingRound?.bids[p.id] ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Running tab — right sidebar on desktop, below on mobile */}
          <section className="game-tab-sidebar" aria-label="Running score tab" style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', margin: 0, color: V.ink }}>
                Running tab
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 8, fontWeight: 500 }}>
                  {completedRounds.length} of {completedRounds.length + 1} rounds
                </small>
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, flexShrink: 0 }}>
                <span aria-hidden style={{ color: V.accent3 }}>●</span> made&nbsp;
                <span aria-hidden style={{ color: V.accent2 }}>●</span> missed
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${V.line}`, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="game-tab-round-cell"
                      style={{ textAlign: 'left', padding: '9px 6px 9px 14px', background: V.surface, color: V.muted, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', width: 60, borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}` }}
                    >Rnd</th>
                    {players.map((p, i) => (
                      <th scope="col" key={p.id} style={{ padding: '9px 4px', background: V.surface, textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: i < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                        <Avatar player={p} size={22} />
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11, color: i === dealerIdx ? V.accent : V.ink, display: 'block', marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabRounds.map(r => {
                    const tr = trumpById.get(r.trump)
                    return (
                      <tr key={r.id}>
                        <td
                          className="game-tab-round-cell"
                          style={{ textAlign: 'left', padding: '7px 6px 7px 14px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink, background: V.bg2 }}
                        >
                          R{r.roundNumber}
                          <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tr?.red ? '#e57860' : V.muted, marginLeft: 3 }}>{tr?.glyph}</span>
                        </td>
                        {players.map((p, pi) => {
                          const b = r.bids[p.id], k = r.took?.[p.id]
                          const made = b !== undefined && k !== undefined && b === k
                          const pts = b !== undefined && k !== undefined ? scoreFor(b, k, variant) : null
                          return (
                            <td key={p.id} style={{ padding: '7px 4px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', background: pts === null ? 'transparent' : made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)` }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: pts === null ? V.muted : made ? V.accent3 : V.accent2 }}>{pts === null ? '—' : made ? `+${pts}` : '0'}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.ink2, opacity: .75, marginTop: 1 }}>{b ?? '—'}/{k ?? '—'}</span>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  {/* Current round — in play */}
                  <tr>
                    <td
                      className="game-tab-round-cell"
                      style={{ textAlign: 'left', padding: '7px 6px 7px 14px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.accent, background: `color-mix(in oklab, ${V.accent} 6%, ${V.bg2})` }}
                    >
                      R{roundNumber}
                      <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .65, marginLeft: 3 }}>{trump?.glyph}</span>
                    </td>
                    {players.map((p, pi) => (
                      <td key={p.id} style={{ padding: '7px 4px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', background: `color-mix(in oklab, ${V.accent} 8%, transparent)` }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: V.muted }}>in play</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .7, marginTop: 1 }}>{pendingRound?.bids[p.id] ?? '—'}/—</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* TOTAL */}
                  <tr>
                    <td
                      className="game-tab-round-cell"
                      style={{ padding: '11px 6px 11px 14px', background: V.surface, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}`, borderTop: `2px solid ${V.line}` }}
                    >TOTAL</td>
                    {players.map((p, pi) => (
                      <td key={p.id} style={{ padding: '11px 4px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: totalColor(totals[p.id], minTotal, maxTotal), letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', borderTop: `2px solid ${V.line}` }}>
                        <AnimatedTotal value={totals[p.id]} />
                      </td>
                    ))}
                  </tr>
                  {/* RANK */}
                  <tr>
                    <td
                      className="game-tab-round-cell"
                      style={{ padding: '8px 6px 8px 14px', background: V.bg2, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}
                    >RANK</td>
                    {players.map((p, pi) => (
                      <td key={p.id} style={{ padding: '8px 4px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: p.id === leaderId ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                        {formatRank(ranks[p.id])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {completedRounds.length > 5 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 10, borderTop: `1px solid ${V.line}`, background: V.bg2 }}>
                <button
                  onClick={() => setExpanded(e => !e)}
                  aria-expanded={expanded}
                  style={{ background: 'transparent', border: `1px solid ${V.line}`, color: V.ink2, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, touchAction: 'manipulation' }}
                  className="game-icon-btn game-expand-btn"
                >
                  {expanded ? 'Collapse' : `All ${completedRounds.length} rounds`}
                  <span aria-hidden style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}>↓</span>
                </button>
              </div>
            ) : null}
          </section>
        </div>

        {/* ─── Stats row — full width ─── */}
        <section aria-label="Round stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <StreakCard completedRounds={completedRounds} topStreak={topStreak} />
          <BiggestBidCard biggest={biggest} />
          <DealerBurdenCard recent3={recent3} />
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${V.line}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.06em', lineHeight: 1.55 }}>
            When the cards are played out, tap <b style={{ color: V.ink }}>Enter Round Results →</b>
          </div>
          <button
            onClick={onEnterResults}
            className="game-cta-btn"
            style={{
              background: V.accent,
              border: 'none',
              borderRadius: 14,
              padding: '16px 26px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              color: '#2a1620',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 8px 20px -8px rgba(232,154,60,.4)',
              touchAction: 'manipulation',
            }}
          >
            Enter Round Results <span aria-hidden style={{ fontSize: 18 }}>→</span>
          </button>
        </footer>
      </div>

      <PauseOverlay
        paused={paused}
        onToggle={togglePause}
        roundNumber={roundNumber}
        trump={trump}
        cards={cards}
        pauseMm={pauseMm}
        pauseSs={pauseSs}
      />

      <SummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        onEndGame={handleEndGame}
        game={game}
        players={players}
        completedRounds={completedRounds}
        pendingRound={pendingRound}
        roundNumber={roundNumber}
      />
      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        game={game}
        players={players}
        completedRounds={completedRounds}
      />
    </>
  )
}
