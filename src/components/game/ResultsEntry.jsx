import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useCountUp } from '../../hooks/useCountUp'
import Avatar from './Avatar'
import GameTimer from './GameTimer'
import SummaryModal from './SummaryModal'
import StatsModal from './StatsModal'
import AccountMenu from '../AccountMenu'
import { trumpById, computeTotals, computeRanks, scoreFor } from '../../lib/gameLogic'
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

const AnimatedScore = React.memo(function AnimatedScore({ value, className = '', style = {} }) {
  const displayed = useCountUp(value, { duration: 500, enabled: value > 0 })
  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{displayed}</span>
})

export default function ResultsEntry({
  game, players, completedRounds, pendingRound,
  roundNumber, trump, dealerIdx,
  lockResults, endGame,
}) {
  const [took, setTook]           = useState({})
  const [flashIds, setFlashIds]   = useState({})
  const [expanded, setExpanded]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const flashTimerRef = useRef({})

  useEffect(() => () => {
    for (const id of Object.values(flashTimerRef.current)) clearTimeout(id)
  }, [])

  const variant = game.scoring_variant
  const cards   = pendingRound?.cards ?? 0
  const tint    = trumpTint(trump)

  const setPlayerTook = useCallback((playerId, val) => {
    setTook(cur => {
      const next = { ...cur }
      if (val === undefined) { delete next[playerId] } else { next[playerId] = val }
      return next
    })
    if (val !== undefined) {
      const bid      = pendingRound?.bids[playerId]
      const flashKey = val === bid ? 'made' : 'miss'
      setFlashIds(cur => ({ ...cur, [playerId]: flashKey }))
      if (flashTimerRef.current[playerId]) clearTimeout(flashTimerRef.current[playerId])
      flashTimerRef.current[playerId] = setTimeout(() => {
        setFlashIds(cur => { const out = { ...cur }; delete out[playerId]; return out })
        delete flashTimerRef.current[playerId]
      }, 1000)
    }
  }, [pendingRound])

  const sumOfTricks = players.reduce((acc, p) => acc + (took[p.id] ?? 0), 0)
  const entered     = players.filter(p => took[p.id] !== undefined).length
  const sumOverBy   = sumOfTricks - cards
  const allValid    = entered === players.length && sumOfTricks === cards

  let sumStatus, sumLabel
  if (entered < players.length) {
    if (sumOverBy > 0) {
      sumStatus = 'over'; sumLabel = `OVER · ${sumOverBy} TOO MANY`
    } else {
      sumStatus = 'under'; sumLabel = `${players.length - entered} LEFT · ${cards - sumOfTricks} MORE`
    }
  } else if (sumOfTricks === cards) {
    sumStatus = 'exact'; sumLabel = `LOCKED IN · ${cards} OF ${cards}`
  } else if (sumOverBy > 0) {
    sumStatus = 'over'; sumLabel = `OVER · ${sumOverBy} EXTRA`
  } else {
    sumStatus = 'under'; sumLabel = `UNDER · ${cards - sumOfTricks} MISSING`
  }

  const totalsBefore = useMemo(() => computeTotals(players, completedRounds, variant), [players, completedRounds, variant])
  const ranksBefore  = useMemo(() => computeRanks(players, totalsBefore), [players, totalsBefore])

  const totalsAfter = useMemo(() => {
    const after = { ...totalsBefore }
    for (const p of players) {
      if (took[p.id] !== undefined) {
        after[p.id] = totalsBefore[p.id] + scoreFor(pendingRound?.bids[p.id], took[p.id], variant)
      }
    }
    return after
  }, [totalsBefore, players, took, pendingRound, variant])

  const ranksAfter  = useMemo(() => computeRanks(players, totalsAfter), [players, totalsAfter])

  const sortedAfter = useMemo(
    () => [...players].toSorted((a, b) => totalsAfter[b.id] - totalsAfter[a.id]),
    [players, totalsAfter]
  )

  const leaderIds = useMemo(() => {
    if (!players.length) return new Set()
    const maxScore = Math.max(...players.map(p => totalsAfter[p.id]))
    return new Set(players.filter(p => totalsAfter[p.id] === maxScore).map(p => p.id))
  }, [players, totalsAfter])

  const topScorers = useMemo(() => {
    const withResults = players.filter(p => took[p.id] !== undefined)
    if (!withResults.length) return []
    const maxPts = Math.max(...withResults.map(p => scoreFor(pendingRound?.bids[p.id] ?? 0, took[p.id], variant)))
    if (maxPts <= 0) return []
    return withResults
      .filter(p => scoreFor(pendingRound?.bids[p.id] ?? 0, took[p.id], variant) === maxPts)
      .map(p => ({ player: p, pts: maxPts, bid: pendingRound?.bids[p.id] ?? 0, took: took[p.id] }))
  }, [players, took, pendingRound, variant])

  const nilAchievers = useMemo(() =>
    players.filter(p => (pendingRound?.bids[p.id] ?? -1) === 0 && took[p.id] === 0)
  , [players, took, pendingRound])

  const nilPending = useMemo(() =>
    players.filter(p => (pendingRound?.bids[p.id] ?? -1) === 0 && took[p.id] === undefined).length
  , [players, took, pendingRound])

  const closestCalls = useMemo(() =>
    players
      .filter(p => took[p.id] !== undefined && Math.abs(took[p.id] - (pendingRound?.bids[p.id] ?? 0)) === 1)
      .map(p => {
        const bid = pendingRound?.bids[p.id] ?? 0
        return { player: p, bid, took: took[p.id], delta: took[p.id] - bid }
      })
  , [players, took, pendingRound])

  const tabRounds = useMemo(
    () => expanded ? completedRounds : completedRounds.slice(-5),
    [completedRounds, expanded]
  )

  const bidSum = useMemo(
    () => players.reduce((acc, p) => acc + (pendingRound?.bids[p.id] ?? 0), 0),
    [players, pendingRound]
  )

  const handleLockResults = useCallback(async () => {
    if (!allValid || saving) return
    setSaving(true)
    try { await lockResults(took) } catch { setSaving(false) }
  }, [allValid, saving, lockResults, took])

  const handleEndGame = useCallback(async () => {
    setSummaryOpen(false)
    setStatsOpen(false)
    try { await endGame() } catch (_) {}
  }, [endGame])

  const hasHighlights = topScorers.length > 0 || nilAchievers.length > 0 || nilPending > 0 || closestCalls.length > 0

  return (
    <>
      <div style={{ minHeight: '100vh', background: tint.pageBleed, transition: 'background 0.9s ease', position: 'relative' }}>

        {/* Diamond lattice overlay */}
        <div aria-hidden style={{ position: 'fixed', inset: 0, backgroundImage: LATTICE_SVG, backgroundSize: '36px 36px', opacity: 0.022, pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1360, margin: '0 auto', padding: '24px 32px 32px', display: 'grid', gridTemplateRows: 'auto auto auto auto auto auto', gap: 18 }}>

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
                {game.name ? `${game.name} · ` : ''}Round {roundNumber} · entering results
              </div>
            </div>

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

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <AccountMenu />
            </div>
          </header>

          {/* ─── Compact info bar (trump · cards · tricks tracker) ─── */}
          <div
            aria-label="Round info"
            style={{
              display: 'flex', alignItems: 'center', gap: 0,
              background: `color-mix(in oklab, ${tint.bg} 55%, ${V.bg2})`,
              border: tint.border,
              borderRadius: 16, overflow: 'hidden',
            }}
          >
            {/* Trump */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', flexShrink: 0 }}>
              <span aria-hidden style={{ fontSize: 32, color: tint.glyphColor, lineHeight: 1 }}>{trump?.glyph ?? '⚬'}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: tint.labelColor }}>
                  {trump?.nt ? 'No Trump' : 'Trump'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: tint.glyphColor, letterSpacing: '-0.01em' }}>
                  {trump?.name ?? '—'}
                  {tint.flavor ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tint.labelColor, opacity: 0.7, fontWeight: 500, marginLeft: 8 }}>{tint.flavor}</span> : null}
                </div>
              </div>
            </div>

            <div aria-hidden style={{ width: 1, alignSelf: 'stretch', background: V.line, flexShrink: 0 }} />

            {/* Cards count */}
            <div style={{ padding: '12px 20px', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Cards</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {cards}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginLeft: 5, fontWeight: 500, letterSpacing: '.08em' }}>EACH</span>
              </div>
            </div>

            <div aria-hidden style={{ width: 1, alignSelf: 'stretch', background: V.line, flexShrink: 0 }} />

            {/* Bid sum */}
            <div style={{ padding: '12px 20px', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Bid sum</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.ink2, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {bidSum}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, marginLeft: 2, fontWeight: 500 }}>/{cards}</span>
              </div>
            </div>

            <div aria-hidden style={{ width: 1, alignSelf: 'stretch', background: V.line, flexShrink: 0 }} />

            {/* Tricks tracker — takes remaining space */}
            <div style={{ flex: 1, padding: '12px 20px', minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Tricks taken</div>
                <div aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sumStatus === 'exact' ? V.accent3 : sumStatus === 'over' ? V.accent2 : V.ink2, fontVariantNumeric: 'tabular-nums' }}>
                  {sumOfTricks} / {cards}
                  {sumStatus === 'exact' ? <span style={{ marginLeft: 4 }}>✓</span> : sumStatus === 'over' ? <span style={{ marginLeft: 4 }}>▲</span> : null}
                </div>
              </div>
              <div style={{ height: 6, background: V.bg2, borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ width: `${Math.min(100, cards > 0 ? (sumOfTricks / cards) * 100 : 0)}%`, height: '100%', background: sumStatus === 'over' ? V.accent2 : sumStatus === 'exact' ? V.accent3 : V.accent, borderRadius: 999, transition: 'width .25s ease' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: sumStatus === 'over' ? V.accent2 : sumStatus === 'exact' ? V.accent3 : V.muted }}>
                {sumLabel}
              </div>
            </div>
          </div>

          {/* ─── Main content: player entry + running tab sidebar ─── */}
          <div className="game-content">

            {/* Player entry grid */}
            <section aria-label="Tricks taken entry" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: V.ink, margin: 0 }}>
                  Tricks taken
                  <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
                    sum must equal {cards}
                  </small>
                </h2>
                <div aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: entered === players.length ? (allValid ? V.accent3 : V.accent2) : V.muted }}>
                  {entered}/{players.length} entered
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {players.map((p, i) => {
                  const bid      = pendingRound?.bids[p.id] ?? 0
                  const taken    = took[p.id]
                  const isSet    = taken !== undefined
                  const made     = isSet && taken === bid
                  const flash    = flashIds[p.id]
                  const earned   = isSet ? scoreFor(bid, taken, variant) : 0
                  const isDealer = i === dealerIdx

                  return (
                    <div
                      key={p.id}
                      className={flash === 'made' ? 'flash-made' : flash === 'miss' ? 'flash-miss' : ''}
                      style={{
                        background: isSet
                          ? (made ? `color-mix(in oklab, ${V.accent3} 10%, ${V.bg2})` : `color-mix(in oklab, ${V.accent2} 10%, ${V.bg2})`)
                          : V.bg2,
                        border: isSet
                          ? `1px solid ${made ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : `color-mix(in oklab, ${V.accent2} 50%, transparent)`}`
                          : `1px solid ${V.line}`,
                        borderLeft: `4px solid ${p.color}`,
                        borderRadius: 12, padding: '10px 12px', position: 'relative',
                        transition: 'background .25s ease, border-color .25s ease',
                      }}
                    >
                      {/* Player identity + bid */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Avatar player={p} size={26} isDealer={isDealer} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.displayName}
                          </div>
                          {isDealer ? (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: V.accent, fontWeight: 700 }}>DEALER</div>
                          ) : null}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: bid === 0 ? V.accent3 : p.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {bid}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: V.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                            {bid === 0 ? 'NIL' : 'BID'}
                          </div>
                        </div>
                      </div>

                      {/* Number pad */}
                      <div
                        role="group"
                        aria-label={`Tricks taken for ${p.displayName}`}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}
                        onClick={e => e.stopPropagation()}
                      >
                        {Array.from({ length: cards + 1 }, (_, n) => {
                          const isSelected = taken === n
                          const isBid      = n === bid
                          return (
                            <button
                              key={n}
                              onClick={() => setPlayerTook(p.id, taken === n ? undefined : n)}
                              aria-label={`${n} trick${n !== 1 ? 's' : ''}${isBid ? ' — bid target' : ''}`}
                              aria-pressed={isSelected}
                              style={{
                                width: 30, height: 30, borderRadius: 7,
                                border: isSelected
                                  ? `2px solid ${made ? V.accent3 : V.accent2}`
                                  : isBid
                                    ? `1.5px solid color-mix(in oklab, ${p.color} 70%, transparent)`
                                    : `1px solid ${V.line}`,
                                background: isSelected
                                  ? (made ? `color-mix(in oklab, ${V.accent3} 28%, ${V.surface})` : `color-mix(in oklab, ${V.accent2} 28%, ${V.surface})`)
                                  : isBid
                                    ? `color-mix(in oklab, ${p.color} 16%, ${V.surface})`
                                    : V.surface,
                                color: isSelected ? (made ? V.accent3 : V.accent2) : isBid ? p.color : V.ink,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: isSelected || isBid ? 700 : 500,
                                fontSize: 13, cursor: 'pointer',
                                touchAction: 'manipulation',
                                transition: 'background .15s ease, border-color .15s ease',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {n}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => setPlayerTook(p.id, bid)}
                          aria-label={`Mark ${p.displayName} as made their bid of ${bid}`}
                          style={{
                            height: 30, borderRadius: 7, padding: '0 8px',
                            background: made ? `color-mix(in oklab, ${V.accent3} 22%, ${V.surface})` : `color-mix(in oklab, ${V.accent3} 12%, ${V.surface})`,
                            border: `1.5px solid color-mix(in oklab, ${V.accent3} ${made ? 60 : 35}%, transparent)`,
                            color: V.accent3,
                            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                            letterSpacing: '.08em', textTransform: 'uppercase',
                            cursor: 'pointer', whiteSpace: 'nowrap', touchAction: 'manipulation',
                          }}
                        >
                          ✓ Made
                        </button>
                      </div>

                      {/* Status + earned */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        paddingTop: 8,
                        borderTop: `1px solid ${isSet ? (made ? `color-mix(in oklab, ${V.accent3} 25%, transparent)` : `color-mix(in oklab, ${V.accent2} 25%, transparent)`) : V.line}`,
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: isSet ? (made ? V.accent3 : V.accent2) : V.muted }}>
                          {isSet ? (made ? '● MADE' : '● MISSED') : '● PENDING'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: isSet ? (made ? V.accent3 : V.accent2) : V.muted, fontVariantNumeric: 'tabular-nums' }}>
                          {isSet ? (made ? <><span>+</span><AnimatedScore value={earned} className="score-pop" /></> : '0') : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Running tab sidebar */}
            <section className="game-tab-sidebar" aria-label="Running score tab" style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>

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
                            const b    = r.bids[p.id]
                            const k    = r.took?.[p.id]
                            const made = b !== undefined && k !== undefined && b === k
                            const pts  = (b !== undefined && k !== undefined) ? scoreFor(b, k, variant) : null
                            return (
                              <td
                                key={p.id}
                                style={{
                                  padding: '7px 4px', textAlign: 'center',
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

                    {/* Current round — live results */}
                    <tr>
                      <td
                        className="game-tab-round-cell"
                        style={{ textAlign: 'left', padding: '7px 6px 7px 14px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.accent, background: `color-mix(in oklab, ${V.accent} 6%, ${V.bg2})` }}
                      >
                        R{roundNumber}
                        <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .65, marginLeft: 3 }}>{trump?.glyph}</span>
                      </td>
                      {players.map((p, pi) => {
                        const b     = pendingRound?.bids[p.id]
                        const k     = took[p.id]
                        const isSet = k !== undefined
                        const made  = isSet && k === b
                        const pts   = isSet ? scoreFor(b, k, variant) : null
                        return (
                          <td
                            key={p.id}
                            style={{
                              padding: '7px 4px', textAlign: 'center',
                              borderBottom: `1px solid ${V.line}`,
                              borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none',
                              background: isSet
                                ? (made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)`)
                                : `color-mix(in oklab, ${V.accent} 8%, transparent)`,
                            }}
                          >
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: isSet ? (made ? V.accent3 : V.accent2) : V.muted }}>
                                {isSet ? (made ? `+${pts}` : '0') : '—'}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isSet ? V.ink2 : V.accent, opacity: isSet ? .75 : .65, marginTop: 1 }}>
                                {b}/{isSet ? k : '—'}
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
                        <td key={p.id} style={{ padding: '11px 4px', background: rankBg(ranksAfter[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: leaderIds.has(p.id) ? V.accent : V.ink, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', borderTop: `2px solid ${V.line}` }}>
                          <AnimatedScore value={totalsAfter[p.id]} />
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
                        <td key={p.id} style={{ padding: '8px 4px', background: rankBg(ranksAfter[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: leaderIds.has(p.id) ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                          {formatRank(ranksAfter[p.id])}
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

          {/* ─── Highlight strip (compact, secondary) ─── */}
          {hasHighlights ? (
            <div
              aria-label="Round highlights"
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12,
              }}
            >
              {topScorers.length > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span aria-hidden style={{ color: V.accent }}>★ MVP</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: topScorers.length === 1 ? topScorers[0].player.color : V.ink }}>
                    {topScorers.length === 1 ? topScorers[0].player.displayName : `${topScorers.length}-way tie`}
                  </span>
                  <span style={{ fontWeight: 700, color: V.accent3 }}>+{topScorers[0].pts}</span>
                </span>
              ) : null}

              {topScorers.length > 0 && (nilAchievers.length > 0 || nilPending > 0 || closestCalls.length > 0) ? (
                <span aria-hidden style={{ color: V.line, fontFamily: 'var(--font-mono)', fontSize: 14 }}>·</span>
              ) : null}

              {nilAchievers.length > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span aria-hidden style={{ color: V.accent3 }}>○ Nil</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink }}>
                    {nilAchievers.map(p => p.displayName).join(', ')}
                  </span>
                  <span style={{ color: V.muted }}>held</span>
                </span>
              ) : nilPending > 0 ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
                  ○ {nilPending} nil bid{nilPending > 1 ? 's' : ''} in play
                </span>
              ) : null}

              {(nilAchievers.length > 0 || nilPending > 0) && closestCalls.length > 0 ? (
                <span aria-hidden style={{ color: V.line, fontFamily: 'var(--font-mono)', fontSize: 14 }}>·</span>
              ) : null}

              {closestCalls.length > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span aria-hidden style={{ color: V.accent2 }}>≈ Close</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink }}>
                    {closestCalls.map(c => c.player.displayName).join(', ')}
                  </span>
                  <span style={{ color: V.muted }}>
                    {closestCalls.length === 1
                      ? (closestCalls[0].delta > 0 ? 'one over' : 'one short')
                      : 'missed by 1'}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {/* ─── Standings — full width, primary section ─── */}
          <section aria-label="Standings after this round" style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink, margin: 0 }}>
                Standings
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>after this round</small>
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: allValid ? V.accent3 : V.muted }}>
                {allValid ? 'Final ✓' : 'Live · updating'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedAfter.map(p => {
                const rkBefore = ranksBefore[p.id]?.rank ?? 0
                const rkAfter  = ranksAfter[p.id]?.rank ?? 0
                const delta    = rkBefore - rkAfter
                const gain     = totalsAfter[p.id] - totalsBefore[p.id]
                const isLeader = leaderIds.has(p.id)
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: rankBg(ranksAfter[p.id]?.rank, sortedAfter.length),
                      border: `1px solid ${V.line}`,
                      borderLeft: `4px solid ${p.color}`,
                      borderRadius: 12, padding: '10px 14px',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: isLeader ? V.accent : V.muted, width: 30, flexShrink: 0 }}>
                      {formatRank(ranksAfter[p.id])}
                    </div>
                    <Avatar player={p} size={28} />
                    <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: isLeader ? V.accent : V.ink, fontVariantNumeric: 'tabular-nums' }}>
                        <AnimatedScore value={totalsAfter[p.id]} />
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: gain === 0 ? V.muted : V.accent3, fontVariantNumeric: 'tabular-nums' }}>
                        {gain > 0 ? `+${gain}` : gain === 0 ? '—' : gain}
                      </span>
                    </div>
                    <div
                      className={delta !== 0 ? 'rank-delta' : ''}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: delta > 0 ? V.accent3 : delta < 0 ? V.accent2 : V.muted, width: 54, textAlign: 'right', flexShrink: 0 }}
                    >
                      {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '— same'}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ─── Footer ─── */}
          <footer style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center',
            paddingTop: 14, paddingBottom: 14,
            borderTop: allValid ? `2px solid color-mix(in oklab, ${V.accent3} 45%, transparent)` : `1px solid ${V.line}`,
            ...(allValid ? {
              position: 'sticky', bottom: 0,
              background: tint.pageBleed,
              boxShadow: '0 -12px 32px -4px rgba(0,0,0,.45)',
              zIndex: 10,
            } : {}),
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.06em', lineHeight: 1.55 }}>
              {!allValid
                ? <>Sum must equal <b style={{ color: V.ink }}>{cards}</b> tricks before the next round can start.</>
                : <>All results in. <b style={{ color: V.ink }}>Round {roundNumber + 1}</b> is next{topScorers.length === 1 ? ` · ${topScorers[0].player.displayName} takes round MVP` : topScorers.length > 1 ? ` · ${topScorers.length}-way MVP this round` : ''}.</>
              }
            </div>
            <button
              onClick={handleLockResults}
              disabled={!allValid || saving}
              className="game-cta-btn"
              aria-label={allValid ? 'Lock results and start next round' : 'Cannot lock — results incomplete or sum invalid'}
              style={{
                background: allValid ? V.accent3 : V.surface,
                border: `1px solid ${allValid ? 'transparent' : V.line}`,
                borderRadius: 14, padding: '16px 26px',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                letterSpacing: '-0.01em',
                color: allValid ? '#1a2a0a' : V.muted,
                cursor: allValid && !saving ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: allValid ? `0 8px 20px -8px color-mix(in oklab, ${V.accent3} 60%, transparent)` : 'none',
                transition: 'all .2s ease',
                touchAction: 'manipulation',
              }}
            >
              {saving ? 'Saving…' : 'Next Round →'}
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
