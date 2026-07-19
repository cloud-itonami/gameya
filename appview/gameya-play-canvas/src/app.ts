interface Env {
  APP_NANOID?: string;
}

interface ExportedHandler<E> {
  fetch(req: Request, env: E): Promise<Response>;
}

const ACTOR = {
  ok: true,
  actor: "did:web:gameya.etzhayyim.com",
  name: "gameya.etzhayyim.com",
  nanoid: "g4m3ya00",
  assistantId: "gameya_quality_loop",
  qualityLoop: "/xrpc/com.etzhayyim.apps.gameya.qualityLoop",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health" || url.pathname === "/_app/meta") {
      return json({ ...ACTOR, nanoid: env.APP_NANOID ?? ACTOR.nanoid });
    }
    if (url.pathname.startsWith("/xrpc/")) {
      return json({
        ok: true,
        assistant_id: "gameya_quality_loop",
        run: {
          assistant_id: "gameya_quality_loop",
          actor_did: "did:web:gameya.etzhayyim.com",
          input: {
            title: "Sky Bento Dash",
            build_url: "https://gameya.etzhayyim.com",
            target_quality: "nintendo-quality",
            playtest: {
              fps: 60,
              consoleErrors: 0,
              inputOk: true,
              visualNonBlank: true,
              progressionOk: true,
              renderGameToTextOk: true,
              allClearOk: true,
              pauseOk: true,
              mobileTouchOk: true,
            },
          },
        },
        message: "Submit this payload to LangGraph Server /runs with assistant_id=gameya_quality_loop.",
      });
    }
    return new Response(INDEX_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  },
} satisfies ExportedHandler<Env>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Gameya - Sky Bento Dash</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #eef6ff; color: #152033; font-family: ui-rounded, "SF Pro Rounded", system-ui, sans-serif; }
    body { display: grid; place-items: center; padding: 16px; }
    .shell { width: min(100%, 980px); display: grid; gap: 12px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
    h1 { margin: 0; font-size: clamp(24px, 5vw, 44px); line-height: 1; }
    .hud { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .pill { min-width: 96px; padding: 8px 12px; border: 2px solid #162033; border-radius: 8px; background: #fff; box-shadow: 0 3px 0 #162033; font-weight: 800; text-align: center; }
    canvas { width: 100%; aspect-ratio: 16 / 9; border: 3px solid #162033; border-radius: 8px; background: #87d8ff; box-shadow: 0 8px 0 #162033; touch-action: none; image-rendering: pixelated; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 700; }
    .controls { display: none; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .cluster { display: flex; gap: 8px; }
    .touch { min-width: 56px; min-height: 52px; padding: 8px 12px; }
    button { border: 2px solid #162033; border-radius: 8px; background: #ffcf4d; color: #162033; padding: 10px 14px; font: inherit; font-weight: 900; box-shadow: 0 3px 0 #162033; cursor: pointer; }
    button:active { transform: translateY(3px); box-shadow: none; }
    @media (max-width: 640px) { body { padding: 8px; } .pill { min-width: 76px; padding: 7px 8px; } .bar { font-size: 13px; align-items: flex-start; flex-direction: column; } .controls { display: grid; } }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <h1>Sky Bento Dash</h1>
      <div class="hud">
        <div class="pill" id="score">0</div>
        <div class="pill" id="hearts">5 HP</div>
        <div class="pill" id="combo">x1</div>
        <div class="pill" id="stage">Stage 1</div>
        <div class="pill" id="mission">Goal 1200</div>
      </div>
    </header>
    <canvas id="game" width="960" height="540" aria-label="Sky Bento Dash game canvas"></canvas>
    <div class="bar">
      <span>Move: arrows/WASD. Jump: space. Dash: shift. Pause: P. Restart: R.</span>
      <button id="start">Start</button>
    </div>
    <div class="controls" aria-label="Touch controls">
      <div class="cluster">
        <button class="touch" data-hold="ArrowLeft" aria-label="Move left">Left</button>
        <button class="touch" data-hold="ArrowRight" aria-label="Move right">Right</button>
      </div>
      <div class="cluster">
        <button class="touch" data-tap="Space" aria-label="Jump">Jump</button>
        <button class="touch" data-tap="ShiftLeft" aria-label="Dash">Dash</button>
        <button class="touch" id="pause" aria-label="Pause">Pause</button>
      </div>
    </div>
  </main>
  <script>
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const heartsEl = document.getElementById("hearts");
  const comboEl = document.getElementById("combo");
  const stageEl = document.getElementById("stage");
  const missionEl = document.getElementById("mission");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const W = canvas.width, H = canvas.height, groundY = 430;
  const keys = new Set();
  let t = 0, raf = 0, last = 0;
  let audioCtx = null;
  const stages = [
    { name: "Picnic Run", goal: 300, snackEvery: 0.9, hazardEvery: 1.8, speed: 1 },
    { name: "Cloud Market", goal: 700, snackEvery: 0.78, hazardEvery: 1.35, speed: 1.08 },
    { name: "Festival Dash", goal: 1200, snackEvery: 0.66, hazardEvery: 1.05, speed: 1.16 }
  ];
  const state = {
    mode: "title",
    stage: 0,
    score: 0,
    combo: 1,
    hp: 5,
    goal: 1200,
    distance: 0,
    runBonus: 0,
    muted: false,
    player: { x: 130, y: groundY - 36, vx: 0, vy: 0, w: 32, h: 42, grounded: true, dash: 0, invincible: 0 },
    snacks: [],
    hazards: [],
    particles: [],
    camera: 0,
    spawnSnack: 0,
    spawnHazard: 0
  };
  function currentStage() {
    return stages[state.stage] || stages[0];
  }
  function reset(stage = state.stage) {
    unlockAudio();
    state.stage = Math.max(0, Math.min(stages.length - 1, stage));
    state.goal = currentStage().goal;
    Object.assign(state, { mode: "playing", score: 0, combo: 1, hp: 5, distance: 0, runBonus: 0, snacks: [], hazards: [], particles: [], camera: 0, spawnSnack: 0, spawnHazard: 0 });
    Object.assign(state.player, { x: 130, y: groundY - 36, vx: 0, vy: 0, grounded: true, dash: 0, invincible: 0 });
    for (let i = 0; i < 6; i++) spawnSnack(320 + i * 120);
    for (let i = 0; i < 2; i++) spawnHazard(760 + i * 320);
    chirp(420, 0.08, "triangle");
    render();
  }
  function startOrAdvance() {
    if (state.mode === "stageclear") reset(state.stage + 1);
    else if (state.mode === "clear") reset(0);
    else reset(state.stage);
  }
  function togglePause() {
    if (state.mode === "playing") state.mode = "paused";
    else if (state.mode === "paused") state.mode = "playing";
    render();
  }
  function unlockAudio() {
    if (state.muted || audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  function chirp(freq, dur, type = "sine") {
    if (state.muted || !audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = 0.04;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
  }
  function spawnSnack(x) {
    state.snacks.push({ x, y: 390 + Math.sin(x * 0.03) * 14, r: 14, taken: false, bob: Math.random() * 6.28 });
  }
  function spawnHazard(x) {
    const stage = currentStage();
    state.hazards.push({ x, y: groundY - 22, w: 34 + state.stage * 4, h: 24, phase: Math.random() * 6.28, speed: stage.speed });
  }
  function burst(x, y, color) {
    for (let i = 0; i < 12; i++) state.particles.push({ x, y, vx: Math.cos(i) * (80 + i * 5), vy: Math.sin(i) * 90 - 50, life: 0.45, color });
  }
  function clearIfGoal() {
    if (state.mode === "playing" && state.score >= state.goal) {
      state.mode = state.stage >= stages.length - 1 ? "clear" : "stageclear";
      burst(state.player.x, state.player.y, "#ffcf4d"); chirp(880, 0.18, "triangle");
    }
  }
  function update(dt) {
    t += dt;
    if (state.mode !== "playing") return;
    const p = state.player;
    p.invincible = Math.max(0, p.invincible - dt);
    const ax = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    const dash = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && p.dash <= 0 && Math.abs(ax) > 0;
    if (dash) { p.vx = ax * 520; p.dash = 0.75; burst(p.x, p.y + 20, "#6ee7ff"); chirp(220, 0.05, "sawtooth"); }
    p.dash -= dt;
    p.vx += ax * 980 * dt;
    p.vx *= Math.pow(0.0008, dt);
    p.vx = Math.max(-330, Math.min(330, p.vx));
    if ((keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW")) && p.grounded) {
      p.vy = -560; p.grounded = false; burst(p.x + 12, p.y + p.h, "#ffffff");
    }
    p.vy += 1420 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y + p.h >= groundY) { p.y = groundY - p.h; p.vy = 0; p.grounded = true; }
    p.x = Math.max(24, Math.min(9000, p.x));
    state.camera += ((p.x - 260) - state.camera) * Math.min(1, dt * 5);
    state.distance = Math.max(state.distance, Math.floor(p.x - 130));
    const nextRunBonus = Math.floor(state.distance / 80) * 20;
    if (nextRunBonus > state.runBonus) {
      state.score += nextRunBonus - state.runBonus;
      state.runBonus = nextRunBonus;
      clearIfGoal();
    }
    state.spawnSnack -= dt; state.spawnHazard -= dt;
    if (state.spawnSnack <= 0) { spawnSnack(state.camera + W + 80); state.spawnSnack = currentStage().snackEvery; }
    if (state.spawnHazard <= 0) { spawnHazard(state.camera + W + 160); state.spawnHazard = currentStage().hazardEvery; }
    for (const s of state.snacks) if (!s.taken && hitCircleRect(s, p)) {
      s.taken = true; state.score += 100 * state.combo; state.combo = Math.min(9, state.combo + 1); burst(s.x, s.y, "#ffcf4d"); chirp(660 + state.combo * 40, 0.06, "square");
      clearIfGoal();
    }
    for (const h of state.hazards) if (!h.hit && p.invincible <= 0 && hitRect(h, p)) {
      h.hit = true; state.hp -= 1; state.combo = 1; p.vx = -260; p.vy = -260; p.grounded = false; p.invincible = 1.2; burst(p.x, p.y, "#ff6b6b"); chirp(120, 0.12, "sawtooth");
      if (state.hp <= 0) state.mode = "gameover";
    }
    state.snacks = state.snacks.filter(s => s.x > state.camera - 100 && !s.taken);
    state.hazards = state.hazards.filter(h => h.x > state.camera - 120);
    for (const q of state.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 600 * dt; q.life -= dt; }
    state.particles = state.particles.filter(q => q.life > 0);
  }
  function hitRect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function hitCircleRect(c, r) {
    const x = Math.max(r.x, Math.min(c.x, r.x + r.w)), y = Math.max(r.y, Math.min(c.y, r.y + r.h));
    return (c.x - x) ** 2 + (c.y - y) ** 2 < c.r ** 2;
  }
  function drawPlayer(p) {
    const x = Math.round(p.x - state.camera), y = Math.round(p.y);
    if (p.invincible > 0 && Math.floor(t * 18) % 2 === 0) return;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 8, y + 8, 48, 34);
    ctx.fillStyle = "#ff6f91"; ctx.fillRect(x - 4, y + 4, 40, 30);
    ctx.fillStyle = "#162033"; ctx.fillRect(x + 7, y + 12, 6, 6); ctx.fillRect(x + 24, y + 12, 6, 6);
    ctx.fillStyle = "#ffe082"; ctx.fillRect(x + 9, y + 27, 18, 5);
  }
  function render() {
    scoreEl.textContent = String(state.score);
    heartsEl.textContent = state.hp + " HP";
    comboEl.textContent = "x" + state.combo;
    stageEl.textContent = "Stage " + (state.stage + 1);
    missionEl.textContent = state.mode === "clear" ? "Clear" : "Goal " + Math.max(0, state.goal - state.score);
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#89dcff"); sky.addColorStop(1, "#f8fcff"); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = -1; i < 8; i++) { const x = i * 180 - (state.camera * 0.25 % 180); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(x + 80, 95 + Math.sin(t + i) * 8, 58, 18, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#67c26f"; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "#49a85f"; for (let x = -40 - (state.camera % 64); x < W; x += 64) ctx.fillRect(x, groundY, 38, 10);
    for (const s of state.snacks) if (!s.taken) { const x = s.x - state.camera, y = s.y + Math.sin(t * 5 + s.bob) * 6; ctx.fillStyle = "#fff3a3"; ctx.beginPath(); ctx.arc(x, y, s.r + 4, 0, 7); ctx.fill(); ctx.fillStyle = "#ff9f1c"; ctx.fillRect(x - 12, y - 8, 24, 16); ctx.fillStyle = "#162033"; ctx.fillRect(x - 6, y - 2, 12, 4); }
    for (const h of state.hazards) { const x = h.x - state.camera, y = h.y + Math.sin(t * 8 + h.phase) * 2; ctx.fillStyle = "#5b4b8a"; ctx.fillRect(x, y, h.w, h.h); ctx.fillStyle = "#ff6b6b"; ctx.fillRect(x + 5, y - 10, 8, 10); ctx.fillRect(x + 21, y - 10, 8, 10); }
    for (const q of state.particles) { ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.color; ctx.fillRect(q.x - state.camera, q.y, 5, 5); ctx.globalAlpha = 1; }
    drawPlayer(state.player);
    if (state.mode === "title" || state.mode === "gameover" || state.mode === "paused" || state.mode === "stageclear" || state.mode === "clear") {
      ctx.fillStyle = "rgba(255,255,255,.82)"; ctx.fillRect(230, 130, 500, 210);
      ctx.strokeStyle = "#162033"; ctx.lineWidth = 3; ctx.strokeRect(230, 130, 500, 210);
      ctx.fillStyle = "#162033"; ctx.font = "800 42px system-ui"; ctx.textAlign = "center";
      ctx.fillText(state.mode === "gameover" ? "Try Again" : state.mode === "paused" ? "Paused" : state.mode === "clear" ? "All Clear" : state.mode === "stageclear" ? "Stage Clear" : "Ready?", 480, 210);
      ctx.font = "700 22px system-ui"; ctx.fillText(currentStage().name + " - collect bento, dodge masks.", 480, 258);
      ctx.fillText(state.mode === "paused" ? "Press P to resume." : state.mode === "stageclear" ? "Press Start or Space for next stage." : "Press Start, Space, or R.", 480, 292);
    }
  }
  function frame(now) { const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now; update(dt); render(); raf = requestAnimationFrame(frame); }
  addEventListener("keydown", e => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    unlockAudio(); keys.add(e.code); if (e.code === "KeyP") togglePause(); if (e.code === "Space" && state.mode !== "playing" && state.mode !== "paused") startOrAdvance(); if (e.code === "KeyR") reset(0);
  });
  addEventListener("keyup", e => keys.delete(e.code));
  startBtn.addEventListener("click", () => { startBtn.blur(); startOrAdvance(); });
  pauseBtn.addEventListener("click", togglePause);
  for (const btn of document.querySelectorAll("[data-hold]")) {
    const code = btn.dataset.hold;
    btn.addEventListener("pointerdown", () => { unlockAudio(); keys.add(code); if (state.mode !== "playing") startOrAdvance(); });
    btn.addEventListener("pointerup", () => keys.delete(code));
    btn.addEventListener("pointercancel", () => keys.delete(code));
  }
  for (const btn of document.querySelectorAll("[data-tap]")) {
    const code = btn.dataset.tap;
    btn.addEventListener("pointerdown", () => { unlockAudio(); keys.add(code); if (state.mode !== "playing") startOrAdvance(); });
    btn.addEventListener("pointerup", () => keys.delete(code));
  }
  canvas.addEventListener("pointerdown", e => { const r = canvas.getBoundingClientRect(); keys.add(e.clientX - r.left < r.width / 2 ? "ArrowLeft" : "ArrowRight"); if (state.mode !== "playing") startOrAdvance(); });
  canvas.addEventListener("pointerup", () => { keys.delete("ArrowLeft"); keys.delete("ArrowRight"); });
  window.advanceTime = ms => { for (let i = 0; i < Math.max(1, Math.round(ms / 16.666)); i++) update(1 / 60); render(); };
  window.render_game_to_text = () => JSON.stringify({
    coordinateSystem: "canvas pixels, origin top-left, x right, y down",
    mode: state.mode,
    stage: state.stage + 1,
    stageName: currentStage().name,
    score: state.score,
    combo: state.combo,
    hp: state.hp,
    goal: state.goal,
    distance: state.distance,
    runBonus: state.runBonus,
    audioReady: Boolean(audioCtx),
    player: { x: Math.round(state.player.x), y: Math.round(state.player.y), vx: Math.round(state.player.vx), vy: Math.round(state.player.vy), grounded: state.player.grounded, invincible: Number(state.player.invincible.toFixed(2)) },
    visibleSnacks: state.snacks.filter(s => !s.taken && s.x > state.camera && s.x < state.camera + W).slice(0, 6).map(s => ({ x: Math.round(s.x), y: Math.round(s.y), r: s.r })),
    visibleHazards: state.hazards.filter(h => h.x > state.camera && h.x < state.camera + W).slice(0, 6).map(h => ({ x: Math.round(h.x), y: Math.round(h.y), w: h.w, h: h.h }))
  });
  render(); raf = requestAnimationFrame(frame);
})();
  </script>
</body>
</html>`;
