import { useState, useCallback, useMemo, memo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useHistory } from '../hooks/useHistory'
import Avatar from '../components/game/Avatar'
import AccountMenu from '../components/AccountMenu'
import StatsModal from '../components/game/StatsModal'
import { disambiguateInitials } from '../lib/gameLogic'

// ── Helpers ───────────────────────────────────────────────────────────
function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const totalMin = Math.floor(Math.max(0, ms) / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function timeAgo(isoString) {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins   = Math.floor(diff / 60000)
  const hours  = Math.floor(diff / 3600000)
  const days   = Math.floor(diff / 86400000)
  const weeks  = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  if (mins  < 60)  return 'Just now'
  if (hours < 24)  return `${hours}h ago`
  if (days  === 1) return 'Yesterday'
  if (days  < 7)   return `${days} days ago`
  if (weeks === 1) return 'Last week'
  if (weeks < 5)   return `${weeks} weeks ago`
  if (months === 1)return 'Last month'
  return `${months} months ago`
}

function processGame(g) {
  const players = g.game_players.toSorted((a, b) => a.seat_order - b.seat_order)
  const names = players.map(p => p.display_name)
  const initials = disambiguateInitials(names)
  const normPlayers = players.map((p, i) => ({ ...p, displayName: p.display_name, initial: initials[i] }))
  const playerCount = normPlayers.length

  const normRounds = g.rounds.map(r => {
    const bids = {}
    for (const b of r.bids) bids[b.game_player_id] = b.bid
    const took = {}
    for (const rr of r.round_results) took[rr.game_player_id] = rr.tricks_won
    const isComplete = r.round_results.length === playerCount
    return {
      id: r.id, roundNumber: r.round_number, cards: r.cards_dealt,
      trump: r.trump_suit, dealerId: r.dealer_id,
      bids, took: isComplete ? took : null,
    }
  })
  const completedRounds = normRounds.filter(r => r.took !== null)

  const totals = {}
  for (const p of normPlayers) totals[p.id] = 0
  for (const r of completedRounds) {
    for (const rr of g.rounds.find(raw => raw.id === r.id)?.round_results ?? []) {
      totals[rr.game_player_id] = (totals[rr.game_player_id] ?? 0) + rr.score
    }
  }

  const sorted = normPlayers.toSorted((a, b) => totals[b.id] - totals[a.id])
  const winner = g.status === 'complete' && sorted.length > 0 ? sorted[0] : null

  return {
    id: g.id, name: g.name, scoringVariant: g.scoring_variant,
    gameType: g.game_type ?? 'card', gameSubtype: g.game_subtype ?? 'kachufull',
    status: g.status, startedAt: g.started_at, endedAt: g.ended_at, createdAt: g.created_at,
    players: normPlayers, completedRounds, completedRoundCount: completedRounds.length,
    totals, sorted, winner,
  }
}

// ── Hoisted static background ─────────────────────────────────────────
const LatticeBg = memo(function LatticeBg() {
  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: [
        'repeating-linear-gradient(45deg,  transparent, transparent 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 19px)',
        'repeating-linear-gradient(-45deg, transparent, transparent 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 19px)',
      ].join(', '),
    }} />
  )
})

// ── Game collection tiles ─────────────────────────────────────────────
const tileBaseStyle = {
  flexShrink: 0, minWidth: 130,
  background: 'var(--color-surface)', border: '1px solid var(--color-line)',
  borderRadius: 14, padding: '14px 16px', textAlign: 'left',
}

const AvailableGameTile = memo(function AvailableGameTile({ glyph, name, count, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${name}, played ${count} times`}
      className="hist-tile"
      style={{ ...tileBaseStyle, cursor: 'pointer' }}
    >
      <div aria-hidden="true" style={{ fontSize: 22, marginBottom: 8, lineHeight: 1 }}>{glyph}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)', marginBottom: 4 }} translate="no">{name}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)' }}>
        Played <b style={{ color: 'var(--color-accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}</b> times
      </div>
    </button>
  )
})

const ComingSoonGameTile = memo(function ComingSoonGameTile({ glyph, name }) {
  return (
    <div
      aria-label={`${name} — coming soon`}
      style={{ ...tileBaseStyle, opacity: 0.45 }}
    >
      <div aria-hidden="true" style={{ fontSize: 22, marginBottom: 8, lineHeight: 1 }}>{glyph}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)', marginBottom: 4 }} translate="no">{name}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginTop: 6, display: 'inline-block', background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 4, padding: '2px 5px' }}>Soon</div>
    </div>
  )
})

// ── Game card ─────────────────────────────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉']
const scoreStyle = { fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }

const GameCard = memo(function GameCard({ game, expanded, onToggle, onNavigate, onStats }) {
  const { id, name, status, startedAt, endedAt, createdAt, players, completedRoundCount, totals, sorted, winner } = game
  const isComplete = status === 'complete'
  const duration = formatDuration(startedAt, endedAt)
  const displayName = name || 'Unnamed game'
  const winnerColor = winner?.color || 'var(--color-accent)'
  const resultPath = isComplete ? `/game/${id}/final` : `/game/${id}`

  const metaParts = [
    displayName,
    `${players.length} players`,
    duration,
    timeAgo(endedAt || createdAt),
  ].filter(Boolean)

  return (
    <div
      className="hist-card-outer"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 14, overflow: 'hidden' }}
    >
      {/* Toggle row — semantic button */}
      <button
        className="hist-card-row"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
        aria-label={`${isComplete && winner ? winner.displayName : 'Game in progress'} — ${expanded ? 'collapse' : 'expand'} standings`}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }}
      >
        {/* Winner color bar */}
        <div aria-hidden="true" style={{ width: 3, height: 44, borderRadius: 2, background: winnerColor, flexShrink: 0 }} />

        {/* Winner avatar */}
        {isComplete && winner
          ? <div style={{ flexShrink: 0 }}><Avatar player={winner} size={40} /></div>
          : <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>●</span>
            </div>
        }

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isComplete && winner ? winner.displayName : 'In progress'}
            </div>
            {isComplete && winner ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {totals[winner.id]} pts
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 6px' }}>
            {metaParts.map((part, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span aria-hidden="true" style={{ color: 'var(--color-line)', fontSize: 10 }}>·</span>}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', letterSpacing: '.04em' }}>{part}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Expand arrow */}
        <div aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--color-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</div>
      </button>

      {/* Expanded standings */}
      {expanded ? (
        <div style={{ borderTop: '1px solid var(--color-line)', padding: '12px 16px', background: 'color-mix(in oklab, var(--color-bg) 40%, var(--color-surface))' }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < sorted.length - 1 ? '1px solid color-mix(in oklab, var(--color-line) 50%, transparent)' : 'none' }}>
              <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>
                {isComplete && i < 3 ? MEDALS[i] : `${i + 1}`}
              </span>
              <div aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink-2)', flex: 1 }}>{p.displayName}</span>
              <span style={scoreStyle}>{totals[p.id]}</span>
            </div>
          ))}

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div>
              {completedRoundCount > 0 ? (
                <button
                  className="hist-stats-btn"
                  onClick={e => { e.stopPropagation(); onStats(game) }}
                  style={{ background: 'none', border: '1px solid var(--color-line)', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <span aria-hidden="true">⊞</span> Stats
                </button>
              ) : null}
            </div>
            <Link
              to={resultPath}
              className="hist-results-link"
              onClick={e => e.stopPropagation()}
              style={{ background: 'none', border: '1px solid var(--color-line)', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-accent)', display: 'inline-block' }}
            >
              {isComplete ? 'Full results →' : 'Continue →'}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
})

// ── Page ──────────────────────────────────────────────────────────────
export default function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { games, loading, error, reload } = useHistory()
  const [statsGame, setStatsGame] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())

  // Stable callbacks
  const toggleCard = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Process each game exactly once per games change
  const processedGames = useMemo(() => games.map(processGame), [games])

  const kachufulCount = useMemo(
    () => processedGames.filter(pg => pg.gameSubtype === 'kachufull').length,
    [processedGames]
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative' }}>

      <LatticeBg />

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span translate="no" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.03em', color: 'var(--color-ink)' }}>
            Uja<span style={{ color: 'var(--color-accent)' }}>gro</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginLeft: 8 }}>· History</span>
        </div>
        <AccountMenu />
      </header>

      {/* Page body */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* ── New Game hero ── */}
        <div style={{ padding: '28px 0 24px', animation: 'rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.05s both' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>Game night</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(26px, 7vw, 36px)', letterSpacing: '-0.03em', color: 'var(--color-ink)', marginBottom: 18, lineHeight: 1.1, textWrap: 'balance' }}>
            Ready for another <span style={{ color: 'var(--color-accent)' }}>round?</span>
          </h1>

          {/* Link styled as button — correct for navigation */}
          <Link
            to="/"
            className="hist-new-game"
            style={{ width: '100%', position: 'relative', overflow: 'hidden', background: 'var(--color-accent)', border: 'none', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}
          >
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(255,255,255,0.05) 14px, rgba(255,255,255,0.05) 15px), repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(255,255,255,0.05) 14px, rgba(255,255,255,0.05) 15px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--color-bg)' }}>New Game</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'color-mix(in oklab, var(--color-bg) 60%, transparent)', marginTop: 2 }}>Set up players · pick a game · deal</div>
            </div>
            <div aria-hidden="true" style={{ position: 'relative', fontSize: 28, color: 'var(--color-bg)', opacity: 0.7, lineHeight: 1 }}>→</div>
          </Link>
        </div>

        {/* ── Game collection ── */}
        <div style={{ animation: 'rise 0.6s ease 0.12s both', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Your games</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            <AvailableGameTile glyph="♠♦♣♥" name="Ka·Chu·Fu·L" count={kachufulCount} onClick={() => navigate('/')} />
            <ComingSoonGameTile glyph="♠3" name="3 of Spades" />
            <ComingSoonGameTile glyph="⬡" name="Board Games" />
          </div>
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Loading…</div>
          </div>
        ) : null}

        {/* ── Error ── */}
        {error && !loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--color-ink)', marginBottom: 8 }}>Failed to load</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', marginBottom: 16 }}>{error}</div>
            <button onClick={reload} className="hist-try-again" style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', touchAction: 'manipulation' }}>Try again</button>
          </div>
        ) : null}

        {/* ── Empty state ── */}
        {!loading && !error && games.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-line)', borderRadius: 16, animation: 'rise 0.6s ease 0.2s both' }}>
            <div aria-hidden="true" style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>♠</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--color-ink-2)', marginBottom: 6 }}>No games yet</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-muted)' }}>Your first game will appear here.</div>
          </div>
        ) : null}

        {/* ── Game list ── */}
        {!loading && !error && processedGames.length > 0 ? (
          <div style={{ animation: 'rise 0.6s ease 0.2s both' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Recent game nights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {processedGames.map(pg => (
                <GameCard
                  key={pg.id}
                  game={pg}
                  expanded={expandedIds.has(pg.id)}
                  onToggle={toggleCard}
                  onStats={setStatsGame}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Stats modal */}
      {statsGame ? (
        <StatsModal
          open
          onClose={() => setStatsGame(null)}
          game={{ name: statsGame.name, scoring_variant: statsGame.scoringVariant }}
          players={statsGame.players}
          completedRounds={statsGame.completedRounds}
        />
      ) : null}

    </div>
  )
}
