# gameya

**A finished browser arcade game — *Sky Bento Dash* — that the deploy config in
this repo does not serve.** The game is one Cloudflare Worker file,
`appview/gameya-play-canvas/src/app.ts`: a three-stage side-scroller (collect
bento, dodge masks) written as a canvas loop inside an inline HTML string, plus
`/health` and an `/xrpc/` endpoint that hands back a LangGraph run payload for
an agent-driven quality loop. It runs. It is complete. It is also not what
`wrangler.jsonc` builds.

The name says the subject, not the role. Read it as *the gameya game* — 「ゲーム
屋」, the game shop. It is `kind :app` (`README.edn`), extracted verbatim from
`etzhayyim/root` at `60-apps/etzhayyim-project-gameya` (`migration.edn`, source
revision `d1ff44f494`, 22 files / 179,889 bytes).

## The split — measured 2026-08-13 at tip `0f866b5`

`wrangler.jsonc` sets `"main": "svelte/.svelte-kit/cloudflare/_worker.js"`. That
is a SvelteKit build, and `svelte/src/routes/+page.svelte` is a **generated
appview placeholder** — a dark self-description card that prints
`routeCount: 0`. The game is not in it and is not reachable through it.

Both were built and served locally. The difference is not an inference:

| `wrangler dev` (the repo's own config) | `wrangler dev src/app.ts` (the game) |
|---|---|
| `/` → 200, **2,277 bytes** | `/` → 200, **15,700 bytes** |
| `<title>gameya-play-canvas</title>` | `<title>Gameya - Sky Bento Dash</title>` |
| no `<canvas id="game">` | `<canvas id="game">` present |
| `/health` → **404** | `/health` → 200, actor JSON |
| `/xrpc/…` → POST-only proxy to `mcp.etzhayyim.com` | `/xrpc/…` → 200, LangGraph run payload |

So `progress.md`'s "Deployed `gameya.etzhayyim.com/*` … Worker
`kotodama-g4m3ya00`" describes a Worker built from a *different* main than the
one this config now names. Whatever is deployed, this tree cannot rebuild it.

Reproduce both columns: [`docs/operator-quickstart.md`](docs/operator-quickstart.md),
steps 3 and 4.

## Status: not live — measured 2026-08-13

**Three of the four hosts this repo declares do not resolve**, including the one
the game calls its own identity (`did:web:gameya.etzhayyim.com`):

| host | declared in | resolves? |
|---|---|---|
| `etzhayyim.com` | zone for both routes | **yes** |
| `gameya.etzhayyim.com` | `wrangler.jsonc`, `PROJECT.jsonld`, `src/app.ts`, `output/gameya-quality/summary.json` | **NXDOMAIN** |
| `g4m3ya00.etzhayyim.com` | `wrangler.jsonc` route | **NXDOMAIN** |
| `mcp.etzhayyim.com` | `AGENTGATEWAY_MCP_ROUTER_URL` — the SvelteKit BFF's only upstream | **NXDOMAIN** |

The parent zone resolves and a control lookup against an unrelated host
succeeded, so these are genuine absences, not a local DNS fault.

**Re-measure before trusting this table** — it is dated, and dated tables rot:

```bash
nbb docs/check-surface.cljs      # exit 1 today; exit 0 would mean this table is stale
```

The script has three exit codes so that *could not measure* is never reachable
from the same exit code as *measured, all fine*: `0` all resolve, `1` at least
one does not, `3` could-not-answer (no working DNS here, or zero hosts
extracted). Both `1` and `3` were demonstrated before this README was written.
It carries no hardcoded host list — it reads the hosts out of the files that
declare them, so adding a route brings it under the check automatically. It is a
copy of the sibling `cloud-itonami/games` script; keep the two in sync by
copying, not by diverging.

## What is verified working

Every command in [`docs/operator-quickstart.md`](docs/operator-quickstart.md)
was executed against this tip on 2026-08-13 and the output there is the output
observed. In short: `npm ci` → `npm run typecheck` (exit 0) → `npm test`
(1 passed) → the game serves locally and plays.

## Known gaps

1. **The deployable does not contain the game** (the table above). Either point
   `main` at `src/app.ts` and drop the SvelteKit scaffold, or move the game into
   the SvelteKit app. Nothing in the repo picks.

2. **The test suite is one assertion, `expect(true).toBe(true)`.** It would
   still pass with `src/app.ts` deleted. The 17,628-byte game — collision, stage
   progression, scoring, the `render_game_to_text` agent hook — has no unit test
   at all, and both are pure functions of state that a `node`-environment vitest
   could exercise directly.

3. **`scripts/quality-gate.mjs` cannot run from this repo.** It resolves its
   Playwright install five directories up from `scripts/`, which was the
   monorepo root before extraction and is now outside the repo entirely
   (`/private/` on the recorded run):

   ```
   Error: ENOENT: no such file or directory, scandir '/private/node_modules/.pnpm/'
   ```

   That gate is the substantive test — it plays all three stages, checks
   pause/resume, mobile touch, and the XRPC payload. Fixing the path would
   convert gap 2 from "untested" to "covered by an end-to-end playtest".

4. **`output/gameya-quality/` is a committed run against a host that no longer
   exists**, with absolute paths from a machine-local checkout
   (`/Users/junkawasaki/github/etzhayyim-root/…`). Three PNGs and a
   `summary.json` claiming `"url": "https://gameya.etzhayyim.com"`. It is
   evidence of a past run, not of the current tree.

5. **`progress.md` is pre-extraction history**, and it names files that did not
   come across — `.github/workflows/gameya-quality-gate.yml` and
   `30-graph/graph-schema/sql_migrations/…gameya_quality_loop_assistant.up.sql`
   are both absent from this repo. Read it as a log of the old monorepo, not as
   a description of this tree.

## Layout

```
README.edn                    identity — {:kind :app}, canonical metadata is EDN
PROJECT.jsonld                schema.org VideoGame record
migration.edn                 provenance of the extraction from etzhayyim/root
NOTICE                        Apache-2.0 + etzhayyim Charter Rider v3.1
progress.md                   pre-extraction build log (see gap 5)
docs/check-surface.cljs       re-measures the status table above
docs/operator-quickstart.md   every command, walked
appview/gameya-play-canvas/
  src/app.ts                  THE GAME — Worker + inline canvas game (17,628 B)
  test/gameya.test.ts         one placeholder assertion (see gap 2)
  scripts/quality-gate.mjs    Playwright playtest gate, broken path (gap 3)
  wrangler.jsonc              main → svelte build, NOT src/app.ts
  svelte/                     SvelteKit appview scaffold + XRPC→MCP proxy
  output/gameya-quality/      stale committed run artifacts (gap 4)
```

## License

Apache-2.0 with the etzhayyim Charter Compliance Rider v3.1. See `NOTICE`.
