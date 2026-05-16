# Ka Chu Fu L (Judgement) — Score Tracker

A card game score tracker for the trick-taking game Ka Chu Fu L, also known as Judgement.
One logged-in scorekeeper (usually also a player) runs the app, screen-shared to a TV.
All players at the table are represented as named seats — no multi-device sync required.

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
   Data survives browser restarts on the same device. Acceptable data loss if
   they clear the browser or switch devices (no upgrade prompt planned).

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
| `scoring_variant` | smallint | 1, 2, or 3 |
| `num_decks` | smallint | 1 or 2 |
| `start_cards` | int | Card count for first round (default 1) |
| `peak_cards` | int | Maximum cards per round |
| `no_trump_round` | boolean | Whether NT suit is included in rotation |
| `first_dealer_seat` | int | seat_order of round-1 dealer (chosen via card-cut mechanic) |
| `status` | text | `'in_progress'` or `'complete'` |
| `started_at` | timestamptz | Set when game begins (replaces in-app timer) |
| `ended_at` | timestamptz | Set when End Game is tapped |

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

**Theme**: Lantern (dark only)

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

## Design Handoff Files

Located in `KA-CHU-FU-L/project/`:

| File | Purpose |
|------|---------|
| `design-system.html` | Full color + typography + component reference |
| `setup.html` | Game creation page |
| `bid-entry.html` | Bidding phase |
| `game-in-play.html` | Active round / waiting state |
| `round-results.html` + `.jsx` | Results entry (near-complete React component) |
| `final-results.html` + `.jsx` | End-game scoreboard (near-complete React component) |
| `summary-modal.jsx` + `.css` | In-game summary overlay (reusable) |
| `game-data.js` | Scoring logic + timer helpers (extract to `src/lib/gameLogic.js`) |
| `tweaks-panel.jsx` | Design-time debug panel — do NOT ship in production |

### Integrating handoff JSX

`round-results.jsx` and `final-results.jsx` are standalone React apps (call
`ReactDOM.createRoot` themselves). They must be refactored into page components
that receive game state from the router + Supabase. The logic stays; the shell
changes. `game-data.js` pure functions should be extracted to `src/lib/gameLogic.js`
with the hardcoded test data stripped out.

## Completed Sessions

- **Session 1** — Vite + React scaffold, Tailwind v4, Supabase client, folder structure, placeholder routes
- **Session 2** — `supabase/schema.sql` with all tables, RLS policies, auth trigger
- **Session 3** — `useAuth` hook + `AuthProvider`, `ProtectedRoute`, `LoginPage`
- **Session 4** — Lantern theme foundation (fonts, CSS tokens), `src/lib/gameLogic.js`,
  Google OAuth + anonymous auth, Login page restyle, full `Home.jsx` setup page
  (player roster, color picker, scoring variant, rules/rounds config, cut-for-dealer,
  Supabase INSERT on submit)

## Remaining Sessions

### Session 5 — Bidding phase (`/game/:id`)

Built from `bid-entry.html` design handoff. Introduces the `useGame` data hook and
phase state machine that all subsequent game phases share.

- **`useGame` hook** — loads `games`, `game_players`, `rounds`, `bids`, `round_results`
  for the current game ID; exposes live state + dispatch
- **Phase state machine** (`useReducer`) — states: `loading` → `bidding` → `playing`
  → `results` → `complete`; persisted in URL or game status so reload works
- **Bid entry UI** from `bid-entry.html`:
  - Top bar: brand, game name + round number, mini leaderboard (top 3), summary button
  - Hero: trump suit card (glyph + name), cards this round, bid-sum progress bar
  - Per-player rows: number pad 0→cards, dealer bids last, forbidden bid auto-locked
    (dealer cannot make sum = cards), active player highlighted
  - Running tab (last 5 rounds) with expand toggle
  - "Skip" button to override card count for the round
  - Footer: "Lock Bids →" enabled only when sum status is valid (not balanced/over)
  - On lock: INSERT all bids to `bids` table, transition to `playing` phase
- **Summary modal** (`summary-modal.jsx`) wired to top bar; pauses timer on open,
  resumes on close; "End game now" sets `ended_at` + status → `complete`

### Session 6 — Play, results, and end game (`/game/:id` continued)

Built from `game-in-play.html`, `round-results.jsx`, and `final-results.jsx`.

- **Waiting / in-play view** from `game-in-play.html`:
  - Locked bids grid (all players' bids shown as tiles)
  - Stat cards: hottest streak, biggest bid, dealer burden (recent 3 / by-player toggle)
  - Pause / resume (☕ chai break overlay with elapsed MM:SS)
  - "Enter Round Results →" CTA transitions to `results` phase
- **Results entry** from `round-results.jsx`:
  - Per-player tricks-won number pad; flash animation (green = made, red = missed)
  - Sum validation: must equal `cards_dealt` to unlock "Next Round →"
  - Live scoring: points this round, running totals, leaderboard with rank deltas
  - MVP reveal (highest single-round scorer) when sum is exact
  - On lock: INSERT `round_results` rows (tricks_won + computed score);
    compute next round's trump + cards + dealer; INSERT new `rounds` row;
    transition back to `bidding`
  - **End Game** button: set `ended_at`, status → `complete`, navigate to `/game/:id/final`
- **Final results** from `final-results.jsx`:
  - Standings table with medal ranks, accuracy %, streaks
  - SVG score progression chart (one line per player, hover tooltip, legend toggle)
  - Full running tab (all rounds)
  - "← Back to setup" navigates to `/`

### Session 7 — History & stats (`/history`)

- List of all games the logged-in user created, sorted by date
- Each row: game name, player count, winner, final scores, duration (`ended_at - started_at`)
- Clicking a game → detail view using the RunningTab component (extracted from `final-results.jsx`)
  plus final standings
- Stats summary across all the user's games:
  - Total games played
  - Win rate (% of games where the user's named seat had the highest score)
  - Best scoring round ever
  - Accuracy rate (% of bids exactly correct across all games)
- Data: Supabase joins across `games` + `game_players` + `rounds` + `bids` + `round_results`

## Deferred / Future

- **Offline support** — defer; internet connection assumed for now
- **Admin view** — view all games across all users (not just own games)
- **Light theme** (Mehfil palette) — design exists, not planned for initial build
- **Player account upgrade prompt** — encouraging anonymous users to create an account
