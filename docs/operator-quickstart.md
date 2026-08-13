# Operator quickstart

Get from a fresh clone to *"I have played the game and seen why it is not the
thing that deploys"* in about five minutes.

**Every command below was executed against tip `0f866b5` on 2026-08-13**, in
this order, and the output shown is the output observed. Two steps are expected
to fail — that is stated where it happens, and a failure there is the correct
result, not a broken quickstart. One step at the end was deliberately **not**
run; it is marked.

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

Observed — **exit 1, and exit 1 is the expected result today**:

```
SCANNED	18 files	DECLARED-HOSTS	4
control	registry.npmjs.org	resolves

         etzhayyim.com  resolves  <- PROJECT.jsonld, .../wrangler.jsonc
g4m3ya00.etzhayyim.com  NXDOMAIN  <- .../wrangler.jsonc
  gameya.etzhayyim.com  NXDOMAIN  <- PROJECT.jsonld, .../output/gameya-quality/summary.json, .../src/app.ts, .../wrangler.jsonc
     mcp.etzhayyim.com  NXDOMAIN  <- .../svelte/src/routes/xrpc/[...path]/+server.ts, .../wrangler.jsonc

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

The game is a self-contained Worker. It needs no build and no assets — but
`wrangler.jsonc` declares an `assets.directory` that is a build output, so
`wrangler dev` refuses to start until that path exists:

```
✘ [ERROR] The directory specified by the "assets.directory" field in your
  configuration file does not exist:
  .../svelte/.svelte-kit/cloudflare/client
```

Point `--assets` at an empty directory instead. Nothing is shadowed —
`not_found_handling` is `none`, so every path falls through to the Worker:

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

## 4. Build and serve what actually deploys (≈60s) — the placeholder

`wrangler.jsonc` sets `"main": "svelte/.svelte-kit/cloudflare/_worker.js"`, so
*this* is the artifact a real deploy would publish. `src/app.ts` is not part of
it.

```bash
cd svelte
npm install
```

Then build. **Inside the `com-junkawasaki` superproject, route the build through
the shared resource governor** — concurrent agent sessions on this machine must
not run two heavy builds at once:

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs run build -- npm run build
```

Standalone clones outside that superproject have no such script; use
`npm run build` directly.

The guard refuses rather than queues. On the recorded run it first answered

```
resource-guard: build is already running (pid=3794, repo=.../cloud-itonami/_wt10-6611, …)
```

and **exited 2** — another session held the lock. That is the guard working, not
a failure of this repo. Retry until it is free; the build itself is ~5s
(`✓ built in 5.07s`, `Using @sveltejs/adapter-cloudflare`).

Now `wrangler dev` starts with no overrides, because the assets directory it
wanted in step 3 exists:

```bash
cd ..                                  # back to $APP
npx wrangler dev --port 8793
```

Observed:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' http://localhost:8793/
# 200 2277    — <title>gameya-play-canvas</title>, NO <canvas id="game">

curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8793/health
# 404         — NOT a bug. /health only exists in src/app.ts, which is not deployed.
```

**That is the finding worth keeping.** 15,700 bytes of game in step 3; 2,277
bytes of generated self-description card here. If you have a monitor pointed at
`gameya.etzhayyim.com/health`, it is watching a route that this configuration
never serves — on a host that does not resolve (step 1).

The one live path through this build is the XRPC proxy at
`/xrpc/<method>` (POST only), which forwards to `mcp.etzhayyim.com`. That host
is NXDOMAIN, so it cannot succeed today.

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
quickstart". It would publish the SvelteKit placeholder — not the game — to
`gameya.etzhayyim.com` and `g4m3ya00.etzhayyim.com`, neither of which currently
resolves. Decide known gap 1 first.

The workspace also requires any deploy to run from a checkout that contains
`origin/main`, since deploys have no fast-forward check and the last writer
wins.

## What you now know

- The game is real, complete, and playable in one command (step 3).
- The game is not in the deployable (steps 3 vs 4) — same repo, two `/`
  responses, 15,700 bytes against 2,277.
- Neither the typecheck (step 2) nor the test suite (step 2) would notice if the
  game logic broke; the gate that would (step 5) cannot run here.
- Nothing is live, and the SvelteKit path cannot be until `mcp.etzhayyim.com`
  exists (step 1).
