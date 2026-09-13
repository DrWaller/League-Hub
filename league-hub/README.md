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

## Editing league history

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
  persisted somewhere (Vercel KV or a small Postgres table). Not wired up
  yet — the model itself (`lib/power-rankings.ts`) is ready for it.
- **Private admin view**: not built. When you want it, the cleanest approach
  is a `/admin` route gated by a simple password check (via middleware) or a
  proper login (e.g. NextAuth) if you want per-owner accounts.
- **ESPN's API is unofficial and undocumented.** If a page ever looks wrong
  after an ESPN update, `lib/espn.ts` is the one file that talks to ESPN —
  start there.
- **Team names**: currently pulled as `location + nickname` from ESPN, which
  is how ESPN stores custom team names. If a team ever shows up blank or odd,
  it likely hasn't set a custom name in ESPN's own team settings.
