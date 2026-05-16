import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import GameTimer from './GameTimer'
import SummaryModal from './SummaryModal'
import {
  TRUMPS,
  computeTotals,
  computeRanks,
  scoreFor,
  playerStreaks,
} from '../../lib/gameLogic'

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

export default function PlayingScreen({
  game, players, completedRounds, pendingRound,
  roundNumber, trump, dealerIdx, endGame, onEnterResults,
}) {
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [expanded, setExpanded] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [burdenView, setBurdenView] = useState('career') // 'recent' | 'career'

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  function togglePause() {
    if (paused) {
      setPaused(false)
      setPausedAt(null)
    } else {
      setPaused(true)
      setPausedAt(Date.now())
    }
  }

  const pauseSec = paused && pausedAt ? Math.floor((now - pausedAt) / 1000) : 0
  const pauseMm = String(Math.floor(pauseSec / 60)).padStart(2, '0')
  const pauseSs = String(pauseSec % 60).padStart(2, '0')

  const variant = game.scoring_variant
  const totals = computeTotals(players, completedRounds, variant)
  const ranks = computeRanks(players, totals)
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])
  const leaderId = sorted[0]?.id

  const cards = pendingRound?.cards ?? 0
  const sumOfBids = players.reduce((acc, p) => acc + (pendingRound?.bids[p.id] ?? 0), 0)
  const overBy = sumOfBids - cards
  const sumStatus = overBy > 0 ? 'over' : 'under'
  const sumLabel = overBy > 0
    ? `OVER · ${overBy} EXTRA BID${overBy > 1 ? 'S' : ''}`
    : `UNDER · ${cards - sumOfBids} SHORT`

  // Stats — hottest streak
  const streakData = players.map(p => ({
    player: p,
    streak: playerStreaks(p.id, completedRounds).madeBest,
  })).sort((a, b) => b.streak - a.streak)
  const topStreak = streakData[0] ?? { player: players[0], streak: 0 }

  // Stats — biggest bid across all rounds so far
  const allRounds = pendingRound ? [...completedRounds, pendingRound] : completedRounds
  let biggest = { player: players[0], bid: 0, made: null, roundNumber: 0 }
  for (const r of allRounds) {
    for (const p of players) {
      const b = r.bids[p.id] ?? 0
      if (b > biggest.bid) {
        biggest = {
          player: p, bid: b,
          made: r.took ? (r.bids[p.id] === r.took[p.id]) : null,
          roundNumber: r.roundNumber,
        }
      }
    }
  }

  // Stats — dealer burden: recent 3 and career
  const recent3 = completedRounds.slice(-3).reverse().map(r => {
    const dealer = players.find(p => p.id === r.dealerId)
    if (!dealer) return null
    return { round: r, dealer, bid: r.bids[r.dealerId], took: r.took[r.dealerId], made: r.bids[r.dealerId] === r.took[r.dealerId] }
  }).filter(Boolean)

  const dealingStats = players.map(p => {
    const dealRounds = completedRounds.filter(r => r.dealerId === p.id)
    const madeCount = dealRounds.filter(r => r.bids[r.dealerId] === r.took[r.dealerId]).length
    return { player: p, dealt: dealRounds.length, made: madeCount, pct: dealRounds.length > 0 ? Math.round((madeCount / dealRounds.length) * 100) : null }
  })

  const tabRounds = expanded ? completedRounds : completedRounds.slice(-5)

  async function handleEndGame() {
    setSummaryOpen(false)
    try { await endGame() } catch (_) {}
  }

  return (
    <>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 32px 32px', minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto auto auto auto auto auto auto', gap: 20 }}>

        {/* ─── Top bar ─── */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
              Ka<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Chu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />Fu<span style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />L
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
              {game.name ? `${game.name} · ` : ''}Round {roundNumber} · playing
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GameTimer startedAt={game.started_at} />
            <button onClick={() => setSummaryOpen(true)} style={{ background: V.surface, border: `1px solid ${V.line}`, color: V.ink, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 14px', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>◍</span> Game Summary
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {sorted.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, display: 'inline-flex', alignItems: 'center', gap: 6, background: i === 0 ? `color-mix(in oklab, ${V.accent} 16%, ${V.bg2})` : V.bg2, border: `1px solid ${i === 0 ? `color-mix(in oklab, ${V.accent} 60%, transparent)` : V.line}`, padding: '5px 10px', borderRadius: 999 }}>
                {i === 0 && <span style={{ color: V.accent }}>★</span>}
                <Avatar player={p} size={18} />
                {p.displayName}
                <b style={{ color: i === 0 ? V.accent : V.ink, fontSize: 13 }}>{totals[p.id]}</b>
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
                {trump?.nt ? `No Trump · Round ${roundNumber}` : `Trump · Round ${roundNumber}`}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, letterSpacing: '-0.02em', color: trump?.nt ? V.accent : '#2a1620', marginTop: 2 }}>{trump?.name ?? '—'}</div>
            </div>
          </div>

          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Cards in hand</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: V.ink, marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {cards}<small style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.muted, fontWeight: 500, letterSpacing: '.1em' }}>{cards === 1 ? 'CARD' : 'CARDS'}</small>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 8 }}>
              Bid sum was {sumOfBids} · someone was off
            </div>
          </div>

          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Bid sum vs cards</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', color: V.ink }}>{sumOfBids}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: V.muted, fontWeight: 600 }}>/ <b style={{ color: V.ink }}>{cards}</b></span>
            </div>
            <div style={{ height: 8, background: V.bg2, borderRadius: 999, marginTop: 12, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, cards > 0 ? (sumOfBids / cards) * 100 : 0)}%`, background: sumStatus === 'over' ? V.accent2 : V.accent, borderRadius: 999, transition: 'width .25s ease' }} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 10, padding: '6px 12px', borderRadius: 999, background: sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 22%, transparent)` : V.bg2, color: sumStatus === 'over' ? V.accent2 : V.ink2, border: `1px solid ${sumStatus === 'over' ? `color-mix(in oklab, ${V.accent2} 50%, transparent)` : V.line}` }}>
              {sumStatus === 'over' ? '▲' : '○'} {sumLabel}
            </div>
          </div>
        </section>

        {/* ─── Locked bids grid ─── */}
        <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, marginBottom: 16 }}>
            Bids locked in
            <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
              {sumOfBids} of {cards} called · {overBy > 0 ? `${overBy} over` : `${cards - sumOfBids} short`}
            </small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {players.map((p, i) => (
              <div
                key={p.id}
                style={{
                  background: i === dealerIdx ? `color-mix(in oklab, ${V.accent} 12%, ${V.bg2})` : V.bg2,
                  border: `1px solid ${i === dealerIdx ? V.accent : V.line}`,
                  borderRadius: 16,
                  padding: '16px 20px',
                  position: 'relative',
                }}
              >
                {i === dealerIdx && (
                  <div style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', background: `color-mix(in oklab, ${V.accent} 22%, transparent)`, color: V.accent, padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>DEALER</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Avatar player={p} size={32} isDealer={i === dealerIdx} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: V.ink }}>{p.displayName}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, color: pendingRound?.bids[p.id] === 0 ? V.accent3 : V.ink, fontFeatureSettings: '"tnum"' }}>
                  {pendingRound?.bids[p.id] ?? '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
                  {pendingRound?.bids[p.id] === 0 ? 'NIL CALL' : `BID ${pendingRound?.bids[p.id] === 1 ? 'TRICK' : 'TRICKS'}`}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Running tab ─── */}
        <section style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: V.ink, margin: 0 }}>
              The running tab
              <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 10, fontWeight: 500 }}>
                {tabRounds.length} of {completedRounds.length + 1} rounds · in play
              </small>
            </h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>
              Made <span style={{ color: V.accent3 }}>●</span> · Missed <span style={{ color: V.accent2 }}>●</span>
            </span>
          </div>
          <div style={{ borderTop: `1px solid ${V.line}`, background: V.bg2, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 72, textAlign: 'left', paddingLeft: 16, padding: '10px 6px', background: V.surface, color: V.muted, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}` }}>Round</th>
                  {players.map((p, pi) => (
                    <th key={p.id} style={{ padding: '10px 6px', background: V.surface, textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                      <Avatar player={p} size={28} />
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: pi === dealerIdx ? V.accent : V.ink, display: 'block', marginTop: 3, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabRounds.map(r => {
                  const tr = TRUMPS.find(t => t.id === r.trump)
                  return (
                    <tr key={r.id}>
                      <td style={{ textAlign: 'left', paddingLeft: 16, padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink }}>
                        R{r.roundNumber}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginLeft: 4 }}><span style={{ color: tr?.red ? '#e57860' : undefined }}>{tr?.glyph}</span> {r.cards}</span>
                      </td>
                      {players.map((p, pi) => {
                        const b = r.bids[p.id], k = r.took?.[p.id]
                        const made = b !== undefined && k !== undefined && b === k
                        const pts = b !== undefined && k !== undefined ? scoreFor(b, k, variant) : null
                        return (
                          <td key={p.id} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', background: pts === null ? 'transparent' : made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)` }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: pts === null ? V.muted : made ? V.accent3 : V.accent2 }}>{pts === null ? '—' : made ? `+${pts}` : '0'}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.ink2, opacity: .75 }}>{b ?? '—'}/{k ?? '—'}</span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {/* Current round — in play */}
                <tr>
                  <td style={{ textAlign: 'left', paddingLeft: 16, padding: '8px 6px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.accent }}>
                    R{roundNumber}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.accent, opacity: .8, marginLeft: 4 }}>{trump?.glyph} {cards}</span>
                  </td>
                  {players.map((p, pi) => (
                    <td key={p.id} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', background: `color-mix(in oklab, ${V.accent} 8%, transparent)` }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: V.muted }}>in play</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.accent, opacity: .7 }}>{pendingRound?.bids[p.id] ?? '—'}/—</span>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '10px 6px', paddingLeft: 16, background: V.surface, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}>TOTAL</td>
                  {players.map((p, pi) => (
                    <td key={p.id} style={{ padding: '10px 6px', background: V.surface, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: p.id === leaderId ? V.accent : V.ink, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                      {totals[p.id]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', paddingLeft: 16, background: V.bg2, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}>RANK</td>
                  {players.map((p, pi) => (
                    <td key={p.id} style={{ padding: '8px 6px', background: V.bg2, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: p.id === leaderId ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                      {formatRank(ranks[p.id])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {completedRounds.length > 5 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12, borderTop: `1px solid ${V.line}`, background: V.bg2 }}>
              <button onClick={() => setExpanded(e => !e)} style={{ background: 'transparent', border: `1px solid ${V.line}`, color: V.ink2, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {expanded ? 'Collapse' : `See all ${completedRounds.length} rounds`}
                <span style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}>↓</span>
              </button>
            </div>
          )}
        </section>

        {/* ─── Stats row ─── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {/* Hottest streak */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Hottest streak</div>
            {completedRounds.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <Avatar player={topStreak.player} size={36} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.ink, lineHeight: 1 }}>{topStreak.streak}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>/{completedRounds.length} rounds made</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 10 }}>
                  <b style={{ color: V.ink }}>{topStreak.player.displayName}</b> · {topStreak.streak} in a row
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 12 }}>No completed rounds yet</div>
            )}
          </div>

          {/* Biggest bid */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Biggest bid called</div>
            {biggest.bid > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <Avatar player={biggest.player} size={36} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.ink, lineHeight: 1 }}>{biggest.bid}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, marginTop: 2 }}>{biggest.bid === 1 ? 'TRICK' : 'TRICKS'}</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.ink2, marginTop: 10 }}>
                  <b style={{ color: V.ink }}>{biggest.player.displayName}</b> in R{biggest.roundNumber}
                  {biggest.made === true ? ' · and made it' : biggest.made === false ? ' · and missed' : ' · playing now'}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, marginTop: 12 }}>No bids yet</div>
            )}
          </div>

          {/* Dealer's burden */}
          <div style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted }}>Dealer's burden</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['recent', 'career'].map(v => (
                  <button key={v} onClick={() => setBurdenView(v)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${burdenView === v ? V.accent : V.line}`, background: burdenView === v ? `color-mix(in oklab, ${V.accent} 18%, ${V.surface})` : 'transparent', color: burdenView === v ? V.accent : V.muted, textTransform: 'uppercase' }}>
                    {v === 'recent' ? 'Recent 3' : 'By player'}
                  </button>
                ))}
              </div>
            </div>
            {burdenView === 'recent' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recent3.length === 0 ? (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted }}>No completed rounds yet</div>
                ) : recent3.map(({ round: r, dealer, bid, took, made }) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: V.bg2, border: `1px solid ${made ? `color-mix(in oklab, ${V.accent3} 50%, transparent)` : `color-mix(in oklab, ${V.accent2} 50%, transparent)`}`, borderRadius: 10, padding: '8px 12px' }}>
                    <Avatar player={dealer} size={28} isDealer />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: V.ink }}>{dealer.displayName}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted }}>R{r.roundNumber} · {bid}/{took}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: made ? V.accent3 : V.accent2 }}>{made ? 'MADE' : 'MISS'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dealingStats.map(s => (
                  <div key={s.player.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar player={s.player} size={22} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: V.ink, flex: 1 }}>{s.player.displayName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted }}>{s.dealt}× dealt</span>
                    {s.dealt > 0 ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: s.pct >= 50 ? V.accent3 : V.accent2 }}>{s.made}/{s.dealt} · {s.pct}%</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted }}>—</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${V.line}` }}>
          <button
            onClick={togglePause}
            style={{
              background: paused ? `color-mix(in oklab, ${V.accent2} 18%, transparent)` : 'transparent',
              border: `1px solid ${paused ? V.accent2 : V.line}`,
              color: paused ? V.accent2 : V.ink2,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              padding: '12px 20px',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              justifySelf: 'start',
            }}
          >
            <span style={{ fontSize: 14 }}>{paused ? '▶' : '☕'}</span>
            {paused ? 'Resume' : 'Pause for chai'}
          </button>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: V.muted, letterSpacing: '.06em', textAlign: 'center', lineHeight: 1.55 }}>
            {paused
              ? <>Paused at <b style={{ color: V.ink }}>{pauseMm}:{pauseSs}</b> · take your time</>
              : <>When the cards are played out, tap <b style={{ color: V.ink }}>Enter Round Results →</b></>}
          </div>

          <button
            onClick={onEnterResults}
            style={{
              background: V.accent,
              border: 'none',
              borderRadius: 14,
              padding: '16px 26px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              color: '#2a1620',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              justifySelf: 'end',
              boxShadow: '0 8px 20px -8px rgba(232,154,60,.4)',
            }}
          >
            Enter Round Results <span style={{ fontSize: 18 }}>→</span>
          </button>
        </footer>
      </div>

      {/* ─── Pause overlay ─── */}
      <div
        onClick={togglePause}
        style={{
          position: 'fixed', inset: 0,
          background: 'color-mix(in oklab, var(--color-bg, #2a1620) 88%, black)',
          backdropFilter: 'blur(8px)',
          zIndex: 50,
          display: 'grid',
          placeItems: 'center',
          opacity: paused ? 1 : 0,
          pointerEvents: paused ? 'auto' : 'none',
          transition: 'opacity .25s ease',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: V.surface,
            border: `1px solid ${V.accent}`,
            borderRadius: 28,
            padding: '48px 56px',
            textAlign: 'center',
            maxWidth: 480,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,.6)',
            transform: paused ? 'scale(1)' : 'scale(.92)',
            transition: 'transform .25s ease',
          }}
        >
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>☕</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: V.muted, marginBottom: 6 }}>
            PAUSED <b style={{ color: V.ink, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', textTransform: 'none', display: 'block' }}>{pauseMm}:{pauseSs}</b>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: V.accent, margin: '0 0 10px' }}>Chai break.</h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: V.ink2, letterSpacing: '.04em', lineHeight: 1.55, margin: '0 0 24px' }}>
            Round {roundNumber} on hold · {trump?.name} trump · {cards} cards in hand. Resume when everyone's ready.
          </p>
          <button
            onClick={togglePause}
            style={{ background: V.accent, border: 'none', borderRadius: 12, padding: '14px 28px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: '#2a1620', cursor: 'pointer', letterSpacing: '-0.01em' }}
          >
            ▶ Resume Round
          </button>
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
    </>
  )
}
