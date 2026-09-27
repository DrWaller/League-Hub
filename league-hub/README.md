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
  (leave the rest blank), hit Save. A **"Suggest from stats"** button pulls
  that week's actual top fantasy scorers (overall for the 3 Stars, by
  position for Forward/Defense/Goalie) from ESPN and pre-fills the form —
  review and adjust before saving, it's a starting point, not an autopilot.
  Nothing shows on the public Awards page for a week until at least one
  category has been filled in.
- **Matchup Blurbs**: pick a week, write a short preview before it's played
  or a summary after — each matchup saves independently. A **"Generate
  draft"** button under each box asks Claude to write a short draft grounded
  in real scores/records/top performers (never invented stats) — read it
  over and edit before saving. Requires `ANTHROPIC_API_KEY` (see below);
  everything else on the site works fine without it.
- **Keepers**: add one player at a time per team/season; remove with the
  "Remove" link if you make a mistake.
- **Managers**: add each owner once, then assign them a row per season —
  which ESPN team id they controlled, what that team was named that year,
  and an optional record note. This is what lets the public Managers page
  and the Keepers page's "By Team" view follow a person across team-name
  changes. The Keepers admin page still saves by team id + season; the
  Managers assignment is what maps that back to a person.
- **Trades**: log a player moving between two managers in a given season —
  shows up on both the Keepers page (season view) and each manager's
  profile.
- **Team Logos**: upload an image per team (square works best). It replaces
  the initials badge everywhere on the site immediately.
- **Monthly Periods**: define a "month" as a range of weeks with a label
  you pick (e.g. "October", weeks 1–4) — it doesn't need to match calendar
  months. This is what Monthly Awards and the monthly newsletter run on.
- **Monthly Awards**: same player categories as Weekly Awards (3 Stars,
  Forward/Defense/Goalie + runners-up), with its own "Suggest from stats"
  button aggregating real points across the period's weeks. **Manager of
  the Month** is shown alongside it but isn't something you fill in — it's
  computed automatically from real win-loss results for that week range,
  since a record is a fact, not an editorial pick.
- **Trades** now has an optional **week** field, so a trade can be tied to
  a specific week (used by the newsletter to know what happened when) —
  leave it blank for older trades where you don't know the exact week.
- **Newsletter**: a compiled recap page (weekly and monthly), not an email
  — no email service to configure. Most of the page (scores, awards,
  trades, standings) is assembled automatically from data you've already
  entered elsewhere; the admin page is just for the intro paragraph, which
  you can write yourself or generate with **Generate Draft** (uses the same
  `ANTHROPIC_API_KEY` as matchup drafts, grounded in the real compiled
  facts for that period).
- **ESPN History Explorer**: a diagnostic tool, not a data source of its
  own. Pick a past season and see exactly what ESPN's API returns for it —
  team names/ids, and owner names if ESPN happens to retain them that far
  back. Useful for filling in Managers accurately instead of guessing from
  old spreadsheets, but not guaranteed to have data for every season.
- **Import Records**: pulls the real win-loss-tie record and points
  for/against for every team in a chosen season, straight from ESPN.
  Preview first, then import. This only writes record data — it never
  creates or changes a manager assignment, so it's safe to run before
  Managers is filled in for that season. Run it once per season you want
  (there's no bulk/range import — each season is a deliberate action, so
  skipping one you don't trust yet, like an incomplete season, is just a
  matter of not clicking Import for it). Afterward, any team-season row
  that came in without a manager shows up in an "Unassigned Team-Seasons"
  list on the Managers page for quick assignment.

### Setting up AI-drafted matchup write-ups (optional)

1. Go to console.anthropic.com, create an account if you don't have one,
   and generate an API key. It's pay-as-you-go — a draft costs a fraction
   of a cent, there's no subscription.
2. In Vercel, add an environment variable named `ANTHROPIC_API_KEY` with
   that key as the value.
3. Redeploy.

Without this set, every other part of the site (including the stat-based
"Suggest from stats" button, which needs no AI) works exactly the same —
only the "Generate draft" button is disabled until this is added.



`data/mock-data.ts` has a `LEAGUE_HISTORY` array — one object per season. It's
edited by hand on purpose, not pulled from ESPN, because:
- One season was played on Fantrax instead of ESPN.
- One season ended early due to COVID-19.

Both get a `tags` array (`"Played on Fantrax"` / `"COVID-shortened"`) that
renders as a small badge on the History page, plus an optional `note` string
for more context. Add a new season by copying an existing entry and editing
the fields — nothing else in the app needs to change.

## Browsing historical matchups and rosters

The Matchups and Rosters pages both have a season selector once at least
one past season has a manager record on file (via Import Records or added
by hand). Picking an older season pulls that season's actual schedule,
scores, and rosters straight from ESPN — the same live-fetch approach as
the current season, just pointed at a different year. Nothing is copied
into the database for this; it's fetched fresh each time (and cached for a
day, since past seasons don't change).

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
