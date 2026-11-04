# The Preprint

A daily, ranked digest of new machine-learning preprints, published as a static GitHub Pages site
with one Discord channel per edition. There is no database: every issue is a JSON file in `data/`.

**Editions** (one JSON file each in [`config/editions/`](config/editions/)):

| Edition | Page | Discord secret |
|---|---|---|
| General AI | `#/general` | `DISCORD_GENERAL_WEBHOOK_URL` |
| Medical AI | `#/medical` | `DISCORD_MEDICAL_WEBHOOK_URL` |
| AI for Education | `#/education` | `DISCORD_EDUCATION_WEBHOOK_URL` |

## How an issue is made

Every morning at 06:30 UTC, [the workflow](.github/workflows/update-dashboard.yml) runs
`npm run build:editions`, deploys the site and posts each issue to its Discord channel.

1. **Fetch once.** It pulls the full arXiv announcement for the union of all editions' categories
   (about 1,000 entries) and drops revisions of older papers (about 40% of the feed). It then adds
   Hugging Face Daily Papers, whose upvotes serve as a community signal. Editions with
   `arxivQueries` also run a keyword search across all of arXiv for the last few days, which
   catches papers outside their categories (for example, an education benchmark filed in cs.IR).
2. **Filter per edition.** Each edition keeps papers in its arXiv categories that match its topic
   keywords. Matching uses word boundaries, so `rl` does not match "world". Focused editions
   (Medical, Education) require a topical match; upvotes only re-rank papers that already qualify.
   Topics marked `"gate": true` are domain topics: at least one must match (`minGateScore`), so a
   method word like "multimodal" can't pull a non-medical paper into the Medical edition.
   Papers featured in an earlier issue are skipped.
3. **Triage.** An LLM scores the top candidates 0–10 for the reader described in `readerProfile`,
   writes a one-line "why", and drops anything below `minLlmScore`.
4. **Front page.** The LLM writes a short editor's note that cites papers inline, plus a
   "Read first" list of three papers. `editorVoice` adds a per-edition style instruction.
5. **Publish.** It writes `data/editions/<slug>/issues/<date>.json`, `latest.json`, `index.json`
   and `seen.json`, then refreshes `data/editions.json`.

If the LLM is unavailable, the ranking falls back to the keyword and upvote heuristic, and the
top paper becomes the lead story. Nothing is ever invented. If an edition has nothing new (for
example, arXiv doesn't announce on weekends), it publishes no issue and sends no Discord ping.

## Old archive

The 120 daily snapshots from the original AI Newspaper pipeline (July–November 2026) are kept
unchanged in [`data/legacy/`](data/legacy/) and can be browsed at `#/archive`. Newsletter items
that the old pipeline invented for unreachable feeds are hidden in that view, and the page shows
how many were hidden.

## Adding or tuning an edition

Copy one of the files in `config/editions/` and edit it. Adding a file adds an edition: the site
nav and the Discord sender pick it up automatically. Add the webhook secret named in
`discordWebhookEnv` to the repo and to the workflow's `Post to Discord` step.

To see what a profile would select today without writing anything:

```sh
npm run build:editions -- --dry-run --no-llm --edition medical
```

## Local use

Requires Node 24. Put `OPENROUTER_API_KEY` and the webhooks in `.env` (see `.env.example`).

The OpenRouter free tier allows about 50 free-model requests per day, and a full run uses about 10.
Manual workflow runs keep today's issues (`--skip-existing`) unless you tick **rebuild**.

```sh
npm install
npm run build:editions          # fetch + rank + write today's issues
npm run dev                     # site at http://localhost:5173/Ai-News-Dashboard/
npm run send:discord -- --dry-run   # print the Discord payloads instead of posting
npm test
```

The LLM model is set in [`config/settings.json`](config/settings.json). The first entry is the
primary model; the others are automatic OpenRouter fallbacks.
