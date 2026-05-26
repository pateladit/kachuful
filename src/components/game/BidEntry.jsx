import { useState, useEffect, useRef } from 'react'
import Avatar from './Avatar'
import GameTimer from './GameTimer'
import SummaryModal from './SummaryModal'
import AccountMenu from '../AccountMenu'
import { TRUMPS, computeTotals, computeRanks, scoreFor } from '../../lib/gameLogic'

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
  red:     'var(--color-red-suit, #e57860)',
}

function formatRank(rk) {
  if (!rk) return '—'
  const n = rk.rank
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

function rankBg(rank, n) {
  if (n <= 1 || !rank) return 'transparent'
  const t = (rank - 1) / (n - 1)
  const base = `color-mix(in oklab, #ef4444 ${Math.round(t * 100)}%, #22c55e)`
  return `color-mix(in oklab, ${base} 40%, transparent)`
}

const SCORING_LABELS = {
  1: 'Made: 10 + tricks won · Missed: 0',
  2: 'Made: 10×bid + 1 · Missed: 0',
  3: 'Made: 10×bid + 1 · Nil made = 10 · Missed: 0',
}

// ── BidEntry ──────────────────────────────────────────────────────────
export default function BidEntry({ game, players, completedRounds, pendingRound, roundNumber, trump, defaultCards, dealerIdx, lockBids, endGame }) {
  const [bids, setBidsState] = useState({})
  const [active, setActive] = useState(null)
  const [cards, setCards] = useState(defaultCards)
  const [expanded, setExpanded] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const advanceBidTimerRef = useRef(null)

  // Bid order: (dealerIdx+1)%n, ..., dealerIdx
  const n = players.length
  const bidOrder = Array.from({ length: n }, (_, i) => (dealerIdx + 1 + i) % n)

  // Reset when round changes
  useEffect(() => {
    setBidsState({})
    setCards(defaultCards)
    setActive(bidOrder[0] ?? 0)
    setSubmitError('')
    if (advanceBidTimerRef.current) {
      clearTimeout(advanceBidTimerRef.current)
      advanceBidTimerRef.current = null
    }
  }, [roundNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync defaultCards when it changes (e.g. from hook)
  useEffect(() => {
    setCards(defaultCards)
  }, [defaultCards])

  // Clear bids that exceed the (possibly adjusted) card count
  useEffect(() => {
    setBidsState(prev => {
      const next = {}
      for (const [k, v] of Object.entries(prev)) {
        if (v <= cards) next[k] = v
      }
      return next
    })
  }, [cards])

  const sumOfBids = players.reduce((acc, p) => acc + (bids[p.id] ?? 0), 0)
  const numBidsIn = players.filter(p => bids[p.id] !== undefined).length
  const allBidsIn = numBidsIn === n

  // Dealer constraint: all non-dealers must have bid before we compute forbidden
  const nonDealerOrder = bidOrder.slice(0, -1)
  const allNonDealerBid = nonDealerOrder.length > 0 && nonDealerOrder.every(i => bids[players[i]?.id] !== undefined)
  const nonDealerSum = nonDealerOrder.reduce((acc, i) => acc + (bids[players[i]?.id] ?? 0), 0)
  const dealerForbidden = allNonDealerBid ? (cards - nonDealerSum) : null
  const dealerForbiddenInRange = dealerForbidden !== null && dealerForbidden >= 0 && dealerForbidden <= cards

  // Sum status
  let sumStatus = 'under'
  let sumLabel = ''
  if (!allBidsIn) {
    sumLabel = `${n - numBidsIn} left to bid`
  } else if (sumOfBids === cards) {
    sumStatus = 'balanced'
    sumLabel = 'INVALID'
  } else if (sumOfBids > cards) {
    sumStatus = 'over'
    sumLabel = `+${sumOfBids - cards} over`
  } else {
    sumStatus = 'complete'
    sumLabel = `${cards - sumOfBids} short · ready`
  }

  const lockReady = allBidsIn && sumOfBids !== cards && !submitting

  function handleChipClick(playerIdx) {
    if (advanceBidTimerRef.current) {
      clearTimeout(advanceBidTimerRef.current)
      advanceBidTimerRef.current = null
    }
    setActive(playerIdx)
  }

  function setBid(playerIdx, value) {
    const p = players[playerIdx]
    if (!p) return
    const newBids = { ...bids, [p.id]: value }
    setBidsState(newBids)

    // Cancel any pending auto-advance
    if (advanceBidTimerRef.current) {
      clearTimeout(advanceBidTimerRef.current)
      advanceBidTimerRef.current = null
    }

    // Find next pending player in bid order
    const bidOrderPos = bidOrder.indexOf(playerIdx)
    let next = null
    for (let i = 1; i <= n; i++) {
      const nextPos = (bidOrderPos + i) % n
      const nextIdx = bidOrder[nextPos]
      if (newBids[players[nextIdx]?.id] === undefined) {
        next = nextIdx
        break
      }
    }

    advanceBidTimerRef.current = setTimeout(() => {
      setActive(next)
      advanceBidTimerRef.current = null
    }, 350)
  }

  async function handleLock() {
    if (!lockReady) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await lockBids(bids, cards)
    } catch (err) {
      setSubmitError(err.message ?? 'Failed to lock bids')
      setSubmitting(false)
    }
  }

  async function handleEndGame() {
    setSummaryOpen(false)
    try {
      await endGame()
    } catch (err) {
      setSubmitError(err.message ?? 'Failed to end game')
    }
  }

  // Leaderboard totals for top bar chips
  const variant = game.scoring_variant
  const totals = computeTotals(players, completedRounds, variant)
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])
  const leaderId = sorted[0]?.id
  const ranks = computeRanks(players, totals)

  // Running tab data: last 5 completed + current round (being bid)
  const tabRounds = expanded ? completedRounds : completedRounds.slice(-5)

  const sumBarPct = Math.min(100, cards > 0 ? (sumOfBids / cards) * 100 : 0)
  const sumBarColor = sumStatus === 'over' ? V.accent2 : sumStatus === 'balanced' ? '#e57860' : sumStatus === 'complete' ? V.accent3 : V.accent

  // Active player data for spotlight
  const activePlayer = active !== null ? players[active] : null
  const activeBid = activePlayer ? bids[activePlayer.id] : undefined
  const activeForbidden = active === dealerIdx && dealerForbiddenInRange ? dealerForbidden : null

  return (
    <>
      <div
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '24px 32px 32px',
          minHeight: '100vh',
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr auto auto',
          gap: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ─── Top bar ─── */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
              Ka<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Chu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Fu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />L
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
              {game.name ? `${game.name} · ` : ''}Round {roundNumber}
            </div>
          </div>

          {/* Timer + summary button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GameTimer startedAt={game.started_at} />
            <button
              onClick={() => setSummaryOpen(true)}
              style={{
                background: V.surface,
                border: `1px solid ${V.line}`,
                color: V.ink,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                padding: '8px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 12 }}>◍</span>
              Game Summary
            </button>
          </div>

          {/* Mini leaderboard + account menu */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {sorted.slice(0, 3).map((p, i) => (
              <div
                key={p.id}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: V.ink2,
                  letterSpacing: '.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: i === 0 ? `color-mix(in oklab, ${V.accent} 16%, ${V.bg2})` : V.bg2,
                  border: `1px solid ${i === 0 ? `color-mix(in oklab, ${V.accent} 60%, transparent)` : V.line}`,
                  padding: '5px 10px',
                  borderRadius: 999,
                }}
              >
                {i === 0 && <span style={{ color: V.accent }}>★</span>}
                <Avatar player={p} size={18} />
                {p.displayName}
                <b style={{ color: i === 0 ? V.accent : V.ink, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{totals[p.id]}</b>
              </div>
            ))}
            <AccountMenu />
          </div>
        </header>

        {/* ─── Hero ─── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 14, alignItems: 'stretch' }}>
          {/* Trump card */}
          <div
            style={{
              background: trump?.nt
                ? V.bg2
                : 'linear-gradient(140deg, color-mix(in oklab, #e89a3c 86%, #d24a3d), #e89a3c)',
              border: trump?.nt ? `1px dashed ${V.accent}` : 'none',
              borderRadius: 20,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 20,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: 80, lineHeight: 1, color: trump?.nt ? V.accent : '#2a1620' }}>
              {trump?.glyph ?? '?'}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: trump?.nt ? V.muted : '#2a162080', opacity: trump?.nt ? 1 : 0.7 }}>
                {trump?.nt ? `No Trump · Round ${roundNumber}` : `Trump suit · Round ${roundNumber}`}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 48, letterSpacing: '-0.02em', lineHeight: 1, color: trump?.nt ? V.accent : '#2a1620', marginTop: 4 }}>
                {trump?.name ?? '—'}
              </div>
            </div>
          </div>

          {/* Cards count */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Cards in hand</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: V.ink, marginTop: 6, fontFeatureSettings: '"tnum"', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {cards}
              <small style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, fontWeight: 500, letterSpacing: '.1em' }}>
                {cards === 1 ? 'CARD' : 'CARDS'} EACH
              </small>
            </div>
            {/* Skip / adjust stepper */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button
                onClick={() => setCards(c => Math.max(1, c - 1))}
                disabled={cards <= 1}
                style={{ background: V.bg2, border: `1px solid ${V.line}`, color: V.ink2, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'grid', placeItems: 'center', opacity: cards <= 1 ? 0.3 : 1 }}
              >−</button>
              <button
                onClick={() => setCards(c => c + 1)}
                style={{ background: V.bg2, border: `1px solid ${V.line}`, color: V.ink2, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'grid', placeItems: 'center' }}
              >+</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.1em', textTransform: 'uppercase', alignSelf: 'center', marginLeft: 4 }}>SKIP / ADJUST</span>
            </div>
          </div>

          {/* Bid sum */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Bid sum vs cards</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, fontFeatureSettings: '"tnum"', color: V.ink }}>{sumOfBids}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: V.muted, fontWeight: 600 }}>
                / <b style={{ color: V.ink }}>{cards}</b>
              </span>
            </div>
            <div style={{ height: 8, background: V.bg2, borderRadius: 999, marginTop: 12, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${sumBarPct}%`, background: sumBarColor, borderRadius: 999, transition: 'width .25s ease, background .25s ease' }} />
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                marginTop: 10,
                padding: '6px 12px',
                borderRadius: 999,
                background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 22%, transparent)` : sumStatus === 'balanced' ? `color-mix(in oklab, ${V.red} 22%, transparent)` : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 22%, transparent)` : V.bg2,
                color: sumStatus === 'over' ? V.accent2 : sumStatus === 'balanced' ? '#e57860' : sumStatus === 'complete' ? V.accent3 : V.ink2,
                border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 50%, transparent)` : sumStatus === 'balanced' ? 'color-mix(in oklab, #e57860 50%, transparent)' : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : V.line}`,
              }}
            >
              {sumStatus === 'balanced' && <span>●</span>}
              {sumStatus === 'over' && <span>▲</span>}
              {sumStatus === 'under' && <span>○</span>}
              {sumStatus === 'complete' && <span>✓</span>}
              {allBidsIn ? (sumStatus === 'over' ? `OVER · ${sumOfBids - cards} MORE THAN CARDS` : sumStatus === 'balanced' ? 'INVALID · SUM EQUALS CARDS' : `READY · ${cards - sumOfBids} SHORT`) : `${n - numBidsIn} LEFT TO BID`}
            </div>
          </div>
        </section>

        {/* ─── Spotlight entry ─── */}
        <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Chips strip */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
              {bidOrder.map((playerIdx) => {
                const p = players[playerIdx]
                const bid = bids[p.id]
                const isActive = active === playerIdx
                const isDone = bid !== undefined
                const isDealer = playerIdx === dealerIdx
                return (
                  <button
                    key={p.id}
                    onClick={() => handleChipClick(playerIdx)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '6px 12px', borderRadius: 999, flexShrink: 0,
                      background: isActive
                        ? `color-mix(in oklab, ${V.accent} 18%, ${V.bg2})`
                        : isDone
                          ? `color-mix(in oklab, ${p.color} 14%, ${V.bg2})`
                          : 'transparent',
                      border: `1.5px solid ${isActive ? V.accent : isDone ? `color-mix(in oklab, ${p.color} 55%, transparent)` : V.line}`,
                      cursor: 'pointer',
                      opacity: !isActive && !isDone ? 0.4 : 1,
                      transition: 'all .15s ease',
                    }}
                  >
                    <Avatar player={p} size={22} isDealer={isDealer} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: isActive || isDone ? V.ink : V.muted, whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </span>
                    {isDone ? (
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: bid === 0 ? V.accent3 : V.ink, letterSpacing: '-0.02em' }}>
                        {bid}
                      </span>
                    ) : isActive ? (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: V.accent, display: 'inline-block', flexShrink: 0 }} />
                    ) : null}
                  </button>
                )
              })}
            </div>

            {/* Sum pill */}
            <div style={{ flexShrink: 0, marginLeft: 4 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em',
                padding: '5px 11px', borderRadius: 999,
                background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 20%, transparent)` : sumStatus === 'balanced' ? `color-mix(in oklab, ${V.red} 20%, transparent)` : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 20%, transparent)` : V.bg2,
                color: sumStatus === 'over' ? V.accent2 : sumStatus === 'balanced' ? '#e57860' : sumStatus === 'complete' ? V.accent3 : V.ink2,
                border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 45%, transparent)` : sumStatus === 'balanced' ? 'color-mix(in oklab, #e57860 45%, transparent)' : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 45%, transparent)` : V.line}`,
              }}>
                <b style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '-0.01em' }}>{sumOfBids}</b>
                <span style={{ opacity: 0.6 }}>/{cards}</span>
                <span style={{ opacity: 0.5, fontSize: 9 }}>·</span>
                <span style={{ fontSize: 10 }}>{sumLabel}</span>
              </div>
            </div>
          </div>

          {/* Spotlight card */}
          {activePlayer ? (
            <div style={{
              padding: '28px 32px 22px',
              background: `color-mix(in oklab, ${activePlayer.color} 6%, transparent)`,
              flex: 1,
            }}>
              {/* Player header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
                <Avatar player={activePlayer} size={72} isDealer={active === dealerIdx} glow />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: V.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {activePlayer.displayName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {active === dealerIdx && (
                      <span style={{ background: `color-mix(in oklab, ${V.accent} 22%, transparent)`, color: V.accent, padding: '2px 8px', borderRadius: 999, fontWeight: 700, fontSize: 9, letterSpacing: '.16em' }}>DEALER · BIDS LAST</span>
                    )}
                    <span>{active === dealerIdx ? 'Bids last this round' : 'On the call'}</span>
                    {activeForbidden !== null && (
                      <span style={{ color: V.accent2 }}>· Can&apos;t bid <b style={{ color: V.accent2 }}>{activeForbidden}</b></span>
                    )}
                  </div>
                </div>
                {activeBid !== undefined && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, color: activeBid === 0 ? V.accent3 : V.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {activeBid}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>
                      {activeBid === 0 ? 'NIL CALL' : `${activeBid} TRICK${activeBid > 1 ? 'S' : ''}`}
                    </div>
                  </div>
                )}
              </div>

              {/* Number buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Array.from({ length: cards + 1 }, (_, num) => {
                  const isForbidden = activeForbidden === num
                  const isSelected = activeBid === num
                  return (
                    <button
                      key={num}
                      disabled={isForbidden && !isSelected}
                      onClick={() => { if (!isForbidden) setBid(active, num) }}
                      title={isForbidden ? "Can't bid this — would make sum equal cards" : ''}
                      style={{
                        flex: '1 0 auto',
                        minWidth: 56,
                        height: 64,
                        borderRadius: 12,
                        background: isSelected ? V.accent : isForbidden ? `color-mix(in oklab, ${V.accent2} 12%, transparent)` : V.bg2,
                        border: `1.5px solid ${isSelected ? V.accent : isForbidden ? `color-mix(in oklab, ${V.accent2} 50%, ${V.line})` : V.line}`,
                        color: isSelected ? '#2a1620' : isForbidden ? V.accent2 : V.ink2,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 22,
                        cursor: isForbidden ? 'not-allowed' : 'pointer',
                        textDecoration: isForbidden ? 'line-through' : 'none',
                        fontFeatureSettings: '"tnum"',
                        transition: 'background .12s ease',
                      }}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.08em', textAlign: 'center' }}>
                Advances automatically · tap any chip to go back and edit
              </div>
            </div>
          ) : (
            <div style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.accent3 }}>All bids in!</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>Review bids above · lock to start the round.</div>
            </div>
          )}
        </section>

        {/* ─── Running tab ─── */}
        <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: V.ink }}>
              The running tab
              <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
                last {expanded ? completedRounds.length : Math.min(5, completedRounds.length)} of {completedRounds.length + 1} rounds · bid/took · points
              </small>
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
              Made <span style={{ color: V.accent3 }}>●</span> · Missed <span style={{ color: V.accent2 }}>●</span>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${V.line}`, background: V.bg2, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: 16, padding: '10px 6px', background: V.surface, color: V.muted, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', width: 72, borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}` }}>Round</th>
                  {players.map((p, i) => (
                    <th key={p.id} style={{ padding: '10px 6px', background: V.surface, textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: i < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                      <Avatar player={p} size={28} />
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: i === dealerIdx ? V.accent : V.ink, display: 'block', marginTop: 3, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabRounds.map(r => {
                  const tr = TRUMPS.find(t => t.id === r.trump)
                  return (
                    <tr key={r.id}>
                      <td style={{ textAlign: 'left', paddingLeft: 16, padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink, fontFeatureSettings: '"tnum"' }}>
                        R{r.roundNumber}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginLeft: 4 }}>
                          <span style={{ color: tr?.red ? '#e57860' : undefined }}>{tr?.glyph}</span> {r.cards}
                        </span>
                      </td>
                      {players.map((p, pi) => {
                        const b = r.bids[p.id]
                        const k = r.took?.[p.id]
                        const made = b !== undefined && k !== undefined && b === k
                        const pts = (b !== undefined && k !== undefined) ? scoreFor(b, k, variant) : null
                        return (
                          <td
                            key={p.id}
                            style={{
                              padding: '8px 6px',
                              textAlign: 'center',
                              borderBottom: `1px solid ${V.line}`,
                              borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none',
                              background: pts === null ? 'transparent' : made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)`,
                            }}
                          >
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: pts === null ? V.muted : made ? V.accent3 : V.accent2 }}>
                                {pts === null ? '—' : made ? `+${pts}` : '0'}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.ink2, opacity: .75, marginTop: 2 }}>
                                {b !== undefined ? b : '—'}/{k !== undefined ? k : '—'}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* Current round row (bids in progress) */}
                <tr>
                  <td style={{ textAlign: 'left', paddingLeft: 16, padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.accent }}>
                    R{roundNumber}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.accent, opacity: .8, marginLeft: 4 }}>
                      {trump?.glyph} {cards}
                    </span>
                  </td>
                  {players.map((p, pi) => {
                    const b = bids[p.id]
                    return (
                      <td
                        key={p.id}
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          borderBottom: `1px solid ${V.line}`,
                          borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none',
                          background: `color-mix(in oklab, ${V.accent} 8%, transparent)`,
                        }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: V.muted }}>—</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .7, marginTop: 2 }}>
                            {b !== undefined ? b : '—'}<span style={{ color: V.muted }}>/{}</span>—
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* Totals row */}
                <tr>
                  <td style={{ padding: '10px 6px', paddingLeft: 16, background: V.surface, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}>TOTAL</td>
                  {players.map((p, pi) => (
                    <td key={p.id} style={{ padding: '10px 6px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: p.id === leaderId ? V.accent : V.ink, letterSpacing: '-0.01em', borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                      {totals[p.id]}
                    </td>
                  ))}
                </tr>
                {/* Rank row */}
                <tr>
                  <td style={{ padding: '8px 6px', paddingLeft: 16, background: V.bg2, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}>RANK</td>
                  {players.map((p, pi) => (
                    <td key={p.id} style={{ padding: '8px 6px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: p.id === leaderId ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                      {formatRank(ranks[p.id])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {completedRounds.length > 5 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12, borderTop: `1px solid ${V.line}`, background: V.bg2 }}>
              <button
                onClick={() => setExpanded(e => !e)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${V.line}`,
                  color: V.ink2,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  padding: '8px 16px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {expanded ? 'Collapse' : `See all ${completedRounds.length} rounds`}
                <span style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}>↓</span>
              </button>
            </div>
          )}
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${V.line}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10 }}>
            Scoring ·{' '}
            <span style={{ background: V.bg2, border: `1px solid ${V.line}`, color: V.ink, padding: '6px 12px', borderRadius: 999, fontWeight: 600, letterSpacing: '.04em', textTransform: 'none', fontFamily: 'var(--font-mono)' }}>
              {SCORING_LABELS[variant]}
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.06em', textAlign: 'center', lineHeight: 1.55 }}>
            {submitError ? (
              <span style={{ color: V.accent2 }}>{submitError}</span>
            ) : allBidsIn && sumOfBids === cards ? (
              <span style={{ color: V.accent2 }}>Dealer&apos;s bid would make total = cards. <b style={{ color: V.ink }}>Change the dealer&apos;s call.</b></span>
            ) : !allBidsIn ? (
              <>Tap each player&apos;s call. <b style={{ color: V.ink }}>Dealer&apos;s forbidden bid auto-locks</b> when others are in.</>
            ) : (
              <>All bids in. <b style={{ color: V.ink }}>Lock to start the round.</b></>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={handleLock}
              disabled={!lockReady}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                borderRadius: 12,
                padding: '14px 24px',
                cursor: lockReady ? 'pointer' : 'not-allowed',
                border: `1px solid ${V.accent}`,
                background: V.accent,
                color: '#2a1620',
                opacity: lockReady ? 1 : 0.3,
                transition: 'opacity .15s ease',
              }}
            >
              {submitting ? 'Locking…' : 'Lock & Play →'}
            </button>
          </div>
        </footer>
      </div>

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
    </>
  )
}
