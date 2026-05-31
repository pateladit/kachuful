import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Returns the most frequent non-host players from the current user's game history.
 * Results are sorted by frequency desc, colour pre-filled from their most recent game.
 * Excludes the host's own seat (user_id IS NULL — only guest seats are returned).
 */
export function useFrequentPlayers(userId) {
  const [players, setPlayers] = useState([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function load() {
      // 1. Get the user's games in recency order
      const { data: gameRows } = await supabase
        .from('games')
        .select('id')
        .eq('created_by', userId)
        .order('started_at', { ascending: false })

      if (cancelled || !gameRows?.length) return

      const gameIds = gameRows.map(g => g.id)
      const gameRank = Object.fromEntries(gameIds.map((id, i) => [id, i]))

      // 2. Fetch all non-host players from those games
      const { data: playerRows } = await supabase
        .from('game_players')
        .select('display_name, color, game_id')
        .in('game_id', gameIds)
        .is('user_id', null)
        .neq('display_name', '')

      if (cancelled || !playerRows) return

      // Sort by recency so the first occurrence of a name carries the latest colour
      playerRows.sort((a, b) => (gameRank[a.game_id] ?? 999) - (gameRank[b.game_id] ?? 999))

      // Aggregate by name
      const freq = new Map()
      for (const p of playerRows) {
        const name = p.display_name.trim()
        if (!name) continue
        if (freq.has(name)) {
          freq.get(name).count++
        } else {
          freq.set(name, { displayName: name, color: p.color, count: 1 })
        }
      }

      if (!cancelled) {
        setPlayers(
          [...freq.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        )
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  return players
}
