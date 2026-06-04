# Ujagro — Game Night Score Tracker

**Ujagro** ("to illuminate / awaken" in Gujarati) is a multi-game companion app for score
keeping and data entry, screen-shared to a TV. Currently supports **Ka Chu Fu L** (Judgement)
with infrastructure for additional card and board games. One logged-in scorekeeper runs the
app; all player seats are entered manually. No multi-device sync required.

- **Tagline**: "Where every game night begins." / *જ્યાં રાત શરૂ થાય.*
- **Production URL**: https://kachuful-eight.vercel.app

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
| `team_mode` | text nullable | `'none'` \| `'alternating'` \| `'custom'` — null means no teams |
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
| `team` | smallint nullable | `1` or `2` for team assignment; null when `team_mode = 'none'` |

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
- `profiles` SELECT policy is own-row-only (tightened S12 — was all authenticated users)

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

Admin access: run `UPDATE public.profiles SET is_admin = true WHERE id = '<uuid>'` in Supabase SQL editor.

## Supported Games

| Subtype | Category | Status | Notes |
|---------|----------|--------|-------|
| `kachufull` | card | Full support | Judgement / Oh Hell; complete game loop |
| `freeform` | card | Setup only | Free Form Entry; scorekeeper enters scores per player/team per round; game loop TBD |
| `spades3` | card | Placeholder | 3 of Spades; rules/scoring not yet configured |
| *(board games)* | board | Placeholder | Coming soon; free-form scoring model planned |

## Build History (Sessions 1–26)

- **S1–S6**: Scaffold → schema → auth (Google + anonymous) → Lantern theme → gameLogic.js → full Ka Chu Fu L game loop (BidEntry, PlayingScreen, ResultsEntry, FinalResults, Game.jsx phase router)
- **S7**: useHistory hook + History.jsx (deep Supabase query, 4-stat summary, game list)
- **S8**: GameOverSplash (confetti), FinalResults podium + share dropdown, rankBg, AccountMenu
- **S9**: StatsModal + gameLogic stat functions (nilBidStats, cardCountStats, dealerBurden, etc.); Stats button wired everywhere
- **S10**: Multi-game type (game_type/game_subtype/game_config columns + migration); Home.jsx game-selection flow; freeform placeholder
- **S11**: Ujagro rebrand; Google OAuth redirect fixed to Vercel URL
- **S12**: profiles RLS own-row-only; micro-animations (useCountUp, ripple, avatar-pulse, score-pop); 6 CCR scheduled routines
- **S13**: Accessibility pass (aria-*, focus-visible, color-scheme, theme-color meta)
- **S15**: Login redesign polish (React.memo, keyframes to CSS, focus-visible); History "Scorebook" redesign (lattice bg, expandable cards)
- **S16**: Home.jsx audit — 18 setup-* CSS classes, semantic HTML, React.memo + useCallback + useMemo
- **S17**: Login/History composition refactor (explicit variant components); useFrequentPlayers hook + SeatEditor
- **S18**: Free Form Entry setup (team_mode/team columns + migration, A/B badges); BidEntry full redesign (game-content grid, chip strip, forbidden shake)
- **S19**: PlayingScreen redesign; gameColors.js created (trumpTint); PauseOverlay component
- **S20**: BidEntry "Felt Table" (suit-bleed, lattice, watermark, flavor, player-color pad, radial glow); gameColors.js expanded (pageBleed/labelColor/flavor); trumpById Map in gameLogic.js
- **S21**: PlayingScreen Felt Table (suit-bleed, lattice, live-dot running tab row, WinStreakCard/LoseStreakCard); full audit
- **S22**: ResultsEntry Felt Table; rotating highlight card (MVP/Nil/Closest Call); leaderIds Set; sticky lime footer
- **S23**: StatsModal redesign — hero cards + score progression chart + 15-col comparison table + honorary titles; groupBidStats/groupTrumpStats/closestCallCount added to gameLogic.js
- **S24**: StatsModal → 12 metric cards grid (METRIC_CARDS/MetricCard); ResultsEntry /frontend-design (compact info bar, 2-col tiles, highlight strip, standings primary); full audit fixes
- **S25**: StatsModal audit (7 web + 7 react fixes); GameHeader + RunningTab extracted as shared components; formatRank/rankBg moved to gameColors.js; ~400 lines removed from callers
- **S26**: SummaryModal /frontend-design (leader hero with watermark, standings section, Felt Table panel)

## Tooling & Workflow

### Production URL
`https://kachuful-eight.vercel.app`

### Scheduled Remote Agents
6 CCR routines run in Anthropic's cloud. Manage at `https://claude.ai/code/routines`.
Routines use Supabase MCP + Gmail MCP for email reports to ptladit@gmail.com.

### Preview / Verification Limitation
The preview browser has no Supabase session — every route behind `ProtectedRoute` redirects to `/login` (blank `#root`). Correct verification: **`npx vite build --mode development`** — clean exit confirms no compile errors. Visual verification requires a real browser with an active session (production URL or `localhost:5173`).

### "Felt Table" Aesthetic — Key Design Rules
Applied to all game screens (BidEntry, PlayingScreen, ResultsEntry) and modals:
- **Suit-bleed background**: `trumpTint().pageBleed` + `transition: background 0.9s ease` — page hue shifts per trump (♠ cold steel, ♦ amber-warm, ♣ olive-green, ♥ deep crimson, NT neutral)
- **Diamond lattice**: fixed-position SVG at `opacity: 0.022`
- **Trump card**: `overflow: hidden` + 130px watermark glyph at 9% opacity + suit flavor label ("cold · commanding" etc.)
- **Player-color**: bid buttons fill in player's personal color; bids in running tab shown in player's color
- All implemented via `gameColors.js` (`trumpTint`) + per-screen inline styles

### Running Tab Layout
Breakpoint: **1100px viewport**. Above: sticky right sidebar (~380px), spotlight/entry takes left column. Below: stacks. Round column `position: sticky; left: 0`. Implemented via `.game-content` + `.game-tab-sidebar` CSS classes in `index.css`.

### Game Screen Status

| Screen | Status |
|--------|--------|
| `BidEntry.jsx` | Felt Table ✓ (S20). Pending: `/web-design-guidelines` + `/react-best-practices` + `/composition-patterns` audit (S27) |
| `PlayingScreen.jsx` | ✓ Done S21 — Felt Table + full audit |
| `ResultsEntry.jsx` | ✓ Done S24 — Felt Table + /frontend-design + full audit |
| `StatsModal.jsx` | ✓ Done S24/S25 — /frontend-design (12 metric cards) + full audit |
| `SummaryModal.jsx` | ✓ Done S26/S27 — /frontend-design + /web-design-guidelines + /react-best-practices |
| `GameHeader.jsx` | ✓ Extracted S25. Pending: `/web-design-guidelines` + `/react-best-practices` audit (S27) |
| `RunningTab.jsx` | ✓ Extracted S25. Pending: `/web-design-guidelines` + `/react-best-practices` audit (S27) |

## Deferred / Future

### Session 27 Next Steps (in order)
1. `/web-design-guidelines` + `/react-best-practices` audit on `GameHeader.jsx` + `RunningTab.jsx`
2. `/web-design-guidelines` + `/react-best-practices` + `/composition-patterns` on `BidEntry.jsx`, `PlayingScreen.jsx`, `ResultsEntry.jsx`

### Backlog
- **Free Form Entry game loop** — round structure (no trump/bid mechanics); scorekeeper enters raw score per player/team per round; round_results.score stored directly; running totals; End Game same as Ka Chu Fu L
- **3 of Spades** — scoring, round structure, and game loop to be defined
- **Board game support** — free-form scoring model; specific games TBD
- **Emoji retention** — add `emoji` column to `game_players` so SeatEditor can pre-fill emoji alongside colour
- **Saved players schema** — `saved_players` table: `id, user_id, display_name, color, emoji, games_together_count, last_played_at`; upsert after each game; replaces lightweight frequency query in `useFrequentPlayers`
- **Player identity across games** — non-host players are anonymous name strings; long-term allow non-host accounts so stats accumulate regardless of who hosts
- **Tie handling for rank display** — award same rank to all tied players; show multiple winners in GameOverSplash, FinalResults podium, and History
- **Rank 1 visual treatment** — amber gradient highlight on rank-1 row and top scorer chip
- **Multi-device sessions** — each player on their own phone; major architecture pivot, very future
- **Offline support** — defer; internet connection assumed
