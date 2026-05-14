-- =============================================================================
-- Ka Chu Fu L (Judgement) — Supabase Schema
-- =============================================================================
-- Run this in the Supabase SQL editor or via the Supabase CLI.
-- Tables: profiles, games, game_players, rounds, bids, round_results
-- =============================================================================


-- =============================================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- =============================================================================

-- Returns true if the current authenticated user is a registered player in the
-- given game. SECURITY DEFINER bypasses RLS on game_players so this function
-- can be safely called from other tables' RLS policies without infinite recursion.
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

-- Returns true if the current authenticated user created the given game.
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
-- One row per registered Supabase auth user.
-- Automatically created via the handle_new_user trigger (see bottom of file).

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON public.profiles (username);


-- =============================================================================
-- TABLE: games
-- =============================================================================
-- A single game session. Holds the configuration chosen when the game is created.
--
-- scoring_variant: controls how points are calculated each round
--   1 → correct bid scores 10 + tricks_won
--   2 → correct bid scores (10 × tricks_won) + 1; zero bid scores 1
--   3 → correct bid scores (10 × tricks_won) + 1; zero bid scores 10
--
-- no_trump_round: whether a 5th round with no trump suit is played after Hearts
-- status:         'in_progress' while playing, 'complete' when the game is over

CREATE TABLE public.games (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  scoring_variant  smallint    NOT NULL DEFAULT 1 CHECK (scoring_variant IN (1, 2, 3)),
  no_trump_round   boolean     NOT NULL DEFAULT false,
  status           text        NOT NULL DEFAULT 'in_progress'
                               CHECK (status IN ('in_progress', 'complete')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON public.games (created_by);
CREATE INDEX ON public.games (status);


-- =============================================================================
-- TABLE: game_players
-- =============================================================================
-- Each row is one player's seat in a game.
-- Registered users have user_id set; guest players have guest_name set instead.
-- The CHECK constraint enforces that every player has at least one identifier.
--
-- seat_order: 0-based position around the table, used to determine bid/play order
--             and to identify the dealer each round.

CREATE TABLE public.game_players (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name    text,
  seat_order    int         NOT NULL CHECK (seat_order >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- A registered user may only appear once per game
  UNIQUE (game_id, user_id),
  -- Seat positions must be unique within a game
  UNIQUE (game_id, seat_order),
  -- Every player must be identified either as a registered user or a guest
  CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_name <> ''))
);

-- Indexes
CREATE INDEX ON public.game_players (game_id);
CREATE INDEX ON public.game_players (user_id);


-- =============================================================================
-- TABLE: rounds
-- =============================================================================
-- One row per round played within a game.
--
-- cards_dealt: number of cards dealt to each player this round
-- trump_suit:  the trump for this round; follows the rotation
--              spades (Ka) → diamonds (Chu) → clubs (Fu) → hearts (Laal) → none
-- dealer_id:   the game_player who is dealer this round (bids last and is
--              constrained from making total bids equal to cards_dealt)

CREATE TABLE public.rounds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number  int         NOT NULL CHECK (round_number > 0),
  cards_dealt   int         NOT NULL CHECK (cards_dealt > 0),
  trump_suit    text        NOT NULL
                            CHECK (trump_suit IN ('spades', 'diamonds', 'clubs', 'hearts', 'none')),
  dealer_id     uuid        NOT NULL REFERENCES public.game_players(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Round numbers must be unique within a game
  UNIQUE (game_id, round_number)
);

-- Indexes
CREATE INDEX ON public.rounds (game_id);
CREATE INDEX ON public.rounds (dealer_id);


-- =============================================================================
-- TABLE: bids
-- =============================================================================
-- Each player's bid for a given round (number of tricks they expect to win).
-- The dealer's bid is validated by the application to ensure the sum of all bids
-- does not equal cards_dealt (forcing at least one player to fail).

CREATE TABLE public.bids (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  game_player_id  uuid        NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  bid             int         NOT NULL CHECK (bid >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One bid per player per round
  UNIQUE (round_id, game_player_id)
);

-- Indexes
CREATE INDEX ON public.bids (round_id);
CREATE INDEX ON public.bids (game_player_id);


-- =============================================================================
-- TABLE: round_results
-- =============================================================================
-- Actual tricks won and the computed score for each player at the end of a round.
--
-- score is stored (not re-computed on every read) so historical scores remain
-- correct even if the scoring_variant is ever changed on the game row.
--
-- Scoring rules (applied by the application before inserting):
--   Variant 1: bid met → 10 + tricks_won;    missed → 0
--   Variant 2: bid met → (10 × tricks_won) + 1; zero bid → 1; missed → 0
--   Variant 3: bid met → (10 × tricks_won) + 1; zero bid → 10; missed → 0

CREATE TABLE public.round_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  game_player_id  uuid        NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  tricks_won      int         NOT NULL CHECK (tricks_won >= 0),
  score           int         NOT NULL DEFAULT 0 CHECK (score >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One result per player per round
  UNIQUE (round_id, game_player_id)
);

-- Indexes
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
-- profiles policies
-- -----------------------------------------------------------------------------

-- Any authenticated user can read any profile.
-- Usernames and avatars need to be visible to all players in a shared game.
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- A user may only update their own profile row.
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT is handled exclusively by the handle_new_user trigger (SECURITY DEFINER),
-- so no INSERT policy is needed here for normal application use.


-- -----------------------------------------------------------------------------
-- games policies
-- -----------------------------------------------------------------------------

-- A user can see a game if they created it OR if they have a seat in it.
-- is_game_member() covers both cases when user is also the creator and has a
-- seat; the OR handles the edge case where created_by has no game_players row.
CREATE POLICY "Users can view games they belong to"
  ON public.games
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_game_member(id)
  );

-- Any authenticated user can create a game, but the created_by must be themselves.
CREATE POLICY "Users can create games"
  ON public.games
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only the creator can update game settings or mark it complete.
CREATE POLICY "Only the creator can update a game"
  ON public.games
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Only the creator can delete a game.
CREATE POLICY "Only the creator can delete a game"
  ON public.games
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());


-- -----------------------------------------------------------------------------
-- game_players policies
-- -----------------------------------------------------------------------------

-- A user can see the player list for any game they are a member of.
-- is_game_member() uses SECURITY DEFINER so it reads game_players without
-- triggering this policy recursively.
CREATE POLICY "Members can view players in their games"
  ON public.game_players
  FOR SELECT
  TO authenticated
  USING (public.is_game_member(game_id));

-- Only the game creator can add players (registered or guest).
CREATE POLICY "Game creator can add players"
  ON public.game_players
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_game_creator(game_id));

-- Only the game creator can update seat assignments or swap a guest name.
CREATE POLICY "Game creator can update players"
  ON public.game_players
  FOR UPDATE
  TO authenticated
  USING (public.is_game_creator(game_id))
  WITH CHECK (public.is_game_creator(game_id));

-- Only the game creator can remove players.
CREATE POLICY "Game creator can remove players"
  ON public.game_players
  FOR DELETE
  TO authenticated
  USING (public.is_game_creator(game_id));


-- -----------------------------------------------------------------------------
-- rounds policies
-- -----------------------------------------------------------------------------

-- Any member of the game can view its rounds.
CREATE POLICY "Members can view rounds in their games"
  ON public.rounds
  FOR SELECT
  TO authenticated
  USING (public.is_game_member(game_id));

-- Only the game creator can add rounds.
CREATE POLICY "Game creator can insert rounds"
  ON public.rounds
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_game_creator(game_id));

-- Only the game creator can edit a round (e.g. correct a trump suit).
CREATE POLICY "Game creator can update rounds"
  ON public.rounds
  FOR UPDATE
  TO authenticated
  USING (public.is_game_creator(game_id))
  WITH CHECK (public.is_game_creator(game_id));

-- Only the game creator can delete a round.
CREATE POLICY "Game creator can delete rounds"
  ON public.rounds
  FOR DELETE
  TO authenticated
  USING (public.is_game_creator(game_id));


-- -----------------------------------------------------------------------------
-- bids policies
-- -----------------------------------------------------------------------------

-- Any member of the game can view all bids for that game's rounds.
-- We join through rounds to reach the game_id for the membership check.
CREATE POLICY "Members can view bids in their games"
  ON public.bids
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_member(rounds.game_id)
    )
  );

-- Only the game creator can record bids (they enter all bids on behalf of the table).
CREATE POLICY "Game creator can insert bids"
  ON public.bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );

-- Only the game creator can correct a bid.
CREATE POLICY "Game creator can update bids"
  ON public.bids
  FOR UPDATE
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

-- Only the game creator can delete a bid.
CREATE POLICY "Game creator can delete bids"
  ON public.bids
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );


-- -----------------------------------------------------------------------------
-- round_results policies
-- -----------------------------------------------------------------------------

-- Any member of the game can view round results.
CREATE POLICY "Members can view results in their games"
  ON public.round_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_member(rounds.game_id)
    )
  );

-- Only the game creator can record results.
CREATE POLICY "Game creator can insert results"
  ON public.round_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = round_id
        AND public.is_game_creator(rounds.game_id)
    )
  );

-- Only the game creator can correct a result.
CREATE POLICY "Game creator can update results"
  ON public.round_results
  FOR UPDATE
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

-- Only the game creator can delete a result.
CREATE POLICY "Game creator can delete results"
  ON public.round_results
  FOR DELETE
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
-- Fires after a new row is inserted into auth.users (i.e. every new sign-up).
-- Derives an initial username from the metadata supplied during sign-up,
-- falling back to the part of the email address before the '@'.
-- SECURITY DEFINER allows the function to insert into profiles even though
-- the new user does not yet have an RLS-approved session.

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
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
