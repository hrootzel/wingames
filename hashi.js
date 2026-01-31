// Hashi Bridges implementation.
const HASHI_PACKS = {
  easy: [
    {
      id: 'easy-cross-5x5',
      name: 'Crossroads',
      w: 5,
      h: 5,
      islands: [
        { r: 0, c: 2, target: 1 },
        { r: 2, c: 0, target: 1 },
        { r: 2, c: 2, target: 4 },
        { r: 2, c: 4, target: 1 },
        { r: 4, c: 2, target: 1 },
      ],
    },
    {
      id: 'easy-columns-6x6',
      name: 'Twin Towers',
      w: 6,
      h: 6,
      islands: [
        { r: 0, c: 1, target: 2 },
        { r: 0, c: 4, target: 2 },
        { r: 2, c: 1, target: 4 },
        { r: 2, c: 4, target: 4 },
        { r: 4, c: 1, target: 2 },
        { r: 4, c: 4, target: 2 },
      ],
    },
  ],
  medium: [
    {
      id: 'medium-grid-7x7',
      name: 'Nine Patch',
      w: 7,
      h: 7,
      islands: [
        { r: 0, c: 1, target: 2 },
        { r: 0, c: 3, target: 4 },
        { r: 0, c: 5, target: 2 },
        { r: 3, c: 1, target: 4 },
        { r: 3, c: 3, target: 5 },
        { r: 3, c: 5, target: 4 },
        { r: 6, c: 1, target: 3 },
        { r: 6, c: 3, target: 3 },
        { r: 6, c: 5, target: 3 },
      ],
    },
    {
      id: 'medium-causeway-7x7',
      name: 'Causeway',
      w: 7,
      h: 7,
      islands: [
        { r: 0, c: 1, target: 1 },
        { r: 0, c: 5, target: 1 },
        { r: 2, c: 1, target: 4 },
        { r: 2, c: 3, target: 4 },
        { r: 2, c: 5, target: 4 },
        { r: 4, c: 1, target: 4 },
        { r: 4, c: 3, target: 4 },
        { r: 4, c: 5, target: 4 },
        { r: 6, c: 1, target: 1 },
        { r: 6, c: 5, target: 1 },
      ],
    },
  ],
  hard: [
    {
      id: 'hard-delta-9x9',
      name: 'Delta Links',
      w: 9,
      h: 9,
      islands: [
        { r: 0, c: 2, target: 3 },
        { r: 0, c: 6, target: 2 },
        { r: 2, c: 0, target: 2 },
        { r: 2, c: 4, target: 4 },
        { r: 2, c: 8, target: 2 },
        { r: 4, c: 4, target: 4 },
        { r: 4, c: 6, target: 4 },
        { r: 6, c: 0, target: 2 },
        { r: 6, c: 4, target: 3 },
        { r: 6, c: 8, target: 2 },
        { r: 8, c: 2, target: 3 },
        { r: 8, c: 6, target: 3 },
      ],
    },
    {
      id: 'hard-matrix-8x8',
      name: 'Matrix',
      w: 8,
      h: 8,
      islands: [
        { r: 0, c: 1, target: 2 },
        { r: 0, c: 4, target: 4 },
        { r: 0, c: 7, target: 2 },
        { r: 2, c: 1, target: 4 },
        { r: 2, c: 4, target: 5 },
        { r: 2, c: 7, target: 4 },
        { r: 4, c: 1, target: 4 },
        { r: 4, c: 4, target: 4 },
        { r: 4, c: 7, target: 4 },
        { r: 6, c: 1, target: 2 },
        { r: 6, c: 4, target: 3 },
        { r: 6, c: 7, target: 2 },
      ],
    },
  ],
};

const DIFFS = Object.keys(HASHI_PACKS);
const DIFF_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const STORAGE = {
  settings: 'hashi:v1:settings',
  lastPuzzle: 'hashi:v1:lastPuzzle',
  savePrefix: 'hashi:v1:save:',
};

const THEME_KEY = 'hashi_theme';

const DEFAULT_SETTINGS = {
  strict: false,
  showErrors: true,
  showGrid: true,
  showRemaining: false,
};

const statusEl = document.getElementById('status');
const timeEl = document.getElementById('time');
const islandCountEl = document.getElementById('island-count');
const satisfiedCountEl = document.getElementById('satisfied-count');
const bridgeCountEl = document.getElementById('bridge-count');
const diffSelect = document.getElementById('diff-select');
const puzzleSelect = document.getElementById('puzzle-select');
const appEl = document.getElementById('app');
const surfaceWrap = document.querySelector('.hashi-surface-wrap');
const surfaceEl = document.getElementById('hashi-surface');
const tipsEl = document.querySelector('.tips');

const undoBtn = document.getElementById('btn-undo');
const redoBtn = document.getElementById('btn-redo');
const resetBtn = document.getElementById('btn-reset');
const checkBtn = document.getElementById('btn-check');
const newBtn = document.getElementById('btn-new');
const randomBtn = document.getElementById('btn-random');

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsApply = document.getElementById('settings-apply');
const settingsCancel = document.getElementById('settings-cancel');
const settingsError = document.getElementById('settings-error');
const strictToggle = document.getElementById('opt-strict');
const errorsToggle = document.getElementById('opt-errors');
const gridToggle = document.getElementById('opt-grid');
const remainingToggle = document.getElementById('opt-remaining');
const settingsThemeBtn = document.getElementById('settings-theme');

let settings = loadSettings();

const puzzleIndex = new Map();
for (const diff of DIFFS) {
  for (const puzzle of HASHI_PACKS[diff]) {
    puzzleIndex.set(puzzle.id, { ...puzzle, diff });
  }
}

const game = {
  diff: null,
  puzzle: null,
  topo: null,
  state: null,
  islandEls: [],
  remainingEls: [],
  bridgeEls: [],
  hoverEdge: null,
  selected: null,
  lastDir: null,
  undo: [],
  redo: [],
  timerId: null,
  startedAt: null,
  elapsedMs: 0,
  saveTimer: null,
};

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (v) => String(v).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      strict: parsed.strict !== false,
      showErrors: parsed.showErrors !== false,
      showGrid: parsed.showGrid !== false,
      showRemaining: parsed.showRemaining === true,
    };
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next) {
  try {
    localStorage.setItem(STORAGE.settings, JSON.stringify(next));
  } catch (err) {
    // ignore
  }
}

function updateThemeMenuLabel() {
  if (!settingsThemeBtn) return;
  const current = document.body.dataset.theme === 'light' ? 'light' : 'dark';
  settingsThemeBtn.textContent = current === 'dark' ? 'Light Theme' : 'Dark Theme';
}

function setTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  updateThemeMenuLabel();
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (err) {
      // ignore
    }
  }
}

function initTheme() {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  } catch (err) {
    // ignore
  }
  setTheme(theme, false);
}

function buildTopology(puzzle) {
  const islands = puzzle.islands.map((island, id) => ({ ...island, id }));
  const rowBuckets = Array.from({ length: puzzle.h }, () => []);
  const colBuckets = Array.from({ length: puzzle.w }, () => []);
  for (const island of islands) {
    rowBuckets[island.r].push(island);
    colBuckets[island.c].push(island);
  }
  for (const row of rowBuckets) row.sort((a, b) => a.c - b.c);
  for (const col of colBuckets) col.sort((a, b) => a.r - b.r);

  const neighbors = Array.from({ length: islands.length }, () => ({
    up: null,
    down: null,
    left: null,
    right: null,
  }));
  const edges = [];
  const islandEdges = Array.from({ length: islands.length }, () => []);
  const edgeByPair = new Map();

  function addEdge(a, b, orient) {
    const ia = islands[a];
    const ib = islands[b];
    let r0 = ia.r;
    let c0 = ia.c;
    let r1 = ib.r;
    let c1 = ib.c;
    if (orient === 'h' && c0 > c1) {
      [c0, c1] = [c1, c0];
      [r0, r1] = [r1, r0];
    }
    if (orient === 'v' && r0 > r1) {
      [c0, c1] = [c1, c0];
      [r0, r1] = [r1, r0];
    }
    const edge = {
      id: edges.length,
      a,
      b,
      orient,
      r0,
      c0,
      r1,
      c1,
      crosses: [],
    };
    edges.push(edge);
    islandEdges[a].push(edge.id);
    islandEdges[b].push(edge.id);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    edgeByPair.set(key, edge.id);
  }

  for (const row of rowBuckets) {
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i].id;
      const b = row[i + 1].id;
      neighbors[a].right = b;
      neighbors[b].left = a;
      addEdge(a, b, 'h');
    }
  }

  for (const col of colBuckets) {
    for (let i = 0; i < col.length - 1; i++) {
      const a = col[i].id;
      const b = col[i + 1].id;
      neighbors[a].down = b;
      neighbors[b].up = a;
      addEdge(a, b, 'v');
    }
  }

  const horizontals = edges.filter((e) => e.orient === 'h');
  const verticals = edges.filter((e) => e.orient === 'v');
  for (const h of horizontals) {
    for (const v of verticals) {
      const crosses = v.c0 > h.c0 && v.c0 < h.c1 && h.r0 > v.r0 && h.r0 < v.r1;
      if (crosses) {
        h.crosses.push(v.id);
        v.crosses.push(h.id);
      }
    }
  }

  return {
    w: puzzle.w,
    h: puzzle.h,
    islands,
    edges,
    islandEdges,
    edgeByPair,
    neighbors,
    rowBuckets,
    colBuckets,
  };
}

function newState(topo) {
  return {
    edgeCounts: new Uint8Array(topo.edges.length),
    islandTotals: new Uint8Array(topo.islands.length),
    solved: false,
  };
}

function setEdgeCount(topo, state, edgeId, next) {
  const prev = state.edgeCounts[edgeId];
  if (prev === next) return false;
  state.edgeCounts[edgeId] = next;
  const edge = topo.edges[edgeId];
  const delta = next - prev;
  state.islandTotals[edge.a] += delta;
  state.islandTotals[edge.b] += delta;
  return true;
}

function applyEdgeChange(topo, state, edgeId, next, opts) {
  const edge = topo.edges[edgeId];
  const prev = state.edgeCounts[edgeId];
  const clamped = clamp(next, 0, 2);
  if (clamped === prev) return { ok: false, reason: 'no-change' };

  if (opts.strict) {
    const totalA = state.islandTotals[edge.a] - prev + clamped;
    const totalB = state.islandTotals[edge.b] - prev + clamped;
    if (totalA > topo.islands[edge.a].target || totalB > topo.islands[edge.b].target) {
      return { ok: false, reason: 'over' };
    }
  }

  if (clamped > 0) {
    for (const otherId of edge.crosses) {
      if (state.edgeCounts[otherId] > 0) {
        return { ok: false, reason: 'cross' };
      }
    }
  }

  setEdgeCount(topo, state, edgeId, clamped);
  state.solved = isSolved(topo, state);
  return { ok: true, prev, next: clamped };
}

function isSolved(topo, state) {
  for (let i = 0; i < topo.islands.length; i++) {
    if (state.islandTotals[i] !== topo.islands[i].target) return false;
  }
  return isConnected(topo, state);
}

function isConnected(topo, state) {
  const count = topo.islands.length;
  if (count <= 1) return true;
  const visited = new Array(count).fill(false);
  const stack = [0];
  visited[0] = true;
  while (stack.length) {
    const i = stack.pop();
    for (const edgeId of topo.islandEdges[i]) {
      if (state.edgeCounts[edgeId] === 0) continue;
      const edge = topo.edges[edgeId];
      const next = edge.a === i ? edge.b : edge.a;
      if (!visited[next]) {
        visited[next] = true;
        stack.push(next);
      }
    }
  }
  return visited.every(Boolean);
}

function hasAnyBridges(state) {
  return state.edgeCounts.some((v) => v > 0);
}

function updateTimer() {
  if (!game.startedAt) {
    timeEl.textContent = 'Time: 00:00';
    return;
  }
  const now = Date.now();
  const elapsed = game.timerId ? now - game.startedAt : game.elapsedMs;
  timeEl.textContent = `Time: ${formatTime(elapsed)}`;
}

function startTimer() {
  if (game.timerId) return;
  if (!game.startedAt) {
    game.startedAt = Date.now() - game.elapsedMs;
  }
  game.timerId = window.setInterval(() => {
    updateTimer();
  }, 1000);
}

function stopTimer() {
  if (!game.timerId) return;
  clearInterval(game.timerId);
  game.timerId = null;
  if (game.startedAt) {
    game.elapsedMs = Date.now() - game.startedAt;
  }
}

function resetTimer() {
  stopTimer();
  game.elapsedMs = 0;
  game.startedAt = null;
  updateTimer();
}

function scheduleSave() {
  if (!game.puzzle) return;
  if (game.saveTimer) return;
  game.saveTimer = window.setTimeout(() => {
    game.saveTimer = null;
    saveGame();
  }, 200);
}

function saveGame() {
  if (!game.puzzle || !game.state) return;
  if (game.timerId && game.startedAt) {
    game.elapsedMs = Date.now() - game.startedAt;
  }
  const payload = {
    version: 1,
    puzzleId: game.puzzle.id,
    edgeCounts: Array.from(game.state.edgeCounts),
    elapsedMs: game.elapsedMs,
    solved: game.state.solved,
  };
  try {
    localStorage.setItem(`${STORAGE.savePrefix}${game.puzzle.id}`, JSON.stringify(payload));
    localStorage.setItem(STORAGE.lastPuzzle, game.puzzle.id);
  } catch (err) {
    // ignore
  }
}

function loadSave(puzzleId) {
  try {
    const raw = localStorage.getItem(`${STORAGE.savePrefix}${puzzleId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.puzzleId !== puzzleId) return null;
    if (!Array.isArray(data.edgeCounts)) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function clearSave(puzzleId) {
  try {
    localStorage.removeItem(`${STORAGE.savePrefix}${puzzleId}`);
  } catch (err) {
    // ignore
  }
}

function updateControls() {
  undoBtn.disabled = game.undo.length === 0;
  redoBtn.disabled = game.redo.length === 0;
  resetBtn.disabled = !game.state || !hasAnyBridges(game.state);
  checkBtn.disabled = !game.state;
}

function updateStats() {
  if (!game.topo || !game.state) return;
  const total = game.topo.islands.length;
  let satisfied = 0;
  let bridges = 0;
  for (let i = 0; i < total; i++) {
    if (game.state.islandTotals[i] === game.topo.islands[i].target) satisfied += 1;
  }
  for (const v of game.state.edgeCounts) bridges += v;
  islandCountEl.textContent = String(total);
  satisfiedCountEl.textContent = String(satisfied);
  bridgeCountEl.textContent = String(bridges);
}

function setHoverEdge(edgeId) {
  if (game.hoverEdge === edgeId) return;
  if (game.hoverEdge !== null && game.bridgeEls[game.hoverEdge]) {
    game.bridgeEls[game.hoverEdge].classList.remove('preview');
  }
  game.hoverEdge = edgeId;
  if (edgeId !== null && game.bridgeEls[edgeId]) {
    game.bridgeEls[edgeId].classList.add('preview');
  }
}

function render() {
  if (!game.topo || !game.state) return;
  for (let i = 0; i < game.bridgeEls.length; i++) {
    const el = game.bridgeEls[i];
    if (!el) continue;
    const count = game.state.edgeCounts[i];
    el.classList.remove('b0', 'b1', 'b2');
    el.classList.add(`b${count}`);
  }
  for (let i = 0; i < game.islandEls.length; i++) {
    const el = game.islandEls[i];
    if (!el) continue;
    const total = game.state.islandTotals[i];
    const target = game.topo.islands[i].target;
    el.classList.toggle('selected', game.selected === i);
    el.classList.toggle('satisfied', total === target);
    el.classList.toggle('over', total > target);
    const mismatch = settings.showErrors && total !== target;
    el.classList.toggle('mismatch', mismatch);
    const remainingEl = game.remainingEls[i];
    if (remainingEl) {
      if (settings.showRemaining) {
        remainingEl.style.display = 'block';
        remainingEl.textContent = String(target - total);
      } else {
        remainingEl.style.display = 'none';
      }
    }
  }
  surfaceEl.classList.toggle('grid', settings.showGrid);
  updateStats();
  updateControls();
  updateTimer();
}

function rebuildBoard() {
  if (!game.topo || !game.state) return;
  surfaceEl.innerHTML = '';
  const bridgeLayer = document.createElement('div');
  bridgeLayer.className = 'bridge-layer';
  const islandLayer = document.createElement('div');
  islandLayer.className = 'island-layer';
  surfaceEl.appendChild(bridgeLayer);
  surfaceEl.appendChild(islandLayer);

  game.bridgeEls = [];
  game.islandEls = [];
  game.remainingEls = [];

  layoutBoard();

  for (const edge of game.topo.edges) {
    const el = document.createElement('div');
    el.className = `bridge ${edge.orient} b0`;
    el.dataset.edgeId = String(edge.id);
    bridgeLayer.appendChild(el);
    game.bridgeEls[edge.id] = el;
  }

  for (const island of game.topo.islands) {
    const el = document.createElement('div');
    el.className = 'island';
    el.dataset.id = String(island.id);
    el.textContent = String(island.target);
    const remainingEl = document.createElement('span');
    remainingEl.className = 'remaining';
    remainingEl.textContent = String(island.target);
    el.appendChild(remainingEl);
    islandLayer.appendChild(el);
    game.islandEls[island.id] = el;
    game.remainingEls[island.id] = remainingEl;
  }

  positionPieces();
}

function layoutBoard() {
  if (!game.topo) return;
  const wrapStyles = window.getComputedStyle(surfaceWrap);
  const padX = parseFloat(wrapStyles.paddingLeft) + parseFloat(wrapStyles.paddingRight);
  const padY = parseFloat(wrapStyles.paddingTop) + parseFloat(wrapStyles.paddingBottom);
  const wrapRect = surfaceWrap.getBoundingClientRect();
  const availableW = surfaceWrap.clientWidth - padX;
  const appStyles = appEl ? window.getComputedStyle(appEl) : null;
  const appPadBottom = appStyles ? parseFloat(appStyles.paddingBottom) : 0;
  const footerSpace = 16 + appPadBottom;
  let availableH = window.innerHeight - wrapRect.top - footerSpace - padY;
  if (!Number.isFinite(availableH)) {
    availableH = Math.min(window.innerHeight * 0.55, 760) - padY;
  }
  availableH = Math.max(180, availableH);

  const sizeByW = Math.floor(availableW / game.topo.w);
  const sizeByH = Math.floor(availableH / game.topo.h);
  const cell = clamp(Math.min(sizeByW, sizeByH, 64), 28, 72);
  const islandSize = Math.round(cell * 0.66);
  const bridgeStroke = Math.max(3, Math.round(cell * 0.12));
  const bridgeBand = Math.max(bridgeStroke * 3, Math.round(cell * 0.28));
  const bridgeOffset = Math.round(bridgeStroke * 0.9);

  surfaceEl.style.setProperty('--cell', `${cell}px`);
  surfaceEl.style.setProperty('--island-size', `${islandSize}px`);
  surfaceEl.style.setProperty('--bridge-stroke', `${bridgeStroke}px`);
  surfaceEl.style.setProperty('--bridge-band', `${bridgeBand}px`);
  surfaceEl.style.setProperty('--bridge-offset', `${bridgeOffset}px`);
  surfaceEl.style.width = `${game.topo.w * cell}px`;
  surfaceEl.style.height = `${game.topo.h * cell}px`;
  const boardHeight = game.topo.h * cell;
  const wrapHeight = Math.min(availableH, boardHeight) + padY;
  surfaceWrap.style.height = `${wrapHeight}px`;
}

function positionPieces() {
  if (!game.topo) return;
  const cell = parseFloat(getComputedStyle(surfaceEl).getPropertyValue('--cell')) || 48;
  const islandSize = parseFloat(getComputedStyle(surfaceEl).getPropertyValue('--island-size')) || 32;
  const bridgeBand = parseFloat(getComputedStyle(surfaceEl).getPropertyValue('--bridge-band')) || 14;

  for (const edge of game.topo.edges) {
    const el = game.bridgeEls[edge.id];
    if (!el) continue;
    const a = game.topo.islands[edge.a];
    const b = game.topo.islands[edge.b];
    const ax = a.c * cell + cell / 2;
    const ay = a.r * cell + cell / 2;
    const bx = b.c * cell + cell / 2;
    const by = b.r * cell + cell / 2;

    if (edge.orient === 'h') {
      const left = Math.min(ax, bx) + islandSize / 2;
      const width = Math.max(4, Math.abs(bx - ax) - islandSize);
      el.style.left = `${left}px`;
      el.style.top = `${ay - bridgeBand / 2}px`;
      el.style.width = `${width}px`;
      el.style.height = `${bridgeBand}px`;
    } else {
      const top = Math.min(ay, by) + islandSize / 2;
      const height = Math.max(4, Math.abs(by - ay) - islandSize);
      el.style.left = `${ax - bridgeBand / 2}px`;
      el.style.top = `${top}px`;
      el.style.width = `${bridgeBand}px`;
      el.style.height = `${height}px`;
    }
  }

  for (const island of game.topo.islands) {
    const el = game.islandEls[island.id];
    if (!el) continue;
    const left = island.c * cell + cell / 2 - islandSize / 2;
    const top = island.r * cell + cell / 2 - islandSize / 2;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
}

let layoutRaf = null;
let resizeObserver = null;

function scheduleLayout() {
  if (layoutRaf) return;
  layoutRaf = window.requestAnimationFrame(() => {
    layoutRaf = null;
    layoutBoard();
    positionPieces();
  });
}

function selectIsland(id) {
  game.selected = id;
  render();
  if (surfaceEl) surfaceEl.focus({ preventScroll: true });
}

function clearSelection() {
  game.selected = null;
  setHoverEdge(null);
  render();
}

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getEdgeId(a, b) {
  return game.topo.edgeByPair.get(edgeKey(a, b));
}

function directionFromTo(a, b) {
  const ia = game.topo.islands[a];
  const ib = game.topo.islands[b];
  if (ia.r === ib.r) return ia.c < ib.c ? 'right' : 'left';
  if (ia.c === ib.c) return ia.r < ib.r ? 'down' : 'up';
  return null;
}

function applyMove(edgeId, nextCount) {
  const result = applyEdgeChange(game.topo, game.state, edgeId, nextCount, { strict: settings.strict });
  if (!result.ok) {
    if (result.reason === 'over') setStatus('That would exceed an island count.');
    if (result.reason === 'cross') setStatus('Bridges cannot cross.');
    return false;
  }
  if (!game.timerId && hasAnyBridges(game.state)) {
    startTimer();
  }
  if (result.prev !== undefined) {
    game.undo.push({ edgeId, prev: result.prev, next: result.next });
    game.redo.length = 0;
  }
  if (game.state.solved) {
    stopTimer();
    setStatus('Solved!');
  } else {
    setStatus('Move recorded.');
  }
  scheduleSave();
  render();
  return true;
}

function cycleEdge(edgeId, dir) {
  const prev = game.state.edgeCounts[edgeId];
  const next = (prev + (dir > 0 ? 1 : 2)) % 3;
  return applyMove(edgeId, next);
}

function setEdge(edgeId, count) {
  return applyMove(edgeId, count);
}

function attemptEdge(a, b, dir) {
  if (a === null || b === null) return false;
  const edgeId = getEdgeId(a, b);
  if (edgeId === undefined) return false;
  const ok = cycleEdge(edgeId, dir);
  if (ok) {
    game.lastDir = directionFromTo(a, b);
    selectIsland(b);
  }
  return ok;
}

function attemptEdgeDir(a, dir, mode) {
  if (a === null || !dir) return false;
  const neighbor = game.topo.neighbors[a][dir];
  if (neighbor === null) return false;
  const edgeId = getEdgeId(a, neighbor);
  if (edgeId === undefined) return false;
  let ok = false;
  if (mode === 'set0') ok = setEdge(edgeId, 0);
  if (mode === 'set1') ok = setEdge(edgeId, 1);
  if (mode === 'set2') ok = setEdge(edgeId, 2);
  if (mode === 'cycle') ok = cycleEdge(edgeId, 1);
  if (mode === 'cycleBack') ok = cycleEdge(edgeId, -1);
  if (ok) {
    game.lastDir = dir;
    selectIsland(neighbor);
  }
  return ok;
}

function undoMove() {
  if (!game.undo.length) {
    setStatus('Nothing to undo.');
    return;
  }
  const diff = game.undo.pop();
  setEdgeCount(game.topo, game.state, diff.edgeId, diff.prev);
  game.state.solved = isSolved(game.topo, game.state);
  game.redo.push(diff);
  setStatus('Undid move.');
  scheduleSave();
  render();
}

function redoMove() {
  if (!game.redo.length) {
    setStatus('Nothing to redo.');
    return;
  }
  const diff = game.redo.pop();
  setEdgeCount(game.topo, game.state, diff.edgeId, diff.next);
  game.state.solved = isSolved(game.topo, game.state);
  game.undo.push(diff);
  setStatus('Redid move.');
  scheduleSave();
  render();
}

function resetPuzzle(clearSaveFlag) {
  if (!game.topo) return;
  game.state = newState(game.topo);
  game.undo = [];
  game.redo = [];
  game.selected = null;
  game.lastDir = null;
  resetTimer();
  if (clearSaveFlag && game.puzzle) clearSave(game.puzzle.id);
  setStatus('Puzzle reset.');
  render();
  scheduleSave();
}

function checkPuzzle() {
  if (!game.state) return;
  let over = false;
  let mismatch = false;
  for (let i = 0; i < game.topo.islands.length; i++) {
    const total = game.state.islandTotals[i];
    const target = game.topo.islands[i].target;
    if (total > target) over = true;
    if (total !== target) mismatch = true;
  }
  if (over) {
    setStatus('Some islands exceed their counts.');
  } else if (!mismatch) {
    if (isConnected(game.topo, game.state)) {
      setStatus('All islands satisfied and connected.');
    } else {
      setStatus('All counts match, but islands are disconnected.');
    }
  } else {
    setStatus('Some islands still need bridges.');
  }
  render();
}

function applySettingsFromUI() {
  settings = {
    strict: strictToggle.checked,
    showErrors: errorsToggle.checked,
    showGrid: gridToggle.checked,
    showRemaining: remainingToggle.checked,
  };
  saveSettings(settings);
  render();
}

function openSettings() {
  settingsError.textContent = '';
  strictToggle.checked = settings.strict;
  errorsToggle.checked = settings.showErrors;
  gridToggle.checked = settings.showGrid;
  remainingToggle.checked = settings.showRemaining;
  updateThemeMenuLabel();
  settingsModal.classList.remove('hidden');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsToggle.setAttribute('aria-expanded', 'false');
  settingsError.textContent = '';
}

function loadPuzzle(puzzle, resume) {
  game.diff = puzzle.diff;
  game.puzzle = puzzle;
  game.topo = buildTopology(puzzle);
  game.state = newState(game.topo);
  game.undo = [];
  game.redo = [];
  game.selected = null;
  game.lastDir = null;
  game.hoverEdge = null;
  game.elapsedMs = 0;
  game.startedAt = null;
  stopTimer();

  const saved = resume ? loadSave(puzzle.id) : null;
  if (saved && saved.edgeCounts && saved.edgeCounts.length === game.topo.edges.length) {
    for (let i = 0; i < saved.edgeCounts.length; i++) {
      const count = clamp(saved.edgeCounts[i], 0, 2);
      setEdgeCount(game.topo, game.state, i, count);
    }
    game.elapsedMs = saved.elapsedMs || 0;
    if (game.elapsedMs > 0) {
      game.startedAt = Date.now() - game.elapsedMs;
      startTimer();
    }
    game.state.solved = isSolved(game.topo, game.state);
    setStatus(saved.solved || game.state.solved ? 'Solved!' : 'Resumed puzzle.');
  } else {
    setStatus('Ready.');
  }

  rebuildBoard();
  render();
  scheduleSave();
}

function populateDiffs() {
  diffSelect.innerHTML = '';
  for (const diff of DIFFS) {
    const opt = document.createElement('option');
    opt.value = diff;
    opt.textContent = DIFF_LABELS[diff] || diff;
    diffSelect.appendChild(opt);
  }
}

function populatePuzzles(diff) {
  puzzleSelect.innerHTML = '';
  const list = HASHI_PACKS[diff] || [];
  list.forEach((puzzle, idx) => {
    const opt = document.createElement('option');
    opt.value = puzzle.id;
    opt.textContent = `${String(idx + 1).padStart(2, '0')} - ${puzzle.name}`;
    puzzleSelect.appendChild(opt);
  });
}

function selectPuzzleById(puzzleId, resume) {
  const puzzle = puzzleIndex.get(puzzleId);
  if (!puzzle) return false;
  diffSelect.value = puzzle.diff;
  populatePuzzles(puzzle.diff);
  puzzleSelect.value = puzzleId;
  loadPuzzle(puzzle, resume);
  return true;
}

function selectDefaultPuzzle() {
  const diff = DIFFS[0];
  diffSelect.value = diff;
  populatePuzzles(diff);
  const list = HASHI_PACKS[diff];
  if (list && list.length) {
    puzzleSelect.value = list[0].id;
    loadPuzzle({ ...list[0], diff }, true);
  }
}

function getClosestIslandByCoords(r, c, dir) {
  if (!game.topo) return null;
  if (dir === 'up' || dir === 'down') {
    const col = game.topo.colBuckets[c];
    if (!col || !col.length) return null;
    if (dir === 'up') {
      let best = null;
      for (const island of col) {
        if (island.r < r) best = island;
        if (island.r >= r) break;
      }
      return best ? best.id : null;
    }
    for (const island of col) {
      if (island.r > r) return island.id;
    }
    return null;
  }
  const row = game.topo.rowBuckets[r];
  if (!row || !row.length) return null;
  if (dir === 'left') {
    let best = null;
    for (const island of row) {
      if (island.c < c) best = island;
      if (island.c >= c) break;
    }
    return best ? best.id : null;
  }
  for (const island of row) {
    if (island.c > c) return island.id;
  }
  return null;
}

function getClickBetweenIslands(ev) {
  if (!game.topo) return null;
  const rect = surfaceEl.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const cell = parseFloat(getComputedStyle(surfaceEl).getPropertyValue('--cell')) || 48;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  if (row < 0 || row >= game.topo.h || col < 0 || col >= game.topo.w) return null;

  const up = getClosestIslandByCoords(row, col, 'up');
  const down = getClosestIslandByCoords(row, col, 'down');
  const left = getClosestIslandByCoords(row, col, 'left');
  const right = getClosestIslandByCoords(row, col, 'right');
  const canVert = up !== null && down !== null && getEdgeId(up, down) !== undefined;
  const canHoriz = left !== null && right !== null && getEdgeId(left, right) !== undefined;

  if (!canVert && !canHoriz) return null;
  if (canVert && !canHoriz) return { from: up, to: down, dir: 'down' };
  if (!canVert && canHoriz) return { from: left, to: right, dir: 'right' };

  const offsetX = Math.abs(x - (col + 0.5) * cell);
  const offsetY = Math.abs(y - (row + 0.5) * cell);
  if (offsetX <= offsetY) return { from: up, to: down, dir: 'down' };
  return { from: left, to: right, dir: 'right' };
}

function handlePointerDown(ev) {
  if (!game.topo || settingsModal && !settingsModal.classList.contains('hidden')) return;
  const bridgeEl = ev.target.closest('.bridge');
  if (bridgeEl) {
    ev.preventDefault();
    const edgeId = Number(bridgeEl.dataset.edgeId);
    const dir = ev.button === 2 ? -1 : 1;
    cycleEdge(edgeId, dir);
    return;
  }

  const islandEl = ev.target.closest('.island');
  if (!islandEl) {
    const between = getClickBetweenIslands(ev);
    if (between) {
      const edgeId = getEdgeId(between.from, between.to);
      if (edgeId !== undefined) {
        const dir = ev.button === 2 ? -1 : 1;
        cycleEdge(edgeId, dir);
        game.lastDir = between.dir;
        selectIsland(between.to);
        return;
      }
    }
    clearSelection();
    return;
  }
  ev.preventDefault();
  const id = Number(islandEl.dataset.id);
  if (game.selected === null) {
    selectIsland(id);
    return;
  }
  if (game.selected === id) {
    selectIsland(id);
    return;
  }
  const edgeId = getEdgeId(game.selected, id);
  if (edgeId !== undefined) {
    const dir = ev.button === 2 ? -1 : 1;
    cycleEdge(edgeId, dir);
    game.lastDir = directionFromTo(game.selected, id);
    selectIsland(id);
    return;
  }
  selectIsland(id);
}

function handleHover(ev) {
  if (!game.topo) return;
  const islandEl = ev.target.closest('.island');
  if (!islandEl || game.selected === null) {
    setHoverEdge(null);
    return;
  }
  const id = Number(islandEl.dataset.id);
  if (id === game.selected) {
    setHoverEdge(null);
    return;
  }
  const edgeId = getEdgeId(game.selected, id);
  if (edgeId !== undefined) {
    setHoverEdge(edgeId);
  } else {
    setHoverEdge(null);
  }
}

function handleContextMenu(ev) {
  if (ev.target.closest('.hashi-surface')) {
    ev.preventDefault();
  }
}

function moveSelection(dir, withBridge) {
  if (game.selected === null) {
    if (game.topo.islands.length) selectIsland(0);
    return;
  }
  const neighbor = game.topo.neighbors[game.selected][dir];
  if (neighbor === null) return;
  if (withBridge) {
    attemptEdgeDir(game.selected, dir, 'cycle');
  } else {
    selectIsland(neighbor);
    game.lastDir = dir;
  }
}

function handleKeyDown(ev) {
  if (!game.topo) return;
  if (!settingsModal.classList.contains('hidden')) {
    if (ev.key === 'Escape') closeSettings();
    return;
  }
  const key = ev.key;
  if ((ev.ctrlKey || ev.metaKey) && key.toLowerCase() === 'z') {
    ev.preventDefault();
    undoMove();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && key.toLowerCase() === 'y') {
    ev.preventDefault();
    redoMove();
    return;
  }
  if (key === 'Escape') {
    clearSelection();
    return;
  }
  if (key === 'ArrowUp') {
    ev.preventDefault();
    moveSelection('up', ev.shiftKey || ev.ctrlKey || ev.metaKey);
    return;
  }
  if (key === 'ArrowDown') {
    ev.preventDefault();
    moveSelection('down', ev.shiftKey || ev.ctrlKey || ev.metaKey);
    return;
  }
  if (key === 'ArrowLeft') {
    ev.preventDefault();
    moveSelection('left', ev.shiftKey || ev.ctrlKey || ev.metaKey);
    return;
  }
  if (key === 'ArrowRight') {
    ev.preventDefault();
    moveSelection('right', ev.shiftKey || ev.ctrlKey || ev.metaKey);
    return;
  }
  if (key === ' ' || key === 'Enter') {
    ev.preventDefault();
    if (game.selected !== null && game.lastDir) {
      attemptEdgeDir(game.selected, game.lastDir, 'cycle');
    }
    return;
  }
  if (key === '0' || key === '1' || key === '2') {
    if (game.selected !== null && game.lastDir) {
      const mode = key === '0' ? 'set0' : key === '1' ? 'set1' : 'set2';
      attemptEdgeDir(game.selected, game.lastDir, mode);
    }
  }
}

function attachEvents() {
  surfaceEl.addEventListener('pointerdown', handlePointerDown);
  surfaceEl.addEventListener('mousemove', handleHover);
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);

  undoBtn.addEventListener('click', undoMove);
  redoBtn.addEventListener('click', redoMove);
  resetBtn.addEventListener('click', () => resetPuzzle(false));
  checkBtn.addEventListener('click', checkPuzzle);
  newBtn.addEventListener('click', () => {
    const puzzle = puzzleIndex.get(puzzleSelect.value);
    if (puzzle) {
      loadPuzzle(puzzle, false);
      clearSave(puzzle.id);
    }
  });
  randomBtn.addEventListener('click', () => {
    const list = HASHI_PACKS[diffSelect.value] || [];
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    puzzleSelect.value = pick.id;
    loadPuzzle({ ...pick, diff: diffSelect.value }, true);
  });

  diffSelect.addEventListener('change', () => {
    const diff = diffSelect.value;
    populatePuzzles(diff);
    const list = HASHI_PACKS[diff] || [];
    if (list.length) {
      puzzleSelect.value = list[0].id;
      loadPuzzle({ ...list[0], diff }, true);
    }
  });

  puzzleSelect.addEventListener('change', () => {
    const puzzleId = puzzleSelect.value;
    const puzzle = puzzleIndex.get(puzzleId);
    if (puzzle) loadPuzzle(puzzle, true);
  });

  settingsToggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openSettings();
  });
  settingsClose.addEventListener('click', closeSettings);
  settingsCancel.addEventListener('click', closeSettings);
  settingsApply.addEventListener('click', () => {
    applySettingsFromUI();
    closeSettings();
  });
  if (settingsThemeBtn) {
    settingsThemeBtn.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
      setTheme(next);
    });
  }
  settingsModal.addEventListener('click', (ev) => {
    if (ev.target === settingsModal) closeSettings();
  });

  window.addEventListener('resize', scheduleLayout);
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleLayout);
    if (appEl) resizeObserver.observe(appEl);
    resizeObserver.observe(surfaceWrap);
  }
}

function init() {
  initTheme();
  populateDiffs();
  const lastPuzzleId = localStorage.getItem(STORAGE.lastPuzzle);
  if (lastPuzzleId && selectPuzzleById(lastPuzzleId, true)) {
    return;
  }
  selectDefaultPuzzle();
}

attachEvents();
init();
