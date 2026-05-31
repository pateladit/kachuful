import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PLAYER_COLORS, defaultLoopRounds } from '../lib/gameLogic'
import AccountMenu from '../components/AccountMenu'

// ── Constants ─────────────────────────────────────────────────────────
const EMOJIS = ['🦁','🐯','🦊','🐺','🐼','🦄','🐲','🦅','🐬','🦋','👑','⭐','🎭','🎲','🃏','♟️','🎯','🔥','⚡','🌙','💫','🎸','🚀','🍀']
const NAME_SUGGESTIONS = ['Adit','Rahul','Priya','Meera','Dev','Zara','Kiran','Rohan','Nisha','Arjun','Pooja','Vikram','Ananya','Sanjay','Kavya']

const GAMES = [
  { subtype: 'kachufull', glyph: '♠♦♣♥', name: 'Ka·Chu·Fu·L', sub: 'Judgement · 2–11 players', category: 'card',  available: true },
  { subtype: 'spades3',   glyph: '♠3',    name: '3 of Spades',  sub: 'Coming soon',              category: 'card',  available: false },
  { subtype: 'catan',     glyph: '⬡',     name: 'Catan',        sub: 'Coming soon',              category: 'board', available: false },
  { subtype: 'ticket',    glyph: '🚂',    name: 'Ticket to Ride',sub: 'Coming soon',             category: 'board', available: false },
  { subtype: 'pandemic',  glyph: '🧬',    name: 'Pandemic',     sub: 'Coming soon',              category: 'board', available: false },
]

const SCORING_FORMULAS = {
  1: '10 + tricks · zero = 10',
  2: '(10×bid)+1 · zero = 1',
  3: '(10×bid)+1 · zero = 10',
}

function makePlayer(index) {
  return { id: crypto.randomUUID(), displayName: '', color: PLAYER_COLORS[index % PLAYER_COLORS.length], emoji: null }
}

// ── Seat Avatar (local, separate from game-screen Avatar component) ───
function SeatAvatar({ player, size = 36 }) {
  if (player.emoji) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.58) }}>
        {player.emoji}
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: player.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: Math.round(size * 0.38), color: '#fff', flexShrink: 0 }}>
      {player.displayName ? player.displayName[0].toUpperCase() : '?'}
    </div>
  )
}

// ── Seat editor popover ───────────────────────────────────────────────
function SeatEditor({ player, usedNames, onNameChange, onColorChange, onEmojiChange, onClose }) {
  const inputRef = useRef(null)
  const [pickerTab, setPickerTab] = useState(player.emoji ? 'emojis' : 'colors')
  const [query, setQuery] = useState(player.displayName)

  useEffect(() => { inputRef.current?.focus() }, [])

  const suggestions = query.length >= 1
    ? NAME_SUGGESTIONS.filter(n =>
        n.toLowerCase().startsWith(query.toLowerCase()) &&
        !usedNames.includes(n.toLowerCase())
      ).slice(0, 4)
    : []

  function handleInput(val) {
    setQuery(val)
    onNameChange(val)
  }

  function applySuggestion(name) {
    setQuery(name)
    onNameChange(name)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if ((e.key === 'Tab') && suggestions.length) {
      e.preventDefault()
      applySuggestion(suggestions[0])
    } else if (e.key === 'Enter' || e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100, width: 260, background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 16, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
    >
      {/* Name input */}
      <div style={{ marginBottom: 10 }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Player name…"
          autoComplete="off"
          maxLength={24}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 10, padding: '9px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-ink)', outline: 'none', caretColor: 'var(--color-accent)', transition: 'border-color .2s' }}
          onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-line)'}
        />
        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {suggestions.map(s => (
              <button
                key={s}
                onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-ink-2)', cursor: 'pointer', transition: 'border-color .15s, color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-line)'; e.currentTarget.style.color = 'var(--color-ink-2)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 9, padding: 2, marginBottom: 10 }}>
        {['Colors', 'Emojis'].map(tab => (
          <button
            key={tab}
            onClick={() => setPickerTab(tab.toLowerCase())}
            style={{ flex: 1, background: pickerTab === tab.toLowerCase() ? 'var(--color-bg-2)' : 'none', border: 'none', borderRadius: 7, padding: '5px 0', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: pickerTab === tab.toLowerCase() ? 'var(--color-ink)' : 'var(--color-muted)', cursor: 'pointer', transition: 'all .15s' }}
          >{tab}</button>
        ))}
      </div>

      {/* Color grid */}
      {pickerTab === 'colors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {PLAYER_COLORS.map(c => (
            <button
              key={c}
              onClick={() => { onColorChange(c); onEmojiChange(null) }}
              aria-label={c}
              aria-pressed={player.emoji === null && player.color === c}
              style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: `2px solid ${player.emoji === null && player.color === c ? '#f5e6cc' : 'transparent'}`, cursor: 'pointer', transition: 'transform .15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />
          ))}
        </div>
      )}

      {/* Emoji grid */}
      {pickerTab === 'emojis' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => onEmojiChange(e)}
              aria-label={e}
              aria-pressed={player.emoji === e}
              style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${player.emoji === e ? 'var(--color-accent)' : 'transparent'}`, background: player.emoji === e ? 'color-mix(in oklab, var(--color-accent) 12%, var(--color-surface))' : 'var(--color-surface)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-muted)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = player.emoji === e ? 'var(--color-accent)' : 'transparent'}
            >{e}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stepper ───────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange, label = 'value' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="group">
      <button
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-2)', fontSize: 16, color: 'var(--color-ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .15s', touchAction: 'manipulation' }}
        onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = 'var(--color-muted)' }}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-line)'}
      >−</button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', width: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">{value}</span>
      <button
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-2)', fontSize: 16, color: 'var(--color-ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .15s', touchAction: 'manipulation' }}
        onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = 'var(--color-muted)' }}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-line)'}
      >+</button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Anonymous upgrade banner
  const isAnonymous = !user?.email && !user?.user_metadata?.provider
  const [showBanner, setShowBanner] = useState(false)
  useEffect(() => {
    if (!isAnonymous || !user?.id) return
    if (localStorage.getItem('kachuful-banner-dismissed')) return
    supabase.from('games').select('id', { count: 'exact', head: true })
      .eq('created_by', user.id).eq('status', 'complete')
      .then(({ count }) => { if (count >= 2) setShowBanner(true) })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissBanner() {
    localStorage.setItem('kachuful-banner-dismissed', '1')
    setShowBanner(false)
  }

  // Core state
  const [players, setPlayers]           = useState([makePlayer(0), makePlayer(1)])
  const [activeEditId, setActiveEditId] = useState(null)
  const [gameName, setGameName]         = useState('')
  const [gameSubtype, setGameSubtype]   = useState('kachufull')
  const [scoringVariant, setScoringVariant] = useState(1)
  const [noTrumpRound, setNoTrumpRound] = useState(false)
  const [numDecks, setNumDecks]         = useState(1)
  const [startCards, setStartCards]     = useState(1)
  const [peakCards, setPeakCards]       = useState(8)
  const [dealerSeat, setDealerSeat]     = useState(null) // index into players
  const [advOpen, setAdvOpen]           = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')

  const maxCards   = Math.floor((52 * numDecks) / Math.max(players.length, 2))
  const loopRounds = defaultLoopRounds(startCards, peakCards)

  // Clamp cards when constraints change
  useEffect(() => { if (peakCards > maxCards) setPeakCards(maxCards) }, [numDecks, players.length]) // eslint-disable-line
  useEffect(() => { if (startCards > peakCards) setStartCards(peakCards) }, [peakCards]) // eslint-disable-line

  // Close seat editor on outside click
  useEffect(() => {
    function handleClick() { setActiveEditId(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Player management
  function addPlayer() {
    if (players.length >= 11) return
    const newPlayer = makePlayer(players.length)
    setPlayers(prev => [...prev, newPlayer])
    setDealerSeat(null)
    setActiveEditId(newPlayer.id)
  }

  function removePlayer(id) {
    if (players.length <= 2) return
    setPlayers(prev => prev.filter(p => p.id !== id))
    setDealerSeat(null)
    if (activeEditId === id) setActiveEditId(null)
  }

  function updatePlayer(id, field, value) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function assignDealer() {
    const named = players.filter(p => p.displayName.trim())
    if (!named.length) return
    const picked = named[Math.floor(Math.random() * named.length)]
    setDealerSeat(players.indexOf(picked))
  }

  // Readiness
  const allNamed = players.every(p => p.displayName.trim().length > 0)
  const canStart = allNamed && players.length >= 2 && gameSubtype === 'kachufull' && dealerSeat !== null && !submitting

  const hints = []
  if (players.length < 2) hints.push('need 2+ players')
  else {
    const unnamed = players.filter(p => !p.displayName.trim()).length
    if (unnamed > 0) hints.push(`${unnamed} player${unnamed > 1 ? 's' : ''} need a name`)
  }
  if (gameSubtype !== 'kachufull') hints.push('select a game')
  if (dealerSeat === null) hints.push('assign a dealer')

  // Submit
  async function handleStart() {
    if (!canStart) return
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
          game_type: 'card',
          game_subtype: gameSubtype,
        })
        .select().single()
      if (gameErr) throw gameErr

      const { error: playersErr } = await supabase
        .from('game_players')
        .insert(players.map((p, i) => ({
          game_id: game.id,
          user_id: i === 0 ? user.id : null,
          display_name: p.displayName.trim(),
          color: p.color,
          seat_order: i,
        })))
      if (playersErr) throw playersErr

      navigate(`/game/${game.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const usedNames = players.map(p => p.displayName.trim().toLowerCase()).filter(Boolean)
  const dealer = dealerSeat !== null ? players[dealerSeat] : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative' }}>

      {/* Lattice background */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 19px), repeating-linear-gradient(-45deg, transparent, transparent 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 18px, color-mix(in oklab, var(--color-accent) 2%, transparent) 19px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <Link to="/history" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-muted)', textDecoration: 'none', marginRight: 14, transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink-2)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted)'}
          >← History</Link>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.03em', color: 'var(--color-ink)' }} translate="no">
            Uja<span style={{ color: 'var(--color-accent)' }}>gro</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginLeft: 8 }}>· Setup</span>
        </div>
        <AccountMenu />
      </header>

      {/* Upgrade banner */}
      {showBanner && (
        <div style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.7 }}>Guest</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>Your history lives only on this device.</span>
            <button onClick={() => navigate('/preferences')} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-bg)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Save your account →</button>
          </div>
          <button onClick={dismissBanner} aria-label="Dismiss" style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--color-bg)', cursor: 'pointer', opacity: 0.6, flexShrink: 0, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Page body */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '24px 20px 120px' }} onClick={() => setActiveEditId(null)}>

        {/* ── SEATS ── */}
        <div style={{ marginBottom: 28, position: 'relative', zIndex: 10 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
            Players at the table
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {players.map((player, idx) => (
              <div key={player.id} style={{ position: 'relative' }}>
                {/* Seat button */}
                <button
                  onClick={() => setActiveEditId(activeEditId === player.id ? null : player.id)}
                  aria-expanded={activeEditId === player.id}
                  aria-label={`Edit ${player.displayName || `Player ${idx + 1}`}`}
                  style={{ width: 86, height: 86, borderRadius: 16, background: 'var(--color-surface)', border: `1px solid ${activeEditId === player.id ? 'var(--color-accent)' : 'var(--color-line)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', boxShadow: activeEditId === player.id ? '0 0 0 3px color-mix(in oklab, var(--color-accent) 20%, transparent)' : 'none', transition: 'border-color .2s, box-shadow .2s', touchAction: 'manipulation' }}
                  onMouseEnter={e => { if (activeEditId !== player.id) e.currentTarget.style.borderColor = 'var(--color-muted)' }}
                  onMouseLeave={e => { if (activeEditId !== player.id) e.currentTarget.style.borderColor = 'var(--color-line)' }}
                >
                  <SeatAvatar player={player} size={36} />
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: player.displayName ? 'var(--color-ink-2)' : 'var(--color-muted)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: player.displayName ? 'normal' : 'italic' }}>
                    {player.displayName || 'Name…'}
                  </div>
                  {/* Dealer badge */}
                  {dealerSeat === idx && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: 'var(--color-accent)', borderRadius: 4, padding: '1px 5px', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '.06em', color: 'var(--color-bg)' }}>D</div>
                  )}
                </button>

                {/* Remove button */}
                {players.length > 2 && (
                  <button
                    onClick={e => { e.stopPropagation(); removePlayer(player.id) }}
                    aria-label={`Remove ${player.displayName || `Player ${idx + 1}`}`}
                    style={{ position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--color-muted)', cursor: 'pointer', lineHeight: 1, touchAction: 'manipulation' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-2)'; e.currentTarget.style.color = 'var(--color-accent-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-line)'; e.currentTarget.style.color = 'var(--color-muted)' }}
                  >×</button>
                )}

                {/* Editor popover */}
                {activeEditId === player.id && (
                  <SeatEditor
                    player={player}
                    usedNames={usedNames.filter(n => n !== player.displayName.toLowerCase())}
                    onNameChange={val => updatePlayer(player.id, 'displayName', val)}
                    onColorChange={val => updatePlayer(player.id, 'color', val)}
                    onEmojiChange={val => updatePlayer(player.id, 'emoji', val)}
                    onClose={() => setActiveEditId(null)}
                  />
                )}
              </div>
            ))}

            {/* Add seat */}
            {players.length < 11 && (
              <button
                onClick={e => { e.stopPropagation(); addPlayer() }}
                aria-label="Add player"
                style={{ width: 86, height: 86, borderRadius: 16, background: 'none', border: '1px dashed var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--color-muted)', cursor: 'pointer', transition: 'border-color .2s, color .2s', touchAction: 'manipulation' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-line)'; e.currentTarget.style.color = 'var(--color-muted)' }}
              >+</button>
            )}
          </div>
        </div>

        {/* ── CONFIG GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

          {/* LEFT: Game + Dealer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Game selection */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Game</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Card games */}
                {GAMES.filter(g => g.category === 'card').map(g => (
                  <button
                    key={g.subtype}
                    role="radio"
                    aria-checked={gameSubtype === g.subtype}
                    disabled={!g.available}
                    onClick={() => g.available && setGameSubtype(g.subtype)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: gameSubtype === g.subtype ? 'color-mix(in oklab, var(--color-accent) 8%, var(--color-surface))' : 'var(--color-bg-2)', border: `1px solid ${gameSubtype === g.subtype ? 'var(--color-accent)' : 'var(--color-line)'}`, borderRadius: 12, padding: '10px 13px', cursor: g.available ? 'pointer' : 'default', textAlign: 'left', opacity: g.available ? 1 : 0.45, transition: 'border-color .2s', touchAction: 'manipulation' }}
                    onMouseEnter={e => { if (g.available && gameSubtype !== g.subtype) e.currentTarget.style.borderColor = 'var(--color-muted)' }}
                    onMouseLeave={e => { if (gameSubtype !== g.subtype) e.currentTarget.style.borderColor = 'var(--color-line)' }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }} translate="no">{g.glyph}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: gameSubtype === g.subtype ? 'var(--color-accent)' : 'var(--color-ink)', flex: 1 }} translate="no">
                      {g.name}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 400, color: 'var(--color-muted)', marginLeft: 6, letterSpacing: '.04em' }}>{g.sub}</span>
                    </span>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${gameSubtype === g.subtype ? 'var(--color-accent)' : 'var(--color-line)'}`, background: gameSubtype === g.subtype ? 'var(--color-accent)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--color-bg)', flexShrink: 0, transition: 'all .15s' }}>
                      {gameSubtype === g.subtype ? '✓' : ''}
                    </span>
                  </button>
                ))}

                {/* Board games section */}
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--color-line)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>Board games</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {GAMES.filter(g => g.category === 'board').map(g => (
                      <div key={g.subtype} style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 8, padding: '5px 10px', opacity: 0.45, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 13 }}>{g.glyph}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-ink-2)' }}>{g.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-muted)', background: 'var(--color-surface)', borderRadius: 3, padding: '1px 4px' }}>Soon</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dealer */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>First dealer</div>
              {dealer ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '10px 13px' }}>
                  <SeatAvatar player={dealer} size={32} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--color-ink)', flex: 1 }}>{dealer.displayName} deals first</span>
                  <button onClick={assignDealer} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-accent)', cursor: 'pointer', touchAction: 'manipulation' }}>↻ Again</button>
                </div>
              ) : (
                <button
                  onClick={assignDealer}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '10px 13px', cursor: 'pointer', transition: 'border-color .2s', touchAction: 'manipulation' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-muted)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-line)'}
                >
                  <span style={{ fontSize: 18 }}>🎲</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--color-ink)', flex: 1, textAlign: 'left' }}>Assign randomly</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)' }}>→</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Game name + Advanced */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Game name */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 16, padding: '16px 18px' }}>
              <label htmlFor="game-name" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)', display: 'block', marginBottom: 12 }}>
                Game name <span style={{ color: 'var(--color-line)' }}>optional</span>
              </label>
              <input
                id="game-name"
                type="text"
                placeholder="e.g. Diwali Eve 2026…"
                autoComplete="off"
                name="game-name"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-line)', padding: '8px 0', fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-ink)', outline: 'none', caretColor: 'var(--color-accent)', transition: 'border-color .2s' }}
                onFocus={e => e.target.style.borderBottomColor = 'var(--color-accent)'}
                onBlur={e => e.target.style.borderBottomColor = 'var(--color-line)'}
              />
            </div>

            {/* Advanced settings */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 16, padding: '16px 18px' }}>
              <button
                onClick={() => setAdvOpen(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer', touchAction: 'manipulation' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Settings</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', transition: 'transform .2s', display: 'inline-block', transform: advOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>

              {advOpen && (
                <div style={{ marginTop: 12 }}>
                  {/* Scoring */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid color-mix(in oklab, var(--color-line) 50%, transparent)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink-2)' }}>Scoring</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>{SCORING_FORMULAS[scoringVariant]}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3].map(n => (
                        <button key={n} aria-pressed={scoringVariant === n} onClick={() => setScoringVariant(n)}
                          style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: scoringVariant === n ? 'var(--color-accent)' : 'var(--color-bg-2)', fontFamily: 'var(--font-mono)', fontSize: 12, color: scoringVariant === n ? 'var(--color-bg)' : 'var(--color-ink-2)', cursor: 'pointer', fontWeight: scoringVariant === n ? 700 : 400, transition: 'all .15s', touchAction: 'manipulation' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* No-trump */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid color-mix(in oklab, var(--color-line) 50%, transparent)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink-2)' }}>No-trump round</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>Adds ⚬ NT to trump rotation</div>
                    </div>
                    <button
                      role="switch"
                      aria-checked={noTrumpRound}
                      aria-label="No-trump round"
                      onClick={() => setNoTrumpRound(v => !v)}
                      style={{ position: 'relative', width: 40, height: 22, borderRadius: 999, background: noTrumpRound ? 'var(--color-accent)' : 'var(--color-bg)', border: `1px solid ${noTrumpRound ? 'var(--color-accent)' : 'var(--color-line)'}`, cursor: 'pointer', transition: 'background .2s, border-color .2s', flexShrink: 0, touchAction: 'manipulation' }}
                    >
                      <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: noTrumpRound ? '#fff' : 'var(--color-muted)', transition: 'transform .2s, background .2s', transform: noTrumpRound ? 'translateX(18px)' : 'none' }} />
                    </button>
                  </div>

                  {/* Decks */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid color-mix(in oklab, var(--color-line) 50%, transparent)' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink-2)' }}>Decks</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2].map(n => (
                        <button key={n} aria-pressed={numDecks === n} aria-label={`${n} deck${n>1?'s':''}`} onClick={() => setNumDecks(n)}
                          style={{ width: 34, height: 28, borderRadius: 8, border: '1px solid var(--color-line)', background: numDecks === n ? 'var(--color-accent)' : 'var(--color-bg-2)', fontFamily: 'var(--font-mono)', fontSize: 12, color: numDecks === n ? 'var(--color-bg)' : 'var(--color-ink-2)', cursor: 'pointer', fontWeight: numDecks === n ? 700 : 400, transition: 'all .15s', touchAction: 'manipulation' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start cards */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid color-mix(in oklab, var(--color-line) 50%, transparent)' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink-2)' }}>Start cards</div>
                    <Stepper value={startCards} min={1} max={peakCards} onChange={setStartCards} label="start cards" />
                  </div>

                  {/* Peak cards */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid color-mix(in oklab, var(--color-line) 50%, transparent)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-ink-2)' }}>Peak cards</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>Max {maxCards} · {numDecks} deck{numDecks>1?'s':''}, {players.length} players</div>
                    </div>
                    <Stepper value={peakCards} min={Math.max(startCards,1)} max={maxCards} onChange={setPeakCards} label="peak cards" />
                  </div>

                  {/* Loop preview */}
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 10 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4 }}>First loop</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink-2)' }}>
                      {startCards} → {peakCards} → 1 <span style={{ color: 'var(--color-muted)' }}>· {loopRounds} rounds</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <p role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-accent-2)', textAlign: 'center', marginTop: 16 }}>{error}</p>}
      </div>

      {/* Sticky bottom bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, background: 'color-mix(in oklab, var(--color-bg) 92%, transparent)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-line)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: hints.length ? 'var(--color-muted)' : 'var(--color-accent-3)' }}>
          {hints.length ? hints.join(' · ') : `${players.length} players · ready ✓`}
        </div>
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={{ background: 'var(--color-accent)', border: 'none', borderRadius: 14, padding: '14px 28px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-bg)', cursor: canStart ? 'pointer' : 'default', letterSpacing: '-0.01em', opacity: canStart ? 1 : 0.3, transition: 'opacity .2s', touchAction: 'manipulation', flexShrink: 0 }}
          onMouseEnter={e => { if (canStart) e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { if (canStart) e.currentTarget.style.opacity = '1' }}
        >
          {submitting ? 'Starting…' : 'Start Game →'}
        </button>
      </div>
    </div>
  )
}
