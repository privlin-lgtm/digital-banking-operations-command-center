# Brief — portfolio screenshots and walkthrough

Written 2026-09-08 by a planning session. Portfolio polish, **not feature work**.

## Why this repo, and why now

BankOps is one of four employer-facing portfolio pieces (the others are
`genpay-api`, `document-archive-digitalization-pipeline` and
`fintech-operations-dashboard`). It is the deepest system of the four: 27
commits, CI, Docker, ADRs, CHANGELOG, SECURITY.md.

**Its one real weakness is that it has no screenshots.** A 95-line README cannot
carry a system this size, and a reader deciding in thirty seconds whether to keep
going has nothing to look at. Of the twelve projects in the portfolio only two
have any images at all. That is what this brief fixes.

## Goal

1. `docs/screenshots/` holding 4–6 PNGs of the strongest screens.
2. Those images embedded in `README.md`, near the top, above the architecture prose.
3. One 60–90 second **silent** walkthrough of the main incident flow (MP4 or
   animated GIF) in `docs/`, linked from the README.
4. A re-runnable capture script so this never has to be done by hand again.

## Approach

The stack: npm monorepo, Next.js web app at `apps/web` on port 3000, Express +
Swagger API at `apps/api`, Postgres via docker compose. `npm run db:seed` loads
six months of simulated operational history — use it, the screenshots should show
a populated system, not empty states.

```
npm run docker:up:detach     # or npm run dev, whichever comes up cleanly
npm run db:migrate
npm run db:seed
```

Then a Playwright script at `scripts/capture-screenshots.ts`. **Check first
whether Playwright is already configured in this repo** and reuse that setup if
so rather than adding a second one.

- Fixed viewport, **1440x900**.
- Pick light or dark and use it for every shot. Say which you picked and why.
- Wait for network idle and for real data to render. A screenshot of a loading
  skeleton is worse than no screenshot.
- Name files by content (`incident-command.png`), never by number.

**Suggested screens**, in rough priority order. Substitute freely if something
better exists once it is running:

1. Incident list / triage queue
2. Incident command view — the single best screen in the product, probably
3. SLA and error-budget tracking
4. A runbook
5. A chaos experiment
6. Swagger overview, only if it looks good

For the walkthrough: one continuous path through the main incident flow. No
narration, no captions burned in, no cursor jitter. Playwright's `recordVideo`
is the simplest route.

## Definition of done

- Screenshots committed, README renders them, walkthrough recorded and linked
- Capture script runs from a clean checkout and reproduces the same images
- Nothing committed over ~2MB per file

## Boundaries

- **Do not change application behaviour, styling, or seed data to make the shots
  look better.** If a screen looks bad, stop and say so. That is a design
  decision, and it belongs to Paul, not to this session.
- **Do not push.** Commit locally. He wants to look before these become public.
- Do not touch anything outside `apps/`, `docs/`, `README.md` and the new script.
- Do not rewrite the README's prose. Add images to it; leave the words alone.
- Note that `docs/architecture/adr/0003-simulated-fleet-not-real-microservices.md`
  is deliberately honest that the twelve services are simulated. Keep that framing
  intact; do not let new README copy imply otherwise.

## Report back with

The file list, and **one line per screenshot saying why that screen earned a
slot**. If you could not get something running, say what and why rather than
substituting a weaker screen silently.

---

# CORRECTION — round 2, written 2026-09-08 after reviewing round 1

Round 1 was much closer than fintech-ops. The seed worked: `incident-triage-queue.png`
shows **57 rows** of realistic incident titles, which is exactly the density this
repo needed. One defect disqualifies the set as it stands.

## The blocker: raw database IDs where names belong

In the triage queue, the **SERVICE** and **COMMANDER** columns render CUIDs:

```
SERVICE    cmtsji5n        COMMANDER  cmthfp3u
```

Nearly every row shows the same service id, which suggests either the seed
assigns almost everything to one service, or a join is not resolving to the
service name.

The same appears on the Overview screen: the single active incident lists its
service as `cmtsji5n`.

This is the first thing a reviewer notices, and it reads as an unfinished join
in a system whose whole pitch is operational maturity.

**Diagnose it and report before changing anything.** Two different problems with
two different owners:

- **A rendering bug** — the API returns the name and the UI shows the id, or the
  UI never asks for the name. That is a real defect worth fixing on its own
  merits, and fixing it is in bounds. Say what you found.
- **A seeding artefact** — the data genuinely has one service carrying almost
  every incident. That is a seed problem, and changing the seed to flatter a
  screenshot is out of bounds. Report it and stop.

## Also fix

1. **Overview is 55% empty.** `incident-command.png` has content down to roughly
   430px of a 900px viewport, and one active incident against zero alerts and
   zero critical services. Either crop to content, or drop this screen — the
   triage queue and fleet health both say more.
2. **Screen names should match the file names.** `incident-command.png` is
   actually the Overview page, not an incident command view. If a genuine
   single-incident command screen exists, capture that and name this one
   `overview.png`.
3. **`incident-triage-queue.png` is 210KB** — the largest in the set. Fine, but
   keep every file under the ~2MB ceiling and prefer optimised PNGs.

## What to keep

The triage queue is the strongest image in either repo and becomes the lead shot
once the SERVICE and COMMANDER columns read as names. `service-fleet-health.png`,
`sla-error-budget.png`, `runbook-catalog.png` and `api-reference.png` were not
flagged in review; recheck them yourself against the framing rule below.

## Framing rule, both rounds

Every shot starts at the top of its page with the heading visible. No mid-page
scroll positions. Crop to content rather than shipping empty background.

## Unchanged from round 1

Do not push. Do not change styling or seed data to flatter a screenshot. Report
one line per image on why it earned its slot — and if a screen looks bad, say so
rather than shipping it.
