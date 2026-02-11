import { makeDudeSpec } from './office_dude_spec.js';
import { bakeDudeAtlas } from './office_dude_bake.js';
import { drawDude, getAnimFrame } from './office_dude_runtime.js';
import { initBuilderUI } from './office_builder_ui.js';

const canvas = document.getElementById('office-stage');
const ctx = canvas.getContext('2d');
const debugEl = document.getElementById('office-debug');
const statusEl = document.getElementById('office-status');

const stageState = {
  t: 0,
  dir: 'SE',
  anim: 'idle',
  x: canvas.width * 0.5,
  y: canvas.height * 0.64,
  scale: 9,
  carry: false,
  speed: 120,
  bounds: {
    left: 144,
    top: 234,
    right: canvas.width - 144,
    bottom: canvas.height - 54,
  },
};

const input = {
  up: false,
  right: false,
  down: false,
  left: false,
};

let atlas = null;
let spec = null;
let seed = 'desk-001';
let bakeVersion = 0;

function randomSeed() {
  return `desk-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updateBounds() {
  const scale = stageState.scale || 1;
  const frameW = atlas?.frameW || 96;
  const frameH = atlas?.frameH || 96;
  const originX = 48;
  const originY = 78;
  const left = Math.ceil(originX * scale);
  const rightMargin = Math.ceil((frameW - originX) * scale);
  const top = Math.ceil(originY * scale);
  const bottomMargin = Math.ceil((frameH - originY) * scale);

  stageState.bounds.left = left;
  stageState.bounds.top = top;
  stageState.bounds.right = canvas.width - rightMargin;
  stageState.bounds.bottom = canvas.height - bottomMargin;
}

function fitCanvas() {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(480, Math.round(r.width * dpr));
  const h = Math.max(320, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    updateBounds();
    stageState.x = clamp(stageState.x, stageState.bounds.left, stageState.bounds.right);
    stageState.y = clamp(stageState.y, stageState.bounds.top, stageState.bounds.bottom);
  }
}

function resolveMovement() {
  if (input.up) return { vx: -1, vy: -1, dir: 'NW' };
  if (input.right) return { vx: 1, vy: -1, dir: 'NE' };
  if (input.down) return { vx: 1, vy: 1, dir: 'SE' };
  if (input.left) return { vx: -1, vy: 1, dir: 'SW' };
  return { vx: 0, vy: 0, dir: stageState.dir };
}

function drawGrid() {
  const room = stageState.bounds;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, room.top, 0, room.bottom);
  grad.addColorStop(0, '#374151');
  grad.addColorStop(1, '#1f2937');
  ctx.fillStyle = grad;
  ctx.fillRect(room.left, room.top, room.right - room.left, room.bottom - room.top);

  ctx.strokeStyle = '#93c5fd22';
  ctx.lineWidth = 1.2;
  for (let i = -8; i < 15; i += 1) {
    ctx.beginPath();
    ctx.moveTo(room.left + i * 36, room.top);
    ctx.lineTo(room.left + (i + 8) * 36, room.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(room.right - i * 36, room.top);
    ctx.lineTo(room.right - (i + 8) * 36, room.bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = '#f1f5f95c';
  ctx.lineWidth = 2;
  ctx.strokeRect(room.left, room.top, room.right - room.left, room.bottom - room.top);
}

function drawShadow() {
  ctx.save();
  ctx.translate(stageState.x, stageState.y + 4);
  ctx.scale(1.1 * stageState.scale * 0.55, 0.5 * stageState.scale * 0.55);
  ctx.fillStyle = '#02061777';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

async function rebuildFromUI(data) {
  seed = data.seed || seed;
  spec = makeDudeSpec(seed, data.overrides);
  stageState.carry = !!data.carry;
  statusEl.textContent = 'Baking atlas...';
  const atlasBakeScale = Math.max(2, Math.min(6, Math.ceil(stageState.scale * 0.6)));

  const current = ++bakeVersion;
  const baked = await bakeDudeAtlas(spec, {
    frameSize: 96,
    bakeScale: atlasBakeScale,
    dirs: ['NE', 'NW', 'SE', 'SW'],
    anims: ['idle', 'walk', 'carry_idle', 'carry_walk'],
    useImageBitmap: true,
  });
  if (current !== bakeVersion) return;
  atlas = baked;
  updateBounds();
  statusEl.textContent = 'Atlas ready.';
}

const ui = initBuilderUI({
  onChange: rebuildFromUI,
  onRebake: rebuildFromUI,
  onRandomize: () => {
    seed = randomSeed();
    const next = makeDudeSpec(seed);
    ui.sync(next, stageState.carry);
    rebuildFromUI(ui.read());
  },
});

function onKey(key, down) {
  if (key === 'ArrowUp') input.up = down;
  if (key === 'ArrowRight') input.right = down;
  if (key === 'ArrowDown') input.down = down;
  if (key === 'ArrowLeft') input.left = down;
}

window.addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    onKey(e.key, true);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    onKey(e.key, false);
  }
});

for (const btn of document.querySelectorAll('.office-touch button')) {
  const dir = btn.dataset.dir;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input[dir] = true;
  });
  btn.addEventListener('pointerup', () => {
    input[dir] = false;
  });
  btn.addEventListener('pointercancel', () => {
    input[dir] = false;
  });
  btn.addEventListener('pointerleave', () => {
    input[dir] = false;
  });
}

let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  fitCanvas();

  const move = resolveMovement();
  if (move.vx || move.vy) {
    const inv = 1 / Math.hypot(move.vx, move.vy);
    stageState.x += move.vx * inv * stageState.speed * dt;
    stageState.y += move.vy * inv * stageState.speed * dt;
    stageState.x = clamp(stageState.x, stageState.bounds.left, stageState.bounds.right);
    stageState.y = clamp(stageState.y, stageState.bounds.top, stageState.bounds.bottom);
    stageState.dir = move.dir;
    stageState.anim = stageState.carry ? 'carry_walk' : 'walk';
  } else {
    stageState.anim = stageState.carry ? 'carry_idle' : 'idle';
  }

  stageState.t += dt;

  drawGrid();
  drawShadow();

  let frame = 0;
  if (atlas) {
    drawDude(ctx, atlas, {
      x: stageState.x,
      y: stageState.y,
      dir: stageState.dir,
      anim: stageState.anim,
      t: stageState.t,
      scale: stageState.scale,
    });
    frame = getAnimFrame(atlas, stageState.anim, stageState.t);
  }

  debugEl.textContent = [
    `dir: ${stageState.dir}`,
    `anim: ${stageState.anim}`,
    `frame: ${frame}`,
    `seed: ${seed}`,
  ].join('\n');

  requestAnimationFrame(loop);
}

const initSpec = makeDudeSpec(seed);
ui.sync(initSpec, false);
rebuildFromUI(ui.read()).then(() => {
  requestAnimationFrame(loop);
});
