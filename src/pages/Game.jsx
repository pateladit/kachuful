import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import BidEntry from '../components/game/BidEntry'
import PlayingScreen from '../components/game/PlayingScreen'
import ResultsEntry from '../components/game/ResultsEntry'

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

// ── Game page (phase router) ───────────────────────────────────────────
export default function Game() {
  const { id } = useParams()
  const [enteringResults, setEnteringResults] = useState(false)
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

  if (phase === 'loading') return <LoadingScreen />
  if (phase === 'error') return <ErrorScreen message={error} onRetry={reload} />
  if (phase === 'complete') return <Navigate to={`/game/${id}/final`} replace />

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
