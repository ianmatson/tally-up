# Tally Up

A mobile-first app for friends to work toward shared workout goals. Groups set a goal over a fixed period with one or more components (for example 10,000 pushups and 50 miles). Members log progress at any time, the dashboard shows whether the group is on pace (as a single "days ahead/behind" figure plus per-component detail), and a weighted leaderboard ranks members by points.

Stack: Svelte 5 (client-rendered) + TanStack Query + shadcn-svelte, served by a Cloudflare Worker (Hono) with D1 and Google sign-in.

## How the numbers work

- Each component has a **points-per-unit** weight. A member's score is the sum of `amount × weight` over everything they log. New components default to `1000 / target`, so every component is worth 1,000 points at its target; the admin can change this.
- **Overall progress** is the points-weighted share of all targets, with each component capped at its target.
- **Days ahead/behind** is `(overall progress − share of the period elapsed) × goal length in days`, using the group creator's time zone.

## Local development

```sh
npm install
npm run db:migrate:local
cp .dev.vars.example .dev.vars   # then fill in the Google credentials
npm run dev
```

For local Google sign-in, add `http://localhost:5173/auth/google/callback` as an authorized redirect URI on the OAuth client.

## Google OAuth client

1. In Google Cloud Console, open **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
2. Add authorized redirect URIs: `https://<your-worker-domain>/auth/google/callback` (and the localhost one above).
3. Configure the OAuth consent screen (External, scopes `openid`, `email`, `profile`) and publish it so friends outside your test-user list can sign in.

## Deploy to Cloudflare

```sh
npx wrangler d1 create workout-together      # copy the database_id into wrangler.jsonc (the database keeps its original name)
npm run db:migrate:remote
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run deploy
```

## Scripts

`npm run check` type-checks the client and Worker, `npm test` runs the scoring tests, and `npm run types` regenerates Worker binding types after changing `wrangler.jsonc`.

## Titles and crowns

Titles are permanent account unlocks earned within a single goal: Initiate (first contribution), Tally Acolyte (3 consecutive days), Tally Disciple (7), Tally Veteran (14), and Tally Legend (28). Activity dates use the group's timezone, and multiple entries on a day count once. Existing activity is backfilled by migration `0006_achievements.sql`. Users can equip any unlocked title in an expanded leaderboard row or the members drawer; until they choose, their highest unlocked title is displayed.

Crowns use full-goal totals, independent of leaderboard filters: Juggernaut (pushups), Blade Runner (mileage), Titan (squats), Unbreakable (situps), GOAT (weighted points), and Final Boss (distinct active days). Ties retain the incumbent; initial ties use earliest contribution, then user ID. Previous holders are recorded, and archived goals retain their standings. Corrections to entries update standings without revoking permanent titles.

Activity names are currently free-form. Rep crowns recognize pushups, squats, and situps (including spaces/hyphens) with repetition units. Mileage includes distance components in miles, kilometers, or meters, normalized to miles. Other activities still count toward points and active days.

The production GitHub Actions workflow applies migrations before deploying the Worker. For a manual deployment, run `npm run db:migrate:remote` first. Local verification uses `npm run db:migrate:local`. Achievement SQL tests use Node's built-in SQLite support (Node 22.13+).
