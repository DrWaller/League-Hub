# Fantasy Hockey League Hub

A public site for your ESPN league (ID 78683444): standings, weekly matchups,
rosters, custom power rankings, and hand-curated league history.

## What's real vs. preview right now

Every page works today with clearly-fake preview data (see `data/mock-data.ts`).
Nothing breaks or looks empty before you connect ESPN — a small banner just
says "preview data" until the two environment variables below are set.

## Deploying (same pattern as your other dashboard)

1. **Upload to GitHub.** Create a new repo (e.g. `league-hub`) and drag-and-drop
   this whole folder's contents in through GitHub's web upload — no local git
   needed, same as before.
2. **Import into Vercel.** New Project → import that repo → Vercel auto-detects
   Next.js, no config needed. Deploy.
3. **Add environment variables** in Vercel (Project → Settings → Environment
   Variables):
   - `ESPN_S2` — from your browser's ESPN cookies (see below)
   - `ESPN_SWID` — same place, includes the curly braces
   - `ESPN_LEAGUE_ID` — `78683444` (already the default if you skip this)
   - `ESPN_SEASON_YEAR` — e.g. `2027`
4. Redeploy (Vercel does this automatically after you save env vars, or trigger
   it manually from the Deployments tab). The "preview data" banner disappears
   once real data comes through.

### Getting ESPN_S2 and ESPN_SWID

This needs a computer (mobile browsers don't expose this):
1. Log into fantasy.espn.com in a normal browser.
2. Open DevTools (F12 or right-click → Inspect) → **Application** tab (Chrome)
   or **Storage** tab (Firefox) → **Cookies** → `https://fantasy.espn.com`.
3. Copy the `espn_s2` and `SWID` values into Vercel as above.

`espn_s2` occasionally expires and needs refreshing (no fixed schedule).
`SWID` tends to be stable for a long time.

## Setting up the Commissioner admin area (/admin)

The admin area lets you post Weekly Awards, matchup previews/recaps, keepers,
and team logos — all from forms, no code editing. Three things to set up in
Vercel, all one-time:

1. **Set a password.** In Vercel → Settings → Environment Variables, add
   `ADMIN_PASSWORD` with any password you choose. That's what gates `/admin`.
2. **Connect Postgres.** In your Vercel project, go to the **Storage** tab →
   **Create Database**, and choose a Postgres option — **Neon** is the
   standard pick (Vercel's own Postgres product was retired; Neon is what
   replaced it, and it's a one-click install from Vercel's Marketplace).
   Connect it to this project. It automatically adds a `DATABASE_URL`
   environment variable — no manual setup. The first time any admin page
   runs, the app automatically creates the tables it needs.
3. **Connect Blob storage** (for team logo uploads). Same **Storage** tab →
   **Create Database** → **Blob**. Connect it to this project. Vercel adds
   `BLOB_READ_WRITE_TOKEN` automatically.
4. Redeploy once after connecting both (Deployments tab → latest → Redeploy)
   so the new environment variables take effect.

Then visit `yoursite.vercel.app/admin`, log in with the password from step 1,
and you're in. There's also a small "Commissioner" link in the site's footer
so you don't have to remember the URL.

### Using the admin area day to day

- **Weekly Awards**: pick a season/week, fill in whichever categories apply
  (leave the rest blank), hit Save. Nothing shows on the public Awards page
  for a week until at least one category has been filled in.
- **Matchup Blurbs**: pick a week, write a short preview before it's played
  or a summary after — each matchup saves independently.
- **Keepers**: add one player at a time per team/season; remove with the
  "Remove" link if you make a mistake.
- **Team Logos**: upload an image per team (square works best). It replaces
  the initials badge everywhere on the site immediately.



`data/mock-data.ts` has a `LEAGUE_HISTORY` array — one object per season. It's
edited by hand on purpose, not pulled from ESPN, because:
- One season was played on Fantrax instead of ESPN.
- One season ended early due to COVID-19.

Both get a `tags` array (`"Played on Fantrax"` / `"COVID-shortened"`) that
renders as a small badge on the History page, plus an optional `note` string
for more context. Add a new season by copying an existing entry and editing
the fields — nothing else in the app needs to change.

## Known gaps / good next steps

- **Power rankings movement (↑/↓ vs. last week)**: needs last week's ranking
  persisted somewhere — now that Postgres is connected for the admin CMS,
  this could reuse it (a small table snapshotting rankings each week). Not
  wired up yet — the model itself (`lib/power-rankings.ts`) is ready for it.
- **Power rankings formula**: the current blend (win% / point differential /
  streak) is a reasonable starting point, not a definitive one. Worth
  revisiting once a season's worth of results shows whether it's actually
  predictive, or whether a category should be weighted differently.
- **Admin area has one shared password**, not per-owner logins. Fine for a
  single commissioner; if other people should be able to post awards/blurbs
  independently, that would need real accounts (e.g. NextAuth) instead.
- **ESPN's API is unofficial and undocumented.** If a page ever looks wrong
  after an ESPN update, `lib/espn.ts` is the one file that talks to ESPN —
  start there.
- **Team names**: pulled from ESPN's `name` field (falling back to the older
  `location + nickname` split, then the abbreviation). If a team ever shows
  up oddly, it likely hasn't set a custom name in ESPN's own team settings.
