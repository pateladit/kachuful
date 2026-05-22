import { useState, useRef } from 'react'
import Avatar from './Avatar'
import GameTimer from './GameTimer'
import SummaryModal from './SummaryModal'
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
}

function formatRank(rk) {
  if (!rk) return '—'
  const n = rk.rank
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

export default function ResultsEntry({
  game, players, completedRounds, pendingRound,
  roundNumber, trump, dealerIdx,
  lockResults, endGame,
}) {
  const n = players.length
  const bidOrder = Array.from({ length: n }, (_, i) => (dealerIdx + 1 + i) % n)

  const [took, setTook] = useState({})
  const [flashIds, setFlashIds] = useState({})
  const [saving, setSaving] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(bidOrder[0] ?? 0)
  const advanceTookTimerRef = useRef(null)

  const variant = game.scoring_variant
  const cards = pendingRound?.cards ?? 0

  function handleChipClick(playerIdx) {
    if (advanceTookTimerRef.current) {
      clearTimeout(advanceTookTimerRef.current)
      advanceTookTimerRef.current = null
    }
    setActiveIdx(playerIdx)
  }

  function setPlayerTook(playerId, val) {
    // Compute updated took synchronously for next-player search
    const updatedTook = { ...took }
    if (val === undefined) delete updatedTook[playerId]
    else updatedTook[playerId] = val

    setTook(updatedTook)

    if (val !== undefined) {
      // Flash animation
      const bid = pendingRound.bids[playerId]
      const flashKey = val === bid ? 'made' : 'miss'
      setFlashIds(cur => ({ ...cur, [playerId]: flashKey }))
      setTimeout(() => {
        setFlashIds(cur => {
          const out = { ...cur }
          delete out[playerId]
          return out
        })
      }, 1000)

      // Find next pending player in bid order
      const playerIdx = players.findIndex(p => p.id === playerId)
      const bidOrderPos = bidOrder.indexOf(playerIdx)
      let next = null
      for (let i = 1; i <= n; i++) {
        const nextPos = (bidOrderPos + i) % n
        const nextIdx = bidOrder[nextPos]
        const nextPlayer = players[nextIdx]
        if (nextPlayer && updatedTook[nextPlayer.id] === undefined) {
          next = nextIdx
          break
        }
      }

      if (advanceTookTimerRef.current) {
        clearTimeout(advanceTookTimerRef.current)
      }
      advanceTookTimerRef.current = setTimeout(() => {
        setActiveIdx(next)
        advanceTookTimerRef.current = null
      }, 350)
    }
  }

  const sumOfTricks = players.reduce((acc, p) => acc + (took[p.id] ?? 0), 0)
  const entered = players.filter(p => took[p.id] !== undefined).length
  const sumOverBy = sumOfTricks - cards

  let sumStatus, sumLabel
  if (entered < players.length) {
    if (sumOverBy > 0) {
      sumStatus = 'over'
      sumLabel = `OVER · ${sumOverBy} TOO MANY`
    } else {
      sumStatus = 'under'
      sumLabel = `${players.length - entered} LEFT · ${cards - sumOfTricks} MORE TO PLACE`
    }
  } else if (sumOfTricks === cards) {
    sumStatus = 'exact'
    sumLabel = `LOCKED IN · ${cards} OF ${cards} TRICKS ACCOUNTED`
  } else if (sumOverBy > 0) {
    sumStatus = 'over'
    sumLabel = `OVER · ${sumOverBy} EXTRA TRICK${sumOverBy > 1 ? 'S' : ''}`
  } else {
    sumStatus = 'under'
    sumLabel = `UNDER · ${cards - sumOfTricks} TRICK${cards - sumOfTricks > 1 ? 'S' : ''} MISSING`
  }

  const allValid = entered === players.length && sumOfTricks === cards

  const totalsBefore = computeTotals(players, completedRounds, variant)
  const ranksBefore = computeRanks(players, totalsBefore)
  const totalsAfter = { ...totalsBefore }
  for (const p of players) {
    if (took[p.id] !== undefined) {
      totalsAfter[p.id] = totalsBefore[p.id] + scoreFor(pendingRound.bids[p.id], took[p.id], variant)
    }
  }
  const ranksAfter = computeRanks(players, totalsAfter)
  const sortedAfter = [...players].sort((a, b) => totalsAfter[b.id] - totalsAfter[a.id])
  const leaderId = sortedAfter[0]?.id

  let mvp = null
  for (const p of players) {
    if (took[p.id] === undefined) continue
    const pts = scoreFor(pendingRound.bids[p.id], took[p.id], variant)
    if (pts > 0 && (!mvp || pts > mvp.pts)) {
      mvp = { player: p, pts, bid: pendingRound.bids[p.id], took: took[p.id] }
    }
  }

  async function handleLockResults() {
    if (!allValid || saving) return
    setSaving(true)
    try {
      await lockResults(took)
    } catch {
      setSaving(false)
    }
  }

  async function handleEndGame() {
    setSummaryOpen(false)
    try { await endGame() } catch (_) {}
  }

  // Spotlight player data
  const activePlayer = activeIdx !== null ? players[activeIdx] : null
  const activeBid = activePlayer ? (pendingRound?.bids[activePlayer.id] ?? 0) : 0
  const activeTaken = activePlayer ? took[activePlayer.id] : undefined

  return (
    <>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 32px 32px', minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto auto auto auto auto', gap: 20 }}>

        {/* ─── Top bar ─── */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
              Ka<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Chu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Fu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />L
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
              {game.name ? `${game.name} · ` : ''}Round {roundNumber} · entering results
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `color-mix(in oklab, ${V.accent3} 15%, ${V.surface})`, border: `1px solid color-mix(in oklab, ${V.accent3} 40%, transparent)`, padding: '7px 14px', borderRadius: 999, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: V.accent3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: V.accent3, display: 'inline-block' }} />
              Entering results
            </div>
            <GameTimer startedAt={game.started_at} />
            <button onClick={() => setSummaryOpen(true)} style={{ background: V.surface, border: `1px solid ${V.line}`, color: V.ink, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 14px', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>◍</span> Game Summary
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {sortedAfter.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, display: 'inline-flex', alignItems: 'center', gap: 6, background: i === 0 ? `color-mix(in oklab, ${V.accent} 16%, ${V.bg2})` : V.bg2, border: `1px solid ${i === 0 ? `color-mix(in oklab, ${V.accent} 60%, transparent)` : V.line}`, padding: '5px 10px', borderRadius: 999 }}>
                {i === 0 && <span style={{ color: V.accent }}>★</span>}
                <Avatar player={p} size={18} />
                {p.displayName}
                <b style={{ color: i === 0 ? V.accent : V.ink, fontSize: 13 }}>{totalsAfter[p.id]}</b>
              </div>
            ))}
          </div>
        </header>

        {/* ─── Hero ─── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 14 }}>
          <div style={{ background: trump?.nt ? V.bg2 : 'linear-gradient(140deg, color-mix(in oklab, #e89a3c 86%, #d24a3d), #e89a3c)', border: trump?.nt ? `1px dashed ${V.accent}` : 'none', borderRadius: 20, padding: '20px 24px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 72, lineHeight: 1, color: trump?.nt ? V.accent : '#2a1620' }}>{trump?.glyph ?? '?'}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: trump?.nt ? V.muted : 'rgba(42,22,32,.65)' }}>
                {trump?.nt ? `No Trump · Round ${roundNumber}` : `Trump suit · Round ${roundNumber}`}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, letterSpacing: '-0.02em', color: trump?.nt ? V.accent : '#2a1620', marginTop: 2 }}>{trump?.name ?? '—'}</div>
            </div>
          </div>

          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Cards this round</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: V.ink, marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {cards}<small style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, fontWeight: 500, letterSpacing: '.1em' }}>{cards === 1 ? 'CARD' : 'CARDS'} EACH</small>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 8 }}>
              Bid sum was {players.reduce((acc, p) => acc + (pendingRound?.bids[p.id] ?? 0), 0)} · someone was off
            </div>
          </div>

          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Tricks taken vs cards</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', color: V.ink }}>{sumOfTricks}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: V.muted, fontWeight: 600 }}>/ <b style={{ color: V.ink }}>{cards}</b></span>
            </div>
            <div style={{ height: 8, background: V.bg2, borderRadius: 999, marginTop: 12, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, cards > 0 ? (sumOfTricks / cards) * 100 : 0)}%`, background: sumStatus === 'over' ? V.accent2 : sumStatus === 'exact' ? V.accent3 : V.accent, borderRadius: 999, transition: 'width .25s ease' }} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 10, padding: '6px 12px', borderRadius: 999, background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 22%, transparent)` : sumStatus === 'exact' ? `color-mix(in oklab, ${V.accent3} 22%, transparent)` : V.bg2, color: sumStatus === 'over' ? V.accent2 : sumStatus === 'exact' ? V.accent3 : V.ink2, border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 50%, transparent)` : sumStatus === 'exact' ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : V.line}` }}>
              {sumStatus === 'exact' ? '✓' : sumStatus === 'over' ? '▲' : '○'} {sumLabel}
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
                const taken = took[p.id]
                const bid = pendingRound?.bids[p.id] ?? 0
                const isActive = activeIdx === playerIdx
                const isDone = taken !== undefined
                const made = isDone && taken === bid
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
                          ? made
                            ? `color-mix(in oklab, ${V.accent3} 14%, ${V.bg2})`
                            : `color-mix(in oklab, ${V.accent2} 12%, ${V.bg2})`
                          : 'transparent',
                      border: `1.5px solid ${isActive ? V.accent : isDone ? (made ? `color-mix(in oklab, ${V.accent3} 55%, transparent)` : `color-mix(in oklab, ${V.accent2} 45%, transparent)`) : V.line}`,
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
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: made ? V.accent3 : V.accent2, letterSpacing: '-0.02em' }}>
                        {taken}
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
                background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 20%, transparent)` : sumStatus === 'exact' ? `color-mix(in oklab, ${V.accent3} 20%, transparent)` : V.bg2,
                color: sumStatus === 'over' ? V.accent2 : sumStatus === 'exact' ? V.accent3 : V.ink2,
                border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 45%, transparent)` : sumStatus === 'exact' ? `color-mix(in oklab, ${V.accent3} 45%, transparent)` : V.line}`,
              }}>
                <b style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '-0.01em' }}>{sumOfTricks}</b>
                <span style={{ opacity: 0.6 }}>/{cards}</span>
                <span style={{ opacity: 0.5, fontSize: 9 }}>·</span>
                <span style={{ fontSize: 10 }}>{entered < players.length ? `${players.length - entered} left` : sumStatus === 'exact' ? 'exact ✓' : sumStatus === 'over' ? `+${sumOverBy} over` : `${cards - sumOfTricks} short`}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
                <Avatar player={activePlayer} size={72} isDealer={activeIdx === dealerIdx} glow />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: V.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {activePlayer.displayName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {activeIdx === dealerIdx && (
                      <span style={{ background: `color-mix(in oklab, ${V.accent} 22%, transparent)`, color: V.accent, padding: '2px 8px', borderRadius: 999, fontWeight: 700, fontSize: 9, letterSpacing: '.16em' }}>DEALER</span>
                    )}
                    <span>
                      {activeTaken !== undefined
                        ? activeTaken === activeBid ? '● MADE' : '● MISSED'
                        : 'Tap tricks taken'}
                    </span>
                  </div>
                </div>
                {/* Bid indicator */}
                <div style={{ textAlign: 'center', flexShrink: 0, background: V.bg2, border: `1px solid ${V.line}`, borderRadius: 12, padding: '10px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 4 }}>BID</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: activeBid === 0 ? V.accent3 : V.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {activeBid}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent3, marginTop: 4, letterSpacing: '.08em' }}>← make this</div>
                </div>
                {activeTaken !== undefined && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, color: activeTaken === activeBid ? V.accent3 : V.accent2, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {activeTaken}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: activeTaken === activeBid ? V.accent3 : V.accent2, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>
                      {activeTaken === activeBid ? 'MADE' : 'MISSED'}
                    </div>
                  </div>
                )}
              </div>

              {/* Number buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Array.from({ length: cards + 1 }, (_, num) => {
                  const isSelected = activeTaken === num
                  const isMake = num === activeBid
                  return (
                    <button
                      key={num}
                      onClick={() => setPlayerTook(activePlayer.id, activeTaken === num ? undefined : num)}
                      style={{
                        flex: '1 0 auto',
                        minWidth: 56,
                        height: 64,
                        borderRadius: 12,
                        background: isSelected
                          ? (isMake ? `color-mix(in oklab, ${V.accent3} 35%, ${V.surface})` : `color-mix(in oklab, ${V.accent2} 35%, ${V.surface})`)
                          : isMake
                            ? `color-mix(in oklab, ${V.accent3} 10%, ${V.bg2})`
                            : V.bg2,
                        border: isSelected
                          ? `2px solid ${isMake ? V.accent3 : V.accent2}`
                          : isMake
                            ? `1.5px solid color-mix(in oklab, ${V.accent3} 50%, transparent)`
                            : `1px solid ${V.line}`,
                        color: isSelected
                          ? (isMake ? V.accent3 : V.accent2)
                          : isMake
                            ? V.accent3
                            : V.ink2,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 22,
                        cursor: 'pointer',
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
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: V.accent3 }}>
                {allValid ? 'All results in!' : 'All players entered'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
                {allValid ? 'Tap a chip to edit · lock the round below.' : 'Tricks don\'t add up yet — tap a chip to fix.'}
              </div>
            </div>
          )}
        </section>

        {/* ─── MVP + leaderboard ─── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 14, opacity: allValid ? 1 : 0.55, transition: 'opacity .3s ease' }}>
          {mvp ? (
            <div style={{ background: `color-mix(in oklab, ${V.accent} 10%, ${V.surface})`, border: `1px solid color-mix(in oklab, ${V.accent} 50%, transparent)`, borderRadius: 20, padding: '22px 24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.accent, marginBottom: 12 }}>★ Round MVP</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Avatar player={mvp.player} size={44} />
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: V.ink }}>{mvp.player.displayName}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginBottom: 8 }}>
                Bid <b style={{ color: V.ink }}>{mvp.bid}</b> · took <b style={{ color: V.ink }}>{mvp.took}</b> · earned the most points this round
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 42, letterSpacing: '-0.02em', color: V.accent }}>
                +{mvp.pts}<small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', color: V.muted, marginLeft: 8 }}>POINTS</small>
              </div>
            </div>
          ) : (
            <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '22px 24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginBottom: 12 }}>Round MVP</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, marginBottom: 8 }}>Pending — no one&apos;s made their bid yet</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>The biggest single-round scorer lands here when results are in.</div>
            </div>
          )}

          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink }}>Standings · after this round</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: allValid ? V.accent3 : V.muted }}>{allValid ? 'Locked' : 'Live · updating'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedAfter.map(p => {
                const rkBefore = ranksBefore[p.id]?.rank ?? 0
                const rkAfter = ranksAfter[p.id]?.rank ?? 0
                const delta = rkBefore - rkAfter
                const gain = totalsAfter[p.id] - totalsBefore[p.id]
                const isLeader = p.id === leaderId
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLeader ? `color-mix(in oklab, ${V.accent} 8%, ${V.bg2})` : V.bg2, border: `1px solid ${isLeader ? `color-mix(in oklab, ${V.accent} 40%, transparent)` : V.line}`, borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: isLeader ? V.accent : V.muted, width: 28 }}>
                      {formatRank(ranksAfter[p.id])}
                    </div>
                    <Avatar player={p} size={26} />
                    <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: V.ink }}>{p.displayName}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: isLeader ? V.accent : V.ink }}>
                      {totalsAfter[p.id]}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginLeft: 4, color: gain === 0 ? V.muted : V.accent3 }}>
                        {gain > 0 ? `+${gain}` : gain === 0 ? '—' : gain}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: delta > 0 ? V.accent3 : delta < 0 ? V.accent2 : V.muted, width: 52, textAlign: 'right' }}>
                      {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '— same'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${V.line}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.06em', lineHeight: 1.55 }}>
            {!allValid
              ? <>Sum must equal <b style={{ color: V.ink }}>{cards}</b> tricks before the next round can start.</>
              : <>Results locked. <b style={{ color: V.ink }}>Round {roundNumber + 1}</b> is up next{mvp ? ` · ${mvp.player.displayName} carries the round MVP` : ''}.</>
            }
          </div>
          <button
            onClick={handleLockResults}
            disabled={!allValid || saving}
            style={{
              background: allValid ? V.accent : V.surface,
              border: `1px solid ${allValid ? 'transparent' : V.line}`,
              borderRadius: 14,
              padding: '16px 26px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              color: allValid ? '#2a1620' : V.muted,
              cursor: allValid && !saving ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: allValid ? '0 8px 20px -8px rgba(232,154,60,.4)' : 'none',
              transition: 'all .2s ease',
            }}
          >
            {saving ? 'Saving…' : 'Next Round'}
            {!saving && <span style={{ fontSize: 18 }}>→</span>}
          </button>
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
