import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import BidEntry from '../components/game/BidEntry'
import PlayingScreen from '../components/game/PlayingScreen'
import ResultsEntry from '../components/game/ResultsEntry'
import Avatar from '../components/game/Avatar'
import confetti from 'canvas-confetti'
import { computeTotals } from '../lib/gameLogic'

// ── Loading screen ─────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="font-display font-bold text-3xl text-ink tracking-tight">Ujagro</div>
        <div className="text-muted text-sm font-mono uppercase tracking-widest">Loading game…</div>
      </div>
    </div>
  )
}

// ── Error screen ───────────────────────────────────────────────────────
function ErrorScreen({ message, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="font-display font-bold text-2xl text-ink">Something went wrong</div>
        <p className="text-ink-2 text-sm">{message}</p>
        <button
          onClick={onRetry}
          className="text-sm text-accent hover:underline"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

// ── Fireworks confetti helper ──────────────────────────────────────────
function fireConfetti(color) {
  const hex = color || '#e89a3c'
  const defaults = { colors: [hex, '#f6e7d3', '#ffffff', '#e89a3c'], zIndex: 999 }

  function fire(opts) { confetti({ ...defaults, ...opts }) }

  // First burst — centre shower
  fire({ particleCount: 80, spread: 60, origin: { x: 0.5, y: 0.5 } })

  // Staggered side cannons
  setTimeout(() => {
    fire({ particleCount: 60, angle: 60,  spread: 55, origin: { x: 0,   y: 0.65 } })
    fire({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1,   y: 0.65 } })
  }, 250)

  setTimeout(() => {
    fire({ particleCount: 50, spread: 80, origin: { x: 0.5, y: 0.3 }, startVelocity: 30 })
  }, 600)

  setTimeout(() => {
    fire({ particleCount: 40, angle: 70,  spread: 45, origin: { x: 0.1, y: 0.5 } })
    fire({ particleCount: 40, angle: 110, spread: 45, origin: { x: 0.9, y: 0.5 } })
  }, 950)
}

// ── Game Over splash ── "The Ceremony" ───────────────────────────────
function GameOverSplash({ winner, score, margin, onDone }) {
  const timerRef = useRef(null)

  useEffect(() => {
    fireConfetti(winner?.color)
    timerRef.current = setTimeout(onDone, 5000)
    return () => clearTimeout(timerRef.current)
  }, [])

  const wc = winner?.color || '#e89a3c'
  const glowColor = `color-mix(in oklab, ${wc} 32%, transparent)`

  const parts = (winner?.displayName || '').trim().split(/\s+/)
  const first = parts[0]
  const rest  = parts.slice(1).join(' ')

  // CSS animation shorthand — 'both' fill-mode handles opacity before/after without inline opacity
  const a = (name, delay, dur = '0.55s', ease = 'ease') =>
    ({ animation: `${name} ${dur} ${ease} ${delay}ms both` })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Ghost score watermark */}
      <div aria-hidden style={{ position: 'absolute', right: '-0.05em', bottom: '-0.12em', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'min(48vw, 400px)', lineHeight: 1, color: wc, opacity: 0.05, userSelect: 'none', pointerEvents: 'none' }} />

      {/* Spotlight cone */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `conic-gradient(from 180deg at 50% -8%, ${wc}1f 0deg, transparent 38deg, transparent 322deg, ${wc}1f 360deg)`, pointerEvents: 'none', animation: `spotlight-sweep 1.4s ease 0ms both` }} />

      {/* Left championship bar */}
      <div aria-hidden style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', width: 2, height: '38%', background: `linear-gradient(to bottom, transparent, ${wc}, transparent)`, animation: 'curtain-rise 0.7s ease 300ms both' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 56px', maxWidth: 760, width: '100%' }}>

        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, animation: 'slide-from-left 0.5s ease 150ms both' }}>
          <div style={{ width: 32, height: 1, background: wc, flexShrink: 0 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10, letterSpacing: '.26em', textTransform: 'uppercase', color: wc }}>Winner · Game Over</div>
        </div>

        {/* Avatar */}
        <div style={{ marginBottom: 24, animation: 'splash-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 350ms both' }}>
          <div style={{ '--winner-color': glowColor, display: 'inline-block' }}>
            <div className="winner-glow" style={{ borderRadius: '50%', padding: 4, display: 'inline-block' }}>
              <Avatar player={winner} size={80} />
            </div>
          </div>
        </div>

        {/* Name */}
        <div style={{ lineHeight: 0.88, marginBottom: 0, animation: 'name-slam 0.7s cubic-bezier(0.22,1,0.36,1) 500ms both' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(56px, 12vw, 104px)', letterSpacing: '-0.04em', color: 'var(--color-ink)' }}>{first}</div>
          {rest
            ? <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(56px, 12vw, 104px)', letterSpacing: '-0.04em', color: wc }}>{rest}</div>
            : <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'clamp(28px, 5vw, 48px)', letterSpacing: '-0.02em', color: wc, marginTop: '0.2em' }}>★</div>
          }
        </div>

        {/* Divider */}
        <div style={{ height: 1, marginTop: 28, marginBottom: 24, background: `linear-gradient(90deg, ${wc}, ${wc}44, transparent)`, animation: 'slide-from-left 0.6s ease 900ms both' }} />

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, marginBottom: 40, animation: 'stat-rise 0.5s ease 1050ms both' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Final Score</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', color: 'var(--color-ink)' }}>{score}</div>
          </div>
          {margin > 0 && <>
            <div style={{ width: 1, height: 52, background: 'var(--color-line)', marginTop: 18 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Margin</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', color: wc }}>+{margin}</div>
            </div>
          </>}
        </div>

        {/* CTA */}
        <button
          onClick={() => { clearTimeout(timerRef.current); onDone() }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--color-muted)', transition: 'color 0.25s', animation: 'curtain-rise 0.5s ease 1300ms both' }}
          onMouseEnter={e => e.currentTarget.style.color = wc}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted)'}
        >
          View Final Results
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: '1px solid currentColor', borderRadius: '50%', fontSize: 14, transition: 'transform 0.25s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
          >→</span>
        </button>
      </div>
    </div>
  )
}

// ── Game page (phase router) ───────────────────────────────────────────
export default function Game() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [enteringResults, setEnteringResults] = useState(false)
  const [showSplash, setShowSplash] = useState(false)
  const {
    game,
    players,
    completedRounds,
    pendingRound,
    phase,
    error,
    roundNumber,
    trump,
    defaultCards,
    dealerIdx,
    lockBids,
    lockResults,
    endGame,
    reload,
  } = useGame(id)

  useEffect(() => {
    if (phase === 'complete') setShowSplash(true)
  }, [phase])

  if (phase === 'loading') return <LoadingScreen />
  if (phase === 'error') return <ErrorScreen message={error} onRetry={reload} />

  if (showSplash && players.length > 0 && game) {
    const totals = computeTotals(players, completedRounds, game.scoring_variant)
    const winner = [...players].sort((a, b) => totals[b.id] - totals[a.id])[0]
    const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])
    const margin = sorted.length > 1 ? totals[sorted[0].id] - totals[sorted[1].id] : 0
    return (
      <GameOverSplash
        winner={winner}
        score={totals[winner?.id]}
        margin={margin}
        onDone={() => navigate(`/game/${id}/final`, { replace: true })}
      />
    )
  }

  if (phase === 'playing') {
    if (enteringResults) {
      return (
        <ResultsEntry
          game={game}
          players={players}
          completedRounds={completedRounds}
          pendingRound={pendingRound}
          roundNumber={roundNumber}
          trump={trump}
          dealerIdx={dealerIdx}
          lockResults={async (took) => {
            await lockResults(took)
            setEnteringResults(false)
          }}
          endGame={endGame}
        />
      )
    }
    return (
      <PlayingScreen
        game={game}
        players={players}
        completedRounds={completedRounds}
        pendingRound={pendingRound}
        roundNumber={roundNumber}
        trump={trump}
        dealerIdx={dealerIdx}
        endGame={endGame}
        onEnterResults={() => setEnteringResults(true)}
      />
    )
  }

  // phase === 'bidding'
  return (
    <BidEntry
      game={game}
      players={players}
      completedRounds={completedRounds}
      pendingRound={pendingRound}
      roundNumber={roundNumber}
      trump={trump}
      defaultCards={defaultCards}
      dealerIdx={dealerIdx}
      lockBids={lockBids}
      endGame={endGame}
    />
  )
}
