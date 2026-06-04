// Ka Chu Fu L — pure game logic
// Extracted from game-data.js. No test data, no timers, no DOM.

export const PLAYER_COLORS = [
  '#e89a3c', // amber
  '#d24a3d', // crimson
  '#b6c97a', // lime
  '#e57860', // coral
  '#a78bfa', // violet
  '#3a9d8a', // teal
  '#f4a261', // peach
  '#c98b9c', // mauve
  '#4fc3f7', // sky
  '#ffd166', // gold
  '#06d6a0', // mint
  '#c77dff', // lavender
]

// Array indexed by trump rotation position (0–4).
// id matches the trump_suit values stored in the rounds table.
export const TRUMPS = [
  { id: 'spades',   glyph: '♠', name: 'Ka',       label: 'Spades · Ka',    red: false, nt: false },
  { id: 'diamonds', glyph: '♦', name: 'Cha',      label: 'Diamonds · Cha', red: true,  nt: false },
  { id: 'clubs',    glyph: '♣', name: 'Fu',       label: 'Clubs · Fu',     red: false, nt: false },
  { id: 'hearts',   glyph: '♥', name: 'Laal',     label: 'Hearts · Laal',  red: true,  nt: false },
  { id: 'none',     glyph: '⚬', name: 'No Trump', label: 'NT',             red: false, nt: true  },
]

export const trumpById = new Map(TRUMPS.map(t => [t.id, t]))

// For each name, return the shortest prefix unique among all names.
export function disambiguateInitials(names) {
  const lower = names.map(n => n.toLowerCase())
  return names.map((name, i) => {
    let len = 1
    while (len < name.length) {
      const prefix = lower[i].slice(0, len)
      const clashes = lower.some((other, j) => j !== i && other.slice(0, len) === prefix)
      if (!clashes) break
      len++
    }
    return name.slice(0, len).charAt(0).toUpperCase() + name.slice(1, len)
  })
}

// variant: 1 = Classic (10+took), 2 = Bid+1 ((10×took)+1), 3 = Bid+1·Nil=10
export function scoreFor(bid, took, variant) {
  if (bid !== took) return 0
  if (variant === 1) return 10 + took
  if (variant === 2) return 10 * took + 1
  if (variant === 3) return took === 0 ? 10 : 10 * took + 1
  return 0
}

// players: [{ id, ... }]
// rounds:  [{ bids: { [playerId]: n }, took: { [playerId]: n } | null }]
export function computeTotals(players, rounds, variant) {
  const totals = {}
  for (const p of players) totals[p.id] = 0
  for (const r of rounds) {
    if (!r.took) continue
    for (const p of players) {
      totals[p.id] += scoreFor(r.bids[p.id], r.took[p.id], variant)
    }
  }
  return totals
}

// Standard competition ranking (1, 2, 2, 4…). Tied entries flagged.
// totals: { [playerId]: number }
export function computeRanks(players, totals) {
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id])
  const ranks = {}
  let prevScore = null
  let prevRank = 0
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]
    const score = totals[p.id]
    if (score === prevScore) {
      ranks[p.id] = { rank: prevRank, tied: false }
    } else {
      prevRank = i + 1
      prevScore = score
      ranks[p.id] = { rank: prevRank, tied: false }
    }
  }
  // Second pass: mark which ranks have multiple holders.
  const counts = {}
  for (const id in ranks) counts[ranks[id].rank] = (counts[ranks[id].rank] || 0) + 1
  for (const id in ranks) ranks[id].tied = counts[ranks[id].rank] > 1
  return ranks
}

// Returns { madeBest, missedBest, currentMade, currentMissed }
export function playerStreaks(playerId, rounds) {
  let madeBest = 0, missedBest = 0
  let curMade = 0, curMissed = 0
  for (const r of rounds) {
    if (!r.took) continue
    const made = r.bids[playerId] === r.took[playerId]
    if (made) {
      curMade++; curMissed = 0
      madeBest = Math.max(madeBest, curMade)
    } else {
      curMissed++; curMade = 0
      missedBest = Math.max(missedBest, curMissed)
    }
  }
  return { madeBest, missedBest, currentMade: curMade, currentMissed: curMissed }
}

// Returns { made, total, pct }
export function playerAccuracy(playerId, rounds) {
  let made = 0, total = 0
  for (const r of rounds) {
    if (!r.took) continue
    total++
    if (r.bids[playerId] === r.took[playerId]) made++
  }
  return { made, total, pct: total > 0 ? Math.round((made / total) * 100) : 0 }
}

// Returns { [trumpId]: { made, total, pct } }
export function trumpPerformance(playerId, rounds) {
  const out = {}
  for (const t of TRUMPS) {
    out[t.id] = { made: 0, total: 0, pct: null }
  }
  for (const r of rounds) {
    if (!r.took || !out[r.trump]) continue
    out[r.trump].total++
    if (r.bids[playerId] === r.took[playerId]) out[r.trump].made++
  }
  for (const key in out) {
    const s = out[key]
    s.pct = s.total > 0 ? Math.round((s.made / s.total) * 100) : null
  }
  return out
}

// Card count for a given 1-based round number.
// Leg 1 (ascending):  start, start+1, …, peak  (peak-start+1 rounds)
// Leg 2 (descending): peak-1, …, 1             (peak-1 rounds)
// Leg 3+ (repeating cycle of 2*(peak-1)): 2→peak, peak-1→1
export function computeCardsForRound(roundNumber, startCards, peakCards) {
  const leg1Length = peakCards - startCards + 1
  if (roundNumber <= leg1Length) {
    return startCards + roundNumber - 1
  }
  const afterLeg1 = roundNumber - leg1Length - 1 // 0-based into leg 2+
  const leg2Length = peakCards - 1
  if (afterLeg1 < leg2Length) {
    return peakCards - 1 - afterLeg1
  }
  const cycleLength = 2 * (peakCards - 1)
  const pos = (afterLeg1 - leg2Length) % cycleLength
  if (pos < peakCards - 1) {
    return 2 + pos // ascending 2→peak
  }
  return peakCards - 1 - (pos - (peakCards - 1)) // descending peak-1→1
}

// Number of rounds in the first full loop (start→peak→1).
export function defaultLoopRounds(startCards, peakCards) {
  return (peakCards - startCards + 1) + (peakCards - 1)
}

// Trump entry for a given 1-based round number. Returns a TRUMPS element.
export function computeTrumpForRound(roundNumber, noTrumpRound) {
  const cycleLength = noTrumpRound ? 5 : 4
  return TRUMPS[(roundNumber - 1) % cycleLength]
}

// Dealer seat index (0-based) for a given 1-based round number.
export function computeDealerSeat(roundNumber, firstDealerSeat, playerCount) {
  return (firstDealerSeat + (roundNumber - 1)) % playerCount
}

// Zero-bid performance, split by card group (≤4 = small, 5+ = large).
// Returns { overall:{count,made,pct}, small:{count,made,pct}, large:{count,made,pct} }
export function nilBidStats(playerId, rounds) {
  const mk = () => ({ count: 0, made: 0, pct: null })
  const s = { overall: mk(), small: mk(), large: mk() }
  for (const r of rounds) {
    if (!r.took || r.bids[playerId] !== 0) continue
    const grp = r.cards <= 4 ? 'small' : 'large'
    const made = r.took[playerId] === 0
    s.overall.count++; if (made) s.overall.made++
    s[grp].count++;    if (made) s[grp].made++
  }
  for (const k of ['overall', 'small', 'large']) {
    const g = s[k]; g.pct = g.count > 0 ? Math.round((g.made / g.count) * 100) : null
  }
  return s
}

// Per card-count and grouped (1–4 / 5+) accuracy.
// Returns { byCnt:{[n]:{rounds,made,pct}}, small:{rounds,made,pct}, large:{rounds,made,pct} }
export function cardCountStats(playerId, rounds) {
  const byCnt = {}
  const small = { rounds: 0, made: 0 }
  const large = { rounds: 0, made: 0 }
  for (const r of rounds) {
    if (!r.took) continue
    const cnt = r.cards
    if (!byCnt[cnt]) byCnt[cnt] = { rounds: 0, made: 0, pct: null }
    const made = r.bids[playerId] === r.took[playerId]
    byCnt[cnt].rounds++; if (made) byCnt[cnt].made++
    if (cnt <= 4) { small.rounds++; if (made) small.made++ }
    else          { large.rounds++; if (made) large.made++ }
  }
  for (const k in byCnt) {
    const g = byCnt[k]; g.pct = g.rounds > 0 ? Math.round((g.made / g.rounds) * 100) : null
  }
  return {
    byCnt,
    small: { ...small, pct: small.rounds > 0 ? Math.round((small.made / small.rounds) * 100) : null },
    large: { ...large, pct: large.rounds > 0 ? Math.round((large.made / large.rounds) * 100) : null },
  }
}

// Times as dealer and bid accuracy when dealing.
// Rounds have dealerId (set by useGame.js from rounds.dealer_id).
// Returns { total, made, pct }
export function dealerBurden(playerId, rounds) {
  let total = 0, made = 0
  for (const r of rounds) {
    if (!r.took || r.dealerId !== playerId) continue
    total++
    if (r.bids[playerId] === r.took[playerId]) made++
  }
  return { total, made, pct: total > 0 ? Math.round((made / total) * 100) : null }
}

// Highest score earned in a single completed round, or null.
export function bestRoundScore(playerId, rounds, variant) {
  let best = null
  for (const r of rounds) {
    if (!r.took) continue
    const s = scoreFor(r.bids[playerId], r.took[playerId], variant)
    if (s > 0 && (best === null || s > best)) best = s
  }
  return best
}

// Trump suit the player performs best at (most accurate, min 1 round played).
// Returns { id, glyph, name, pct, made, total } or null.
export function favoriteTrump(playerId, rounds) {
  const perf = trumpPerformance(playerId, rounds)
  let best = null
  for (const [id, s] of Object.entries(perf)) {
    if (s.total === 0) continue
    if (!best || s.pct > best.pct) {
      const t = TRUMPS.find(tr => tr.id === id)
      best = { id, glyph: t?.glyph, name: t?.name, made: s.made, total: s.total, pct: s.pct }
    }
  }
  return best
}

// Average bid as a fraction of cards dealt (0–1), or null if no rounds.
// Higher = more aggressive bidder.
export function avgBidRatio(playerId, rounds) {
  let total = 0, count = 0
  for (const r of rounds) {
    if (!r.took || r.cards === 0) continue
    total += (r.bids[playerId] ?? 0) / r.cards
    count++
  }
  return count > 0 ? total / count : null
}

// Average (bid − took) per round. Positive = overbids, negative = underbids.
export function netBidDrift(playerId, rounds) {
  let total = 0, count = 0
  for (const r of rounds) {
    if (!r.took) continue
    total += (r.bids[playerId] ?? 0) - (r.took[playerId] ?? 0)
    count++
  }
  return count > 0 ? total / count : null
}

// Rank change for all players from mid-game (N/2 rounds) to end.
// Returns { [playerId]: change } where positive = improved rank.
// Returns null if rounds.length < 4.
export function allMidGameRankChanges(players, rounds, variant) {
  if (rounds.length < 4) return null
  const mid      = Math.floor(rounds.length / 2)
  const midTotals = computeTotals(players, rounds.slice(0, mid), variant)
  const endTotals = computeTotals(players, rounds, variant)
  const midRanks  = computeRanks(players, midTotals)
  const endRanks  = computeRanks(players, endTotals)
  const result = {}
  for (const p of players) {
    const mRank = midRanks[p.id]?.rank ?? players.length
    const eRank = endRanks[p.id]?.rank ?? players.length
    result[p.id] = mRank - eRank // positive = climbed the table
  }
  return result
}

// Count of completed rounds where the player missed by exactly 1 trick.
export function closestCallCount(playerId, rounds) {
  let count = 0
  for (const r of rounds) {
    if (!r.took) continue
    if (Math.abs((r.bids[playerId] ?? 0) - r.took[playerId]) === 1) count++
  }
  return count
}

// Group bid statistics across all completed rounds.
// Returns { loneWolfRounds, mostChaotic, overRounds, underRounds, totalTricks }
// mostChaotic: { roundNumber, cards, trump, failCount } | null — round where most players failed.
// overRounds/underRounds: rounds where sum(bids) > or < cards_dealt (computed on all rounds, not just completed).
export function groupBidStats(players, rounds) {
  let loneWolfRounds = 0, overRounds = 0, underRounds = 0, totalTricks = 0
  let mostChaotic = null
  for (const r of rounds) {
    totalTricks += r.cards ?? 0
    const bidSum = players.reduce((s, p) => s + (r.bids[p.id] ?? 0), 0)
    if (bidSum > r.cards) overRounds++
    else if (bidSum < r.cards) underRounds++
    if (!r.took) continue
    const failCount = players.filter(p => r.bids[p.id] !== r.took[p.id]).length
    if (failCount === 1) loneWolfRounds++
    if (!mostChaotic || failCount > mostChaotic.failCount) {
      mostChaotic = { roundNumber: r.roundNumber, cards: r.cards, trump: r.trump, failCount }
    }
  }
  return { loneWolfRounds, mostChaotic, overRounds, underRounds, totalTricks }
}

// Group accuracy per trump suit across all completed rounds.
// Returns array of { id, glyph, name, made, total, pct }, filtered to suits with data, sorted by total desc.
export function groupTrumpStats(players, rounds) {
  const acc = {}
  for (const t of TRUMPS) acc[t.id] = { id: t.id, glyph: t.glyph, name: t.name, made: 0, total: 0 }
  for (const r of rounds) {
    if (!r.took || !acc[r.trump]) continue
    for (const p of players) {
      acc[r.trump].total++
      if (r.bids[p.id] === r.took[p.id]) acc[r.trump].made++
    }
  }
  return Object.values(acc)
    .filter(t => t.total > 0)
    .map(t => ({ ...t, pct: Math.round((t.made / t.total) * 100) }))
    .sort((a, b) => b.total - a.total)
}
