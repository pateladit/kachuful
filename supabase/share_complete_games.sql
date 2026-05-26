-- =============================================================================
-- Ka Chu Fu L — Shareable final results
-- =============================================================================
-- Additive SELECT policies so any authenticated user (not just game members)
-- can read the data for completed games.
--
-- These are separate policy rows; Supabase ORs multiple policies on the same
-- table+operation, so existing member-only policies remain intact.
--
-- Run this in the Supabase SQL editor after the main schema.sql.
-- =============================================================================

CREATE POLICY "Any authenticated user can view complete games"
  ON public.games FOR SELECT
  TO authenticated
  USING (status = 'complete');

CREATE POLICY "Any authenticated user can view players in complete games"
  ON public.game_players FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = game_id AND games.status = 'complete'
  ));

CREATE POLICY "Any authenticated user can view rounds in complete games"
  ON public.rounds FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = game_id AND games.status = 'complete'
  ));

CREATE POLICY "Any authenticated user can view bids in complete games"
  ON public.bids FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.games g ON g.id = r.game_id
    WHERE r.id = round_id AND g.status = 'complete'
  ));

CREATE POLICY "Any authenticated user can view results in complete games"
  ON public.round_results FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.games g ON g.id = r.game_id
    WHERE r.id = round_id AND g.status = 'complete'
  ));
