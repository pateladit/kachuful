import { useState, useEffect } from 'react'
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
        <div className="font-display font-bold text-3xl text-ink tracking-tight">Ka·Chu·Fu·L</div>
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

// ── Game Over splash ───────────────────────────────────────────────────
function GameOverSplash({ winner, score, onDone }) {
  useEffect(() => {
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 } })
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', gap: 20, padding: '0 24px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.2em',
        textTransform: 'uppercase', color: 'var(--color-muted)',
      }}>Game Over</div>
      <Avatar player={winner} size={80} />
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 42,
          letterSpacing: '-0.03em', color: 'var(--color-ink)',
        }}>{winner?.displayName}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 15,
          color: 'var(--color-accent)', marginTop: 6,
        }}>{score} points · ★ Winner</div>
      </div>
      <button
        onClick={onDone}
        style={{
          marginTop: 16, background: 'none',
          border: '1px solid var(--color-line)', borderRadius: 12,
          padding: '12px 24px', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 15, color: 'var(--color-accent)', cursor: 'pointer',
        }}
      >
        View Final Results →
      </button>
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
    return (
      <GameOverSplash
        winner={winner}
        score={totals[winner?.id]}
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
