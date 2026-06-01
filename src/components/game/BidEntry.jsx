import { useState, useEffect, useRef, useMemo } from 'react'
import Avatar from './Avatar'
import GameTimer from './GameTimer'
import SummaryModal from './SummaryModal'
import StatsModal from './StatsModal'
import AccountMenu from '../AccountMenu'
import { TRUMPS, trumpById, computeTotals, computeRanks, scoreFor } from '../../lib/gameLogic'
import { trumpTint } from '../../lib/gameColors'

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

// Diamond lattice — same 2% texture used on login + history pages
const LATTICE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M18 0 L36 18 L18 36 L0 18 Z' fill='none' stroke='white' stroke-width='0.6'/%3E%3C/svg%3E")`

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

export default function BidEntry({
  game, players, completedRounds, pendingRound,
  roundNumber, trump, defaultCards, dealerIdx,
  lockBids, endGame,
}) {
  const [bids, setBidsState]         = useState({})
  const [active, setActive]          = useState(null)
  const [cards, setCards]            = useState(defaultCards)
  const [expanded, setExpanded]      = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [statsOpen, setStatsOpen]    = useState(false)
  const [submitting, setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [pressedBtn, setPressedBtn]  = useState(null)
  const [shakingBtn, setShakingBtn]  = useState(null)
  const advanceBidTimerRef  = useRef(null)
  const shakeBtnTimerRef    = useRef(null)
  const pressedBtnTimerRef  = useRef(null)

  const n        = players.length
  const bidOrder = useMemo(
    () => Array.from({ length: n }, (_, i) => (dealerIdx + 1 + i) % n),
    [n, dealerIdx]
  )

  useEffect(() => {
    setBidsState({})
    setCards(defaultCards)
    setActive((dealerIdx + 1) % n)
    setSubmitError('')
    if (advanceBidTimerRef.current) {
      clearTimeout(advanceBidTimerRef.current)
      advanceBidTimerRef.current = null
    }
  }, [roundNumber, dealerIdx, n, defaultCards])

  useEffect(() => () => {
    if (shakeBtnTimerRef.current)   clearTimeout(shakeBtnTimerRef.current)
    if (pressedBtnTimerRef.current) clearTimeout(pressedBtnTimerRef.current)
  }, [])

  useEffect(() => { setCards(defaultCards) }, [defaultCards])

  useEffect(() => {
    setBidsState(prev => {
      const next = {}
      for (const [k, v] of Object.entries(prev)) {
        if (v <= cards) next[k] = v
      }
      return next
    })
  }, [cards])

  const sumOfBids   = players.reduce((acc, p) => acc + (bids[p.id] ?? 0), 0)
  const numBidsIn   = players.filter(p => bids[p.id] !== undefined).length
  const allBidsIn   = numBidsIn === n

  const nonDealerOrder   = bidOrder.slice(0, -1)
  const allNonDealerBid  = nonDealerOrder.length > 0 && nonDealerOrder.every(i => bids[players[i]?.id] !== undefined)
  const nonDealerSum     = nonDealerOrder.reduce((acc, i) => acc + (bids[players[i]?.id] ?? 0), 0)
  const dealerForbidden  = allNonDealerBid ? (cards - nonDealerSum) : null
  const dealerForbiddenInRange = dealerForbidden !== null && dealerForbidden >= 0 && dealerForbidden <= cards

  let sumStatus = 'under'
  let sumLabel  = ''
  if (!allBidsIn) {
    sumLabel = `${n - numBidsIn} left`
  } else if (sumOfBids === cards) {
    sumStatus = 'balanced'
    sumLabel  = 'invalid'
  } else if (sumOfBids > cards) {
    sumStatus = 'over'
    sumLabel  = `+${sumOfBids - cards} over`
  } else {
    sumStatus = 'complete'
    sumLabel  = `${cards - sumOfBids} short · ready`
  }

  const sumBarPct   = Math.min(100, cards > 0 ? (sumOfBids / cards) * 100 : 0)
  const sumBarColor = sumStatus === 'over' ? V.accent2 : sumStatus === 'balanced' ? '#e57860' : sumStatus === 'complete' ? V.accent3 : V.accent
  const lockReady   = allBidsIn && sumOfBids !== cards && !submitting

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
    setBidsState(prev => ({ ...prev, [p.id]: value }))

    if (advanceBidTimerRef.current) {
      clearTimeout(advanceBidTimerRef.current)
      advanceBidTimerRef.current = null
    }

    const bidOrderPos = bidOrder.indexOf(playerIdx)
    let next = null
    for (let i = 1; i <= n; i++) {
      const nextPos = (bidOrderPos + i) % n
      const nextIdx = bidOrder[nextPos]
      if (newBids[players[nextIdx]?.id] === undefined) { next = nextIdx; break }
    }

    advanceBidTimerRef.current = setTimeout(() => {
      setActive(next)
      advanceBidTimerRef.current = null
    }, 350)
  }

  function handleBidPress(playerIdx, num) {
    if (pressedBtnTimerRef.current) clearTimeout(pressedBtnTimerRef.current)
    setPressedBtn(`${playerIdx}-${num}`)
    pressedBtnTimerRef.current = setTimeout(() => {
      setPressedBtn(null)
      pressedBtnTimerRef.current = null
    }, 220)
    setBid(playerIdx, num)
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
    setStatsOpen(false)
    try { await endGame() } catch (err) {
      setSubmitError(err.message ?? 'Failed to end game')
    }
  }

  const variant  = game.scoring_variant
  const totals   = useMemo(() => computeTotals(players, completedRounds, variant), [players, completedRounds, variant])
  const sorted    = useMemo(() => [...players].sort((a, b) => totals[b.id] - totals[a.id]), [players, totals])
  const leaderIds = useMemo(() => {
    if (!players.length) return new Set()
    const maxScore = Math.max(...players.map(p => totals[p.id]))
    return new Set(players.filter(p => totals[p.id] === maxScore).map(p => p.id))
  }, [players, totals])
  const ranks    = useMemo(() => computeRanks(players, totals), [players, totals])
  const tabRounds = useMemo(
    () => expanded ? completedRounds : completedRounds.slice(-5),
    [completedRounds, expanded]
  )

  const activePlayer    = active !== null ? players[active] : null
  const activeBid       = activePlayer ? bids[activePlayer.id] : undefined
  const activeForbidden = active === dealerIdx && dealerForbiddenInRange ? dealerForbidden : null
  const tint = trumpTint(trump)

  // Selected bid button uses the active player's personal color
  const selectedBidColor = activePlayer?.color ?? V.accent

  let footerHint
  if (submitError) {
    footerHint = <span style={{ color: V.accent2 }}>{submitError}</span>
  } else if (allBidsIn && sumOfBids === cards) {
    footerHint = <span style={{ color: V.accent2 }}>Dealer&apos;s bid makes total = cards. <b style={{ color: V.ink }}>Change the dealer&apos;s call.</b></span>
  } else if (!allBidsIn) {
    footerHint = (
      <>
        {n - numBidsIn} player{n - numBidsIn > 1 ? 's' : ''} left to bid
        {activeForbidden !== null ? (
          <> · dealer can&apos;t bid <b style={{ color: V.accent2 }}>{activeForbidden}</b></>
        ) : null}
      </>
    )
  } else {
    footerHint = <>All bids in · <b style={{ color: V.ink }}>ready to lock.</b></>
  }

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
          gridTemplateRows: 'auto auto auto auto',
          gap: 20,
        }}>

          {/* ─── Header ─── */}
          <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>

            <div>
              <div translate="no" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
                Ka
                <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
                Chu
                <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
                Fu
                <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
                L
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
                {game.name ? `${game.name} · ` : ''}Round {roundNumber} · bidding
              </div>
            </div>

            {/* Icon-only action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GameTimer startedAt={game.started_at} />
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
            </div>

            {/* Mini leaderboard */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {sorted.slice(0, 3).map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: i === 0 ? `color-mix(in oklab, ${V.accent} 16%, ${V.bg2})` : V.bg2,
                    border: `1px solid ${i === 0 ? `color-mix(in oklab, ${V.accent} 60%, transparent)` : V.line}`,
                    borderLeft: i === 0 ? `3px solid ${p.color}` : undefined,
                    padding: '5px 10px',
                    borderRadius: 999,
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2,
                  }}
                >
                  <Avatar player={p} size={18} />
                  <span>{p.displayName}</span>
                  <b style={{ color: i === 0 ? V.accent : V.ink, fontFamily: 'var(--font-mono)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{totals[p.id]}</b>
                </div>
              ))}
              <AccountMenu />
            </div>
          </header>

          {/* ─── Hero: 3 info cards ─── */}
          <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 14 }} aria-label="Round information">

            {/* Trump — full character treatment, watermark glyph */}
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
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, fontWeight: 500, letterSpacing: '.1em' }}>
                  {cards === 1 ? 'CARD' : 'CARDS'} EACH
                </small>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
                <button
                  className="game-icon-btn"
                  onClick={() => setCards(c => Math.max(1, c - 1))}
                  disabled={cards <= 1}
                  aria-label="Decrease card count"
                  style={{ background: V.bg2, border: `1px solid ${V.line}`, color: V.ink2, borderRadius: 8, width: 28, height: 28, cursor: cards <= 1 ? 'default' : 'pointer', fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'grid', placeItems: 'center', opacity: cards <= 1 ? 0.3 : 1, touchAction: 'manipulation' }}
                >−</button>
                <button
                  className="game-icon-btn"
                  onClick={() => setCards(c => c + 1)}
                  aria-label="Increase card count"
                  style={{ background: V.bg2, border: `1px solid ${V.line}`, color: V.ink2, borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'grid', placeItems: 'center', touchAction: 'manipulation' }}
                >+</button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginLeft: 2 }}>ADJUST</span>
              </div>
            </div>

            {/* Bid sum — progress bar leads */}
            <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Bid sum vs cards</div>
              <div style={{ height: 10, background: V.bg2, borderRadius: 999, marginTop: 10, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${sumBarPct}%`, background: sumBarColor, borderRadius: 999, transition: 'width .25s ease, background .25s ease' }} aria-hidden />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 48, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: V.ink }}>{sumOfBids}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: V.muted, fontWeight: 600 }}>
                  / <b style={{ color: V.ink }}>{cards}</b>
                </span>
              </div>
              <div
                aria-live="polite"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                  marginTop: 8, padding: '5px 10px', borderRadius: 999,
                  background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 22%, transparent)` : sumStatus === 'balanced' ? `color-mix(in oklab, #e57860 22%, transparent)` : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 22%, transparent)` : V.bg2,
                  color: sumStatus === 'over' ? V.accent2 : sumStatus === 'balanced' ? '#e57860' : sumStatus === 'complete' ? V.accent3 : V.ink2,
                  border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 50%, transparent)` : sumStatus === 'balanced' ? 'color-mix(in oklab, #e57860 50%, transparent)' : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : V.line}`,
                }}
              >
                <span aria-hidden>{sumStatus === 'balanced' ? '●' : sumStatus === 'over' ? '▲' : sumStatus === 'complete' ? '✓' : '○'}</span>
                {allBidsIn
                  ? (sumStatus === 'over' ? `OVER · ${sumOfBids - cards} TOO MANY` : sumStatus === 'balanced' ? 'INVALID · SUM EQUALS CARDS' : `READY · ${cards - sumOfBids} SHORT`)
                  : `${n - numBidsIn} LEFT TO BID`}
              </div>
            </div>
          </section>

          {/* ─── Main content: spotlight + running tab ─── */}
          <div className="game-content">

            {/* Spotlight entry */}
            <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* ── Bid-order chip strip — elevated, taller chips ── */}
              <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${V.line}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 7, overflowX: 'auto', flex: 1 }} role="group" aria-label="Bid order">
                  {bidOrder.map((playerIdx) => {
                    const p         = players[playerIdx]
                    const bid       = bids[p.id]
                    const isActive  = active === playerIdx
                    const isDone    = bid !== undefined
                    const isPending = !isActive && !isDone
                    const isDealer  = playerIdx === dealerIdx

                    return (
                      <button
                        key={p.id}
                        className={['bid-chip-btn', isActive ? 'bid-chip-active' : ''].filter(Boolean).join(' ')}
                        onClick={() => handleChipClick(playerIdx)}
                        aria-label={`${p.displayName}${isDone ? `, bid ${bid}` : isActive ? ', bidding now' : ', pending'}`}
                        aria-pressed={isActive}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: isActive ? '10px 18px 10px 12px' : isDone ? '8px 14px 8px 10px' : '7px 13px',
                          borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                          opacity: isPending ? 0.35 : isDone ? 0.78 : 1,
                          background: isActive
                            ? `color-mix(in oklab, ${V.accent} 18%, ${V.bg2})`
                            : isDone
                              ? `color-mix(in oklab, ${p.color} 14%, ${V.bg2})`
                              : 'transparent',
                          border: `1.5px solid ${isActive ? V.accent : isDone ? `color-mix(in oklab, ${p.color} 55%, transparent)` : V.line}`,
                        }}
                      >
                        <Avatar player={p} size={isActive ? 26 : 22} isDealer={isDealer} />
                        {isDone ? (
                          // Done: bid number is the hero, name is the label
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: bid === 0 ? V.accent3 : V.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                              {bid}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.03em' }}>
                              {p.displayName}
                            </span>
                          </div>
                        ) : isActive ? (
                          <>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: V.ink, whiteSpace: 'nowrap' }}>
                              {p.displayName}
                            </span>
                            <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: V.accent, display: 'inline-block', flexShrink: 0 }} />
                          </>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.muted, whiteSpace: 'nowrap' }}>
                            {p.displayName}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Sum pill */}
                <div style={{ flexShrink: 0, marginLeft: 4 }}>
                  <div
                    aria-live="polite"
                    aria-label={`Bid sum ${sumOfBids} of ${cards}: ${sumLabel}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em',
                      padding: '5px 11px', borderRadius: 999,
                      background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 20%, transparent)` : sumStatus === 'balanced' ? `color-mix(in oklab, #e57860 20%, transparent)` : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 20%, transparent)` : V.bg2,
                      color: sumStatus === 'over' ? V.accent2 : sumStatus === 'balanced' ? '#e57860' : sumStatus === 'complete' ? V.accent3 : V.ink2,
                      border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 45%, transparent)` : sumStatus === 'balanced' ? 'color-mix(in oklab, #e57860 45%, transparent)' : sumStatus === 'complete' ? `color-mix(in oklab, ${V.accent3} 45%, transparent)` : V.line}`,
                    }}
                  >
                    <b style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{sumOfBids}</b>
                    <span style={{ opacity: 0.6 }}>/{cards}</span>
                    <span aria-hidden style={{ opacity: 0.4, fontSize: 9 }}>·</span>
                    <span style={{ fontSize: 10 }}>{sumLabel}</span>
                  </div>
                </div>
              </div>

              {/* Active player spotlight */}
              {activePlayer ? (
                <div style={{
                  padding: '28px 32px 22px',
                  background: `radial-gradient(ellipse at 22% 45%, color-mix(in oklab, ${activePlayer.color} 12%, transparent) 0%, transparent 60%), color-mix(in oklab, ${activePlayer.color} 5%, transparent)`,
                  flex: 1,
                }}>

                  {/* Player header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 22 }}>
                    <div className="avatar-pulse" style={{ borderRadius: '50%', flexShrink: 0 }}>
                      <Avatar player={activePlayer} size={72} isDealer={active === dealerIdx} glow />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: V.ink, letterSpacing: '-0.02em', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activePlayer.displayName}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {active === dealerIdx ? (
                          <span style={{ background: `color-mix(in oklab, ${V.accent} 22%, transparent)`, color: V.accent, padding: '2px 8px', borderRadius: 999, fontWeight: 700, fontSize: 9, letterSpacing: '.16em' }}>DEALER · BIDS LAST</span>
                        ) : null}
                        <span>{active === dealerIdx ? 'Bids last this round' : 'On the call'}</span>
                      </div>

                      {activeForbidden !== null ? (
                        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: `color-mix(in oklab, ${V.accent2} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${V.accent2} 40%, transparent)`, borderRadius: 8, padding: '6px 12px' }}>
                          <span aria-hidden style={{ fontSize: 13, color: V.accent2, fontWeight: 700 }}>✕</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.accent2 }}>
                            Can&apos;t bid <b style={{ fontSize: 13 }}>{activeForbidden}</b> — that balances the sum
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Current bid display */}
                    {activeBid !== undefined ? (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, color: activeBid === 0 ? V.accent3 : activePlayer.color, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {activeBid}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>
                          {activeBid === 0 ? 'NIL CALL' : `${activeBid} TRICK${activeBid > 1 ? 'S' : ''}`}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Number pad */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label={`Choose bid for ${activePlayer.displayName}`}>
                    {Array.from({ length: cards + 1 }, (_, num) => {
                      const isForbidden = activeForbidden === num
                      const isSelected  = activeBid === num
                      const isPressed   = pressedBtn === `${active}-${num}`
                      const isShaking   = shakingBtn === `${active}-${num}`

                      return (
                        <button
                          key={num}
                          className={[
                            'bid-num-btn',
                            isPressed ? 'bid-press' : '',
                            isForbidden ? 'bid-btn-forbidden' : '',
                            isShaking ? 'bid-btn-forbidden-shake' : '',
                          ].filter(Boolean).join(' ')}
                          aria-label={isForbidden ? `${num} — forbidden for dealer` : `Bid ${num} trick${num !== 1 ? 's' : ''}`}
                          aria-pressed={isSelected}
                          aria-disabled={isForbidden && !isSelected}
                          onClick={() => {
                            if (isForbidden) {
                              setShakingBtn(`${active}-${num}`)
                              if (shakeBtnTimerRef.current) clearTimeout(shakeBtnTimerRef.current)
                              shakeBtnTimerRef.current = setTimeout(() => {
                                setShakingBtn(null)
                                shakeBtnTimerRef.current = null
                              }, 420)
                              return
                            }
                            handleBidPress(active, num)
                          }}
                          style={{
                            flex: '1 0 auto',
                            minWidth: 68,
                            height: 76,
                            borderRadius: 12,
                            background: isSelected
                              ? selectedBidColor
                              : isForbidden
                                ? `color-mix(in oklab, ${V.accent2} 12%, transparent)`
                                : V.bg2,
                            border: `1.5px solid ${
                              isSelected
                                ? selectedBidColor
                                : isForbidden
                                  ? `color-mix(in oklab, ${V.accent2} 50%, ${V.line})`
                                  : V.line
                            }`,
                            color: isSelected ? '#2a1620' : isForbidden ? V.accent2 : V.ink2,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: 24,
                            cursor: isForbidden ? 'not-allowed' : 'pointer',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {num}
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid color-mix(in oklab, ${V.line} 50%, transparent)`, fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.08em', textAlign: 'center' }}>
                    Advances automatically · tap any chip above to edit a bid
                  </div>
                </div>
              ) : (
                <div style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.accent3 }}>All bids in!</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>Review above · lock when ready.</div>
                </div>
              )}
            </section>

            {/* Running tab — right sidebar on desktop, below on mobile */}
            <section className="game-tab-sidebar" style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>

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
                        <th key={p.id} scope="col" style={{ padding: '9px 4px', background: V.surface, textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: i < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
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
                            const b = r.bids[p.id]
                            const k = r.took?.[p.id]
                            const made = b !== undefined && k !== undefined && b === k
                            const pts  = (b !== undefined && k !== undefined) ? scoreFor(b, k, variant) : null
                            return (
                              <td
                                key={p.id}
                                style={{
                                  padding: '7px 4px',
                                  textAlign: 'center',
                                  borderBottom: `1px solid ${V.line}`,
                                  borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none',
                                  background: pts === null ? 'transparent' : made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)`,
                                }}
                              >
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: pts === null ? V.muted : made ? V.accent3 : V.accent2 }}>
                                    {pts === null ? '—' : made ? `+${pts}` : '0'}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.ink2, opacity: .75, marginTop: 1 }}>
                                    {b !== undefined ? b : '—'}/{k !== undefined ? k : '—'}
                                  </span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}

                    {/* Current round — bids in progress */}
                    <tr>
                      <td
                        className="game-tab-round-cell"
                        style={{ textAlign: 'left', padding: '7px 6px 7px 14px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.accent, background: `color-mix(in oklab, ${V.accent} 6%, ${V.bg2})` }}
                      >
                        R{roundNumber}
                        <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .65, marginLeft: 3 }}>{trump?.glyph}</span>
                      </td>
                      {players.map((p, pi) => {
                        const b = bids[p.id]
                        return (
                          <td
                            key={p.id}
                            style={{
                              padding: '7px 4px',
                              textAlign: 'center',
                              borderBottom: `1px solid ${V.line}`,
                              borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none',
                              background: `color-mix(in oklab, ${V.accent} 8%, transparent)`,
                            }}
                          >
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: b !== undefined ? V.ink : V.muted }}>
                                {b !== undefined ? b : '—'}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .65, marginTop: 1 }}>
                                {b !== undefined ? b : '—'}/—
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>

                    {/* TOTAL */}
                    <tr>
                      <td
                        className="game-tab-round-cell"
                        style={{ padding: '11px 6px 11px 14px', background: V.surface, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}`, borderTop: `2px solid ${V.line}` }}
                      >TOTAL</td>
                      {players.map((p, pi) => (
                        <td key={p.id} style={{ padding: '11px 4px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: leaderIds.has(p.id) ? V.accent : V.ink, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', borderTop: `2px solid ${V.line}` }}>
                          {totals[p.id]}
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
                        <td key={p.id} style={{ padding: '8px 4px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: leaderIds.has(p.id) ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
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
                    className="game-icon-btn game-expand-btn"
                    onClick={() => setExpanded(e => !e)}
                    aria-expanded={expanded}
                    style={{ background: 'transparent', border: `1px solid ${V.line}`, color: V.ink2, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, touchAction: 'manipulation' }}
                  >
                    {expanded ? 'Collapse' : `All ${completedRounds.length} rounds`}
                    <span aria-hidden style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}>↓</span>
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          {/* ─── Footer ─── */}
          <footer style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${V.line}` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.06em', lineHeight: 1.55 }}>
              {footerHint}
            </div>
            <button
              onClick={handleLock}
              disabled={!lockReady}
              className="game-cta-btn"
              aria-label={lockReady ? 'Lock bids and start the round' : 'Cannot lock — bids incomplete'}
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
                touchAction: 'manipulation',
              }}
            >
              {submitting ? 'Locking…' : 'Lock & Play →'}
            </button>
          </footer>

        </div>
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
