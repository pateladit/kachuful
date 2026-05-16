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
  { id: 'diamonds', glyph: '♦', name: 'Chu',      label: 'Diamonds · Chu', red: true,  nt: false },
  { id: 'clubs',    glyph: '♣', name: 'Fu',       label: 'Clubs · Fu',     red: false, nt: false },
  { id: 'hearts',   glyph: '♥', name: 'Laal',     label: 'Hearts · Laal',  red: true,  nt: false },
  { id: 'none',     glyph: '⚬', name: 'No Trump', label: 'NT',             red: false, nt: true  },
]

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
