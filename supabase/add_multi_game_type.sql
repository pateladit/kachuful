-- Migration: add multi-game-type infrastructure
-- Run once in Supabase SQL editor.
-- Adds game_type, game_subtype, and game_config columns to games.
-- Existing Ka Chu Fu L rows get DEFAULT values automatically.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS game_type    text NOT NULL DEFAULT 'card'
    CHECK (game_type IN ('card', 'board')),
  ADD COLUMN IF NOT EXISTS game_subtype text NOT NULL DEFAULT 'kachufull',
  ADD COLUMN IF NOT EXISTS game_config  jsonb NOT NULL DEFAULT '{}';

-- Back-fill game_config for all existing Ka Chu Fu L games
UPDATE games
SET game_config = jsonb_build_object(
  'scoring_variant', scoring_variant,
  'num_decks',       num_decks,
  'start_cards',     start_cards,
  'peak_cards',      peak_cards,
  'no_trump_round',  no_trump_round
)
WHERE game_subtype = 'kachufull' AND game_config = '{}';
