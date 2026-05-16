import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  TRUMPS,
  disambiguateInitials,
  computeCardsForRound,
  computeTrumpForRound,
  computeDealerSeat,
  scoreFor,
} from '../lib/gameLogic'

export function useGame(gameId) {
  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [completedRounds, setCompletedRounds] = useState([])
  const [pendingRound, setPendingRound] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (gameId) load(gameId)
  }, [gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load(id) {
    setPhase('loading')
    setError(null)
    try {
      const { data: g, error: gErr } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single()
      if (gErr) throw gErr

      const { data: gps, error: gpsErr } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', id)
        .order('seat_order')
      if (gpsErr) throw gpsErr

      const { data: rs, error: rsErr } = await supabase
        .from('rounds')
        .select(`
          id, round_number, cards_dealt, trump_suit, dealer_id,
          bids ( game_player_id, bid ),
          round_results ( game_player_id, tricks_won, score )
        `)
        .eq('game_id', id)
        .order('round_number')
      if (rsErr) throw rsErr

      const names = gps.map(p => p.display_name)
      const initials = disambiguateInitials(names)
      const normPlayers = gps.map((p, i) => ({
        id: p.id,
        displayName: p.display_name,
        color: p.color,
        seatOrder: p.seat_order,
        initial: initials[i],
      }))

      const playerCount = normPlayers.length
      const normRounds = rs.map(r => {
        const bids = {}
        for (const b of r.bids) bids[b.game_player_id] = b.bid
        const took = {}
        for (const rr of r.round_results) took[rr.game_player_id] = rr.tricks_won
        const isComplete = r.round_results.length === playerCount
        return {
          id: r.id,
          roundNumber: r.round_number,
          cards: r.cards_dealt,
          trump: r.trump_suit,
          dealerId: r.dealer_id,
          bids,
          took: isComplete ? took : null,
        }
      })

      const completed = normRounds.filter(r => r.took !== null)
      const pending = normRounds.find(r => r.took === null) ?? null

      setGame(g)
      setPlayers(normPlayers)
      setCompletedRounds(completed)
      setPendingRound(pending)
      setPhase(
        g.status === 'complete' ? 'complete'
        : pending ? 'playing'
        : 'bidding'
      )
    } catch (err) {
      setError(err.message ?? 'Failed to load game')
      setPhase('error')
    }
  }

  // Insert the rounds row + all bids; advance to playing phase.
  async function lockBids(bids, cardsDealt) {
    const roundNumber = completedRounds.length + 1
    const trump = computeTrumpForRound(roundNumber, game.no_trump_round)
    const dealerSeat = computeDealerSeat(roundNumber, game.first_dealer_seat, players.length)
    const dealer = players.find(p => p.seatOrder === dealerSeat) ?? players[0]

    const { data: roundRow, error: roundErr } = await supabase
      .from('rounds')
      .insert({
        game_id: game.id,
        round_number: roundNumber,
        cards_dealt: cardsDealt,
        trump_suit: trump.id,
        dealer_id: dealer.id,
      })
      .select()
      .single()
    if (roundErr) throw roundErr

    const { error: bidsErr } = await supabase.from('bids').insert(
      players.map(p => ({
        round_id: roundRow.id,
        game_player_id: p.id,
        bid: bids[p.id],
      }))
    )
    if (bidsErr) throw bidsErr

    const newPending = {
      id: roundRow.id,
      roundNumber,
      cards: cardsDealt,
      trump: trump.id,
      dealerId: dealer.id,
      bids: { ...bids },
      took: null,
    }
    setPendingRound(newPending)
    setPhase('playing')
  }

  // INSERT round_results for the pending round, then auto-advance to bidding.
  async function lockResults(took) {
    if (!pendingRound) return
    const { error: resultsErr } = await supabase.from('round_results').insert(
      players.map(p => ({
        round_id: pendingRound.id,
        game_player_id: p.id,
        tricks_won: took[p.id],
        score: scoreFor(pendingRound.bids[p.id], took[p.id], game.scoring_variant),
      }))
    )
    if (resultsErr) throw resultsErr

    const completedRound = { ...pendingRound, took: { ...took } }
    setCompletedRounds(prev => [...prev, completedRound])
    setPendingRound(null)
    setPhase('bidding')
  }

  // Set ended_at + status = complete; navigate to final results.
  async function endGame() {
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('games')
      .update({ status: 'complete', ended_at: now })
      .eq('id', game.id)
    if (err) throw err
    setGame(prev => ({ ...prev, status: 'complete', ended_at: now }))
    setPhase('complete')
  }

  // --- Derived values for the current/next round ---

  // If a pending round exists, that's the active round number.
  // Otherwise the next round to be played.
  const nextRoundNumber = pendingRound
    ? pendingRound.roundNumber
    : completedRounds.length + 1

  let trump = null
  let defaultCards = 1
  let dealerIdx = 0

  if (game && players.length > 0) {
    if (pendingRound) {
      trump = TRUMPS.find(t => t.id === pendingRound.trump) ?? null
      defaultCards = pendingRound.cards
      dealerIdx = players.findIndex(p => p.id === pendingRound.dealerId)
    } else {
      trump = computeTrumpForRound(nextRoundNumber, game.no_trump_round)
      defaultCards = computeCardsForRound(nextRoundNumber, game.start_cards, game.peak_cards)
      const dealerSeat = computeDealerSeat(nextRoundNumber, game.first_dealer_seat, players.length)
      dealerIdx = players.findIndex(p => p.seatOrder === dealerSeat)
    }
    if (dealerIdx < 0) dealerIdx = 0
  }

  return {
    game,
    players,
    completedRounds,
    pendingRound,
    phase,
    error,
    roundNumber: nextRoundNumber,
    trump,
    defaultCards,
    dealerIdx,
    lockBids,
    lockResults,
    endGame,
    reload: () => load(gameId),
  }
}
