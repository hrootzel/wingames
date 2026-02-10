export const COLS = 6;
export const ROWS_VISIBLE = 12;
export const ROWS_BUFFER = 0;
export const ROWS = ROWS_VISIBLE + ROWS_BUFFER;
export const VISIBLE_START = ROWS - ROWS_VISIBLE;

export const CELL_EMPTY = 0;
export const CELL_I = 1;
export const CELL_V = 2;
export const CELL_X = 3;
export const CELL_L = 4;
export const CELL_C = 5;
export const CELL_D = 6;
export const CELL_PLUS = 7;
export const CELL_MINUS = 8;

export const REQUIRE = [5, 2, 5, 2, 5, 2];
export const DENOM = [1, 5, 10, 50, 100, 500];
export const BASE_DESCENT_MS = { 1: 1600, 2: 1450, 3: 1325, 4: 1200, 5: 1100, 6: 1000, 7: 925, 8: 850 };
export const DIFF_LEVEL_SHIFT = { 1: -6, 2: -4, 3: -2, 4: 0, 5: 2, 6: 4, 7: 6, 8: 8 };

export function makeRng(seed) {
  let t = seed >>> 0;
  return {
    next() {
      t += 0x6d2b79f5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    int(n) {
      return Math.floor(this.next() * n);
    },
  };
}

export function isCoin(cell) {
  return cell >= CELL_I && cell <= CELL_D;
}

export function tierOf(cell) {
  return isCoin(cell) ? cell - 1 : null;
}

export function cellOfTier(tier) {
  return CELL_I + tier;
}

export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_EMPTY));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function descentIntervalMs(level, difficulty) {
  const base = BASE_DESCENT_MS[difficulty];
  const ms = base * Math.pow(0.97, level - 1);
  return Math.max(260, Math.floor(ms));
}

function sampleTier(rng, weights) {
  const r = rng.next();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (r <= sum) return i;
  }
  return weights.length - 1;
}

export function generateSpawnRow({ rng, level, difficulty }) {
  const eff = level + DIFF_LEVEL_SHIFT[difficulty];
  let weights;
  if (eff <= 5) weights = [0.55, 0.25, 0.2, 0, 0, 0];
  else if (eff <= 12) weights = [0.4, 0.25, 0.25, 0.1, 0, 0];
  else if (eff <= 20) weights = [0.28, 0.22, 0.25, 0.18, 0.07, 0];
  else weights = [0.2, 0.18, 0.22, 0.2, 0.14, 0.06];

  const row = Array(COLS).fill(CELL_EMPTY);
  for (let c = 0; c < COLS; c++) {
    row[c] = cellOfTier(sampleTier(rng, weights));
  }

  const pSpecial = Math.min(0.12, 0.03 + 0.002 * eff);
  if (rng.next() < pSpecial) {
    const col = rng.int(COLS);
    row[col] = rng.next() < 0.52 ? CELL_PLUS : CELL_MINUS;
  }
  return row;
}

export function countOccupied(board, col) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) if (board[r][col] !== CELL_EMPTY) n++;
  return n;
}

export function findBottomOccupiedRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] !== CELL_EMPTY) return r;
  }
  return -1;
}

export function applyGravity(board) {
  applyGravityAndRemapActive(board, null);
}

function applyGravityAndRemapActive(board, activeSet) {
  let nextActive = activeSet ? new Set() : null;
  for (let c = 0; c < COLS; c++) {
    let write = 0;
    for (let r = 0; r < ROWS; r++) {
      const cell = board[r][c];
      if (cell !== CELL_EMPTY) {
        if (nextActive && activeSet.has(cellKey(r, c))) nextActive.add(cellKey(write, c));
        if (write !== r) {
          board[write][c] = cell;
          board[r][c] = CELL_EMPTY;
        }
        write++;
      }
    }
  }
  return nextActive;
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function makeActiveSet(activeCells) {
  if (!Array.isArray(activeCells) || activeCells.length === 0) return null;
  const active = new Set();
  for (const cell of activeCells) {
    if (!Array.isArray(cell) || cell.length !== 2) continue;
    const [r, c] = cell;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    active.add(cellKey(r, c));
  }
  return active.size > 0 ? active : null;
}

function groupTouchesActive(group, activeSet) {
  if (!activeSet) return true;
  for (const [r, c] of group.cells) {
    if (activeSet.has(cellKey(r, c))) return true;
  }
  return false;
}

function rankUpAllOfTier(board, tier) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tierOf(board[r][c]) === tier) {
        count++;
        board[r][c] = tier < 5 ? cellOfTier(tier + 1) : CELL_EMPTY;
      }
    }
  }
  return count;
}

function eraseAllOfTier(board, tier) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tierOf(board[r][c]) === tier) {
        board[r][c] = CELL_EMPTY;
        count++;
      }
    }
  }
  return count;
}

export function activateSpecialsOnce(board, activeSet = null) {
  let changed = false;
  let scoreDelta = 0;
  let cleared = 0;
  let specialActivations = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell !== CELL_PLUS && cell !== CELL_MINUS) continue;
      if (activeSet && !activeSet.has(cellKey(r, c))) continue;

      let rr = r + 1;
      while (rr < ROWS && board[rr][c] === CELL_EMPTY) rr++;

      if (rr < ROWS && isCoin(board[rr][c])) {
        const tier = tierOf(board[rr][c]);
        let affected = 0;
        if (cell === CELL_PLUS) {
          affected = rankUpAllOfTier(board, tier);
          scoreDelta += DENOM[tier] * affected * 6;
        } else {
          affected = eraseAllOfTier(board, tier);
          cleared += affected;
          scoreDelta += DENOM[tier] * affected * 8;
        }
        changed = changed || affected > 0;
        specialActivations++;
      }
      board[r][c] = CELL_EMPTY;
    }
  }

  return { changed, scoreDelta, cleared, specialActivations };
}

export function findGroups(board) {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!isCoin(cell) || visited[r][c]) continue;

      const tier = tierOf(cell);
      const stack = [[r, c]];
      visited[r][c] = true;
      const cells = [];

      while (stack.length) {
        const [rr, cc] = stack.pop();
        cells.push([rr, cc]);
        const neighbors = [
          [rr - 1, cc],
          [rr + 1, cc],
          [rr, cc - 1],
          [rr, cc + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          if (visited[nr][nc]) continue;
          if (board[nr][nc] === cell) {
            visited[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      groups.push({ tier, cells });
    }
  }
  return groups;
}

export function selectUpgradeSpawn(cells) {
  let best = cells[0];
  for (const [r, c] of cells) {
    if (r > best[0] || (r === best[0] && c > best[1])) best = [r, c];
  }
  return best;
}

function findTopFreeRow(board, col) {
  for (let r = 0; r < ROWS; r++) {
    if (board[r][col] === CELL_EMPTY) return r;
  }
  return -1;
}

export function applyScoreForStep(conversions, chainStep) {
  const chainMult = 1 + 0.5 * (chainStep - 1);
  const comboMult = 1 + 0.25 * (conversions.length - 1);
  let stepPoints = 0;
  let anyDClear = false;

  for (const conv of conversions) {
    stepPoints += DENOM[conv.tier] * conv.size * 10;
    if (conv.tier === 5) anyDClear = true;
  }

  stepPoints = Math.floor(stepPoints * chainMult * comboMult);
  if (anyDClear) stepPoints += 1000;
  return stepPoints;
}

export function resolveBoard(board, options = {}) {
  const useGravity = options.applyGravity !== false;
  let activeSet = makeActiveSet(options.activeCells);
  let chain = 0;
  let guard = 0;
  let clearedInResolve = 0;
  let specialsInResolve = 0;
  let scoreDelta = 0;

  while (guard++ < 64) {
    if (useGravity && activeSet) activeSet = applyGravityAndRemapActive(board, activeSet);
    else if (useGravity) applyGravity(board);
    const specialResult = activateSpecialsOnce(board, activeSet);
    scoreDelta += specialResult.scoreDelta;
    clearedInResolve += specialResult.cleared;
    specialsInResolve += specialResult.specialActivations;

    const groups = findGroups(board);
    const toConvert = groups
      .map((g) => ({
        ...g,
        setSize: REQUIRE[g.tier],
        setCount: Math.floor(g.cells.length / REQUIRE[g.tier]),
      }))
      .filter((g) => g.setCount > 0 && groupTouchesActive(g, activeSet));
    if (toConvert.length === 0) break;
    chain++;

    const clearMask = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const spawns = [];
    const conversions = [];

    for (const group of toConvert) {
      const sorted = group.cells.slice().sort((a, b) => {
        if (a[0] !== b[0]) return b[0] - a[0];
        return b[1] - a[1];
      });
      const consumeCount = group.setCount * group.setSize;
      const consumed = sorted.slice(0, consumeCount);
      for (const [r, c] of consumed) clearMask[r][c] = true;

      if (group.tier < 5) {
        for (let i = 0; i < group.setCount; i++) {
          const chunkStart = i * group.setSize;
          const chunk = consumed.slice(chunkStart, chunkStart + group.setSize);
          if (chunk.length === 0) continue;
          const spawnAt = selectUpgradeSpawn(chunk);
          spawns.push({ c: spawnAt[1], cell: cellOfTier(group.tier + 1) });
        }
      }
      conversions.push({ tier: group.tier, size: consumeCount });
    }

    let removedCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (clearMask[r][c]) {
          board[r][c] = CELL_EMPTY;
          removedCount++;
        }
      }
    }
    clearedInResolve += removedCount;
    const placedSpawns = [];
    for (const spawn of spawns) {
      const r = findTopFreeRow(board, spawn.c);
      if (r < 0) continue;
      board[r][spawn.c] = spawn.cell;
      placedSpawns.push([r, spawn.c]);
    }
    if (activeSet) {
      activeSet = new Set(placedSpawns.map(([r, c]) => cellKey(r, c)));
      if (activeSet.size === 0) break;
    }
    scoreDelta += applyScoreForStep(conversions, chain);
  }

  return { chain, clearedInResolve, specialsInResolve, scoreDelta };
}

export function grabFromColumn(board, handStack, col) {
  let r = findBottomOccupiedRow(board, col);
  if (r < 0) return 0;
  const type = board[r][col];
  if (handStack.length > 0 && handStack[0] !== type) return 0;

  let grabbed = 0;
  while (r >= 0 && board[r][col] === type) {
    handStack.push(type);
    board[r][col] = CELL_EMPTY;
    grabbed++;
    r--;
  }
  return grabbed;
}

export function throwToColumn(board, handStack, col) {
  if (handStack.length === 0) return { ok: false, overflow: false };
  applyGravity(board);
  const height = countOccupied(board, col);
  const startRow = height;
  if (startRow + handStack.length > ROWS) return { ok: false, overflow: true };
  const placed = [];
  for (let i = 0; i < handStack.length; i++) {
    const r = startRow + i;
    board[r][col] = handStack[i];
    placed.push([r, col]);
  }
  handStack.length = 0;
  return { ok: true, overflow: false, placed };
}

export function descentStep(board, { rng, level, difficulty, spawnRow = null, resolve = false, applyGravityOnResolve = false } = {}) {
  for (let c = 0; c < COLS; c++) {
    if (board[ROWS - 1][c] !== CELL_EMPTY) {
      return { gameOver: true, row: null, resolve: null };
    }
  }

  for (let r = ROWS - 2; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) board[r + 1][c] = board[r][c];
  }

  const row = spawnRow ?? generateSpawnRow({ rng, level, difficulty });
  for (let c = 0; c < COLS; c++) board[0][c] = row[c];

  const resolveResult = resolve ? resolveBoard(board, { applyGravity: applyGravityOnResolve }) : null;
  return { gameOver: false, row, resolve: resolveResult };
}

export function seedInitialRowsTop(board, { rng, level, difficulty, rows = 2 } = {}) {
  for (let i = 0; i < rows; i++) {
    const row = generateSpawnRow({ rng, level, difficulty });
    for (let c = 0; c < COLS; c++) board[i][c] = row[c];
  }
}
