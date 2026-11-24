# Tally Up

A mobile-first app for friends to work toward shared workout goals. Groups set a goal over a fixed period with one or more components (for example 10,000 pushups and 50 miles). Members log progress at any time, the dashboard charts the group's total progress against the pace needed to finish (with a per-component breakdown), and the leaderboard ranks members by their weighted contribution to the goal.

Stack: Svelte 5 (client-rendered) + TanStack Query + shadcn-svelte, served by a Cloudflare Worker (Hono) with D1 and Google sign-in.

## How the numbers work

- Each component's **weight** is its share of the whole goal, entered as a percentage. Weights are relative, so they count in proportion even when they do not add up to 100. New components split the goal evenly; an admin can change this. A group can have several admins. When the last admin leaves or deletes their account, the longest-standing member becomes admin.
- **Overall progress** is the sum of each component's share × its completion, with each component capped at its target.
- A member's **contribution** is the part of the goal their logs complete. Logs are credited in date order; once a component reaches its target, later logs for it count for nothing, so members' contributions add up to overall progress.
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

Crowns work in every group. Titles are exclusive to the existing **DG (Daddy Gainz)** group. Migration `0007_dg_achievements.sql` resolves that exact name once and stores its ID; later renames do not affect eligibility, and another group using that name does not gain access. Missing or duplicate matches leave titles disabled. Other groups cannot earn, equip, or display titles.

Titles are permanent group-scoped unlocks earned within a single DG goal: Initiate (first contribution), Tally Acolyte (3 consecutive days), Tally Disciple (7), Tally Veteran (14), and Tally Legend (28). Activity dates use the group's timezone, and multiple entries on a day count once. The scope migration backfills only DG activity and removes awards attributed to other groups. Users can equip any unlocked title in an expanded leaderboard row or the members drawer; until they choose, their highest unlocked title is displayed.

Crowns are awarded per day in every goal. When a day in the group's timezone ends, the member with the largest contribution to the goal that day earns a crown, and so does the member with the largest contribution to each activity. Contributions use the same crediting as the leaderboard, so logs past an activity's target do not count. A tie, or a day with no counted logs for a category, awards nothing. Crowns accumulate for the whole goal. The client computes them from the goal's entries, so existing goals are covered and corrections to past entries update the counts.

The production GitHub Actions workflow applies migrations before deploying the Worker. For a manual deployment, run `npm run db:migrate:remote` first. Local verification uses `npm run db:migrate:local`. Achievement SQL tests use Node's built-in SQLite support (Node 22.13+).
