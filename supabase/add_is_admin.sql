-- =============================================================================
-- Migration: add is_admin support
-- Run this in the Supabase SQL editor.
-- =============================================================================

-- 1. Add is_admin column to profiles (safe to run multiple times)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Helper function: returns true if the current user is an admin.
--    SECURITY DEFINER avoids RLS recursion on profiles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 3. Admin SELECT policies — additive (OR'd with existing member policies).
--    Admins can see every row across all tables.

CREATE POLICY "Admin can view all games"
  ON public.games FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can view all game_players"
  ON public.game_players FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can view all rounds"
  ON public.rounds FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can view all bids"
  ON public.bids FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can view all results"
  ON public.round_results FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- To grant admin to a user:
--   UPDATE public.profiles SET is_admin = true WHERE id = '<user-uuid>';
