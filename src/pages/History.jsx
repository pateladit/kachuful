import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useHistory } from '../hooks/useHistory'
import Avatar from '../components/game/Avatar'
import { disambiguateInitials } from '../lib/gameLogic'

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

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const totalMin = Math.floor(Math.max(0, ms) / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Process raw Supabase game into a shape usable by the UI.
function processGame(g) {
  const players = [...g.game_players]
    .sort((a, b) => a.seat_order - b.seat_order)
  const names = players.map(p => p.display_name)
  const initials = disambiguateInitials(names)
  const normPlayers = players.map((p, i) => ({
    ...p,
    displayName: p.display_name,
    initial: initials[i],
  }))

  const playerCount = normPlayers.length
  const completedRounds = g.rounds.filter(r => r.round_results.length === playerCount)

  const totals = {}
  for (const p of normPlayers) totals[p.id] = 0
  for (const r of completedRounds) {
    for (const rr of r.round_results) {
      totals[rr.game_player_id] = (totals[rr.game_player_id] ?? 0) + rr.score
    }
  }

  const sorted = [...normPlayers].sort((a, b) => totals[b.id] - totals[a.id])
  const winner = g.status === 'complete' && sorted.length > 0 ? sorted[0] : null

  return {
    id: g.id,
    name: g.name,
    status: g.status,
    startedAt: g.started_at,
    endedAt: g.ended_at,
    createdAt: g.created_at,
    players: normPlayers,
    rounds: g.rounds,
    completedRoundCount: completedRounds.length,
    totals,
    sorted,
    winner,
  }
}

// Aggregate stats across all games for the current user.
function computeStats(rawGames, userId) {
  const empty = { totalGames: 0, winRate: 0, winsLabel: '0/0', bestRound: 0, accuracy: 0, accuracyLabel: '0/0' }
  if (!rawGames.length) return empty

  const completeGames = rawGames.filter(g => g.status === 'complete')
  let wins = 0
  for (const g of completeGames) {
    const pg = processGame(g)
    const userSeat = pg.players.find(p => p.user_id === userId)
    if (!userSeat) continue
    const userScore = pg.totals[userSeat.id] ?? 0
    const maxScore = Math.max(...Object.values(pg.totals))
    if (userScore === maxScore) wins++
  }

  let bestRound = 0
  let madeBids = 0, totalBids = 0
  for (const g of rawGames) {
    const playerCount = g.game_players.length
    const userSeat = g.game_players.find(p => p.user_id === userId)
    for (const r of g.rounds) {
      if (r.round_results.length !== playerCount) continue
      if (!userSeat) continue
      const bid = r.bids.find(b => b.game_player_id === userSeat.id)
      const result = r.round_results.find(rr => rr.game_player_id === userSeat.id)
      if (bid && result) {
        totalBids++
        if (bid.bid === result.tricks_won) madeBids++
        if (result.score > bestRound) bestRound = result.score
      }
    }
  }

  const winRate = completeGames.length > 0
    ? Math.round((wins / completeGames.length) * 100)
    : 0
  const accuracy = totalBids > 0
    ? Math.round((madeBids / totalBids) * 100)
    : 0

  return {
    totalGames: rawGames.length,
    winRate,
    winsLabel: `${wins}/${completeGames.length}`,
    bestRound,
    accuracy,
    accuracyLabel: `${madeBids}/${totalBids}`,
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1, color: accent ? V.accent : V.ink, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Game card ─────────────────────────────────────────────────────────────────
function GameCard({ rawGame, onOpen }) {
  const pg = processGame(rawGame)
  const { id, name, status, startedAt, endedAt, createdAt, players, completedRoundCount, totals, sorted, winner } = pg
  const isComplete = status === 'complete'
  const duration = formatDuration(startedAt, endedAt)
  const displayName = name || `Game · ${formatDate(createdAt)}`

  return (
    <div
      style={{
        background: V.surface,
        border: `1px solid ${V.line}`,
        borderRadius: 20,
        padding: '20px 24px',
        cursor: 'pointer',
        transition: 'border-color .15s ease',
      }}
      onClick={onOpen}
      onMouseEnter={e => e.currentTarget.style.borderColor = isComplete ? V.accent : V.ink2}
      onMouseLeave={e => e.currentTarget.style.borderColor = V.line}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: V.ink, marginBottom: 4 }}>{displayName}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted }}>
            {formatDate(createdAt)}
            {' · '}
            {players.length} player{players.length !== 1 ? 's' : ''}
            {' · '}
            {completedRoundCount} round{completedRoundCount !== 1 ? 's' : ''}
            {duration && ` · ${duration}`}
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 999, flexShrink: 0,
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          background: isComplete
            ? `color-mix(in oklab, ${V.accent} 15%, ${V.bg2})`
            : `color-mix(in oklab, ${V.accent3} 12%, ${V.bg2})`,
          color: isComplete ? V.accent : V.accent3,
          border: `1px solid ${isComplete ? `color-mix(in oklab, ${V.accent} 40%, transparent)` : `color-mix(in oklab, ${V.accent3} 30%, transparent)`}`,
        }}>
          {isComplete ? '★ Complete' : '● In progress'}
        </div>
      </div>

      {/* Player scores */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {sorted.map((p, i) => {
          const medals = ['🥇', '🥈', '🥉']
          const isWinner = isComplete && i === 0
          return (
            <div
              key={p.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: isWinner ? `color-mix(in oklab, ${V.accent} 12%, ${V.bg2})` : V.bg2,
                border: `1px solid ${isWinner ? `color-mix(in oklab, ${V.accent} 50%, transparent)` : V.line}`,
                borderRadius: 10, padding: '7px 12px',
              }}
            >
              {isComplete && i < 3 && <span style={{ fontSize: 14 }}>{medals[i]}</span>}
              <Avatar player={p} size={24} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: isWinner ? V.accent : V.ink }}>{p.displayName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: isWinner ? V.accent : V.ink2 }}>{totals[p.id]}</span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${V.line}` }}>
        {isComplete && winner ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
            <b style={{ color: V.accent }}>{winner.displayName}</b> won with <b style={{ color: V.ink }}>{totals[winner.id]}</b> points
            {sorted.length > 1 && <> · <b style={{ color: V.ink }}>+{totals[winner.id] - totals[sorted[1].id]}</b> ahead</>}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
            Round {completedRoundCount + 1} in progress
          </div>
        )}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: isComplete ? V.accent : V.ink2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {isComplete ? 'View final results' : 'Continue game'} →
        </span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function History() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { games, loading, error, reload } = useHistory()

  const stats = computeStats(games, user?.id)

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login')
    } catch (_) {}
  }

  function openGame(g) {
    if (g.status === 'complete') {
      navigate(`/game/${g.id}/final`)
    } else {
      navigate(`/game/${g.id}`)
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px 48px', minHeight: '100vh' }}>

      {/* ─── Header ─── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid ${V.line}` }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
            Ka<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Chu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Fu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />L
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>Game History</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: V.accent, border: 'none', borderRadius: 12, padding: '10px 18px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: '#2a1620', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            + New game
          </button>
          <button
            onClick={handleSignOut}
            style={{ background: 'transparent', border: `1px solid ${V.line}`, borderRadius: 12, padding: '10px 18px', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.08em', color: V.muted, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ─── Loading ─── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Loading history…</div>
        </div>
      )}

      {/* ─── Error ─── */}
      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, marginBottom: 8 }}>Failed to load</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, marginBottom: 16 }}>{error}</div>
          <button onClick={reload} style={{ background: 'transparent', border: 'none', color: V.accent, fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>Try again</button>
        </div>
      )}

      {/* ─── Stats row ─── */}
      {!loading && !error && games.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          <StatCard
            label="Games played"
            value={stats.totalGames}
            sub={`${games.filter(g => g.status === 'complete').length} complete`}
          />
          <StatCard
            label="Win rate"
            value={`${stats.winRate}%`}
            sub={`${stats.winsLabel} games`}
            accent
          />
          <StatCard
            label="Best round score"
            value={stats.bestRound || '—'}
            sub={stats.bestRound ? 'points in one round' : 'no data yet'}
          />
          <StatCard
            label="Accuracy"
            value={stats.accuracyLabel === '0/0' ? '—' : `${stats.accuracy}%`}
            sub={stats.accuracyLabel === '0/0' ? 'no data yet' : `${stats.accuracyLabel} bids made`}
          />
        </div>
      )}

      {/* ─── Game list ─── */}
      {!loading && !error && games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: V.ink, marginBottom: 10 }}>No games yet</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, marginBottom: 24 }}>Start your first game to see it here.</div>
          <button
            onClick={() => navigate('/')}
            style={{ background: V.accent, border: 'none', borderRadius: 12, padding: '14px 24px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: '#2a1620', cursor: 'pointer' }}
          >
            + New game
          </button>
        </div>
      )}

      {!loading && !error && games.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {games.map(g => (
            <GameCard key={g.id} rawGame={g} onOpen={() => openGame(g)} />
          ))}
        </div>
      )}
    </div>
  )
}
