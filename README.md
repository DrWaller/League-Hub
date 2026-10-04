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
  "Remove" link if you make a mistake. **Import Keepers** (`/admin/keeper-import`)
  pulls them in bulk from the Keeper History Google Sheet (one tab per season):
  preview first, add-only (keepers already on the site are skipped, so it's safe
  to re-run as 2027 keepers come in). It matches the sheet's manager names to
  Managers and uses the team linked to them for that season (falling back to their
  latest earlier team when the season isn't linked yet). The keeper type and
  position are saved in the note. The sheet must be shared as "Anyone with the
  link" for the site to read it, otherwise use the paste box. Parsing is in
  `lib/keeper-import.ts`.
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



## League History and past seasons

**Past seasons are found automatically.** The site asks ESPN which earlier
seasons it has for this league (the last dozen years), so Standings,
Matchups, Rosters, the Luck Chart, and League History all offer the same
season buttons with no import needed. A season the league didn't play on
ESPN (the Fantrax year) simply isn't found there -- it still appears on
League History once you write an entry for it.

- **Standings** has a season selector; a past season shows its final
  regular-season standings (ranked by record, then points for -- ESPN's own
  tiebreakers may differ slightly).
- **League History** (public) lists every past season, newest first, with its
  playoff result -- Champion, Runner-up, and 3rd Place, each entered by hand
  since ESPN has no idea who won the playoffs -- plus the **Regular Season
  Champion**, worked out automatically from that season's final standings (no
  typing needed, and it's shown separately so it's never confused with the
  playoff Champion when the two differ) -- any tags/notes, a tap-to-open final
  standings table, and links to that season's Standings, Luck Chart and
  Matchups. The final-standings table comes from ESPN; a manager's name shows
  in brackets (on the podium and in that table) when you've assigned managers
  to that season on the Managers page.
- **Admin > League History** is where you enter the playoff result --
  Champion, Runner-up, and an optional 3rd Place -- plus the tags
  "COVID-shortened" / "Played on Fantrax", and a note. Team names are
  suggested from that season's ESPN teams as you type. There's no field for
  Regular Season Champion; that one takes care of itself.
- **A season played on another platform (the Fantrax year).** Tick
  "Played on Fantrax" on that season's League History entry and the site
  stops using ESPN for it *everywhere*: it's left out of the season buttons
  on Standings / Matchups / Rosters / Luck Chart, opening it by address shows
  a "played on Fantrax" notice instead of ESPN's numbers, its standings and
  records never appear on League History, record imports for it are refused,
  and any ESPN records or team names already saved for it by an earlier import
  are hidden (leftover unassigned rows) or blanked (rows you assigned a manager
  to). The season still appears on League History with its champion,
  runner-up and notes. Untick the tag and everything reverts. The rule lives
  in `lib/played-elsewhere.ts`.
- **Import Records** is no longer needed just to make a season show up. It
  now only matters for linking a season's teams to managers (the Managers
  page), and as a backup source for a season's standings if ESPN can't
  answer.

Season labels are ESPN's own season numbers (e.g. "2026"), the same
numbering the rest of the site uses.

## The Fantrax season, and the Records page

**Entering a season played on another platform** (admin > *Fantrax Scores*).
First tag the season "Played on Fantrax" on the League History admin page
(this switches ESPN's data for that year off everywhere). Then paste that
season's weekly scores, one game per line:

    week, home team, home score, away team, away score

(add `,playoff` to a playoff game; put a team name in "quotes" if it contains a
comma). A live preview checks the paste as you type -- bad numbers, a team
playing itself, a team in two games in one week, and (as warnings) a missing
game or a misspelled team name -- and shows the standings it would produce so
you can check them against Fantrax before saving. Saving again **replaces** the
season's games, which is how you correct a mistake. Then link each team to its
manager on the same page.

The site then works that season out from the scores: Standings, Matchups, the
Luck Chart (public page and image) and League History all show it, labelled as
entered by hand. Rosters aren't tracked for it. Standings are computed from
regular-season games (win-loss, then points for), so they should match
Fantrax's own unless Fantrax used a different tiebreaker.

**Linking managers to teams** (admin > *Link Managers*). The Records page adds up
each *manager's* history, so every past team needs a manager. Pick a year and
that year's own team names are listed, each with a manager dropdown that saves
the moment you choose. The number on a year is how many of its teams still need a
manager (a tick means done). Shortcuts: **Copy links from <previous year>** fills
this year's unlinked teams from the same team slot last year; **fill other years**
(next to a linked team) uses that manager for every other year where the team is
still unlinked; for the Fantrax year, **Auto-link teams named after managers**
does all ten in one tap. Linking only changes the manager -- it never overwrites
a saved team name, note, or record.

**Playoffs and games that don't count** (admin > *Playoffs & Rules*). For each
finished season you set the week the playoffs began; every game from that week
on is a playoff game and is left out of standings, the Luck Chart, and all-time
totals. This *overrides* whatever ESPN (or the pasted scores' `,playoff` marker)
said, so it doesn't depend on ESPN flagging playoffs correctly; leave it blank to
use the data's own flags. You can also mark individual games (or a whole week) as
"doesn't count" -- for games before the playoffs that shouldn't be counted, e.g.
played after a team was eliminated. Games in playoff weeks are already left out of
the regular season, so those don't need ticking. When a season has any ruling, its
Standings and League History table are recomputed from the games that count
(ESPN's own win-loss totals can't know about your rulings); with no rulings, ESPN's
numbers are used as before. Rulings apply to finished seasons; the current
season keeps using ESPN's live flags. The Matchups page labels playoff games and
games that don't count. Logic: `lib/season-rules.ts`.

**The Records page** (public, /records) totals up every finished season --
ESPN and the hand-entered Fantrax one together, regular season only:
- all-time standings per manager (record, win%, points, titles, runner-ups,
  first-place finishes),
- best and worst seasons and most points in a season,
- single-game records (highest and lowest scores, biggest blowouts, closest
  finishes), and
- a head-to-head grid between every pair of managers.

Titles and runner-ups come from League History: the champion/runner-up you
type there has to match that season's team name (spelling and capitalization
don't matter, spacing is ignored), otherwise the page says which one it
couldn't match. Any team not yet linked to a manager is left out of the totals,
and the page says how many. The maths lives in `lib/records.ts` and was
cross-checked against a separate implementation on generated data; the database
functions were run against a real Postgres engine.

## Browsing historical matchups and rosters

The Matchups and Rosters pages both have a season selector (seasons are
found automatically -- see above). Picking an older season pulls that season's actual schedule,
scores, and rosters straight from ESPN — the same live-fetch approach as
the current season, just pointed at a different year. Nothing is copied
into the database for this; it's fetched fresh each time (and cached for a
day, since past seasons don't change).

## Player weekly stats now explicitly request the week

**Confirmed and fixed.** ESPN's roster response only ever contains season-
aggregate stat buckets (`scoringPeriodId: 0`, distinguished by
`statSplitTypeId` instead -- season total, last-7-days, etc.) unless the
request explicitly asks for a specific `scoringPeriodId`. Without it, a
past season's roster fetch contained no real per-week data at all, no
matter which week the code searched for afterward -- confirmed directly
against the live league via the admin Roster Stats Probe page (still there
for future debugging). `getWeeklyPlayerStats` in `lib/espn.ts` now always
asks ESPN for the specific week explicitly. This fixes Graphics, the
Weekly Awards "Suggest from stats" button, and Matchup Blurbs' draft
suggestion for any week, current or past. As a side effect it also fixes a
latent caching bug: different weeks of the same past season used to share
one cached response (up to 24 hours) since the week wasn't part of the
request URL at all; each week now gets its own.

## Auto-generated graphics

**Graphics** (in the admin area) generates shareable images — 3 Stars,
Top 3 by Position, Team of the Week — from the same real weekly stats as
the Awards "Suggest" button, no admin curation needed, just pick a week.
Matches the visual style approved on the design canvas. Right-click or
press-and-hold an image to save it; there's also a Download link. Uses
`next/og` (built into Next.js — no extra service or API key).

**Player headshots**: each player's photo circle uses their real ESPN
headshot when one's on file, and falls back to the same initials-circle
style as before when it isn't (ESPN doesn't have a photo for every player).
The photo is checked for real before the image is generated (with a strict
timeout), so a missing or slow photo can never break the graphic -- worst
case, that one player just shows initials. The URL pattern
(`a.espncdn.com/i/headshots/nhl/players/full/{id}.png`) is documented and
was verified against a real local test image end-to-end (circular clipping,
crop-not-stretch, colored borders, and the fallback all confirmed working),
but this environment can't reach ESPN's own image servers to test against
them directly, so the very first real check of ESPN's actual photos happens
on a live deployment. Logic lives in `lib/headshots.ts` (the availability
check) and `lib/og-avatar.tsx` (the shared avatar element).

All three graphics also take an optional `?season=YYYY` (and a matching
field on the admin Graphics page) to pull a **past** season's already-
completed weeks instead of the current one -- handy before the current
season has any stats posted yet, e.g. to check real players' photos show
up correctly without waiting.

**Luck Chart**: what each team's record would be if it played every other
team every week ("all-play" -- the "expected" record), against the record
it actually has. The Luck column is actual win% minus expected win%:
**green = lucky** (won more than the all-play record says), **red =
unlucky**, shaded darker for bigger gaps, and the luckiest and unluckiest
team are called out above the table. Also shown: median points per week
vs. the league median, and "Chg" (places moved in expected-win% ranking
since the week before). Ties count as half a win.

It appears in two places: as a live table on the public **Power Rankings**
page (season buttons, plus arrows to step through weeks; a past season
opens on its end-of-season chart), and as a shareable image on the admin
**Graphics** page (type a season there for a past season's final chart).
Past seasons come straight from ESPN, so a season button appears for any
season you've imported records for (or add `?season=2026` to the address).

Only completed **regular-season** games count -- playoff games and bye
weeks are excluded, since only some teams play them. Playoff games are
recognised by ESPN's `playoffTierType` field, which is the one thing here
not yet confirmed against a real league: if a past season's chart looks
off (say, an extra week or two of very lopsided results), that's the first
place to look (`getMatchups` in `lib/espn.ts`). The math is in
`lib/luck.ts` and was cross-checked against a separate implementation on
test data.

**Player Spotlight**: one featured player per week (top scorer by default,
or narrow by position on the Graphics page; `?playerId=` picks a specific
player, `?season=` a past season) with headshot, points, and stat tiles --
goals/assists/shots for skaters, saves/SV%/GA/wins for goalies. The ESPN stat
ids come from the community `espn-api` project's hockey map, NOT verified
against this league: open `/api/admin/graphics/player-spotlight?week=N&debug=1`
(logged in) to see a player's raw stat ids and, if a tile looks wrong, fix the
ids in `lib/espn-stats.ts` (the only place they live).

## Weekly routine, more graphics, and admin extras

**Weekly Checklist** (`/admin/weekly`): pick a week and see what's done
(matchup blurbs, awards, writeup) with links to the tool for each step,
including Generate Graphics opened to that week. It's on the admin dashboard.

**More graphics** (all on the admin Graphics page, all with a download link):
- **Matchup Preview** -- the upcoming week's games with each team's record and
  power-ranking spot going in (results through the previous week). Current
  season only.
- **Weekly Scoreboard** -- every matchup's final score, winners highlighted,
  plus high score and closest game. Works for past seasons via `?season=`.
- **Power Rankings** -- the ranked list with record, streak, score and
  movement arrows. Current season only.
- **Team logos** appear on these and on the Luck Chart, and beside team names
  on the player graphics. Only PNG, JPEG and GIF logos can be drawn; any other
  file type (WebP, SVG) or a failed download just shows that team's initials.
  Past seasons show no logos (a past team id may belong to a different manager).
- **Standings playoff line**: a red line is drawn under the last playoff spot, using
  the league's playoff team count from ESPN (6 if ESPN doesn't say).
- **Matchup Preview head-to-head**: each game shows the managers' all-time series
  ("EVAN LEADS 5-3", "SERIES TIED 4-4"). Built in `lib/head-to-head.ts` from
  regular-season results (the same games the Records page counts) plus this
  season's earlier weeks, following the MANAGER so a renamed team keeps its
  history. Needs the teams linked to managers under Link Managers; a game with an
  unlinked team, or two managers who have never met, just shows "VS".
- **Ice theme (hybrid)**: the portrait graphics keep the navy header and sit on a
  pale icy gradient with faint rink markings (faceoff circle, center dot and line)
  behind the cards. All in `lib/portrait-graphics.tsx` (`frame()`).
- **Stat lines** on 3 Stars / Top 3 (portrait): "4 G \u00b7 4 A \u00b7 10 SOG" for skaters,
  "32 SV \u00b7 .941 \u00b7 2 GA" for goalies (`statLine` in `lib/espn-stats.ts`; same stat ids
  as Player Spotlight, so a wrong tile there means a wrong line here).
- **Standings movement and streaks** (portrait): a small arrow beside the rank shows
  places moved since last week (by wins minus losses) and a green/red tag under the
  record shows the streak.
- **Copy caption**: every graphic card on the Graphics page has a Copy caption
  button. Each graphic route returns ready-to-post text when called with `&caption=1`
  (`lib/captions.ts`), including the week's dates when the Week Days calendar is saved.
- **Player Radar** (`/api/admin/graphics/player-radar`, portrait only): a percentile
  radar for one player, current season. Each axis is one of the league's scoring
  categories (read from ESPN's scoring settings and labelled in `STAT_META`,
  `lib/espn-stats.ts`; skaters and goalies get their own sets). The value is the
  player's PER-GAME rate (rate stats like GAA/SV% are used as-is), ranked against
  every NHL player at the same position group (forwards / defensemen / goalies,
  from ESPN's player list, most-owned first) who has played the minimum games. The
  minimum is half of what the leaders have played (1-15 games) unless `&minGames=N`
  is given, so early-season percentiles are noisy -- a small-sample note appears
  when the player is under it. A stat the league scores negatively (goals against,
  PIM...) is flipped so a bigger point is always better, and doing nothing in a
  count stat always scores 0. Pick a player with `&playerId=N` (the Graphics page has
  a name search); without it the week's top scorer (`&week=N`) is used. `&debug=1`
  returns the categories, pool size and every percentile as JSON -- the first thing to
  check if an axis looks wrong. Logic in `lib/radar.ts`, drawing in `lib/radar-image.tsx`.
  Card design: big headshot and name, then the radar on a navy panel with a GOLD shape (never red/green, which
  are reserved for good/bad numbers). Related categories sit next to each other
  (`AXIS_ORDER` in `lib/radar.ts`); the dashed ring is labelled AVG. It skips the
  rink-marking background (`plain` option of `frame()`).
  Rare stats (shutouts, OT losses, short-handed goals/assists, hat tricks: `RARE_STATS` in
  `lib/radar.ts`) aren't plotted, because most players have none and the chart would
  collapse; they show as season-count tiles in the panel's top-left corner (if that would
  leave fewer than 3 axes they stay on the chart). DEF is dropped for forwards. A previous
  season: add `&season=YYYY` (needs `&playerId=`): uses that season's ESPN player list and
  scoring settings, minimum games capped at 20, labelled with the season. The Player Cards
  page has an "Add a previous season" picker (`/api/admin/players/seasons`).
  Fantasy points table (total and per game): each shown as a percentile (big) with the rank
  beside it, vs ALL players (forwards + defensemen + goalies together; fantasy points use the
  league's own scoring so they compare across positions) and vs his own group. Each group
  applies its own minimum-games cutoff. `pointsComparison` in `lib/radar.ts`; the `points`
  block of `&debug=1` shows the numbers. The totals are the big numbers; beside each is the rank
  (larger) and the percentile (smaller), e.g. "#24  96th pct" -- no pool size shown. Other layouts
  exist behind `&pts=pct|rank|both` (percentile only, rank only, percentile big + rank small).
- **Player Cards** (`/admin/player-cards`): pick one player (search any NHL player by
  name, or choose a fantasy team and then a player from its roster) and every card for
  that player is generated: Player Radar and the weekly Player Spotlight (week box
  defaults to the latest completed week). The card list is the `cards` array in the page,
  so a new player card type is one more entry. Uses the shared `components/GraphicCard.tsx`
  (also used by the Graphics page) and `/api/admin/players/rosters` for the team dropdowns.
- **Player Bars** (`/api/admin/graphics/player-bars`, portrait only): the same data as the Player
  Radar drawn like Baseball Savant's percentile panel -- one bar per category on a shared
  POOR / MEDIAN / GREAT scale, a numbered circle at the end of each bar, the actual per-game value
  on the right, categories grouped into SCORING / PHYSICAL (or GOALIE), rare stats as season-count
  tiles. Best for goalies and any league with many categories. Both cards share
  `lib/player-profile.ts` (`loadProfile`) so they always agree, and take the same parameters
  (`playerId` or `week`, `season`, `minGames`, `debug`, `caption`). A player below the minimum games is
  NOT QUALIFIED: the radar dims, the bars are hatched with no percentiles. Colors use a blue (strong) /
  neutral (median) / coral (weak) scale (`scaleColor` in `lib/radar.ts`), which stays readable with
  common color blindness unlike red/green. The radar's dashed ring is labelled MEDIAN (it is the 50th
  percentile of the pool). The Player Cards page shows both cards for a picked player.
  The header band of both cards is the PLAYER (photo, name, position/team, games played; the shared
  `lib/player-header.tsx`, passed to `frame()` as `headerContent`) rather than a card-type title.
- **Find by rank** (Player Cards page, `/api/admin/players/ranks`): browse the players in rank order by total
  fantasy points, fantasy points per game, or any scoring category per game (lower-is-better categories
  sort the other way), among all players or just forwards / defensemen / goalies; "Start at rank" jumps
  to a rank. A Season dropdown ranks a previous season's final numbers instead (that season's ESPN player
  list and scoring; choosing a player from it also adds that season's cards). Only players who meet the
  minimum games count, like the cards; click a name to pick him.
- **Image caching**: next/og tells browsers to keep every image for a year (`immutable`), which made
  a graphic you had already opened keep showing the old picture even after new stats or a redeploy.
  Every image response now sends `NO_CACHE` (`lib/og-theme.ts`) and the card fetch uses `cache: "no-store"`.
- **Public Player Cards** (`/players`, in the main nav): the same Player Cards page without the commissioner
  login: search a player, pick from a team, browse rankings, previous seasons; Radar, Bars and the weekly
  Spotlight. The page is `components/PlayerCardsBrowser.tsx`, shared with the admin page (props choose the
  endpoints). The public endpoints are `/api/cards/*` (images) and `/api/players/*` (search, rosters,
  ranks, seasons): thin wrappers around the admin handlers (`lib/public-cards.ts`), so the two can't
  drift apart. Because anyone can open them: answers are cached on Vercel's CDN for 15 minutes, `debug`
  is refused, errors aren't cached, and setting the environment variable `PUBLIC_PLAYER_CARDS=off`
  switches the public cards off (404) without touching the admin ones.
- **Standings** -- the full table (record, points for/against; the landscape one
  also shows diff and streak). Current season uses ESPN's own order (same as the
  Standings page), `?week=N` gives the table as of week N, `?season=YYYY` a past
  season's final table.
- **Portrait is the primary shape**: every graphic defaults to a 1080 x 1350 (4:5)
  layout for phones and Instagram; the Shape dropdown on the Graphics page (or
  `&format=landscape` on any graphic's address) gives the wide version. Portrait
  layouts are in `lib/portrait-graphics.tsx`, landscape ones in the `lib/*-image.tsx`
  files.

**Power rankings** blend win %, point differential and streak (see
`lib/power-rankings.ts`), built only from completed regular-season games. Movement
arrows compare the ranking through the latest final week to the week before;
nothing is stored. The admin **Formula Test** (`/admin/formula-test`) backtests
the formula against every past season; on this league's 7 seasons nothing beat
the current formula by more than noise, so the weights were left alone.

**Weekly stats and the week -> scoring period mapping**: this league scores
DAILY (a scoring period is one day) with multi-day matchup weeks, so "week N" is
a group of days. ESPN does NOT say which days belong to a week for this league
(the schedule has no per-day breakdown, and `scheduleSettings.matchupPeriods`
just maps matchup periods to matchup periods), so the commissioner enters each
week's length once per season at **Week Days** (`/admin/week-days`), copied from
ESPN's schedule page. `lib/week-calendar.ts` turns those lengths into days.
`getWeeklyPlayerStats` uses ESPN's per-day data if it ever appears, otherwise
the saved week lengths, and sums every day, counting only days a player was in an
active lineup slot (bench/IR skipped). With nothing saved, the player graphics
(3 Stars, Top 3, Team of the Week, Player Spotlight) show an error pointing to
Week Days instead of reporting one night as a week. `/api/admin/period-probe`
(logged in) shows what ESPN returns, for checking. Empty results show diagnostics.

**Admin login**: the cookie holds a signed, expiring token, never the password.
Optionally set `ADMIN_SESSION_SECRET` in Vercel; changing it or `ADMIN_PASSWORD`
logs everyone out.

**AI-drafted blurbs** only work for the current season; asking for a past
season returns a clear message instead of mixing in current-season data.

## Known gaps / good next steps

- **Power rankings movement (▲/▼ vs. last week)**: built. Nothing is stored:
  the ranking is recomputed from the weekly results both through the latest
  completed week and through the week before, and the difference is the
  arrow. Playoff and excluded games don't count. Before the first week is
  final it falls back to the plain standings with no arrows.
- **Power rankings formula**: the current blend (win% / point differential /
  streak) is a reasonable starting point, not a definitive one. Worth
  revisiting once a season's worth of results shows whether it's actually
  predictive, or whether a category should be weighted differently.
- **Admin login** stores a signed, expiring session token in the cookie (never
  the password). Optionally set `ADMIN_SESSION_SECRET` in Vercel for extra
  hardening; changing it or `ADMIN_PASSWORD` logs everyone out.
- **Admin area has one shared password**, not per-owner logins. Fine for a
  single commissioner; if other people should be able to post awards/blurbs
  independently, that would need real accounts (e.g. NextAuth) instead.
- **ESPN's API is unofficial and undocumented.** If a page ever looks wrong
  after an ESPN update, `lib/espn.ts` is the one file that talks to ESPN —
  start there.
- **Team names**: pulled from ESPN's `name` field (falling back to the older
  `location + nickname` split, then the abbreviation). If a team ever shows
  up oddly, it likely hasn't set a custom name in ESPN's own team settings.
