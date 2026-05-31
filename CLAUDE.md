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

- **Session 11** — branding + auth fixes:
  - App renamed to **Ujagro**; tagline "Where every game night begins." / *જ્યાં રાત શરૂ થાય.*
  - Login hero updated; nav headers across all pages (Home, History, Game, Admin, Preferences) updated to Ujagro; game-specific Ka·Chu·Fu·L labels left intact
  - Google OAuth redirect fixed: Supabase Site URL + Redirect URLs updated to `https://kachuful-eight.vercel.app`
  - `game_type` / `game_subtype` columns confirmed added via `add_multi_game_type.sql` migration (resolves "column does not exist" error on History page)

- **Session 12** — security hardening + micro-animations + scheduled routines:
  - **Security**: tightened `profiles` SELECT policy — was `authenticated` (all users could list all profiles + see `is_admin`); replaced with own-row-only via `supabase/tighten_profiles_policy.sql` migration
  - **Micro-animations**:
    - New `src/hooks/useCountUp.js` — `requestAnimationFrame` count-up with ease-out cubic; `duration` and `enabled` options
    - `src/index.css` — 4 new keyframe animations: `ripple` (bid pad press), `avatar-pulse` (active player ring), `slide-in-right` (rank delta badge), `score-pop` (score reveal)
    - `BidEntry.jsx` — bid pad buttons play `.bid-press` ripple on press; active-player avatar wrapped in `.avatar-pulse` ring
    - `ResultsEntry.jsx` — `AnimatedScore` component using `useCountUp` on earned points, MVP score, and standings totals; rank delta badges use `.rank-delta` slide-in
    - `PlayingScreen.jsx` — `AnimatedTotal` component animates TOTAL row in running tab using `useCountUp`
  - **Scheduled routines** — 6 CCR remote agents created at `claude.ai/code/routines` (Supabase MCP + Gmail MCP):
    1. **Prod health check** — daily 9 AM PT; queries Supabase for stuck in-progress games, anomalies; emails ptladit@gmail.com
    2. **Stuck games cleanup** — daily 8 AM PT; flags games in-progress > 24 h with no recent rounds
    3. **CLAUDE.md reminder** — weekly Monday 9 AM PT; reminds to update CLAUDE.md after sessions
    4. **Dependency check** — weekly Monday 10 AM PT; checks for outdated npm packages
    5. **Signup summary** — weekly Monday 9 AM PT; weekly new user signup counts from Supabase
    6. **Anon nudge** — weekly Monday 9 AM PT; counts anonymous users with ≥2 games who haven't upgraded

- **Session 13** — accessibility pass (web-design-guidelines audit):
  - `aria-label` on all icon-only buttons: color swatches, ↑↓ reorder, × remove, cut-for-dealer cards, color picker swatches, Stepper −/+
  - `aria-pressed` on game type toggle, deck selector (1/2), no-trump toggle, color picker swatches
  - `role="radio"` + `aria-checked` on game selection and scoring variant buttons
  - `aria-expanded` on color swatch trigger; `aria-live="polite"` on Stepper value display
  - `focus-visible` rings on all inputs (`Login.jsx`, `Home.jsx`) and all icon buttons
  - `autocomplete` + `name` attributes on all form inputs; `spellCheck={false}` on email; `htmlFor` wired to game name label
  - `Stepper` component accepts `label` prop for descriptive aria-labels
  - Placeholder text ends with `…` on guest name, game name, player name inputs
  - `color-scheme: dark` on `<html>` — native scrollbars and selects adopt dark theme
  - `<meta name="theme-color" content="#2a1620">` — mobile browser chrome matches app background

- **Session 15** — Login redesign polish + History page redesign:
  - **Login accessibility/perf fixes** (react-best-practices + web-design-guidelines audit):
    - `rise`/`breathe` keyframes moved from inline `<style>` to `index.css`
    - `CORNER_POSITIONS`, `inputStyle`, `toggleBtnStyle` hoisted to module level
    - `Page` wrapped in `React.memo` — atmospheric decorations never re-render on state changes
    - Brand `<div>` → `<h1>`; tagline → `<p>` with `text-wrap: balance`
    - `{error && ...}` → `{error ? ... : null}` throughout
    - `transition: all` removed from tab buttons → explicit CSS class properties
    - `onMouseEnter/Leave` mutations replaced with CSS `:hover` classes
    - `focus-visible` rings on all interactive elements via `login-*` CSS classes
    - `touch-action: manipulation` on all buttons
    - `outline: none` removed from inputs → `.login-input:focus` in CSS
    - `htmlFor` wired on all Field labels
    - `text-wrap: balance` on tagline and short headings
  - **History page full redesign** — "The Scorebook":
    - New Game as full-width hero `<Link>` with diamond lattice pattern
    - Game collection strip: Ka·Chu·Fu·L with live play count; 3 of Spades + Board Games as "coming soon" tiles
    - Compact game cards: winner color bar, avatar, name/score, meta row (name · players · duration · relative time)
    - Tap-to-expand inline standings with medals, color dots, Stats + Full Results actions
    - `expandedIds: Set<id>` — multiple cards expandable simultaneously
    - Subtle 2% lattice background texture — consistent with login, not theatrical
    - `timeAgo()` helper for relative timestamps
    - Sticky header with Ujagro brand + AccountMenu
  - **History react-best-practices + web-design-guidelines fixes**:
    - `processGame` runs once per game via `useMemo(games.map(processGame), [games])` — eliminates double-call
    - `GameCard` + `GameTile` wrapped in `React.memo`
    - `toggleCard` stable via `useCallback([])` — memoization effective
    - `LatticeBg` hoisted to memoized module-level component — never re-renders after mount
    - `onNavigate` prop eliminated — `GameCard` uses `<Link>` directly
    - `toSorted()` replaces spread+sort throughout `processGame`
    - All `&&` JSX conditionals → explicit ternary with null
    - Navigation actions use `<Link>` not `<button onClick={navigate}>`
    - `<div role="button">` → semantic `<button>` on card toggle row
    - `focus-visible` rings, `touch-action`, `aria-label`, `aria-expanded`, `aria-hidden`, `aria-live` throughout
    - `font-variant-numeric: tabular-nums` on all score/count numbers
    - `translate="no"` on brand and game names

- **Session 16** — Setup page react-best-practices + web-design-guidelines audit + fixes:
  - **CSS** (`index.css`): 18 new `.setup-*` classes — `:hover` transitions, `:focus-visible` rings (2px amber outline), `touch-action: manipulation` on all interactive elements; removes all JS `onMouseEnter/Leave` style mutations from the page
  - **Semantic HTML**: page body `<div>` → `<main>`; seats strip + config cards wrapped in `<section aria-label="…">`
  - **ARIA fixes**: `role="radiogroup"` wrapper on card game radio buttons; `aria-expanded` + `aria-controls="adv-settings"` on settings toggle; `aria-hidden` on decorative arrows/glyphs; color swatch `aria-label` now uses human name (e.g. `"amber"`) via `COLOR_NAMES` map instead of raw hex
  - **Focus**: `outline: 'none'` removed from both inputs; focus handled by `.setup-name-input:focus` / `.setup-game-name-input:focus` CSS
  - **`transition: 'all'`** removed from tab switcher → explicit `background`, `color` in CSS class
  - **React**: `SeatAvatar`, `SeatEditor`, `Stepper` wrapped in `memo`; `addPlayer`, `removePlayer`, `updatePlayer`, `assignDealer`, `closeEditor`, `toggleAdv`, `dismissBanner` in `useCallback`; `usedNames` + `hints` in `useMemo`
  - **`useEffect` deps**: removed all `eslint-disable-line` suppression comments; proper dependency arrays
  - **JSX**: all `{x && <el>}` → `{x ? <el> : null}` throughout

- **Post-Session 15** — Setup page full redesign — "The Pre-Game Huddle" (`Home.jsx`):
  - **Layout**: non-sequential two-column grid — all config visible without scrolling; seats strip at top as the hero interaction; config cards below; sticky header with ← History link; sticky bottom bar with live blocking hints + Start Game button
  - **Player seats**: seat cards (86×86) with avatar + name; tap to open inline `SeatEditor` popover with name input (Tab-to-autocomplete from suggestions), Colors tab (12-color palette) + Emojis tab (24 emoji avatars); dealer badge shown on assigned seat card; × remove button appears on hover (only when >2 players); click-outside closes editor
  - **Config cards**:
    - Game selection: pill buttons for card games + compact board game chips (Catan, Ticket to Ride, Pandemic as "Soon" tiles)
    - Dealer: single "Assign randomly 🎲" button → shows result + ↻ Again (replaces cut-for-dealer card mechanic)
    - Game name: bottom-border-only input, consistent with login style
    - Settings: collapsed by default, toggle to expand scoring/rules/rounds config
  - **Sticky bar**: live blocking hints ("2 players need a name · assign a dealer") clear to "N players · ready ✓" when all conditions met; Start Game activates only when all conditions met
  - **Preserved**: all Supabase INSERT logic, `game_type` + `game_subtype` in insert, anonymous upgrade banner, all accessibility attrs, Stepper component

## Tooling & Workflow

### Production URL
`https://kachuful-eight.vercel.app`

### Scheduled Remote Agents
6 CCR routines run in Anthropic's cloud against the GitHub repo. Manage at `https://claude.ai/code/routines`.
Routines use the **Supabase MCP** connector (credentials stored securely by Anthropic — not in code) and **Gmail MCP** for email reports to ptladit@gmail.com.

## Deferred / Future

- **Offline support** — defer; internet connection assumed for now
- **Multi-device sessions** — each player connects on their own phone to view status and submit bids; major architecture pivot, very future
- **3 of Spades rules** — scoring, round structure, and game loop to be defined and implemented
- **Board game support** — free-form entry scoring model; specific games TBD
