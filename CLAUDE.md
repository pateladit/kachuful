# Ka Chu Fu L (Judgement) — Score Tracker

A card game score tracker for the trick-taking game Ka Chu Fu L, also known as Judgement.

## Tech Stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **Backend/Auth/DB**: Supabase (auth + PostgreSQL)
- **Deployment**: Vercel

## Game Rules

- Trick-taking game supporting any number of players
- Each round: dealer distributes `n` cards; players bid how many tricks they'll win
- Dealer goes last and cannot bid a number that makes total bids equal to cards dealt (at least one player must lose)
- Trump suit rotates each round:
  - Spades (Ka) → Diamonds (Chu) → Clubs (Fu) → Hearts (Laal)
  - Optional 5th no-trump round

### Scoring Variants

| Variant | Correct bid | Zero bid |
|---------|-------------|----------|
| 1 | `10 + tricks` | `10` |
| 2 | `(10 × tricks) + 1` | `1` |
| 3 | `(10 × tricks) + 1` | `10` |

If tricks won ≠ bid → score is `0`.

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | Registered user profiles |
| `games` | Game sessions (scoring_variant, no_trump_round, status) |
| `game_players` | Players in a game (supports guest_name for non-registered players) |
| `rounds` | Individual rounds per game |
| `bids` | Player bids per round |
| `round_results` | Actual tricks won and computed scores per round |

### Key Fields

- `games.scoring_variant`: `1`, `2`, or `3`
- `games.no_trump_round`: boolean — whether a 5th no-trump round is included
- `games.status`: `in_progress` or `complete`
- `game_players.guest_name`: non-null for guest (non-registered) players

## Access Control

- Supabase Row Level Security (RLS) ensures users can only see and modify games they are part of
- Guest players are supported via `guest_name` field without requiring a registered account

## Completed Sessions

- **Session 1** — Vite + React scaffold, Tailwind v4, Supabase client, folder structure, placeholder routes
- **Session 2** — `supabase/schema.sql` with all tables, foreign keys, RLS policies, auth trigger
- **Session 3** — `useAuth` hook + `AuthProvider`, `ProtectedRoute`, `LoginPage` (sign-in/sign-up toggle, email confirmation screen, redirect to `/history`)

## Remaining Sessions

### Session 4 — Game creation (`/`)
- Form to add 2–8 players (registered users by email lookup, or type a guest name)
- Drag-to-reorder player list to set seating order
- Choose scoring variant (radio buttons showing the actual formula for each)
- Toggle for no-trump round
- On submit: create `games` + `game_players` rows in Supabase, navigate to `/game/:id`

### Session 5 — Round play (`/game/:id`)
Core game loop driven by a `useReducer` phase state machine with four phases:
1. **round_header** — round number, trump suit (Ka/Chu/Fu/Laal), cards per player, dealer name
2. **bidding** — per-player bid inputs, lock bids one by one, running total, enforce dealer constraint (block submit if dealer's bid would make total = cards dealt), save to `bids`
3. **results** — per-player tricks-won inputs, validate total = cards dealt, compute + save scores to `round_results` using `scoring_variant`, show round summary with this-round and cumulative totals
4. **auto-advance** — move to next round (next trump, next card count) or transition to `game_over` when all rounds complete

### Session 6 — History & stats (`/history`)
- List of all games the user has played, sorted by date, with players and final scores
- Click a game → full detail view (all rounds, bids vs actuals)
- Stats summary at the top (across all games):
  - Total games played
  - Win rate (% of games where this user had the highest score)
  - Best scoring round ever
  - Most common bid
  - Accuracy rate (% of bids exactly correct)
- Data via Supabase joins on `game_players` + `rounds` + `bids` + `round_results`
