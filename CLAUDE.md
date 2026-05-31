# Score Tracker — Ka Chu Fu L & more

A multi-game companion app for score keeping and data entry, screen-shared to a TV.
Currently supports **Ka Chu Fu L** (Judgement) with infrastructure for additional card games
and board games. One logged-in scorekeeper runs the app; all player seats are entered manually.
No multi-device sync required.

## Tech Stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS v4 (Lantern dark theme — see Design System below)
- **Backend/Auth/DB**: Supabase (auth + PostgreSQL)
- **Deployment**: Vercel

## Auth Modes

Three supported login paths, all land on `/history` after success:
1. **Google OAuth** — preferred, one-tap
2. **Email + password** — traditional
3. **Anonymous / guest** — host enters just their display name, no account needed.
   Supabase anonymous auth creates a real session persisted in localStorage.
   Data survives browser restarts on the same device.
   - Anonymous users can upgrade to a full account via `/preferences` (email/password or Google link)
   - A dismissible amber banner appears on `/` after ≥2 complete games prompting upgrade
   - `localStorage` key `kachuful-banner-dismissed` persists the dismiss

## Game Rules

- Trick-taking game, 2–11 players (10–11 rare but supported)
- One scorekeeper (the host) enters all bids and results on behalf of the table
- Each round: dealer distributes N cards; players bid how many tricks they'll win
- **Dealer constraint**: dealer bids last and cannot bid a number that makes
  `sum(all bids) = cards_dealt` — at least one player must fail
- Dealer rotates +1 seat (clockwise) each round

### Trump Rotation

Each round's trump is computed from `(round_number - 1) mod cycle_length`:

| Index | Suit | Glyph | Name |
|-------|------|-------|------|
| 0 | Spades | ♠ | Ka |
| 1 | Diamonds | ♦ | Chu |
| 2 | Clubs | ♣ | Fu |
| 3 | Hearts | ♥ | Laal |
| 4 | No Trump | ⚬ | NT (only if `no_trump_round = true`) |

Cycle length is 4 (no NT) or 5 (with NT).

### Round / Card Sequence

Configured per game via `start_cards` and `peak_cards`.

```
Leg 1 (ascending):  start_cards, start_cards+1, …, peak_cards
Leg 2 (descending): peak_cards-1, …, 1
Leg 3+ (repeating): 2, …, peak_cards, peak_cards-1, …, 1
```

- `peak_cards` is always reached once per ascending leg (not repeated between legs)
- The sequence oscillates indefinitely until the scorekeeper taps **End Game**
- On the bid-entry screen there is a **skip** button to jump to a non-sequential
  card count for a round if needed; the actual `cards_dealt` stored per round is
  authoritative regardless of the computed sequence
- The setup page displays the default loop as `start → peak → 1 (N rounds)` for reference
- `peak_cards` defaults to `floor((52 × num_decks) / player_count)` but the
  scorekeeper can set a lower value on the setup screen

### Scoring Variants

| Variant | Bid met | Zero bid | Bid missed |
|---------|---------|----------|------------|
| 1 — Classic | `10 + tricks_won` | `10` | `0` |
| 2 — Bid+1 | `(10 × tricks_won) + 1` | `1` | `0` |
| 3 — Bid+1 · Nil=10 | `(10 × tricks_won) + 1` | `10` | `0` |

Score is stored in `round_results.score` (not recomputed on read) so history
remains correct even if the scoring_variant is ever corrected on the game row.

### End Game

- Scorekeeper taps **End Game** on the round-results screen at any time
- If a round is in progress (bids saved but no results yet), that round is
  discarded — no `round_results` rows are created for it
- `games.ended_at` is set; `games.status` → `'complete'`

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user (email, Google, or anonymous). Auto-created by trigger. |
| `games` | Game sessions with all configuration |
| `game_players` | Player seats in a game (registered or named guest) |
| `rounds` | Individual rounds |
| `bids` | Player bids per round |
| `round_results` | Tricks won + computed score per player per round |

### games — key columns

| Column | Type | Notes |
|--------|------|-------|
| `name` | text | Optional game name e.g. "Diwali Eve 2026" |
| `game_type` | text | `'card'` or `'board'` (DEFAULT `'card'`) |
| `game_subtype` | text | e.g. `'kachufull'`, `'spades3'` (DEFAULT `'kachufull'`) |
| `game_config` | jsonb | Game-specific config mirror (back-filled from Ka Chu Fu L columns) |
| `scoring_variant` | smallint | Ka Chu Fu L: 1, 2, or 3 |
| `num_decks` | smallint | Ka Chu Fu L: 1 or 2 |
| `start_cards` | int | Ka Chu Fu L: card count for first round (default 1) |
| `peak_cards` | int | Ka Chu Fu L: maximum cards per round |
| `no_trump_round` | boolean | Ka Chu Fu L: whether NT suit is included in rotation |
| `first_dealer_seat` | int | Ka Chu Fu L: seat_order of round-1 dealer (chosen via card-cut mechanic) |
| `status` | text | `'in_progress'` or `'complete'` |
| `started_at` | timestamptz | Set when game begins |
| `ended_at` | timestamptz | Set when End Game is tapped |

Ka Chu Fu L-specific columns (`scoring_variant` … `first_dealer_seat`) remain for backward compat.
New game types store their config in `game_config` (JSONB).

### game_players — key columns

| Column | Type | Notes |
|--------|------|-------|
| `display_name` | text NOT NULL | Name shown in-game. Per-game, no cross-game correlation. |
| `user_id` | uuid nullable | Links to `profiles.id` for RLS. NULL for non-account players. |
| `color` | text | Hex from the 12-color palette (see Design System) |
| `seat_order` | int | 0-based clockwise seat index |

`guest_name` column from earlier design is replaced by `display_name` universally.

### rounds — key columns

| Column | Notes |
|--------|-------|
| `cards_dealt` | Actual card count (may differ from computed sequence if scorekeeper skipped) |
| `trump_suit` | `'spades'` \| `'diamonds'` \| `'clubs'` \| `'hearts'` \| `'none'` |
| `dealer_id` | FK to `game_players.id` |

## Access Control

- Supabase RLS on all tables
- Helper functions `is_game_member(game_id)` and `is_game_creator(game_id)` used by policies
- Both functions use `SECURITY DEFINER` to avoid recursive RLS on `game_players`
- Anonymous users are in the `authenticated` role — all policies apply to them identically
- Members can SELECT; only the creator can INSERT / UPDATE / DELETE

## Design System

**Themes**: Lantern (dark, default) and Mehfil (light). Toggled via `/preferences`, persisted in `localStorage` key `kachuful-theme`. Applied as `data-theme` attribute on `<html>`.

### Color Palette — CSS variables

| Variable | Hex | Usage |
|----------|-----|-------|
| `--bg` | `#2a1620` | Page background |
| `--bg-2` | `#3a1f2c` | Secondary background |
| `--surface` | `#3d2330` | Card / panel surface |
| `--ink` | `#f6e7d3` | Primary text |
| `--ink-2` | `#d8b893` | Secondary text |
| `--muted` | `#9b7c6b` | Tertiary / disabled text |
| `--line` | `#5a3445` | Borders |
| `--accent` | `#e89a3c` | Primary action (amber) |
| `--accent-2` | `#d24a3d` | Negative / missed (red) |
| `--accent-3` | `#b6c97a` | Positive / made (lime) |
| `--red` | `#e57860` | Red-suit marker |

### Player Color Palette — 12 colors

Assigned at setup, stored in `game_players.color`:

```
#e89a3c  amber      #d24a3d  crimson
#b6c97a  lime       #e57860  coral
#a78bfa  violet     #3a9d8a  teal
#f4a261  peach      #c98b9c  mauve
#4fc3f7  sky        #ffd166  gold
#06d6a0  mint       #c77dff  lavender
```

### Typography

- Display: **Bricolage Grotesque** (500, 600, 700) — headings, hero numbers
- Body: **Geist** (400, 500, 600) — all UI text
- Mono: **Geist Mono** (500, 600, 700) — scores, bid/took notation

Load via Google Fonts in `index.html`.

### Tailwind Integration

Register the Lantern palette as Tailwind v4 theme tokens in `src/index.css`
so classes like `bg-bg`, `text-ink`, `border-line` work throughout the app.

## Pages & Routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `Home.jsx` | Game setup — player roster, game type + game selection, scoring variant, rules config, cut-for-dealer |
| `/game/:id` | `Game.jsx` | Phase router: loading → bidding (`BidEntry`) → playing (`PlayingScreen` + `ResultsEntry`) → complete |
| `/game/:id/final` | `FinalResults.jsx` | Standings, score-progression chart, full running tab |
| `/history` | `History.jsx` | Per-user game history with stats |
| `/preferences` | `Preferences.jsx` | Theme toggle (Lantern/Mehfil); account upgrade for anonymous users |
| `/admin` | `Admin.jsx` | All-games view; guarded by `profiles.is_admin = true` |

Admin access: run `UPDATE public.profiles SET is_admin = true WHERE id = '<uuid>'` in Supabase SQL editor. Migration in `supabase/add_is_admin.sql`.

## Completed Sessions

- **Session 1** — Vite + React scaffold, Tailwind v4, Supabase client, folder structure, placeholder routes
- **Session 2** — `supabase/schema.sql` with all tables, RLS policies, auth trigger
- **Session 3** — `useAuth` hook + `AuthProvider`, `ProtectedRoute`, `LoginPage`
- **Session 4** — Lantern theme foundation (fonts, CSS tokens), `src/lib/gameLogic.js`,
  Google OAuth + anonymous auth, Login page restyle, full `Home.jsx` setup page
  (player roster, color picker, scoring variant, rules/rounds config, cut-for-dealer,
  Supabase INSERT on submit)
- **Session 5** — `useGame` hook (Supabase data loader + phase state machine),
  `Avatar`, `GameTimer`, `SummaryModal`, `BidEntry` components built from
  `bid-entry.html` + `summary-modal.jsx` design handoffs; full `Game.jsx` phase
  router (`loading → bidding → playing → complete`); Home.jsx RLS fix (first
  player seat 0 gets `user_id = auth.uid()` so `is_game_member` returns true)
- **Session 6** — `PlayingScreen` (locked bids grid, running tab, stat cards, chai
  pause overlay), `ResultsEntry` (per-player number pad, flash animations, sum
  validation, live rank deltas, MVP reveal, locks results to Supabase),
  `FinalResults` page at `/game/:id/final` (standings table with medals/accuracy/
  streaks, SVG score-progression line chart with hover tooltip, full running tab);
  `Game.jsx` phase router wired end-to-end; `App.jsx` route added

- **Session 7** — `useHistory` hook (deep Supabase query: games → game_players →
  rounds → bids + round_results), full `History.jsx` rewrite: 4-stat summary row
  (total games, win rate, best round score, accuracy — scoped to the user's own
  seat across all games), game list with per-game player scores, winner, duration,
  status badge; clicking any game navigates to `/game/:id/final` (complete) or
  `/game/:id` (in progress)

- **Post-session work** — responsive layout (two-column `Home.jsx` at ≥1024px,
  wider `History.jsx`, overflow-x scroll on `FinalResults` standings table);
  Mehfil light theme + `useTheme` hook; anonymous account upgrade flow (`Preferences.jsx`,
  dismissible banner on `Home.jsx`); `isAdmin` support with `Admin.jsx` and
  `supabase/add_is_admin.sql` migration; `AccountMenu` wired to Preferences/Admin;
  `ResultsEntry` reverted to open-grid design (all players visible simultaneously)

- **Session 8** — share, fanfare & rank colours: `canvas-confetti` + `html2canvas`
  installed; `supabase/share_complete_games.sql` additive SELECT policies for complete
  games (anyone authenticated can view `/game/:id/final`); `Game.jsx` — `GameOverSplash`
  component fires confetti + shows winner, auto-navigates to FinalResults after 3 s;
  `FinalResults.jsx` — confetti on load (< 10 min since end), winner hero card, top-3
  podium (2nd | 1st | 3rd), share dropdown (copy link / Share via… / download PNG /
  print PDF); rank conditional formatting (`rankBg` green→red by rank) applied to TOTAL
  + RANK footer rows in `PlayingScreen`, `BidEntry` (new RANK row added), `ResultsEntry`
  standings, and `FinalResults` RunningTab + standings table; `AccountMenu` added to
  all 3 in-game screen headers; fixed missing `/` in BidEntry running tab bid/took subtext

- **Session 9** — `StatsModal` component (`src/components/game/StatsModal.jsx`) with
  5 sections: zero-bid performance (overall + ≤4/5+ card split), accuracy by card count
  (per-count breakdown + 1–4/5+ grouped), dealer burden (times dealt + accuracy as dealer),
  best streaks (made/missed), and fun stats (best single round, trump affinity, risk
  appetite, bid drift); glossary for risk appetite and bid drift below fun stats section;
  new stat functions in `gameLogic.js`: `nilBidStats`, `cardCountStats`, `dealerBurden`,
  `bestRoundScore`, `favoriteTrump`, `avgBidRatio`, `netBidDrift`; `rankBg` added to
  `SummaryModal` TOTAL/RANK rows (was missing); Stats button (⊞) wired into `BidEntry`,
  `PlayingScreen`, `ResultsEntry`, `FinalResults`, and per-game-card in `History`;
  `useHistory` updated to fetch `round_number, cards_dealt, trump_suit, dealer_id` so
  rounds can be normalized to StatsModal format from the history page

- **Session 10** — multi-game type infrastructure + ResultsEntry UX improvements:
  - `supabase/add_multi_game_type.sql` migration: adds `game_type` (card/board),
    `game_subtype` (kachufull/spades3/…), `game_config` (JSONB) to `games` table;
    back-fills `game_config` for existing Ka Chu Fu L rows
  - `Home.jsx` redesigned setup flow: **Game type** section (Card Game / Board Game toggle)
    → **Select a game** grid (explicit selection required before config appears);
    Ka Chu Fu L shows full scoring + rules + cut-for-dealer config; 3 of Spades shows
    "rules coming soon" placeholder; board games show 3 dimmed "coming soon" tiles;
    `canStart` gated to `kachufull` only until other games are implemented
  - `games` INSERT now writes `game_type` + `game_subtype`
  - `useHistory` + `History.jsx` fetch and display `game_subtype` badge on game cards
  - `ResultsEntry` bid highlight on number pad (amber tint on the button matching the
    player's bid) + "✓ Made" quick-fill button next to each player's bid value

## Supported Games

| Subtype | Category | Status | Notes |
|---------|----------|--------|-------|
| `kachufull` | card | Full support | Judgement / Oh Hell; complete game loop |
| `spades3` | card | Placeholder | 3 of Spades; rules/scoring not yet configured |
| *(board games)* | board | Placeholder | Coming soon; free-form scoring model planned |

## Deferred / Future

- **Offline support** — defer; internet connection assumed for now
- **Multi-device sessions** — each player connects on their own phone to view status and submit bids; major architecture pivot, very future
- **3 of Spades rules** — scoring, round structure, and game loop to be defined and implemented
- **Board game support** — free-form entry scoring model; specific games TBD
