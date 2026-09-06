# Operator quickstart

Get from a fresh clone to *"I have played the game and seen why it is not the
thing that deploys"* in about five minutes.

**Steps 1–3 and 5 below were executed against tip `0f866b5` on 2026-08-13**, and
the output shown for those is the output observed then; they are unaffected by
the 2026-09-07 cljs migration (`src/app.ts`, the game, was untouched by it).
**Step 4 was rewritten and re-executed 2026-09-07**, when the SvelteKit appview
scaffold this step builds was replaced with a cljs (reagent + re-frame +
jp-go-dds) one — its output is from that run. In this order, and the output
shown is the output observed. Two steps are expected to fail — that is stated
where it happens, and a failure there is the correct result, not a broken
quickstart. One step at the end was deliberately **not** run; it is marked.

Read [`../README.md`](../README.md) first if you have not. The short version:
`src/app.ts` is a complete browser game, `wrangler.jsonc` builds something else,
and none of the hosts either one names still resolve.

## 0. Prerequisites

Versions used for the run recorded here. Nothing is pinned by the repo, so
newer versions are likely fine and older ones untested.

```
node    v26.3.0
npm     11.16.0
nbb     (on PATH)
```

`wrangler` is fetched by `npx` in steps 3 and 4 — `wrangler@4.122.0` on the
recorded run. Set a shell variable for the app directory; every step after the
first needs it:

```bash
APP=appview/gameya-play-canvas
```

## 1. Is any of this live? (≈5s)

Run from the repo root:

```bash
nbb docs/check-surface.cljs
```

Observed 2026-08-13, before the cljs migration — **exit 1, and exit 1 was the
expected result then**:

```
SCANNED	18 files	DECLARED-HOSTS	4
control	registry.npmjs.org	resolves

         etzhayyim.com  resolves  <- PROJECT.jsonld, .../wrangler.jsonc
g4m3ya00.etzhayyim.com  NXDOMAIN  <- .../wrangler.jsonc
  gameya.etzhayyim.com  NXDOMAIN  <- PROJECT.jsonld, .../output/gameya-quality/summary.json, .../src/app.ts, .../wrangler.jsonc
     mcp.etzhayyim.com  NXDOMAIN  <- .../svelte/src/routes/xrpc/[...path]/+server.ts, .../wrangler.jsonc

3 of 4 declared hosts do not exist.
```

**Re-observed 2026-09-07, after the cljs migration** (`svelte/` is gone; the
file declaring `mcp.etzhayyim.com` moved to `src/xrpc-proxy.ts`) — still exit 1,
same three absent hosts:

```
SCANNED	17 files	DECLARED-HOSTS	4
control	registry.npmjs.org	resolves

         etzhayyim.com  resolves  <- PROJECT.jsonld, appview/gameya-play-canvas/wrangler.jsonc
g4m3ya00.etzhayyim.com  NXDOMAIN  <- appview/gameya-play-canvas/wrangler.jsonc
  gameya.etzhayyim.com  NXDOMAIN  <- PROJECT.jsonld, appview/gameya-play-canvas/output/gameya-quality/summary.json, appview/gameya-play-canvas/src/app.ts, appview/gameya-play-canvas/wrangler.jsonc
     mcp.etzhayyim.com  NXDOMAIN  <- appview/gameya-play-canvas/src/xrpc-proxy.ts, appview/gameya-play-canvas/wrangler.jsonc

3 of 4 declared hosts do not exist.
```

The script has three exit codes, and both non-zero ones were demonstrated before
this document was written:

| exit | meaning | how it was shown |
|---|---|---|
| `0` | every declared host resolves — the README's status table is stale | not reachable today |
| `1` | at least one does not resolve — **today's state** | the run above |
| `3` | **could not answer**: no working DNS here, or zero hosts extracted (wrong directory) | run from an empty directory: `COULD NOT ANSWER: scanned 0 files … extracted 0 declared hosts`, exit 3 |

Exit `3` exists so that "I could not measure" is never reachable from the same
exit code as "I measured, all fine".

## 2. Install, typecheck, test (≈20s)

```bash
cd $APP
npm ci
npm run typecheck
npm test
```

Observed — `added 65 packages, and audited 66 packages in 2s`, then `typecheck`
**exit 0 with no output** (`tsc --noEmit`, and unlike the sibling `games` repo
this one does have a `tsconfig.json`, so it really did typecheck `src/app.ts`),
then:

```
 RUN  v4.1.8

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

**Do not read that as coverage.** The single test is
`expect(true).toBe(true)`. It would still pass with `src/app.ts` deleted. See
known gap 2 in the README.

## 3. Play the game (≈40s)

The game is a self-contained Worker. It needs no build and no assets. Before
the cljs migration, `wrangler.jsonc` declared an `assets.directory` that was a
SvelteKit build output, so `wrangler dev` refused to start until that path
existed:

```
✘ [ERROR] The directory specified by the "assets.directory" field in your
  configuration file does not exist:
  .../svelte/.svelte-kit/cloudflare/client
```

That specific failure was observed 2026-08-13, against the pre-migration
config. `assets.directory` is `./cljs/public` now (see step 4) — `wrangler
dev`/`wrangler deploy` were not re-run against the new config as part of this
migration (see step 4's note), so whether the same class of error still
reproduces was not re-verified. Either way, point `--assets` at an empty
directory to run the game standalone. Nothing is shadowed — `not_found_handling`
is `none`, so every path falls through to the Worker:

```bash
npx wrangler dev src/app.ts --port 8791 --assets "$(mktemp -d)"    # still in $APP
```

Open <http://localhost:8791/> and play: arrows/WASD move, space jumps, shift
dashes, `P` pauses, `R` restarts. Three stages — Picnic Run (goal 300), Cloud
Market (700), Festival Dash (1200).

In another shell, the three requests that define the surface. Every status below
was observed:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' http://localhost:8791/
# 200 15700   — <title>Gameya - Sky Bento Dash</title>, <canvas id="game">

curl -s http://localhost:8791/health
# 200 {"ok":true,"actor":"did:web:gameya.etzhayyim.com","name":"gameya.etzhayyim.com",
#      "nanoid":"g4m3ya00","assistantId":"gameya_quality_loop",
#      "qualityLoop":"/xrpc/com.etzhayyim.apps.gameya.qualityLoop"}

curl -s http://localhost:8791/xrpc/com.etzhayyim.apps.gameya.qualityLoop
# 200 {"ok":true,"assistant_id":"gameya_quality_loop","run":{…"target_quality":"nintendo-quality",
#      "playtest":{"fps":60,"consoleErrors":0,…}},"message":"Submit this payload to
#      LangGraph Server /runs with assistant_id=gameya_quality_loop."}
```

Note what that last one is: a **static** payload. The `playtest` numbers are
literals in `src/app.ts`, not a measurement of the run you are looking at. The
endpoint hands an agent a well-shaped LangGraph request; it does not observe the
game.

The game also exposes two agent hooks on `window`, which is how the quality gate
in step 5 drives it:

```js
window.advanceTime(2000)        // step the simulation 2s without waiting
window.render_game_to_text()    // JSON: mode, stage, score, hp, player, visible hazards
```

Stop the dev server when done.

## 4. Build the appview scaffold (≈30s) — the placeholder, now cljs

Before 2026-09-07, `wrangler.jsonc` set
`"main": "svelte/.svelte-kit/cloudflare/_worker.js"`, and *that* SvelteKit build
was the artifact a real deploy would have published (`src/app.ts` was never
part of it). **That scaffold was migrated to cljs (reagent + re-frame +
jp-go-dds) 2026-09-07, per ADR-2608260900.** `wrangler.jsonc` no longer has a
`main` key at all — it was deleted, not repointed at `src/app.ts` (see the
README's "Known gaps" #1 for why not) — so this config is assets-only now, and
`assets.directory` points at `./cljs/public`, the build output of the scaffold
below.

```bash
cd $APP/cljs
npm install
```

Then build. **Inside the `com-junkawasaki` superproject, route the build through
the shared resource governor** — concurrent agent sessions on this machine must
not run two heavy builds at once:

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs run build -- npx shadow-cljs compile app
```

Standalone clones outside that superproject have no such script; use
`npx shadow-cljs compile app` directly.

Observed on the 2026-09-07 migration run (after the guard freed up):
`[:app] Build completed. (111 files, 110 compiled, 0 warnings, 27.61s)`. The
test build was run the same way and passed:

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs run build -- npx shadow-cljs compile test
node out/tests.js
# Ran 5 tests containing 14 assertions.
# 0 failures, 0 errors.
```

**`wrangler dev` / `wrangler deploy` against this config were not run** as part
of the migration — this workspace's standing rule is build/test first, deploy
separately and deliberately, never blind. So unlike step 3, there is no
observed `curl` transcript here; do not assume one without running it yourself.

What running it would serve: `cljs/public/index.html` mounts a reagent view
describing this appview surface itself — title/project/name/kind, declared
route count, the actual `routes`/`vars` read out of `wrangler.jsonc` (2 routes,
8 vars — the old `+page.svelte` had these as stale empty literals; this port
corrected them), and whether xrpc is configured. Same four sections the Svelte
page had (top / facts / public routes / runtime bindings / source), same
content, jp-go-dds hiccup instead of hand-rolled dark CSS.

There is no `/health` or `/xrpc/<method>` route anymore — with no `main` key,
this Worker config has no script to serve them. The old SvelteKit XRPC proxy
that forwarded `/xrpc/<method>` to `mcp.etzhayyim.com` (NXDOMAIN regardless,
per step 1) was preserved, not deleted — it now lives, unwired, at
`../src/xrpc-proxy.ts` (marked `SVELTEKIT-BACKEND-PRESERVED`). Reviving it
behind a real Worker entry is an unresolved product decision, not something
this migration did.

## 5. Watch the quality gate fail (≈5s) — expected

```bash
npm run quality:gate        # in $APP
```

Observed: **exit 1**, and not a test failure —

```
Error: ENOENT: no such file or directory, scandir '/private/node_modules/.pnpm/'
    at loadPlaywright (…/scripts/quality-gate.mjs:14:8)
```

`quality-gate.mjs` looks for its Playwright install five directories above
`scripts/` (`new URL("../../../../../", import.meta.url)`). In the monorepo this
repo was extracted from, `scripts/` sat at
`60-apps/etzhayyim-project-gameya/appview/gameya-play-canvas/scripts/` and five
up was exactly the monorepo root. In this repo, five up from `scripts/` is two
levels **above** the repo root — so where it lands depends only on how deep you
happened to clone. The recorded run was clone-at-`/tmp`, and it landed on `/`
(reported as `/private/` in the error, because macOS resolves `/tmp` through
`/private/tmp`).

That is the whole defect: the path is relative to a monorepo that is no longer
there, so it cannot be right at any clone depth.

This matters more than the other two gaps: that script is the only substantive
test in the tree. It plays all three stages, asserts `mode: clear`, checks
pause/resume, mobile touch, and the XRPC payload. Repairing the path — or
vendoring Playwright into `$APP` — converts the repo from "one placeholder
assertion" to "covered by an end-to-end playtest".

## 6. Deploy — NOT RUN

```bash
npx wrangler deploy        # from $APP
```

This was **not** executed, and you should not execute it to "check the
quickstart". It would publish the appview placeholder (cljs now, was SvelteKit)
— not the game — to `gameya.etzhayyim.com` and `g4m3ya00.etzhayyim.com`,
neither of which currently resolves. Decide known gap 1 first.

The workspace also requires any deploy to run from a checkout that contains
`origin/main`, since deploys have no fast-forward check and the last writer
wins.

## What you now know

- The game is real, complete, and playable in one command (step 3).
- The game is not in the deployable (steps 3 vs 4). The appview scaffold that
  *is* the deployable moved from SvelteKit to cljs 2026-09-07, but the split
  itself is unchanged — same repo, two different `/` responses either way.
- Neither the typecheck (step 2) nor the test suite (step 2) would notice if the
  game logic broke; the gate that would (step 5) cannot run here.
- Nothing is live. Even setting DNS aside, the old SvelteKit XRPC path cannot
  be revived by itself anymore — it has no `main` script left to run inside;
  see `../src/xrpc-proxy.ts` (step 4).
