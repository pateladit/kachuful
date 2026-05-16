-- =============================================================================
-- Ka Chu Fu L (Judgement) — Supabase Schema
-- =============================================================================
-- Run this in the Supabase SQL editor or via the Supabase CLI.
-- Tables: profiles, games, game_players, rounds, bids, round_results
--
-- Auth modes supported:
--   • Email + password
--   • Google OAuth
--   • Anonymous (guest scorekeeper — enters just a display name, no account)
--     Anonymous users are in the 'authenticated' role and are covered by all
--     RLS policies below without any special handling.
-- =============================================================================


-- =============================================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- =============================================================================

-- Returns true if the current user is a player in the given game.
-- SECURITY DEFINER bypasses RLS on game_players so this function can be
-- called from other tables' policies without infinite recursion.
CREATE OR REPLACE FUNCTION public.is_game_member(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_players.game_id = p_game_id
      AND game_players.user_id = auth.uid()
  );
$$;

-- Returns true if the current user created the given game.
CREATE OR REPLACE FUNCTION public.is_game_creator(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = p_game_id
      AND games.created_by = auth.uid()
  );
$$;


-- =============================================================================
-- TABLE: profiles
-- =============================================================================
-- One row per Supabase auth user (email, Google, or anonymous).
-- Created automatically via handle_new_user trigger on auth.users insert.
-- Anonymous users get a NULL username — they identify via display_name
-- on game_players instead.

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.profiles (username);


-- =============================================================================
-- TABLE: games
-- =============================================================================
-- One row per game session.
--
-- Round card sequence (computed by the app, not stored):
--   Leg 1 (ascending): start_cards, start_cards+1, …, peak_cards
--   Leg 2 (descending): peak_cards-1, …, 1
--   Leg 3+ (repeating): 2, …, peak_cards, peak_cards-1, …, 1
--   Game ends when scorekeeper taps "End Game" — no fixed round count.
--
-- Trump rotation per round: Ka (♠) → Chu (♦) → Fu (♣) → Laal (♥)
--   If no_trump_round is true, a fifth NT (⚬) suit follows Laal.
--   The 4- or 5-suit cycle repeats across all rounds.
--
-- scoring_variant:
--   1 → bid met: 10 + tricks_won;    missed: 0
--   2 → bid met: (10 × tricks_won)+1; zero bid: 1;  missed: 0
--   3 → bid met: (10 × tricks_won)+1; zero bid: 10; missed: 0
--
-- Dealer rotates +1 seat each round (seat_order mod player_count).
-- first_dealer_seat is the seat_order of the round-1 dealer, chosen
-- via the "cut for dealer" card-tap mechanic on the setup screen.
--
-- started_at / ended_at replace the in-app timer; duration is derived
-- from these two timestamps.

CREATE TABLE public.games (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name               text,
  scoring_variant    smallint    NOT NULL DEFAULT 1 CHECK (scoring_variant IN (1, 2, 3)),
  num_decks          smallint    NOT NULL DEFAULT 1 CHECK (num_decks IN (1, 2)),
  start_cards        int         NOT NULL DEFAULT 1 CHECK (start_cards >= 1),
  peak_cards         int         NOT NULL CHECK (peak_cards >= start_cards),
  no_trump_round     boolean     NOT NULL DEFAULT false,
  first_dealer_seat  int         NOT NULL DEFAULT 0,
  status             text        NOT NULL DEFAULT 'in_progress'
                                 CHECK (status IN ('in_progress', 'complete')),
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.games (created_by);
CREATE INDEX ON public.games (status);


-- =============================================================================
-- TABLE: game_players
-- =============================================================================
-- One seat per player per game. Supports both registered and guest players.
--
-- display_name: the name shown in-game. Always set. Independent of the
--   linked profile's username — the same person can appear as "Dad" in one
--   game and "Rohit" in another with no cross-game correlation.
--
-- user_id: optional. Set when a registered/anonymous auth user is a player,
--   enabling RLS membership checks. NULL for players who are just names
--   (entered by the scorekeeper on behalf of others at the table).
--
-- color: one of 12 palette hex values assigned at setup (see CLAUDE.md).
--
-- seat_order: 0-based clockwise position. Bid order each round is:
--   seat (dealer+1) mod N → … → dealer (bids last).

CREATE TABLE public.game_players (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name  text        NOT NULL CHECK (display_name <> ''),
  color         text        NOT NULL DEFAULT '#e89a3c',
  seat_order    int         NOT NULL CHECK (seat_order >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- A registered/anonymous user may only hold one seat per game
  UNIQUE (game_id, user_id),
  -- Seat positions must be unique within a game
  UNIQUE (game_id, seat_order)
);

CREATE INDEX ON public.game_players (game_id);
CREATE INDEX ON public.game_players (user_id);


-- =============================================================================
-- TABLE: rounds
-- =============================================================================
-- One row per round played.
--
-- cards_dealt: actual card count for this round. The app computes the
--   expected value from start_cards / peak_cards, but the scorekeeper can
--   tap "skip" on the bid-entry screen to jump to a different card count,
--   so the stored value is authoritative.
--
-- trump_suit: 'spades' | 'diamonds' | 'clubs' | 'hearts' | 'none'
--   Computed by the app from round_number mod cycle length (4 or 5).
--
-- dealer_id: the game_player who deals this round.
--   Computed: game_players seat = (first_dealer_seat + round_number - 1) mod N.

CREATE TABLE public.rounds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number  int         NOT NULL CHECK (round_number > 0),
  cards_dealt   int         NOT NULL CHECK (cards_dealt > 0),
  trump_suit    text        NOT NULL
                            CHECK (trump_suit IN ('spades', 'diamonds', 'clubs', 'hearts', 'none')),
  dealer_id     uuid        NOT NULL REFERENCES public.game_players(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (game_id, round_number)
);

CREATE INDEX ON public.rounds (game_id);
CREATE INDEX ON public.rounds (dealer_id);


-- =============================================================================
-- TABLE: bids
-- =============================================================================
-- Each player's bid for a round (tricks they expect to win).
--
-- Dealer constraint (enforced by the app):
--   dealer's bid cannot make sum(all bids) = cards_dealt.

CREATE TABLE public.bids (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  game_player_id  uuid        NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  bid             int         NOT NULL CHECK (bid >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (round_id, game_player_id)
);

CREATE INDEX ON public.bids (round_id);
CREATE INDEX ON public.bids (game_player_id);


-- =============================================================================
-- TABLE: round_results
-- =============================================================================
-- Tricks won and computed score per player per round.
--
-- score is stored (not recomputed on read) so history is correct even if
-- scoring_variant is ever patched on the parent game row.
--
-- If the scorekeeper taps "End Game" while a round is in progress, that
-- round's bids are saved but no round_results row is created for it.

CREATE TABLE public.round_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  game_player_id  uuid        NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  tricks_won      int         NOT NULL CHECK (tricks_won >= 0),
  score           int         NOT NULL DEFAULT 0 CHECK (score >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (round_id, game_player_id)
);

CREATE INDEX ON public.round_results (round_id);
CREATE INDEX ON public.round_results (game_player_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

-- Any authenticated user (including anonymous) can read all profiles.
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profile.
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT is handled by the handle_new_user trigger (SECURITY DEFINER).


-- -----------------------------------------------------------------------------
-- games
-- -----------------------------------------------------------------------------

-- User can see a game if they created it or have a seat in it.
CREATE POLICY "Users can view games they belong to"
  ON public.games FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_game_member(id)
  );

CREATE POLICY "Users can create games"
  ON public.games FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Only the creator can update a game"
  ON public.games FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Only the creator can delete a game"
  ON public.games FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());


-- -----------------------------------------------------------------------------
-- game_players
-- -----------------------------------------------------------------------------

-- Members can view the player list for any game they are in.
-- is_game_member uses SECURITY DEFINER to avoid recursive RLS on this table.
CREATE POLICY "Members can view players in their games"
  ON public.game_players FOR SELECT
  TO authenticated
  USING (public.is_game_member(game_id));

CREATE POLICY "Game creator can add players"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (public.is_game_creator(game_id));

CREATE POLICY "Game creator can update players"
  ON public.game_players FOR UPDATE
  TO authenticated
  USING (public.is_game_creator(game_id))
  WITH CHECK (public.is_game_creator(game_id));

CREATE POLICY "Game creator can remove players"
  ON public.game_players FOR DELETE
  TO authenticated
  USING (public.is_game_creator(game_id));


-- -----------------------------------------------------------------------------
-- rounds
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view rounds in their games"
  ON public.rounds FOR SELECT
  TO authenticated
  USING (public.is_game_member(game_id));

CREATE POLICY "Game creator can insert rounds"
  ON public.rounds FOR INSERT
  TO authenticated
  WITH CHECK (public.is_game_creator(game_id));

CREATE POLICY "Game creator can update rounds"
  ON public.rounds FOR UPDATE
  TO authenticated
  USING (public.is_game_creator(game_id))
  WITH CHECK (public.is_game_creator(game_id));

CREATE POLICY "Game creator can delete rounds"
  ON public.rounds FOR DELETE
  TO authenticated
  USING (public.is_game_creator(game_id));


-- -----------------------------------------------------------------------------
-- bids
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view bids in their games"
  ON public.bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_member(rounds.game_id)
    )
  );

CREATE POLICY "Game creator can insert bids"
  ON public.bids FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );

CREATE POLICY "Game creator can update bids"
  ON public.bids FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );

CREATE POLICY "Game creator can delete bids"
  ON public.bids FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );


-- -----------------------------------------------------------------------------
-- round_results
-- -----------------------------------------------------------------------------

CREATE POLICY "Members can view results in their games"
  ON public.round_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_member(rounds.game_id)
    )
  );

CREATE POLICY "Game creator can insert results"
  ON public.round_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );

CREATE POLICY "Game creator can update results"
  ON public.round_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );

CREATE POLICY "Game creator can delete results"
  ON public.round_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );


-- =============================================================================
-- TRIGGER: auto-create profile on sign-up
-- =============================================================================
-- Fires for every new auth.users row: email/password, Google OAuth, anonymous.
-- Anonymous users have no email and no username metadata → profile.username is NULL.
-- That is fine; their in-game identity is display_name on game_players.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data->>'username' IS NOT NULL
        THEN NEW.raw_user_meta_data->>'username'
      WHEN NEW.email IS NOT NULL
        THEN split_part(NEW.email, '@', 1)
      ELSE NULL  -- anonymous users: no username derived
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
