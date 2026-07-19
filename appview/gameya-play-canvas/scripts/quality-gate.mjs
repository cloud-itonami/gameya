import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const repoRoot = new URL("../../../../../", import.meta.url);
const repoRequire = createRequire(new URL("package.json", repoRoot));

function loadPlaywright() {
  try {
    return repoRequire("playwright");
  } catch {
    const pnpmDir = new URL("node_modules/.pnpm/", repoRoot);
    const match = fs
      .readdirSync(pnpmDir)
      .find((entry) => entry.startsWith("playwright@"));
    if (!match) throw new Error("playwright package not found under node_modules/.pnpm");
    return createRequire(new URL(`node_modules/.pnpm/${match}/node_modules/playwright/package.json`, repoRoot))("playwright");
  }
}

const { chromium } = loadPlaywright();

const argUrl = process.argv[2] === "--" ? process.argv[3] : process.argv[2];
const url = process.env.GAMEYA_URL || argUrl || "http://localhost:8787";
const outDir = path.resolve("output/gameya-quality");
fs.mkdirSync(outDir, { recursive: true });

function assertGate(condition, message) {
  if (!condition) throw new Error(message);
}

async function state(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function step(page, ms) {
  await page.evaluate((duration) => window.advanceTime(duration), ms);
}

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await step(page, ms);
  await page.keyboard.up(key);
}

async function playBurst(page) {
  await page.keyboard.down("ArrowRight");
  for (let i = 0; i < 11; i++) {
    const current = await state(page);
    if (current.mode !== "playing") break;
    const hazardAhead = current.visibleHazards.some((h) => {
      const dx = h.x - current.player.x;
      return dx > 20 && dx < 300;
    });
    if (hazardAhead && current.player.grounded) await page.keyboard.press("Space");
    await step(page, 100);
    if ((await state(page)).mode !== "playing") break;
  }
  await page.keyboard.up("ArrowRight");
}

async function playUntil(page, predicate, maxBursts = 30) {
  for (let i = 0; i < maxBursts; i++) {
    const current = await state(page);
    if (predicate(current)) return current;
    await playBurst(page);
  }
  return state(page);
}

async function desktopFlow(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.click("#start");
  await page.keyboard.down("ArrowRight");
  await step(page, 4200);
  await page.keyboard.up("ArrowRight");
  const progressed = await state(page);
  await page.keyboard.press("Space");
  const stageTwo = await state(page);
  await page.keyboard.press("KeyP");
  const paused = await state(page);
  await page.keyboard.press("KeyP");
  await page.keyboard.down("ArrowRight");
  await step(page, 1000);
  await page.keyboard.up("ArrowRight");
  const resumed = await state(page);
  const shot = path.join(outDir, "desktop.png");
  await page.locator("canvas").screenshot({ path: shot });
  await page.close();
  return { errors, progressed, stageTwo, paused, resumed, shot };
}

async function allClearFlow(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.click("#start");

  const stage1 = await playUntil(page, (s) => s.mode === "stageclear" && s.stage === 1);
  await page.keyboard.press("Space");
  const stage2Start = await state(page);
  const stage2 = await playUntil(page, (s) => s.mode === "stageclear" && s.stage === 2);
  await page.keyboard.press("Space");
  const stage3Start = await state(page);
  const final = await playUntil(page, (s) => s.mode === "clear" && s.stage === 3, 42);
  const shot = path.join(outDir, "all-clear.png");
  await page.locator("canvas").screenshot({ path: shot });
  await page.close();
  return { errors, stage1, stage2Start, stage2, stage3Start, final, shot };
}

async function mobileFlow(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.click("#start");
  const right = page.locator('[data-hold="ArrowRight"]');
  const jump = page.locator('[data-tap="Space"]');
  await right.dispatchEvent("pointerdown", { pointerType: "touch" });
  await step(page, 1400);
  await jump.dispatchEvent("pointerdown", { pointerType: "touch" });
  await step(page, 350);
  await jump.dispatchEvent("pointerup", { pointerType: "touch" });
  await right.dispatchEvent("pointerup", { pointerType: "touch" });
  const mobile = await state(page);
  const shot = path.join(outDir, "mobile.png");
  await page.locator("canvas").screenshot({ path: shot });
  await page.close();
  return { errors, mobile, shot };
}

async function xrpcFlow(browser) {
  const page = await browser.newPage();
  const response = await page.goto(`${url}/xrpc/com.etzhayyim.apps.gameya.qualityLoop`, {
    waitUntil: "domcontentloaded",
  });
  const body = JSON.parse(await page.locator("body").innerText());
  await page.close();
  return { status: response.status(), body };
}

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await desktopFlow(browser);
  const allClear = await allClearFlow(browser);
  const mobile = await mobileFlow(browser);
  const xrpc = await xrpcFlow(browser);

  assertGate(desktop.errors.length === 0, `desktop console errors: ${desktop.errors.join("; ")}`);
  assertGate(allClear.errors.length === 0, `all-clear console errors: ${allClear.errors.join("; ")}`);
  assertGate(mobile.errors.length === 0, `mobile console errors: ${mobile.errors.join("; ")}`);
  assertGate(desktop.progressed.mode === "stageclear", "desktop did not clear stage 1");
  assertGate(desktop.progressed.score >= desktop.progressed.goal, "desktop score did not reach stage goal");
  assertGate(desktop.progressed.visibleHazards.length > 0, "desktop did not spawn visible hazards");
  assertGate(desktop.stageTwo.mode === "playing", "desktop did not advance to stage 2");
  assertGate(desktop.stageTwo.stage === 2, "desktop stage advance did not report stage 2");
  assertGate(desktop.paused.mode === "paused", "pause did not switch to paused");
  assertGate(desktop.resumed.mode === "playing", "resume did not switch to playing");
  assertGate(desktop.resumed.player.x > desktop.paused.player.x, "player did not move after resume");
  assertGate(allClear.stage1.mode === "stageclear", "all-clear flow did not clear stage 1");
  assertGate(allClear.stage2Start.stage === 2 && allClear.stage2Start.mode === "playing", "all-clear flow did not start stage 2");
  assertGate(allClear.stage2.mode === "stageclear", "all-clear flow did not clear stage 2");
  assertGate(allClear.stage3Start.stage === 3 && allClear.stage3Start.mode === "playing", "all-clear flow did not start stage 3");
  assertGate(allClear.final.mode === "clear", "all-clear flow did not reach final clear");
  assertGate(allClear.final.score >= allClear.final.goal, "all-clear flow did not meet final goal");
  assertGate(mobile.mobile.mode === "playing", "mobile did not enter playing mode");
  assertGate(mobile.mobile.player.x > 130, "mobile touch controls did not move player");
  assertGate(xrpc.status === 200, `xrpc status ${xrpc.status}`);
  assertGate(xrpc.body?.run?.assistant_id === "gameya_quality_loop", "xrpc does not expose gameya_quality_loop run payload");

  const summary = {
    ok: true,
    url,
    desktop: {
      score: desktop.progressed.score,
      clearedMode: desktop.progressed.mode,
      stageTwo: desktop.stageTwo.stage,
      hazards: desktop.progressed.visibleHazards.length,
      pausedMode: desktop.paused.mode,
      resumedX: desktop.resumed.player.x,
      screenshot: desktop.shot,
    },
    mobile: {
      x: mobile.mobile.player.x,
      y: mobile.mobile.player.y,
      screenshot: mobile.shot,
    },
    allClear: {
      finalMode: allClear.final.mode,
      finalStage: allClear.final.stage,
      finalScore: allClear.final.score,
      screenshot: allClear.shot,
    },
    xrpc: {
      assistant_id: xrpc.body.run.assistant_id,
      target_quality: xrpc.body.run.input.target_quality,
    },
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
