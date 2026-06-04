import {
  playerAccuracy, playerStreaks, nilBidStats, avgBidRatio,
  bestRoundScore, closestCallCount, netBidDrift,
  computeTotals, allMidGameRankChanges,
} from './gameLogic'

const C = {
  lime:  'var(--color-accent-3, #b6c97a)',
  amber: 'var(--color-accent,   #e89a3c)',
  red:   'var(--color-accent-2, #d24a3d)',
  muted: 'var(--color-muted,    #9b7c6b)',
}

// 12 merit titles + 2 fallbacks
export const TITLE_DEFS = [
  { key: 'oracle',      label: 'The Oracle',     icon: '◎',  color: C.lime,  desc: 'Called it every time'                      },
  { key: 'hothand',     label: 'Hot Hand',        icon: '◉',  color: C.lime,  desc: 'On fire — couldn\'t miss if they tried'    },
  { key: 'nil',         label: 'Nil Hero',        icon: '○',  color: C.lime,  desc: 'Zero is a flex · held their nerve'          },
  { key: 'gambler',     label: 'The Gambler',     icon: '◈',  color: C.amber, desc: 'Always swinging for the fences'            },
  { key: 'miser',       label: 'The Miser',       icon: '◇',  color: C.amber, desc: 'The art of never committing'               },
  { key: 'peak',        label: 'Peak Scorer',     icon: '△',  color: C.amber, desc: 'One perfect round that changed everything' },
  { key: 'closest',     label: 'Closest Call',    icon: '±',  color: C.amber, desc: 'One trick shy, every single time'          },
  { key: 'comeback',    label: 'The Comeback',    icon: '↑',  color: C.lime,  desc: 'Down at half · unstoppable at the end'     },
  { key: 'fader',       label: 'The Fader',       icon: '↓',  color: C.red,   desc: 'Led early · ran out of steam'              },
  { key: 'icecold',     label: 'Ice Cold',        icon: '❄',  color: C.red,   desc: 'The universe conspired against them'       },
  { key: 'philosopher', label: 'The Philosopher', icon: '≋',  color: C.red,   desc: 'Thought too hard · bid more than they got' },
  { key: 'darkhorse',   label: 'The Dark Horse',  icon: '◐',  color: C.lime,  desc: 'Promised little · delivered everything'    },
  { key: 'woodenspoon', label: 'Wooden Spoon',    icon: '🥄', color: C.muted, desc: 'Finished last · but showed up'             },
  { key: 'averagejoe',  label: 'Average Joe',     icon: '◦',  color: C.muted, desc: 'Steady · consistent · dependable'          },
]

export const TITLE_BY_KEY = new Map(TITLE_DEFS.map(d => [d.key, d]))

// ─── Internal helpers ──────────────────────────────────────────────────────────

function buildMetrics(players, rounds, variant) {
  const rankChanges = allMidGameRankChanges(players, rounds, variant)
  const m = {}
  for (const p of players) {
    const acc  = playerAccuracy(p.id, rounds)
    const str  = playerStreaks(p.id, rounds)
    const nil  = nilBidStats(p.id, rounds)
    m[p.id] = {
      accuracyPct:  acc.pct,
      madeBest:     str.madeBest,
      missedBest:   str.missedBest,
      nilMade:      nil.overall.made,
      bidRatio:     avgBidRatio(p.id, rounds),
      bestScore:    bestRoundScore(p.id, rounds, variant),
      closestCalls: closestCallCount(p.id, rounds),
      bidDrift:     netBidDrift(p.id, rounds),
      rankChange:   rankChanges ? (rankChanges[p.id] ?? null) : null,
    }
  }
  return m
}

function topBy(players, metrics, getVal, minThreshold = null) {
  const entries = players
    .map(p => ({ id: p.id, v: getVal(metrics[p.id]) }))
    .filter(e => e.v !== null && e.v !== undefined &&
      (minThreshold === null || e.v > minThreshold))
  if (!entries.length) return []
  const best = Math.max(...entries.map(e => e.v))
  return entries.filter(e => e.v === best).map(e => e.id)
}

function bottomBy(players, metrics, getVal, maxThreshold = null) {
  const entries = players
    .map(p => ({ id: p.id, v: getVal(metrics[p.id]) }))
    .filter(e => e.v !== null && e.v !== undefined &&
      (maxThreshold === null || e.v < maxThreshold))
  if (!entries.length) return []
  const best = Math.min(...entries.map(e => e.v))
  return entries.filter(e => e.v === best).map(e => e.id)
}

function buildEligibility(players, metrics, roundCount) {
  const ok4 = roundCount >= 4
  return {
    oracle:      topBy(players, metrics, m => m.accuracyPct,  0),
    hothand:     topBy(players, metrics, m => m.madeBest,     0),
    nil:         topBy(players, metrics, m => m.nilMade,      0),
    gambler:     topBy(players, metrics, m => m.bidRatio),
    miser:       bottomBy(players, metrics, m => m.bidRatio),
    peak:        topBy(players, metrics, m => m.bestScore,    0),
    closest:     topBy(players, metrics, m => m.closestCalls, 0),
    comeback:    ok4 ? topBy(players, metrics, m => m.rankChange,    0)  : [],
    fader:       ok4 ? bottomBy(players, metrics, m => m.rankChange, 0)  : [],
    icecold:     topBy(players, metrics, m => m.missedBest,   0),
    philosopher: topBy(players, metrics, m => m.bidDrift,     0),
    darkhorse:   bottomBy(players, metrics, m => m.bidDrift,  0),
  }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function greedyAssign(eligible, players) {
  const playerTitles = {}
  for (const p of players) playerTitles[p.id] = []
  for (const [key, ids] of Object.entries(eligible)) {
    for (const id of ids) {
      if (playerTitles[id]) playerTitles[id].push(key)
    }
  }
  const assignment = {}
  const claimed    = new Set()
  for (const p of shuffle(players)) {
    for (const key of shuffle(playerTitles[p.id])) {
      if (!claimed.has(key)) {
        assignment[p.id] = key
        claimed.add(key)
        break
      }
    }
  }
  return assignment
}

// ─── Public API ────────────────────────────────────────────────────────────────

// Returns { [playerId]: titleKey } — every player gets exactly one title.
// Merit titles are unique per player; fallbacks (woodenspoon / averagejoe) may repeat.
export function assignTitles(players, completedRounds, variant) {
  if (!players.length || !completedRounds.length) return {}
  const metrics  = buildMetrics(players, completedRounds, variant)
  const eligible = buildEligibility(players, metrics, completedRounds.length)

  let best = {}
  for (let i = 0; i < 100; i++) {
    const attempt = greedyAssign(eligible, players)
    if (Object.keys(attempt).length > Object.keys(best).length) best = attempt
    if (Object.keys(attempt).length === players.length) break
  }

  const totals    = computeTotals(players, completedRounds, variant)
  const sortedAsc = [...players].sort((a, b) => totals[a.id] - totals[b.id])
  const lastId    = players.length > 1 ? sortedAsc[0].id : null

  const result = { ...best }
  for (const p of players) {
    if (!result[p.id]) result[p.id] = p.id === lastId ? 'woodenspoon' : 'averagejoe'
  }
  return result
}

// Returns per-title ranked leaderboard for the StatsModal titles tab.
// { [titleKey]: { available: bool, rows: [{ player, raw, label, isWinner }] } }
export function computeTitleLeaderboards(players, completedRounds, variant) {
  if (!players.length || !completedRounds.length) return {}
  const metrics = buildMetrics(players, completedRounds, variant)
  const N = completedRounds.length

  const configs = [
    { key: 'oracle',      getVal: m => m.accuracyPct,  desc: true,  fmt: v => `${v}%`,                                        avail: true  },
    { key: 'hothand',     getVal: m => m.madeBest,      desc: true,  fmt: v => `${v} in a row`,                                avail: true  },
    { key: 'nil',         getVal: m => m.nilMade,       desc: true,  fmt: v => `${v} held`,                                    avail: true  },
    { key: 'gambler',     getVal: m => m.bidRatio,      desc: true,  fmt: v => v !== null ? `${Math.round(v*100)}%` : '—',     avail: true  },
    { key: 'miser',       getVal: m => m.bidRatio,      desc: false, fmt: v => v !== null ? `${Math.round(v*100)}%` : '—',     avail: true  },
    { key: 'peak',        getVal: m => m.bestScore,     desc: true,  fmt: v => v !== null ? `+${v}` : '—',                     avail: true  },
    { key: 'closest',     getVal: m => m.closestCalls,  desc: true,  fmt: v => `${v}×`,                                        avail: true  },
    { key: 'comeback',    getVal: m => m.rankChange,    desc: true,  fmt: v => v !== null ? (v > 0 ? `+${v}` : `${v}`) : 'n/a', avail: N >= 4 },
    { key: 'fader',       getVal: m => m.rankChange,    desc: false, fmt: v => v !== null ? (v < 0 ? `${v}` : `+${v}`) : 'n/a', avail: N >= 4 },
    { key: 'icecold',     getVal: m => m.missedBest,    desc: true,  fmt: v => `${v} in a row`,                                avail: true  },
    { key: 'philosopher', getVal: m => m.bidDrift,      desc: true,  fmt: v => v !== null ? `+${v.toFixed(1)}` : '—',          avail: true  },
    { key: 'darkhorse',   getVal: m => m.bidDrift,      desc: false, fmt: v => v !== null ? `−${Math.abs(v).toFixed(1)}` : '—', avail: true  },
  ]

  const result = {}
  for (const cfg of configs) {
    if (!cfg.avail) { result[cfg.key] = { available: false, rows: [] }; continue }

    const rows = players
      .map(p => ({ player: p, raw: cfg.getVal(metrics[p.id]) }))
      .sort((a, b) => {
        if (a.raw === null) return 1
        if (b.raw === null) return -1
        return cfg.desc ? b.raw - a.raw : a.raw - b.raw
      })
      .map((r, i) => ({ ...r, label: cfg.fmt(r.raw), rank: i + 1 }))

    const topRaw = rows[0]?.raw
    rows.forEach(r => { r.isWinner = r.raw !== null && r.raw === topRaw })
    result[cfg.key] = { available: true, rows }
  }
  return result
}
