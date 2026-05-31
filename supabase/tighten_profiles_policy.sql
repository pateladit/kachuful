-- Migration: tighten profiles SELECT policy
-- Run once in Supabase SQL editor.
-- Restricts profile reads to own row only — app never needs cross-user profile access.

DROP POLICY "Authenticated users can read all profiles" ON public.profiles;

CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());
