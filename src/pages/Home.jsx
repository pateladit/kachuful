import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PLAYER_COLORS, defaultLoopRounds } from '../lib/gameLogic'
import AccountMenu from '../components/AccountMenu'

function makePlayer(index) {
  return {
    id: crypto.randomUUID(),
    displayName: '',
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  }
}

const SCORING_OPTIONS = [
  { value: 1, label: 'Classic',        formula: '10 + tricks won  ·  zero bid = 10' },
  { value: 2, label: 'Bid+1',          formula: '(10 × tricks won) + 1' },
  { value: 3, label: 'Bid+1 · Nil=10', formula: '(10 × tricks won) + 1  ·  zero = 10' },
]

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const isAnonymous = !user?.email && !user?.user_metadata?.provider
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!isAnonymous || !user?.id) return
    if (localStorage.getItem('kachuful-banner-dismissed')) return
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('status', 'complete')
      .then(({ count }) => { if (count >= 2) setShowBanner(true) })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissBanner() {
    localStorage.setItem('kachuful-banner-dismissed', '1')
    setShowBanner(false)
  }

  const [gameName, setGameName] = useState('')
  const [players, setPlayers] = useState([makePlayer(0), makePlayer(1)])
  const [scoringVariant, setScoringVariant] = useState(1)
  const [noTrumpRound, setNoTrumpRound] = useState(false)
  const [numDecks, setNumDecks] = useState(1)
  const [startCards, setStartCards] = useState(1)
  const [peakCards, setPeakCards] = useState(8)
  const [colorPickerOpen, setColorPickerOpen] = useState(null)
  const [dealerSeat, setDealerSeat] = useState(null)
  const [cutDone, setCutDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [gameCategory, setGameCategory] = useState('card')
  const [gameSubtype,  setGameSubtype]  = useState('kachufull')

  const maxCards = Math.floor((52 * numDecks) / Math.max(players.length, 2))
  const loopRounds = defaultLoopRounds(startCards, peakCards)
  const allNamed = players.every(p => p.displayName.trim().length > 0)
  const canStart = allNamed && players.length >= 2 && gameSubtype === 'kachufull' && cutDone

  // Clamp peakCards to maxCards when deck count or player count changes
  useEffect(() => {
    if (peakCards > maxCards) setPeakCards(maxCards)
  }, [numDecks, players.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clamp startCards when peakCards decreases
  useEffect(() => {
    if (startCards > peakCards) setStartCards(peakCards)
  }, [peakCards]) // eslint-disable-line react-hooks/exhaustive-deps

  function addPlayer() {
    if (players.length >= 11) return
    setPlayers(prev => [...prev, makePlayer(prev.length)])
    resetCut()
  }

  function removePlayer(id) {
    if (players.length <= 2) return
    setPlayers(prev => prev.filter(p => p.id !== id))
    resetCut()
  }

  function updatePlayer(id, field, value) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function moveUp(index) {
    if (index === 0) return
    setPlayers(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
    resetCut()
  }

  function moveDown(index) {
    if (index === players.length - 1) return
    setPlayers(prev => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
    resetCut()
  }

  function resetCut() {
    setDealerSeat(null)
    setCutDone(false)
  }

  function cutForDealer() {
    const seat = Math.floor(Math.random() * players.length)
    setDealerSeat(seat)
    setCutDone(true)
  }

  async function handleStart() {
    if (!canStart || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { data: game, error: gameErr } = await supabase
        .from('games')
        .insert({
          name: gameName.trim() || null,
          scoring_variant: scoringVariant,
          no_trump_round: noTrumpRound,
          num_decks: numDecks,
          start_cards: startCards,
          peak_cards: peakCards,
          first_dealer_seat: dealerSeat,
          started_at: new Date().toISOString(),
          created_by: user.id,
          status: 'in_progress',
        })
        .select()
        .single()

      if (gameErr) throw gameErr

      const { error: playersErr } = await supabase
        .from('game_players')
        .insert(
          players.map((p, i) => ({
            game_id: game.id,
            // seat 0 is the creator/scorekeeper — sets user_id so RLS
            // is_game_member() returns true for all subsequent queries
            user_id: i === 0 ? user.id : null,
            display_name: p.displayName.trim(),
            color: p.color,
            seat_order: i,
          }))
        )

      if (playersErr) throw playersErr

      navigate(`/game/${game.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg" onClick={() => setColorPickerOpen(null)}>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-bg border-b border-line px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="font-display font-bold text-xl text-ink">Ujagro</span>
            <span className="text-muted text-base ml-2">· Game Setup</span>
          </div>
          <AccountMenu />
        </div>
      </header>

      {/* Upgrade banner — anonymous users with ≥2 complete games */}
      {showBanner && (
        <div style={{
          background: 'var(--color-accent)',
          color: '#2a1620',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.7 }}>Guest</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>
              Your history lives only on this device.
            </span>
            <button
              onClick={() => navigate('/preferences')}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: '#2a1620', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Save your account →
            </button>
          </div>
          <button
            onClick={dismissBanner}
            style={{ background: 'none', border: 'none', fontSize: 16, color: '#2a1620', cursor: 'pointer', opacity: 0.6, flexShrink: 0, lineHeight: 1, padding: '0 4px' }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Scrollable body */}
      <main className="max-w-5xl mx-auto px-4 lg:px-8 pt-6 pb-36">
        <div className="space-y-8 lg:grid lg:grid-cols-2 lg:gap-10 lg:space-y-0 lg:items-start">

          {/* LEFT column — Players */}
          <div className="space-y-8">

            {/* ── Players ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wider">
                  Players ({players.length})
                </h2>
                <button
                  onClick={addPlayer}
                  disabled={players.length >= 11}
                  className="text-sm font-medium text-accent hover:opacity-80
                             disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  + Add player
                </button>
              </div>

              <div className="space-y-2">
                {players.map((player, i) => (
                  <div key={player.id} onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-3 py-2">
                      {/* Color swatch */}
                      <button
                        type="button"
                        onClick={() => setColorPickerOpen(colorPickerOpen === player.id ? null : player.id)}
                        className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-transparent
                                   hover:ring-ink transition-all"
                        style={{ backgroundColor: player.color }}
                      />

                      {/* Name input */}
                      <input
                        type="text"
                        placeholder={`Player ${i + 1}`}
                        value={player.displayName}
                        onChange={e => updatePlayer(player.id, 'displayName', e.target.value)}
                        className="flex-1 bg-transparent text-sm text-ink focus:outline-none
                                   placeholder:text-muted"
                      />

                      {/* Reorder */}
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => moveUp(i)}
                          disabled={i === 0}
                          className="w-6 h-6 flex items-center justify-center text-muted
                                     hover:text-ink disabled:opacity-20 transition-colors text-xs"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveDown(i)}
                          disabled={i === players.length - 1}
                          className="w-6 h-6 flex items-center justify-center text-muted
                                     hover:text-ink disabled:opacity-20 transition-colors text-xs"
                        >
                          ↓
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removePlayer(player.id)}
                        disabled={players.length <= 2}
                        className="w-6 h-6 flex items-center justify-center text-muted
                                   hover:text-accent-2 disabled:opacity-20 transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    {/* Inline color picker */}
                    {colorPickerOpen === player.id && (
                      <div className="mt-1 p-3 bg-bg-2 border border-line rounded-xl grid grid-cols-6 gap-2">
                        {PLAYER_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              updatePlayer(player.id, 'color', color)
                              setColorPickerOpen(null)
                            }}
                            className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                            style={{
                              backgroundColor: color,
                              borderColor: player.color === color ? '#f6e7d3' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* RIGHT column — Settings */}
          <div className="space-y-8">

            {/* ── Game name ── */}
            <section>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                Game name <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Diwali Eve 2026"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
                className="w-full rounded-xl bg-surface border border-line px-4 py-3 text-sm
                           text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </section>

            {/* ── Game category ── */}
            <section>
              <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wider mb-3">
                Game type
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'card',  glyph: '♠', label: 'Card Game',   sub: 'Trick-taking, rummy & more' },
                  { id: 'board', glyph: '⬡', label: 'Board Game',  sub: 'Coming soon' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setGameCategory(cat.id)
                      setGameSubtype(null)
                    }}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-4 text-center transition-colors ${
                      gameCategory === cat.id
                        ? 'border-accent bg-surface'
                        : 'border-line bg-surface hover:border-muted'
                    }`}
                  >
                    <span className={`text-3xl leading-none ${gameCategory === cat.id ? 'text-accent' : 'text-muted'}`}>
                      {cat.glyph}
                    </span>
                    <span className={`text-sm font-semibold mt-1 ${gameCategory === cat.id ? 'text-accent' : 'text-ink'}`}>
                      {cat.label}
                    </span>
                    <span className="text-xs text-muted">{cat.sub}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Game selection ── */}
            <section>
              <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wider mb-3">
                Select a game
              </h2>

              {gameCategory === 'card' && (
                <div className="space-y-2">
                  {[
                    { id: 'kachufull', glyph: '♠♦♣♥', name: 'Ka Chu Fu L',    sub: 'Judgement · 2–11 players' },
                    { id: 'spades3',   glyph: '♠3',    name: '3 of Spades',    sub: 'Rules coming soon' },
                  ].map(g => (
                    <button
                      key={g.id}
                      onClick={() => setGameSubtype(g.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        gameSubtype === g.id
                          ? 'border-accent bg-surface'
                          : 'border-line bg-surface hover:border-muted'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                        gameSubtype === g.id ? 'border-accent bg-accent' : 'border-muted'
                      }`} />
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`text-xl leading-none flex-shrink-0 ${gameSubtype === g.id ? 'text-accent' : 'text-muted'}`}>
                          {g.glyph}
                        </span>
                        <div>
                          <div className={`text-sm font-semibold ${gameSubtype === g.id ? 'text-accent' : 'text-ink'}`}>
                            {g.name}
                          </div>
                          <div className="text-xs text-muted font-mono mt-0.5">{g.sub}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {gameCategory === 'board' && (
                <div className="grid grid-cols-3 gap-2" style={{ opacity: 0.45 }}>
                  {['Catan', 'Ticket to Ride', 'Pandemic'].map(name => (
                    <div
                      key={name}
                      className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-3 py-4 text-center"
                    >
                      <span className="text-2xl text-muted">⬡</span>
                      <span className="text-xs font-medium text-ink leading-tight">{name}</span>
                      <span className="font-mono text-[9px] tracking-widest uppercase text-muted">Coming soon</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {gameSubtype === 'spades3' && (
              <section>
                <div className="bg-surface border border-line rounded-xl px-4 py-5 text-center">
                  <div className="text-2xl text-muted mb-2">♠3</div>
                  <div className="text-sm font-semibold text-ink mb-1">3 of Spades</div>
                  <div className="text-xs text-muted font-mono">Rules, scoring, and config coming soon.</div>
                </div>
              </section>
            )}

            {gameSubtype === 'kachufull' && (<>

            {/* ── Scoring variant ── */}
            <section>
              <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wider mb-3">
                Scoring
              </h2>
              <div className="space-y-2">
                {SCORING_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setScoringVariant(opt.value)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3
                                text-left transition-colors ${
                                  scoringVariant === opt.value
                                    ? 'border-accent bg-surface'
                                    : 'border-line bg-surface hover:border-muted'
                                }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                        scoringVariant === opt.value ? 'border-accent bg-accent' : 'border-muted'
                      }`}
                    />
                    <div>
                      <div className={`text-sm font-medium ${scoringVariant === opt.value ? 'text-accent' : 'text-ink'}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-muted font-mono mt-0.5">{opt.formula}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Rules & Rounds ── */}
            <section>
              <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wider mb-3">
                Rules &amp; Rounds
              </h2>
              <div className="bg-surface border border-line rounded-xl divide-y divide-line">
                {/* No-trump toggle */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium text-ink">No-trump round</div>
                    <div className="text-xs text-muted mt-0.5">Adds ⚬ NT to the trump rotation</div>
                  </div>
                  <button
                    onClick={() => setNoTrumpRound(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      noTrumpRound ? 'bg-accent' : 'bg-bg border border-line'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-ink
                                   transition-transform ${noTrumpRound ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </div>

                {/* Deck selector */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="text-sm font-medium text-ink">Decks</div>
                  <div className="flex gap-2">
                    {[1, 2].map(n => (
                      <button
                        key={n}
                        onClick={() => setNumDecks(n)}
                        className={`w-10 h-8 rounded-lg text-sm font-medium transition-colors ${
                          numDecks === n
                            ? 'bg-accent text-bg'
                            : 'bg-bg border border-line text-ink-2 hover:text-ink'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start cards */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="text-sm font-medium text-ink">Start cards</div>
                  <Stepper
                    value={startCards}
                    min={1}
                    max={peakCards}
                    onChange={setStartCards}
                  />
                </div>

                {/* Peak cards */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium text-ink">Peak cards</div>
                    <div className="text-xs text-muted mt-0.5">
                      Max {maxCards} with {numDecks} deck{numDecks > 1 ? 's' : ''}, {players.length} players
                    </div>
                  </div>
                  <Stepper
                    value={peakCards}
                    min={Math.max(startCards, 1)}
                    max={maxCards}
                    onChange={setPeakCards}
                  />
                </div>

                {/* Round preview */}
                <div className="px-4 py-3.5">
                  <div className="text-xs text-muted mb-1">First loop preview</div>
                  <div className="font-mono text-sm text-ink-2">
                    {startCards} → {peakCards} → 1
                    <span className="text-muted ml-2">· {loopRounds} rounds</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Cut for dealer ── */}
            <section>
              <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wider mb-3">
                Cut for dealer
              </h2>

              {!cutDone ? (
                <div>
                  <p className="text-sm text-muted mb-4">
                    Tap any card to randomly assign the first dealer.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {players.map((_, i) => (
                      <button
                        key={i}
                        onClick={cutForDealer}
                        className="w-14 h-20 rounded-xl bg-surface border border-line
                                   flex items-center justify-center text-xl text-muted
                                   hover:border-accent hover:text-accent transition-colors"
                      >
                        ✦
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-surface border border-line rounded-xl px-4 py-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center
                               text-sm font-bold text-bg flex-shrink-0"
                    style={{ backgroundColor: players[dealerSeat]?.color }}
                  >
                    {(players[dealerSeat]?.displayName?.charAt(0) || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">
                      {players[dealerSeat]?.displayName || `Player ${dealerSeat + 1}`} deals first
                    </div>
                    <div className="text-xs text-muted mt-0.5">Clockwise from there</div>
                  </div>
                  <button
                    onClick={cutForDealer}
                    className="text-sm text-accent hover:opacity-80 transition-opacity flex-shrink-0"
                  >
                    ↻ Reshuffle
                  </button>
                </div>
              )}
            </section>

            </>)}

          </div>
        </div>

        {error && (
          <p className="text-sm text-accent-2 text-center mt-8">{error}</p>
        )}
      </main>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-line px-4 py-4">
        <div className="max-w-5xl mx-auto space-y-2">
          {!allNamed && (
            <p className="text-xs text-muted text-center">
              Enter a name for every player to continue.
            </p>
          )}
          {allNamed && gameSubtype === null && (
            <p className="text-xs text-muted text-center">
              Select a game to continue.
            </p>
          )}
          {allNamed && gameSubtype === 'spades3' && (
            <p className="text-xs text-muted text-center">
              3 of Spades rules are coming soon — check back later.
            </p>
          )}
          {allNamed && gameSubtype === 'kachufull' && !cutDone && (
            <p className="text-xs text-muted text-center">
              Cut for dealer before starting.
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={!canStart || submitting}
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-bg
                       hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-opacity"
          >
            {submitting ? 'Starting…' : 'Start Game →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stepper({ value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg bg-bg border border-line text-ink
                   hover:border-muted disabled:opacity-30 transition-colors
                   flex items-center justify-center text-lg leading-none"
      >
        −
      </button>
      <span className="font-mono text-sm text-ink w-6 text-center tabular-nums">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg bg-bg border border-line text-ink
                   hover:border-muted disabled:opacity-30 transition-colors
                   flex items-center justify-center text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}
