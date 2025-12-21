import { LAYOUTS } from './mahjong_layouts.js';

const Group = {
  PEOPLE: 'PEOPLE',
  ANIMALS: 'ANIMALS',
  FOODS: 'FOODS',
  WIND: 'WIND',
  DRAGON: 'DRAGON',
  FLOWER: 'FLOWER',
  SEASON: 'SEASON',
};

const Preset = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  EXPERT: 'expert',
  CUSTOM: 'custom',
};

const PRESET_DEFAULTS = {
  [Preset.BEGINNER]: {
    layout: 'standard',
    solvable: true,
    allowHint: true,
    allowUndo: true,
    undoLimit: 0,
    allowShuffle: true,
    highlightFree: true,
  },
  [Preset.INTERMEDIATE]: {
    layout: 'bridge',
    solvable: true,
    allowHint: true,
    allowUndo: true,
    undoLimit: 25,
    allowShuffle: true,
    highlightFree: true,
  },
  [Preset.EXPERT]: {
    layout: 'cube',
    solvable: true,
    allowHint: false,
    allowUndo: true,
    undoLimit: 10,
    allowShuffle: false,
    highlightFree: false,
  },
};

const STORAGE = {
  preset: 'mj.preset',
  layout: 'mj.layout',
  seed: 'mj.seed',
  solvable: 'mj.solvable',
  allowHint: 'mj.allowHint',
  allowUndo: 'mj.allowUndo',
  undoLimit: 'mj.undoLimit',
  allowShuffle: 'mj.allowShuffle',
  highlightFree: 'mj.highlightFree',
};

const Face = {
  NORMAL: '🙂',
  WIN: '😎',
};

const SOLVABLE_ATTEMPTS = 200;
const PULSE = {
  hint: { color: '#fbbf24', duration: 1400, min: 0.18, max: 0.45, speed: 2.2 },
  blocked: { color: '#f87171', duration: 900, min: 0.2, max: 0.5, speed: 3.2 },
};

let animationId = null;

const canvas = document.getElementById('mahjong-canvas');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const tilesLeftEl = document.getElementById('tiles-left');
const pairsLeftEl = document.getElementById('pairs-left');
const seedLabelEl = document.getElementById('seed-label');
const faceBtn = document.getElementById('face-button');

const hintBtn = document.getElementById('btn-hint');
const undoBtn = document.getElementById('btn-undo');
const shuffleBtn = document.getElementById('btn-shuffle');

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const presetSelect = document.getElementById('preset-select');
const layoutSelect = document.getElementById('layout-select');
const seedInput = document.getElementById('seed-input');
const solvableToggle = document.getElementById('solvable-toggle');
const hintToggle = document.getElementById('hint-toggle');
const undoToggle = document.getElementById('undo-toggle');
const undoLimitInput = document.getElementById('undo-limit');
const shuffleToggle = document.getElementById('shuffle-toggle');
const highlightToggle = document.getElementById('highlight-toggle');
const settingsError = document.getElementById('settings-error');

let settings = loadSettings();
let game = null;

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function setFace(face) {
  faceBtn.textContent = face;
}

function createRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function resolveSeed(input) {
  if (!input) return Math.floor(Math.random() * 0x7fffffff);
  const trimmed = input.trim();
  if (!trimmed) return Math.floor(Math.random() * 0x7fffffff);
  if (/^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  return hashSeed(trimmed);
}

function shuffleInPlace(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function matchKey(type) {
  if (type.group === Group.FLOWER) return 'FLOWER';
  if (type.group === Group.SEASON) return 'SEASON';
  return `${type.group}:${type.rank}`;
}

function makeType(group, rank, emoji, opts = {}) {
  return {
    group,
    rank,
    emoji,
    tint: opts.tint || null,
    badge: opts.badge || null,
    textColor: opts.textColor || null,
    isText: Boolean(opts.isText),
  };
}

function buildTileTypes() {
  const people = ['🧑‍⚕️', '🧑‍🚒', '🧟‍♂️', '🧑‍🏫', '🧑‍🔧', '🧑‍🍳', '🧑‍💻', '🧑‍🚀', '🧑‍🎨'];
  const animals = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨'];
  const foods = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒'];

  const types = [];
  people.forEach((emoji, idx) => types.push(makeType(Group.PEOPLE, idx + 1, emoji)));
  animals.forEach((emoji, idx) => types.push(makeType(Group.ANIMALS, idx + 1, emoji)));
  foods.forEach((emoji, idx) => types.push(makeType(Group.FOODS, idx + 1, emoji)));

  ['E', 'S', 'W', 'N'].forEach((wind) => {
    types.push(makeType(Group.WIND, wind, wind, { isText: true, textColor: '#1f2937' }));
  });

  types.push(makeType(Group.DRAGON, 'R', '🀄', { tint: '#ffe1e1', badge: '🔴' }));
  types.push(makeType(Group.DRAGON, 'G', '🀄', { tint: '#e1ffe9', badge: '🟢' }));
  types.push(makeType(Group.DRAGON, 'W', '🀄', { tint: '#f5f0e6', badge: '⚪' }));

  ['🌸', '🌼', '🌺', '🪷'].forEach((emoji, idx) => {
    types.push(makeType(Group.FLOWER, idx + 1, emoji));
  });
  ['🌱', '☀️', '🍂', '❄️'].forEach((emoji, idx) => {
    types.push(makeType(Group.SEASON, idx + 1, emoji));
  });

  return types;
}

const BASE_TYPES = buildTileTypes();

function buildFullPool() {
  const pool = [];
  for (const type of BASE_TYPES) {
    let copies = 4;
    if (type.group === Group.FLOWER || type.group === Group.SEASON) {
      copies = 1;
    }
    for (let i = 0; i < copies; i++) {
      pool.push({ ...type });
    }
  }
  return pool;
}

function trimPool(pool, targetCount, rng) {
  if (pool.length <= targetCount) return pool.slice();
  const byKey = new Map();
  pool.forEach((tile, idx) => {
    const key = matchKey(tile);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(idx);
  });
  const removed = new Set();
  let remaining = pool.length;
  while (remaining > targetCount) {
    const eligible = [];
    for (const [key, list] of byKey.entries()) {
      const available = list.filter((idx) => !removed.has(idx));
      if (available.length >= 2) eligible.push({ key, available });
    }
    if (eligible.length === 0) break;
    const choice = eligible[Math.floor(rng() * eligible.length)];
    const list = choice.available;
    const first = list[Math.floor(rng() * list.length)];
    removed.add(first);
    const list2 = list.filter((idx) => !removed.has(idx));
    const second = list2[Math.floor(rng() * list2.length)];
    removed.add(second);
    remaining -= 2;
  }
  return pool.filter((_, idx) => !removed.has(idx));
}

function buildTilePool(targetCount, rng) {
  const pool = buildFullPool();
  const trimmed = trimPool(pool, targetCount, rng);
  return trimmed;
}

function buildPairs(pool, rng) {
  const byKey = new Map();
  pool.forEach((tile) => {
    const key = matchKey(tile);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(tile);
  });
  const pairs = [];
  for (const list of byKey.values()) {
    shuffleInPlace(list, rng);
    for (let i = 0; i < list.length; i += 2) {
      pairs.push([list[i], list[i + 1]]);
    }
  }
  shuffleInPlace(pairs, rng);
  return pairs;
}

function buildSlots(layoutId) {
  const layout = LAYOUTS[layoutId];
  const slots = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = 0;

  layout.layers.forEach((layer, z) => {
    layer.forEach(([x, y]) => {
      slots.push({ id: slots.length, x, y, z });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    });
  });

  return {
    slots,
    bounds: { minX, minY, maxX, maxY, maxZ },
  };
}

function createOccupancy(bounds) {
  const gridW = bounds.maxX + 3;
  const gridH = bounds.maxY + 3;
  const layers = bounds.maxZ + 1;
  const occ = Array.from({ length: layers }, () => (
    Array.from({ length: gridH }, () => Array(gridW).fill(-1))
  ));
  return { occ, gridW, gridH };
}

function setOcc(occ, slot, id) {
  const { x, y, z } = slot;
  const layer = occ[z];
  layer[y][x] = id;
  layer[y + 1][x] = id;
  layer[y][x + 1] = id;
  layer[y + 1][x + 1] = id;
}

function clearOcc(occ, slot) {
  const { x, y, z } = slot;
  const layer = occ[z];
  layer[y][x] = -1;
  layer[y + 1][x] = -1;
  layer[y][x + 1] = -1;
  layer[y + 1][x + 1] = -1;
}

function isSlotPlaceable(slot, occ) {
  const { x, y, z } = slot;
  if (occ[z + 1]) {
    const above = occ[z + 1];
    if (
      above[y][x] !== -1 ||
      above[y + 1][x] !== -1 ||
      above[y][x + 1] !== -1 ||
      above[y + 1][x + 1] !== -1
    ) {
      return false;
    }
  }

  const layer = occ[z];
  const leftBlocked = (x - 1 >= 0) && (layer[y][x - 1] !== -1 || layer[y + 1][x - 1] !== -1);
  const rightBlocked = (x + 2 < layer[0].length) && (layer[y][x + 2] !== -1 || layer[y + 1][x + 2] !== -1);
  return !leftBlocked || !rightBlocked;
}

function dealSolvable(slots, pool, bounds, rng) {
  const pairs = buildPairs(pool, rng);

  for (let attempt = 0; attempt < SOLVABLE_ATTEMPTS; attempt++) {
    const assignment = Array(slots.length).fill(null);
    const remaining = Array(slots.length).fill(true);
    const { occ } = createOccupancy(bounds);
    slots.forEach((slot, idx) => setOcc(occ, slot, idx));

    let failed = false;
    for (const [aType, bType] of pairs) {
      const freeSlots = [];
      for (let i = 0; i < slots.length; i++) {
        if (!remaining[i]) continue;
        if (isSlotPlaceable(slots[i], occ)) freeSlots.push(i);
      }
      if (freeSlots.length < 2) {
        failed = true;
        break;
      }
      const aIndex = freeSlots.splice(Math.floor(rng() * freeSlots.length), 1)[0];
      const bIndex = freeSlots[Math.floor(rng() * freeSlots.length)];
      assignment[aIndex] = aType;
      assignment[bIndex] = bType;
      remaining[aIndex] = false;
      remaining[bIndex] = false;
      clearOcc(occ, slots[aIndex]);
      clearOcc(occ, slots[bIndex]);
    }

    if (!failed && assignment.every((tile) => tile)) {
      const { occ: fullOcc } = createOccupancy(bounds);
      slots.forEach((slot, idx) => setOcc(fullOcc, slot, idx));
      return { assignment, occ: fullOcc };
    }
  }

  return null;
}

function dealRandom(slots, pool, bounds, rng) {
  const assignment = pool.slice(0, slots.length);
  shuffleInPlace(assignment, rng);
  const { occ } = createOccupancy(bounds);
  slots.forEach((slot, idx) => setOcc(occ, slot, idx));
  return { assignment, occ };
}

function buildGame() {
  const layoutId = settings.layout in LAYOUTS ? settings.layout : 'standard';
  const seedNumber = resolveSeed(settings.seed);
  const rng = createRng(seedNumber);
  const { slots, bounds } = buildSlots(layoutId);
  const pool = buildTilePool(slots.length, rng);

  let deal = null;
  let solvableFailed = false;
  if (settings.solvable) {
    deal = dealSolvable(slots, pool, bounds, rng);
    solvableFailed = !deal;
  }
  if (!deal) {
    deal = dealRandom(slots, pool, bounds, rng);
  }

  const tiles = slots.map((slot, idx) => ({
    id: idx,
    slot,
    type: deal.assignment[idx],
    removed: false,
    selected: false,
    free: false,
    px: 0,
    py: 0,
  }));

  const drawOrder = tiles.slice().sort((a, b) => {
    if (a.slot.z !== b.slot.z) return a.slot.z - b.slot.z;
    if (a.slot.y !== b.slot.y) return a.slot.y - b.slot.y;
    return a.slot.x - b.slot.x;
  }).map((tile) => tile.id);

  game = {
    layoutId,
    seedNumber,
    rng,
    tiles,
    bounds,
    occ: deal.occ,
    drawOrder,
    selectedId: null,
    pulseHint: null,
    pulseBlocked: null,
    undoStack: [],
    undoUsed: 0,
    moves: 0,
    view: null,
  };

  computeLayout();
  updateStats();
  updateControls();
  setFace(Face.NORMAL);
  const status = solvableFailed
    ? `Layout: ${layoutId}. Solvable deal failed; using random deal.`
    : `Layout: ${layoutId}.`;
  setStatus(status);
  render();
  checkForMoves();
}

function isTileFree(tile) {
  if (tile.removed) return false;
  return isSlotPlaceable(tile.slot, game.occ);
}

function updateFreeTiles() {
  for (const tile of game.tiles) {
    if (tile.removed) {
      tile.free = false;
      continue;
    }
    tile.free = isTileFree(tile);
  }
}

function updateStats() {
  const remaining = game.tiles.filter((tile) => !tile.removed).length;
  tilesLeftEl.textContent = String(remaining).padStart(3, '0');
  pairsLeftEl.textContent = String(Math.floor(remaining / 2)).padStart(3, '0');
  seedLabelEl.textContent = String(game.seedNumber);
}

function updateControls() {
  const allowHint = settings.allowHint;
  const allowUndo = settings.allowUndo;
  const allowShuffle = settings.allowShuffle;
  const undoLimit = settings.undoLimit;
  hintBtn.disabled = !allowHint;
  undoBtn.disabled = !allowUndo || game.undoStack.length === 0 || (undoLimit > 0 && game.undoUsed >= undoLimit);
  shuffleBtn.disabled = !allowShuffle;
}

function computeLayout() {
  const wrap = canvas.parentElement;
  const available = wrap ? wrap.clientWidth - 24 : 720;
  const spanX = game.bounds.maxX - game.bounds.minX + 2;
  const baseW = Math.floor((available * 2) / spanX);
  const tileW = clamp(baseW, 34, 72);
  const tileH = Math.round(tileW * 1.25);
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  const zOffset = Math.max(6, Math.round(tileW * 0.12));
  const padding = 12;

  let minPX = Infinity;
  let minPY = Infinity;
  let maxPX = -Infinity;
  let maxPY = -Infinity;

  for (const tile of game.tiles) {
    const px = (tile.slot.x - game.bounds.minX) * halfW + tile.slot.z * zOffset;
    const py = (tile.slot.y - game.bounds.minY) * halfH - tile.slot.z * zOffset;
    minPX = Math.min(minPX, px);
    minPY = Math.min(minPY, py);
    maxPX = Math.max(maxPX, px + tileW);
    maxPY = Math.max(maxPY, py + tileH);
  }

  const width = Math.ceil(maxPX - minPX + padding * 2);
  const height = Math.ceil(maxPY - minPY + padding * 2);
  const originX = padding - minPX;
  const originY = padding - minPY;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  game.view = { tileW, tileH, halfW, halfH, zOffset, originX, originY, width, height };
  for (const tile of game.tiles) {
    tile.px = originX + (tile.slot.x - game.bounds.minX) * halfW + tile.slot.z * zOffset;
    tile.py = originY + (tile.slot.y - game.bounds.minY) * halfH - tile.slot.z * zOffset;
  }
}

function startPulse(type, ids) {
  const config = PULSE[type];
  if (!config || !game) return;
  const now = performance.now();
  const pulse = { ids, start: now, end: now + config.duration, config };
  if (type === 'hint') game.pulseHint = pulse;
  if (type === 'blocked') game.pulseBlocked = pulse;
  render();
  ensureAnimation();
}

function pulseAlpha(pulse, now) {
  const elapsed = Math.max(0, now - pulse.start) / 1000;
  const wave = (Math.sin(elapsed * pulse.config.speed * Math.PI * 2) + 1) / 2;
  return pulse.config.min + (pulse.config.max - pulse.config.min) * wave;
}

function ensureAnimation() {
  if (animationId !== null) return;
  animationId = requestAnimationFrame(renderLoop);
}

function renderLoop(time) {
  render(time, true);
  if (game && (game.pulseHint || game.pulseBlocked)) {
    animationId = requestAnimationFrame(renderLoop);
  } else {
    animationId = null;
  }
}

function roundRect(ctxRef, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctxRef.beginPath();
  ctxRef.moveTo(x + radius, y);
  ctxRef.lineTo(x + w - radius, y);
  ctxRef.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctxRef.lineTo(x + w, y + h - radius);
  ctxRef.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctxRef.lineTo(x + radius, y + h);
  ctxRef.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctxRef.lineTo(x, y + radius);
  ctxRef.quadraticCurveTo(x, y, x + radius, y);
  ctxRef.closePath();
}

function drawTile(tile, highlight) {
  const { tileW, tileH } = game.view;
  const x = tile.px;
  const y = tile.py;
  const radius = Math.max(4, Math.floor(tileW * 0.12));
  const base = tile.type.tint || '#f8f5ec';
  const outline = highlight ? highlight.outline : null;
  const pulse = highlight ? highlight.pulse : null;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  roundRect(ctx, x + 3, y + 3, tileW, tileH, radius);
  ctx.fill();

  ctx.fillStyle = base;
  roundRect(ctx, x, y, tileW, tileH, radius);
  ctx.fill();

  if (pulse) {
    ctx.save();
    ctx.globalAlpha = pulse.alpha;
    ctx.fillStyle = pulse.color;
    roundRect(ctx, x, y, tileW, tileH, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x + radius, y + 1);
  ctx.lineTo(x + tileW - radius, y + 1);
  ctx.moveTo(x + 1, y + radius);
  ctx.lineTo(x + 1, y + tileH - radius);
  ctx.stroke();

  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    roundRect(ctx, x + 1.5, y + 1.5, tileW - 3, tileH - 3, radius - 1);
    ctx.stroke();
  }

  const emojiSize = Math.floor(tileH * 0.48);
  const textSize = Math.floor(tileH * 0.42);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (tile.type.isText) {
    ctx.font = `700 ${textSize}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = tile.type.textColor || '#1f2937';
    ctx.fillText(tile.type.emoji, x + tileW / 2, y + tileH / 2);
  } else {
    ctx.font = `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui`;
    ctx.fillStyle = '#111827';
    ctx.fillText(tile.type.emoji, x + tileW / 2, y + tileH / 2);
  }

  if (tile.type.badge) {
    ctx.font = `${Math.floor(tileH * 0.22)}px "Segoe UI Emoji", "Apple Color Emoji", system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(tile.type.badge, x + tileW * 0.08, y + tileH * 0.06);
  }

  ctx.restore();
}

function render(time, fromLoop = false) {
  if (!game) return;
  const now = typeof time === 'number' ? time : performance.now();
  if (game.pulseHint && now > game.pulseHint.end) game.pulseHint = null;
  if (game.pulseBlocked && now > game.pulseBlocked.end) game.pulseBlocked = null;
  const hasPulse = Boolean(game.pulseHint || game.pulseBlocked);

  updateFreeTiles();
  ctx.clearRect(0, 0, game.view.width, game.view.height);
  for (const id of game.drawOrder) {
    const tile = game.tiles[id];
    if (tile.removed) continue;
    const isHint = game.pulseHint && game.pulseHint.ids.includes(tile.id);
    const isBlocked = game.pulseBlocked && game.pulseBlocked.ids.includes(tile.id);
    const pulseSource = isBlocked ? game.pulseBlocked : (isHint ? game.pulseHint : null);

    const highlight = {};
    if (pulseSource) {
      highlight.pulse = {
        color: pulseSource.config.color,
        alpha: pulseAlpha(pulseSource, now),
      };
    }

    if (tile.id === game.selectedId) {
      highlight.outline = '#38bdf8';
    } else if (isBlocked) {
      highlight.outline = '#f87171';
    } else if (isHint) {
      highlight.outline = '#fbbf24';
    } else if (settings.highlightFree && tile.free) {
      highlight.outline = 'rgba(56, 189, 248, 0.35)';
    }

    drawTile(tile, highlight);
  }

  if (hasPulse && !fromLoop) {
    ensureAnimation();
  }
}

function pickTileAt(x, y) {
  for (let i = game.drawOrder.length - 1; i >= 0; i--) {
    const tile = game.tiles[game.drawOrder[i]];
    if (tile.removed) continue;
    if (x >= tile.px && x <= tile.px + game.view.tileW &&
        y >= tile.py && y <= tile.py + game.view.tileH) {
      return tile;
    }
  }
  return null;
}

function clearSelection() {
  if (game.selectedId !== null) {
    game.tiles[game.selectedId].selected = false;
  }
  game.selectedId = null;
}

function removePair(a, b) {
  a.removed = true;
  b.removed = true;
  clearOcc(game.occ, a.slot);
  clearOcc(game.occ, b.slot);
  game.undoStack.push([a.id, b.id]);
  game.moves += 1;
  setStatus('Pair removed.');
  clearSelection();
  updateStats();
  updateControls();
  render();
  if (game.tiles.every((tile) => tile.removed)) {
    setFace(Face.WIN);
    setStatus('You cleared the board!');
    return;
  }
  checkForMoves();
}

function handleTileClick(tile) {
  if (!tile) return;
  if (!tile.free) {
    setStatus('Tile is blocked.');
    startPulse('blocked', [tile.id]);
    return;
  }
  if (game.selectedId === null) {
    game.selectedId = tile.id;
    setStatus('Select a matching free tile.');
    render();
    return;
  }
  if (game.selectedId === tile.id) {
    clearSelection();
    setStatus('Selection cleared.');
    render();
    return;
  }
  const first = game.tiles[game.selectedId];
  if (matchKey(first.type) === matchKey(tile.type)) {
    removePair(first, tile);
    return;
  }
  game.selectedId = tile.id;
  setStatus('No match. New tile selected.');
  render();
}

function findFreeMatch() {
  updateFreeTiles();
  const seen = new Map();
  for (const tile of game.tiles) {
    if (tile.removed || !tile.free) continue;
    const key = matchKey(tile.type);
    if (seen.has(key)) {
      return [seen.get(key), tile];
    }
    seen.set(key, tile);
  }
  return null;
}

function checkForMoves() {
  const match = findFreeMatch();
  if (!match) {
    setStatus(settings.allowShuffle ? 'No matches. Try shuffle.' : 'No matches available.');
  }
  return match;
}

function useHint() {
  if (!settings.allowHint) return;
  const match = findFreeMatch();
  if (!match) {
    setStatus('No available matches.');
    return;
  }
  const ids = [match[0].id, match[1].id];
  startPulse('hint', ids);
  setStatus('Hint highlighted.');
}

function undoMove() {
  if (!settings.allowUndo) return;
  const limit = settings.undoLimit;
  if (limit > 0 && game.undoUsed >= limit) {
    setStatus('Undo limit reached.');
    return;
  }
  const last = game.undoStack.pop();
  if (!last) {
    setStatus('Nothing to undo.');
    return;
  }
  for (const id of last) {
    const tile = game.tiles[id];
    tile.removed = false;
    setOcc(game.occ, tile.slot, tile.id);
  }
  game.undoUsed += 1;
  clearSelection();
  setStatus('Undo complete.');
  updateStats();
  updateControls();
  render();
}

function shuffleTiles() {
  if (!settings.allowShuffle) return;
  const remaining = game.tiles.filter((tile) => !tile.removed);
  if (remaining.length < 2) return;
  const types = remaining.map((tile) => tile.type);
  shuffleInPlace(types, game.rng);
  remaining.forEach((tile, idx) => {
    tile.type = types[idx];
  });
  clearSelection();
  setStatus('Tiles shuffled.');
  render();
  checkForMoves();
}

function onCanvasClick(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const tile = pickTileAt(x, y);
  handleTileClick(tile);
}

function loadSettings() {
  const preset = localStorage.getItem(STORAGE.preset) || Preset.BEGINNER;
  const presetDefaults = PRESET_DEFAULTS[preset] || PRESET_DEFAULTS[Preset.BEGINNER];
  const layout = localStorage.getItem(STORAGE.layout) || presetDefaults.layout;
  return {
    preset,
    layout: layout in LAYOUTS ? layout : presetDefaults.layout,
    seed: localStorage.getItem(STORAGE.seed) || '',
    solvable: localStorage.getItem(STORAGE.solvable) !== 'false',
    allowHint: localStorage.getItem(STORAGE.allowHint) !== 'false',
    allowUndo: localStorage.getItem(STORAGE.allowUndo) !== 'false',
    undoLimit: Number(localStorage.getItem(STORAGE.undoLimit) || presetDefaults.undoLimit || 0),
    allowShuffle: localStorage.getItem(STORAGE.allowShuffle) !== 'false',
    highlightFree: localStorage.getItem(STORAGE.highlightFree) !== 'false',
  };
}

function saveSettings() {
  localStorage.setItem(STORAGE.preset, settings.preset);
  localStorage.setItem(STORAGE.layout, settings.layout);
  localStorage.setItem(STORAGE.seed, settings.seed);
  localStorage.setItem(STORAGE.solvable, String(settings.solvable));
  localStorage.setItem(STORAGE.allowHint, String(settings.allowHint));
  localStorage.setItem(STORAGE.allowUndo, String(settings.allowUndo));
  localStorage.setItem(STORAGE.undoLimit, String(settings.undoLimit));
  localStorage.setItem(STORAGE.allowShuffle, String(settings.allowShuffle));
  localStorage.setItem(STORAGE.highlightFree, String(settings.highlightFree));
}

function syncSettingsUI() {
  presetSelect.value = settings.preset;
  layoutSelect.value = settings.layout;
  seedInput.value = settings.seed;
  solvableToggle.checked = settings.solvable;
  hintToggle.checked = settings.allowHint;
  undoToggle.checked = settings.allowUndo;
  undoLimitInput.value = String(settings.undoLimit);
  undoLimitInput.disabled = !settings.allowUndo;
  shuffleToggle.checked = settings.allowShuffle;
  highlightToggle.checked = settings.highlightFree;
  settingsError.textContent = '';
}

function applyPreset(preset) {
  const defaults = PRESET_DEFAULTS[preset];
  if (!defaults) return;
  settings.layout = defaults.layout;
  settings.solvable = defaults.solvable;
  settings.allowHint = defaults.allowHint;
  settings.allowUndo = defaults.allowUndo;
  settings.undoLimit = defaults.undoLimit;
  settings.allowShuffle = defaults.allowShuffle;
  settings.highlightFree = defaults.highlightFree;
}

function applySettingsFromUI() {
  const preset = presetSelect.value;
  if (preset !== Preset.CUSTOM) {
    applyPreset(preset);
  }
  settings.preset = preset;
  settings.layout = layoutSelect.value;
  settings.seed = seedInput.value.trim();
  settings.solvable = solvableToggle.checked;
  settings.allowHint = hintToggle.checked;
  settings.allowUndo = undoToggle.checked;
  const limitVal = Number(undoLimitInput.value);
  settings.undoLimit = Number.isFinite(limitVal) ? clamp(limitVal, 0, 999) : 0;
  settings.allowShuffle = shuffleToggle.checked;
  settings.highlightFree = highlightToggle.checked;
  saveSettings();
}

function openSettings() {
  syncSettingsUI();
  settingsModal.classList.remove('hidden');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsToggle.setAttribute('aria-expanded', 'false');
  settingsError.textContent = '';
}

function attachEvents() {
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  faceBtn.addEventListener('click', () => {
    buildGame();
  });
  hintBtn.addEventListener('click', useHint);
  undoBtn.addEventListener('click', undoMove);
  shuffleBtn.addEventListener('click', shuffleTiles);

  settingsToggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openSettings();
  });
  settingsClose.addEventListener('click', closeSettings);
  settingsCancel.addEventListener('click', closeSettings);
  settingsModal.addEventListener('click', (ev) => {
    if (ev.target === settingsModal) closeSettings();
  });
  settingsApply.addEventListener('click', () => {
    applySettingsFromUI();
    closeSettings();
    buildGame();
  });

  presetSelect.addEventListener('change', () => {
    const preset = presetSelect.value;
    if (preset !== Preset.CUSTOM) {
      applyPreset(preset);
    }
    settings.preset = preset;
    syncSettingsUI();
  });

  undoToggle.addEventListener('change', () => {
    undoLimitInput.disabled = !undoToggle.checked;
  });

  window.addEventListener('resize', () => {
    if (!game) return;
    computeLayout();
    render();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      closeSettings();
    }
  });
}

attachEvents();
buildGame();
