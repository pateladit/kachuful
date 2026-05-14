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
