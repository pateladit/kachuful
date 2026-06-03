import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useCountUp } from '../../hooks/useCountUp'
import Avatar from './Avatar'
import SummaryModal from './SummaryModal'
import StatsModal from './StatsModal'
import {
  trumpById,
  computeTotals,
  computeRanks,
  scoreFor,
  playerStreaks,
} from '../../lib/gameLogic'
import { trumpTint } from '../../lib/gameColors'
import GameHeader from './GameHeader'
import RunningTab from './RunningTab'

const V = {
  bg:      'var(--color-bg, #211218)',
  bg2:     'var(--color-bg-2, #301820)',
  surface: 'var(--color-surface, #381c2a)',
  ink:     'var(--color-ink, #f5e6cc)',
  ink2:    'var(--color-ink-2, #d4a882)',
  muted:   'var(--color-muted, #8e7060)',
  line:    'var(--color-line, #4c2c3c)',
  accent:  'var(--color-accent, #c98818)',
  accent2: 'var(--color-accent-2, #cc3e35)',
  accent3: 'var(--color-accent-3, #a8c068)',
}

// Diamond lattice — same 2% texture used on login, history, BidEntry
const LATTICE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M18 0 L36 18 L18 36 L0 18 Z' fill='none' stroke='white' stroke-width='0.6'/%3E%3C/svg%3E")`

function totalColor(score, min, max) {
  if (max === min) return V.ink
  const t = (score - min) / (max - min)
  return `color-mix(in oklab, ${V.accent3} ${Math.round(t * 100)}%, ${V.accent2})`
}

const AnimatedTotal = React.memo(function AnimatedTotal({ value }) {
  const displayed = useCountUp(value, { duration: 700 })
  return <span>{displayed}</span>
})

// ── Stat sub-components ─────────────────────────────────────────────────────

const WinStreakCard = React.memo(function WinStreakCard({ completedRounds, topWinStreak }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Hottest streak</div>
      {completedRounds.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Avatar player={topWinStreak.player} size={36} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.accent3, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {topWinStreak.streak}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>/{completedRounds.length} rounds made</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 10 }}>
            <b style={{ color: V.ink }}>{topWinStreak.player.displayName}</b> · {topWinStreak.streak} in a row
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 12 }}>No completed rounds yet</div>
      )}
    </div>
  )
})

const LoseStreakCard = React.memo(function LoseStreakCard({ completedRounds, topLoseStreak }) {
  const hasMisses = topLoseStreak.streak > 0
  return (
    <div style={{
      background: V.surface,
      border: `1px solid ${hasMisses ? `color-mix(in oklab, ${V.accent2} 38%, ${V.line})` : V.line}`,
      borderRadius: 20,
      padding: '20px 22px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>On a cold streak</div>
      {completedRounds.length > 0 && hasMisses ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Avatar player={topLoseStreak.player} size={36} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.accent2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {topLoseStreak.streak}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>
                miss{topLoseStreak.streak !== 1 ? 'es' : ''} in a row
              </div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 10 }}>
            <b style={{ color: V.accent2 }}>{topLoseStreak.player.displayName}</b> · currently cold
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 12 }}>
          {completedRounds.length === 0 ? 'No completed rounds yet' : "No one’s on a cold streak"}
        </div>
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
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: V.bg2,
            border: `1px solid ${made ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : `color-mix(in oklab, ${V.accent2} 50%, transparent)`}`,
            borderRadius: 10, padding: '8px 12px',
          }}>
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
        background: 'color-mix(in oklab, var(--color-bg, #211218) 88%, black)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        opacity: paused ? 1 : 0,
        pointerEvents: paused ? 'auto' : 'none',
        transition: 'opacity .25s ease',
        overscrollBehavior: 'contain',
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

  const totals   = useMemo(() => computeTotals(players, completedRounds, variant), [players, completedRounds, variant])
  const ranks    = useMemo(() => computeRanks(players, totals), [players, totals])
  const leaderIds = useMemo(() => {
    if (!players.length) return new Set()
    const maxScore = Math.max(...players.map(p => totals[p.id]))
    return new Set(players.filter(p => totals[p.id] === maxScore).map(p => p.id))
  }, [players, totals])

  const { minTotal, maxTotal } = useMemo(() => {
    const scores = players.map(p => totals[p.id])
    return { minTotal: Math.min(...scores), maxTotal: Math.max(...scores) }
  }, [players, totals])

  const cards     = pendingRound?.cards ?? 0
  const sumOfBids = useMemo(() => players.reduce((acc, p) => acc + (pendingRound?.bids[p.id] ?? 0), 0), [players, pendingRound])
  const overBy    = sumOfBids - cards
  const sumStatus = overBy > 0 ? 'over' : 'under'
  const sumLabel  = overBy > 0
    ? `OVER · ${overBy} EXTRA BID${overBy > 1 ? 'S' : ''}`
    : `UNDER · ${cards - sumOfBids} SHORT`

  // Win + lose streaks — single O(n) pass, playerStreaks called once per player
  const { topWinStreak, topLoseStreak } = useMemo(() => {
    const fallback = { player: players[0] ?? null, streak: 0 }
    let bestWin = fallback, bestLose = fallback
    for (const p of players) {
      const s = playerStreaks(p.id, completedRounds)
      if (s.madeBest      > bestWin.streak)  bestWin  = { player: p, streak: s.madeBest }
      if (s.currentMissed > bestLose.streak) bestLose = { player: p, streak: s.currentMissed }
    }
    return { topWinStreak: bestWin, topLoseStreak: bestLose }
  }, [players, completedRounds])

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
      {/* ─── Page wrapper: suit-bleed background + diamond lattice ─── */}
      <div style={{
        minHeight: '100vh',
        background: tint.pageBleed,
        transition: 'background 0.9s ease',
        position: 'relative',
      }}>
        {/* Diamond lattice overlay — fixed so it covers the full viewport seamlessly */}
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: LATTICE_SVG,
            backgroundSize: '36px 36px',
            opacity: 0.022,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Content layer */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1360,
          margin: '0 auto',
          padding: '24px 32px 32px',
          display: 'grid',
          gridTemplateRows: 'auto auto auto auto auto',
          gap: 20,
        }}>

          {/* ─── Header ─── */}
          <GameHeader game={game} roundNumber={roundNumber} phase="playing">
            <button
              className="game-icon-btn"
              onClick={() => setSummaryOpen(true)}
              aria-label="Game Summary"
              title="Game Summary"
              style={{ background: V.surface, border: `1px solid ${V.line}`, color: V.ink2, height: 36, borderRadius: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px' }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>◍</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600 }}>Summary</span>
            </button>
            <button
              className="game-icon-btn"
              onClick={() => setStatsOpen(true)}
              aria-label="Player Stats"
              title="Player Stats"
              style={{ background: V.surface, border: `1px solid ${V.line}`, color: V.ink2, height: 36, borderRadius: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px' }}
            >
              <span aria-hidden style={{ fontSize: 13 }}>⊞</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600 }}>Stats</span>
            </button>
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
          </GameHeader>

          {/* ─── Hero ─── */}
          <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 14 }} aria-label="Round information">

            {/* Trump — full character treatment: watermark glyph + flavor label */}
            <div style={{
              background: tint.bg,
              border: tint.border,
              borderRadius: 20,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Watermark — large faint glyph behind content */}
              <div aria-hidden style={{
                position: 'absolute',
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 130,
                lineHeight: 1,
                color: tint.glyphColor,
                opacity: 0.09,
                pointerEvents: 'none',
                userSelect: 'none',
                fontFamily: 'var(--font-body)',
              }}>{trump?.glyph ?? '?'}</div>

              <div aria-hidden style={{ fontSize: 80, lineHeight: 1, color: tint.glyphColor, flexShrink: 0, position: 'relative', zIndex: 1 }}>
                {trump?.glyph ?? '?'}
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: tint.labelColor }}>
                  {trump?.nt ? 'No Trump' : 'Trump suit'} · R{roundNumber}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1, color: tint.glyphColor, marginTop: 4 }}>
                  {trump?.name ?? '—'}
                </div>
                {tint.flavor ? (
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '.2em',
                    textTransform: 'uppercase',
                    color: tint.labelColor,
                    marginTop: 6,
                    opacity: 0.75,
                  }}>{tint.flavor}</div>
                ) : null}
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, margin: '0 0 16px' }}>
                Bids locked in
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
                  {sumOfBids} of {cards} called · {overBy > 0 ? `${overBy} over` : `${cards - sumOfBids} short`}
                </small>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {players.map((p, i) => {
                  const bid = pendingRound?.bids[p.id]
                  const bidColor = bid === undefined ? V.muted : bid === 0 ? V.accent3 : p.color
                  return (
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
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: bidColor, fontVariantNumeric: 'tabular-nums' }}>
                        {bid ?? '—'}
                      </div>
                      {bid === 0 ? (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.accent3, marginTop: 4, opacity: 0.8 }}>NIL CALL</div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Running tab — right sidebar on desktop, below on mobile */}
            <RunningTab
              players={players}
              completedRounds={completedRounds}
              tabRounds={tabRounds}
              dealerIdx={dealerIdx}
              variant={variant}
              totals={totals}
              ranks={ranks}
              leaderIds={leaderIds}
              expanded={expanded}
              onToggleExpand={() => setExpanded(e => !e)}
              totalCellColor={p => totalColor(totals[p.id], minTotal, maxTotal)}
              renderTotal={p => <AnimatedTotal value={totals[p.id]} />}
              renderCurrentRound={() => (
                <tr>
                  <td
                    className="game-tab-round-cell"
                    style={{ textAlign: 'left', padding: '7px 6px 7px 14px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.accent, background: `color-mix(in oklab, ${V.accent} 6%, ${V.bg2})` }}
                  >
                    R{roundNumber}
                    <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .65, marginLeft: 3 }}>{trump?.glyph}</span>
                  </td>
                  {players.map((p, pi) => {
                    const bid = pendingRound?.bids[p.id]
                    return (
                      <td key={p.id} style={{ padding: '7px 4px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', background: `color-mix(in oklab, ${V.accent} 8%, transparent)` }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: bid === 0 ? V.accent3 : V.ink }}>
                            {bid ?? '—'}
                          </span>
                          <span
                            aria-hidden
                            className="live-dot"
                            style={{ width: 5, height: 5, borderRadius: '50%', background: V.accent, marginTop: 3, display: 'block' }}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )}
            />
          </div>

          {/* ─── Stats row — full width ─── */}
          <section aria-label="Round stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <WinStreakCard completedRounds={completedRounds} topWinStreak={topWinStreak} />
            <LoseStreakCard completedRounds={completedRounds} topLoseStreak={topLoseStreak} />
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
