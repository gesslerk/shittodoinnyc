# Shit To Do in NYC

A Monday 6am email of things worth leaving the house for in New York, built for exactly one reader. Not a listings feed: every issue is researched against a written taste profile, fact-checked, and written in the voice of a friend who already has the plan and a text you can forward to the group chat.

The reader profile lives in [`profile/`](profile/). Everything else is plumbing.

## What arrives

Five to seven picks for the coming Thursday to Sunday, each with the when, where, price, why it fits *you*, a heads-up, a link, and a copy-paste invite text. Then a **Book now** radar for the next six weeks, one or two **Anytime** places, and one **With the kid** weekend daytime pick. Bauhaus layout: blue circle for the guys, red square for date night, yellow triangle for family.

## How it works

```
Monday 06:00 New York
  │
  ├─ 0. Instagram (optional)  Apify pulls the last 14 days of posts from profile/instagram.md,
  │                            in parallel with the web lanes; only the Instagram lane waits for it
  │
  ├─ 1. Research               7 parallel Claude calls, one per lane, each with web search + web fetch
  │      music · fights · food · culture · body · scenes · instagram
  │      → structured JSON candidates with ISO dates, URLs, confidence grades
  │
  ├─ 2. Filter + dedupe        code drops anything without a URL, outside the window, or duplicated
  │
  ├─ 3. Curate                 one Claude call chooses by candidate id and writes the copy;
  │                            dates, venues, prices and links are joined back from research in code,
  │                            so the writer cannot invent a fact
  │
  ├─ 4. Verify                 one Claude call re-fetches every chosen page and confirms date/venue/price;
  │                            corrections are folded into the candidate pool, contradicted items removed,
  │                            and if anything material moved the curator runs a second pass on the
  │                            corrected facts (new choices get checked too)
  │
  ├─ 5. Render + send          Bauhaus HTML + plain text, via Resend or Gmail
  │
  └─ 6. Archive                archive/<date>/ is committed back to the repo, so next week
                               knows what it already recommended
```

Model: Claude Opus 5 for every stage, adaptive thinking, structured JSON output, server-side refusal fallbacks enabled (if the API ever declines a request, it is re-run on a fallback model automatically). Set `RESEARCH_MODEL=claude-sonnet-5` to cut the research bill by more than half if that ever matters.

## Setup

You need three secrets in the GitHub repo. Add them at **Settings → Secrets and variables → Actions**, or from a terminal that has the `gh` CLI logged in:

```bash
gh secret set ANTHROPIC_API_KEY --repo gesslerk/shittodoinnyc
```

```bash
gh secret set RESEND_API_KEY --repo gesslerk/shittodoinnyc
```

Each command prompts for the value; nothing is stored in the repo.

**Anthropic key:** create one at https://console.anthropic.com/settings/keys.

**Email, option A (recommended): Resend.** Sign up at https://resend.com with `gesslerk@gmail.com`, create an API key. Without a verified domain, Resend only delivers to the address on the account, which is exactly the address this sends to, from `onboarding@resend.dev`. If you later verify a domain, set the repo variable `EMAIL_FROM` to something like `Shit To Do in NYC <monday@yourdomain.com>`.

**Email, option B: Gmail.** Turn on 2-step verification on the Google account, create an app password at https://myaccount.google.com/apppasswords, then set secrets `GMAIL_USER` and `GMAIL_APP_PASSWORD` instead of `RESEND_API_KEY`.

**Instagram, optional:** see below. Secret name `APIFY_TOKEN`.

### First send

Once the secrets are in, run it by hand from the **Actions** tab (Weekly email → Run workflow). Tick *dry_run* the first time: the email is built and attached to the run as an artifact instead of sent, so you can open `email.html` and judge it. Run it again without dry run to send for real. Manual runs ignore the 6am gate.

From a terminal with `gh`:

```bash
gh workflow run weekly.yml --repo gesslerk/shittodoinnyc -f dry_run=true
```

### Running locally

```bash
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY and one email provider
```

```bash
npm run preview        # full pipeline, writes out/email.html, sends nothing
```

```bash
npm run send           # full pipeline and send
```

```bash
npm run render:sample  # just the template, from samples/sample-issue.json, no API calls
```

`npm test` runs the unit tests for the date gate, filtering, dedupe, assembly and rendering.

Node 20 or newer. The `.env` file is read only if you export it (`set -a; source .env; set +a`) or use `node --env-file=.env src/index.js`.

## Tuning it

Everything the engine knows about you is in `profile/`:

| File | What it does |
|---|---|
| `konrad.md` | The taste profile: who, when, where, what, the non-negotiables, the voice |
| `music.md` | The Spotify-derived music profile, by tier |
| `calendar.md` | Annual traditions by month, so the season shows up on time |
| `sources.md` | Trusted pages each lane fetches first, grouped by lane |
| `instagram.md` | Accounts the Instagram lane watches |
| `feedback.md` | Your running notes. "Loved X", "never again Y". Read every week, newest first |

Edit, commit, push. The next Monday uses it. `feedback.md` is the fastest lever: the curator treats it as the latest word on your taste.

Lane briefs and search hints live in `src/lanes.js` if you want to change what a lane hunts for.

## Instagram

Most of the small, weird stuff is announced on Instagram and nowhere else, and Instagram does not let outsiders read it: pages will not load without a login and there is no API for other people's posts. Two tiers:

- **Search only (default).** The `instagram` lane runs `site:instagram.com` searches for the handles in `profile/instagram.md` and for phrases like "this saturday brooklyn". It reads captions from post metadata when it can. Partial coverage, zero setup.
- **Scraper (recommended).** With an `APIFY_TOKEN` secret, the run first pulls the last 14 days of posts from every handle in `profile/instagram.md` through Apify's Instagram Scraper (`apify/instagram-scraper`) and hands the captions to the lane as primary evidence. Roughly $1.50 per 1,000 posts, so under a dollar a week at 60 accounts. Sign up at https://apify.com, copy the token from Settings → Integrations. Scraping public Instagram is against Instagram's terms; Apify runs it on their side and you are choosing to accept that.

The handle list in `profile/instagram.md` is a starting guess. Fix any handles that are wrong and add the accounts you actually follow for plans.

## Schedule

GitHub Actions cron is best-effort. On the first Monday it fired six hours late, and the original design (run only in the 6am hour) threw the run away. Now the workflow has a slot every 30 minutes from 10:00 to 14:30 UTC on Mondays, which is 6:00 to 10:30am New York in summer and an hour earlier in winter. The first slot GitHub actually honors sends the issue; every later slot finds this week's issue in `archive/` and stops. Whichever slot sends, it is once a week, and a failed attempt leaves no archive entry so the next slot retries.

Manual runs (Actions tab, or `gh workflow run`) always proceed, including a second send in the same week.

GitHub disables scheduled workflows in repos with no commits for 60 days. The weekly archive commit keeps this one alive.

## Cost

Per issue, all stages on Claude Opus 5: the first dry run cost about $16 and took 40 minutes, dominated by the seven research lanes reading web pages. The run log prints the actual number (`~$` on the "built" line) and it is stored in `archive/<date>/run.json`. Levers, cheapest first: `RESEARCH_MODEL=claude-sonnet-5` (about 60% off research), `LANES=music,fights,food` to run fewer lanes, `MAX_SEARCHES_PER_LANE` / `MAX_FETCHES_PER_LANE`, `SKIP_VERIFY=1`.

## Archive

Every sent issue is committed under `archive/<YYYY-MM-DD>/`: `issue.json` (what was sent), `email.html`, `email.txt`, `research.json` (every candidate, what was dropped and why, verification results) and `run.json` (usage and cost). The curator reads the last eight issues so main picks do not repeat.

## If something breaks

- The workflow goes red and GitHub emails you. Open the run log; each stage logs what it did.
- A single research lane failing does not stop the email; the footer says which lane was thin.
- Zero usable candidates stops the run rather than sending an empty email.
- A pick that fails fact-checking is dropped and replaced from the bench; a pick that could not be checked ships with a "confirm before you buy" heads-up.
- `SKIP_VERIFY=1` and `LANES=music` make a cheap smoke test.
