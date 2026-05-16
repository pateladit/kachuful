import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useHistory() {
  const { user } = useAuth()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('games')
        .select(`
          id, name, scoring_variant, status, started_at, ended_at, created_at,
          game_players ( id, display_name, color, seat_order, user_id ),
          rounds (
            id,
            bids ( game_player_id, bid ),
            round_results ( game_player_id, tricks_won, score )
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      if (err) throw err
      setGames(data ?? [])
    } catch (err) {
      setError(err.message ?? 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  return { games, loading, error, reload: load }
}
