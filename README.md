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

## The split — measured 2026-08-13 at tip `0f866b5`, appview rebuilt 2026-09-07

`wrangler.jsonc` used to set `"main": "svelte/.svelte-kit/cloudflare/_worker.js"`
— a SvelteKit build, with `svelte/src/routes/+page.svelte` as a **generated
appview placeholder**, a dark self-description card that printed
`routeCount: 0`. The game was never in it and was never reachable through it.

**2026-09-07: the SvelteKit scaffold was migrated to cljs (reagent + re-frame +
jp-go-dds), per ADR-2608260900 (repo-wide "Svelte/React are not authored in
this workspace; the default is cljs + reagent + re-frame + jp-go-dds").** The
`+page.svelte` self-description card was ported faithfully — same fields
(title/project/name/kind/routeCount/routes/vars/xrpc), same four sections — to
`appview/gameya-play-canvas/cljs/src/gameya/app.cljk`. **This did not close the
split.** The game is still not part of the deployable; only the placeholder's
implementation language changed. `wrangler.jsonc` no longer has a `main` key at
all (deleted, not repointed at `src/app.ts` — see "Known gaps" below for why)
and `assets.directory` now points at `./cljs/public`, the shadow-cljs build
output of the new scaffold.

The SvelteKit BFF's one backend route, `svelte/src/routes/xrpc/[...path]/+server.ts`
(POST `/xrpc/…` → `mcp.etzhayyim.com`), was **not** deleted with the rest of
`svelte/` — it was backend logic, not frontend markup. It now lives, byte-for-byte
unmodified body, at `appview/gameya-play-canvas/src/xrpc-proxy.ts`, marked
`SVELTEKIT-BACKEND-PRESERVED` and **not wired to anything**: with no `main` key,
this Worker config has no Worker script left to invoke it. Reviving it (either by
rewriting it against a real Worker entry, or deciding it should stay retired) is
an unresolved product decision, not one this migration made.

The table below was measured against the SvelteKit build before it was deleted.
That build no longer exists, so the left column is no longer reproducible —
`svelte/` is gone, and step 4 of the operator quickstart has been rewritten for
the cljs build. No fresh byte-count measurement of the cljs output was taken as
part of this migration (that would mean running `wrangler dev`, which this
migration deliberately did not do — see "Known gaps"). Read the left column as
history, not as the current state of `./cljs/public`:

| `wrangler dev` on the old SvelteKit build (historical, 2026-08-13) | `wrangler dev src/app.ts` (the game) |
|---|---|
| `/` → 200, **2,277 bytes** | `/` → 200, **15,700 bytes** |
| `<title>gameya-play-canvas</title>` | `<title>Gameya - Sky Bento Dash</title>` |
| no `<canvas id="game">` | `<canvas id="game">` present |
| `/health` → **404** | `/health` → 200, actor JSON |
| `/xrpc/…` → POST-only proxy to `mcp.etzhayyim.com` | `/xrpc/…` → 200, LangGraph run payload |

So `progress.md`'s "Deployed `gameya.etzhayyim.com/*` … Worker
`kotodama-g4m3ya00`" describes a Worker built from a main that this config no
longer has at all. Whatever is deployed, this tree cannot rebuild it — it never
could, and removing the `main` key did not change that.

Reproduce the right column: [`docs/operator-quickstart.md`](docs/operator-quickstart.md),
step 3. Step 4 now builds the cljs scaffold instead of the SvelteKit one.

## Status: not live — measured 2026-09-07 (re-measured after the cljs migration)

**Three of the four hosts this repo declares do not resolve**, including the one
the game calls its own identity (`did:web:gameya.etzhayyim.com`). Same three as
the 2026-08-13 measurement — the migration changed the scaffold's implementation
language, not its DNS:

| host | declared in | resolves? |
|---|---|---|
| `etzhayyim.com` | zone for both routes | **yes** |
| `gameya.etzhayyim.com` | `wrangler.jsonc`, `PROJECT.jsonld`, `src/app.ts`, `output/gameya-quality/summary.json` | **NXDOMAIN** |
| `g4m3ya00.etzhayyim.com` | `wrangler.jsonc` route | **NXDOMAIN** |
| `mcp.etzhayyim.com` | `wrangler.jsonc`'s `AGENTGATEWAY_MCP_ROUTER_URL` var (now unread — no `main` script consumes it) and the preserved-but-unwired `src/xrpc-proxy.ts` | **NXDOMAIN** |

The parent zone resolves and a control lookup against an unrelated host
succeeded, so these are genuine absences, not a local DNS fault.

**Re-measure before trusting this table** — it is dated, and dated tables rot:

```bash
nbb docs/check-surface.cljk      # exit 1 today; exit 0 would mean this table is stale
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

Steps 1–3 of [`docs/operator-quickstart.md`](docs/operator-quickstart.md) (the
`src/app.ts` game, unaffected by the cljs migration) were executed against tip
`0f866b5` on 2026-08-13 and the output there is the output observed: `npm ci` →
`npm run typecheck` (exit 0) → `npm test` (1 passed) → the game serves locally
and plays.

Step 4 (the appview scaffold) was rewritten 2026-09-07 for the cljs migration
and re-verified then: `npm install` in `cljs/`, `shadow-cljs compile app` (0
warnings), `shadow-cljs compile test && node out/tests.js` (5 tests / 14
assertions, 0 failures, 0 errors). **`wrangler dev`/`wrangler deploy` against
the new `assets.directory` were not run** — this migration deliberately did not
start a local Cloudflare dev server or deploy; see "Known gaps" and the
wrangler.jsonc change note in this repo's history for why.

## Known gaps

1. **The deployable does not contain the game** (the table above). This was
   true of the SvelteKit scaffold and remains true of the cljs scaffold that
   replaced it 2026-09-07 — the migration ported the placeholder faithfully,
   it did not decide the split. Either point `main` at `src/app.ts` and drop
   the appview scaffold, or move the game into the scaffold. Nothing in the
   repo picks. (`main` was removed outright during the migration rather than
   repointed at `src/app.ts`, because `src/app.ts` does not call
   `env.ASSETS.fetch()` — repointing it without that would have made the
   Worker shadow every static asset the appview serves.)

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
docs/check-surface.cljk       re-measures the status table above
docs/operator-quickstart.md   every command, walked
appview/gameya-play-canvas/
  src/app.ts                  THE GAME — Worker + inline canvas game (17,628 B)
  src/xrpc-proxy.ts           preserved SvelteKit XRPC→MCP handler, NOT wired (see "The split")
  test/gameya.test.ts         one placeholder assertion (see gap 2)
  scripts/quality-gate.mjs    Playwright playtest gate, broken path (gap 3)
  wrangler.jsonc              assets → cljs/public, no main (NOT src/app.ts either)
  cljs/                       reagent + re-frame + jp-go-dds appview scaffold (was svelte/, migrated 2026-09-07)
  output/gameya-quality/      stale committed run artifacts (gap 4)
```

## License

Apache-2.0 with the etzhayyim Charter Compliance Rider v3.1. See `NOTICE`.
