import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS,
  ROWS,
  CELL_EMPTY,
  CELL_I,
  CELL_V,
  CELL_X,
  CELL_D,
  CELL_PLUS,
  CELL_MINUS,
  createBoard,
  makeRng,
  applyGravity,
  descentStep,
  resolveBoard,
  grabFromColumn,
  throwToColumn,
} from '../coin_cascade_engine.mjs';

function emptyRow() {
  return Array(COLS).fill(CELL_EMPTY);
}

function countCell(board, target) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c] === target) n++;
  return n;
}

function assertColumnCompactedTop(board, col) {
  let seenEmpty = false;
  for (let r = 0; r < ROWS; r++) {
    const cell = board[r][col];
    if (cell === CELL_EMPTY) seenEmpty = true;
    else assert.equal(seenEmpty, false, `column ${col} has a gap before row ${r}`);
  }
}

test('descent inserts new row at top and shifts board down by one', () => {
  const board = createBoard();
  board[2][0] = CELL_I;
  const spawn = [CELL_V, CELL_V, CELL_V, CELL_V, CELL_V, CELL_V];
  const result = descentStep(board, { spawnRow: spawn, resolve: false });

  assert.equal(result.gameOver, false);
  assert.equal(board[0][0], CELL_V);
  assert.equal(board[3][0], CELL_I);
});

test('descent resolve does not apply gravity by default (keeps top-origin flow)', () => {
  const board = createBoard();
  const spawn = [CELL_I, CELL_V, CELL_X, CELL_D, CELL_V, CELL_X];
  const result = descentStep(board, { spawnRow: spawn, resolve: true });
  assert.equal(result.gameOver, false);
  assert.equal(board[0][0], CELL_I);
  assert.equal(board[ROWS - 1][0], CELL_EMPTY);
});

test('descent does not auto-resolve when resolve option is omitted', () => {
  const board = createBoard();
  const spawn = [CELL_V, CELL_V, CELL_I, CELL_I, CELL_I, CELL_I];
  const result = descentStep(board, { spawnRow: spawn });
  assert.equal(result.gameOver, false);
  assert.equal(result.resolve, null);
  assert.equal(board[0][0], CELL_V);
  assert.equal(board[0][1], CELL_V);
});

test('descent triggers game over if bottom row is occupied before shift', () => {
  const board = createBoard();
  board[ROWS - 1][2] = CELL_I;
  const result = descentStep(board, { spawnRow: emptyRow(), resolve: false });
  assert.equal(result.gameOver, true);
  assert.equal(board[ROWS - 1][2], CELL_I);
});

test('gravity compacts coins upward to the top of the board', () => {
  const board = createBoard();
  board[ROWS - 1][0] = CELL_I;
  board[ROWS - 3][0] = CELL_V;
  board[ROWS - 2][1] = CELL_X;

  applyGravity(board);

  assert.equal(board[0][0], CELL_V);
  assert.equal(board[1][0], CELL_I);
  assert.equal(board[0][1], CELL_X);
  assert.equal(board[ROWS - 1][0], CELL_EMPTY);
});

test('five connected I coins convert into one V at highest free spot of chosen column', () => {
  const board = createBoard();
  board[ROWS - 2][0] = CELL_I;
  board[ROWS - 2][1] = CELL_I;
  board[ROWS - 2][2] = CELL_I;
  board[ROWS - 3][2] = CELL_I;
  board[ROWS - 4][2] = CELL_I;

  const out = resolveBoard(board);
  assert.equal(out.chain, 1);
  assert.equal(board[0][2], CELL_V);
  assert.equal(countCell(board, CELL_I), 0);

  let nonEmpty = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c] !== CELL_EMPTY) nonEmpty++;
  assert.equal(nonEmpty, 1);
});

test('two connected V coins convert into one X', () => {
  const board = createBoard();
  board[ROWS - 2][0] = CELL_V;
  board[ROWS - 2][1] = CELL_V;
  resolveBoard(board);
  assert.equal(countCell(board, CELL_X), 1);
  assert.equal(countCell(board, CELL_V), 0);
});

test('six connected I coins clear as one group and produce one V', () => {
  const board = createBoard();
  for (let c = 0; c < 6; c++) board[ROWS - 2][c] = CELL_I;
  resolveBoard(board);

  assert.equal(countCell(board, CELL_V), 1);
  assert.equal(countCell(board, CELL_I), 0);
});

test('ten connected I coins clear as one group and produce one V', () => {
  const board = createBoard();
  for (let c = 0; c < 5; c++) board[ROWS - 2][c] = CELL_I;
  for (let c = 0; c < 5; c++) board[ROWS - 3][c] = CELL_I;

  const out = resolveBoard(board);

  assert.equal(out.chain, 1);
  assert.equal(countCell(board, CELL_V), 1);
  assert.equal(countCell(board, CELL_I), 0);
});

test('plus token upgrades all coins matching tier found below it', () => {
  const board = createBoard();
  board[ROWS - 5][0] = CELL_PLUS;
  board[ROWS - 6][0] = CELL_V;
  board[ROWS - 4][3] = CELL_V;
  board[ROWS - 3][5] = CELL_V;
  resolveBoard(board);
  assert.equal(countCell(board, CELL_V), 0);
  assert.equal(countCell(board, CELL_X), 3);
});

test('minus token removes all coins matching tier found below it', () => {
  const board = createBoard();
  board[ROWS - 5][0] = CELL_MINUS;
  board[ROWS - 6][0] = CELL_I;
  board[ROWS - 4][2] = CELL_I;
  board[ROWS - 3][4] = CELL_I;
  resolveBoard(board);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      assert.notEqual(board[r][c], CELL_I);
    }
  }
});

test('plus token in active set still activates after gravity remap', () => {
  const board = createBoard();
  board[ROWS - 2][0] = CELL_PLUS;
  board[ROWS - 3][0] = CELL_V;
  board[ROWS - 2][4] = CELL_V;

  const out = resolveBoard(board, { activeCells: [[ROWS - 2, 0]] });

  assert.equal(countCell(board, CELL_PLUS), 0);
  assert.equal(countCell(board, CELL_V), 0);
  assert.equal(countCell(board, CELL_X), 2);
  assert.equal(out.scoreDelta, 60);
});

test('minus token in active set still activates after gravity remap', () => {
  const board = createBoard();
  board[ROWS - 2][1] = CELL_MINUS;
  board[ROWS - 3][1] = CELL_I;
  board[ROWS - 2][3] = CELL_I;
  board[ROWS - 4][5] = CELL_I;

  const out = resolveBoard(board, { activeCells: [[ROWS - 2, 1]] });

  assert.equal(countCell(board, CELL_MINUS), 0);
  assert.equal(countCell(board, CELL_I), 0);
  assert.equal(out.scoreDelta, 24);
  assert.equal(out.clearedInResolve, 3);
});

test('active minus token fizzles when no coin exists above in same column', () => {
  const board = createBoard();
  board[1][2] = CELL_MINUS;
  board[ROWS - 1][0] = CELL_I;
  board[ROWS - 1][4] = CELL_V;

  const out = resolveBoard(board, { activeCells: [[1, 2]] });

  assert.equal(countCell(board, CELL_MINUS), 0);
  assert.equal(countCell(board, CELL_I), 1);
  assert.equal(countCell(board, CELL_V), 1);
  assert.equal(out.scoreDelta, 0);
});

test('throwing a plus gem into a column upgrades the denomination above it', () => {
  const board = createBoard();
  board[0][0] = CELL_V;
  board[1][0] = CELL_V;
  const hand = [CELL_PLUS];

  const thrown = throwToColumn(board, hand, 0);
  assert.equal(thrown.ok, true);
  const out = resolveBoard(board, { activeCells: thrown.placed });

  assert.equal(out.specialsInResolve, 1);
  assert.equal(countCell(board, CELL_PLUS), 0);
  assert.equal(countCell(board, CELL_V), 0);
  assert.equal(countCell(board, CELL_X), 2);
});

test('throwing a minus gem into a column removes matching denomination above it', () => {
  const board = createBoard();
  board[0][2] = CELL_I;
  board[1][2] = CELL_I;
  board[0][4] = CELL_I;
  const hand = [CELL_MINUS];

  const thrown = throwToColumn(board, hand, 2);
  assert.equal(thrown.ok, true);
  const out = resolveBoard(board, { activeCells: thrown.placed });

  assert.equal(out.specialsInResolve, 1);
  assert.equal(countCell(board, CELL_MINUS), 0);
  assert.equal(countCell(board, CELL_I), 0);
});

test('D pair clear awards +1000 bonus once in the step', () => {
  const board = createBoard();
  board[ROWS - 2][0] = CELL_D;
  board[ROWS - 2][1] = CELL_D;
  const out = resolveBoard(board);
  assert.equal(out.chain, 1);
  assert.equal(out.scoreDelta, 2000);
});

test('grab takes bottom contiguous run and throw places stack starting at top of target column', () => {
  const board = createBoard();
  board[ROWS - 1][0] = CELL_I;
  board[ROWS - 2][0] = CELL_I;
  board[ROWS - 3][0] = CELL_I;
  const hand = [];

  const grabbed = grabFromColumn(board, hand, 0);
  assert.equal(grabbed, 3);
  assert.deepEqual(hand, [CELL_I, CELL_I, CELL_I]);

  const throwResult = throwToColumn(board, hand, 1);
  assert.equal(throwResult.ok, true);
  assert.equal(board[0][1], CELL_I);
  assert.equal(board[1][1], CELL_I);
  assert.equal(board[2][1], CELL_I);
});

test('spawn generator is deterministic with fixed RNG seed', () => {
  const rngA = makeRng(12345);
  const rngB = makeRng(12345);
  const boardA = createBoard();
  const boardB = createBoard();
  const a = descentStep(boardA, { rng: rngA, level: 1, difficulty: 4, resolve: false }).row;
  const b = descentStep(boardB, { rng: rngB, level: 1, difficulty: 4, resolve: false }).row;
  assert.deepEqual(a, b);
});

test('targeted resolve does not clear unrelated matches on the board', () => {
  const board = createBoard();
  board[0][0] = CELL_V;
  board[0][4] = CELL_V;
  board[0][5] = CELL_V;
  const hand = [CELL_V];

  const throwResult = throwToColumn(board, hand, 0);
  assert.equal(throwResult.ok, true);
  assert.equal(Array.isArray(throwResult.placed), true);

  const out = resolveBoard(board, { applyGravity: false, activeCells: throwResult.placed });
  assert.equal(out.chain, 1);
  assert.equal(countCell(board, CELL_X), 1);
  assert.equal(countCell(board, CELL_V), 2);
});

test('throw uses highest available free slot after compacting column', () => {
  const board = createBoard();
  board[0][2] = CELL_I;
  board[2][2] = CELL_V;
  const hand = [CELL_X];

  const throwResult = throwToColumn(board, hand, 2);
  assert.equal(throwResult.ok, true);
  assert.equal(board[0][2], CELL_I);
  assert.equal(board[1][2], CELL_V);
  assert.equal(board[2][2], CELL_X);
  assertColumnCompactedTop(board, 2);
});

test('resolve with gravity compacts columns with no in-between gaps', () => {
  const board = createBoard();
  board[0][3] = CELL_I;
  board[3][3] = CELL_V;

  resolveBoard(board, { applyGravity: true, activeCells: [[3, 3]] });

  assert.equal(board[0][3], CELL_I);
  assert.equal(board[1][3], CELL_V);
  assertColumnCompactedTop(board, 3);
});

test('combo spawn placement supports compaction-driven chain reactions', () => {
  const board = createBoard();
  board[0][2] = CELL_V;
  board[1][2] = CELL_I;
  board[2][2] = CELL_I;
  board[3][2] = CELL_I;
  board[4][2] = CELL_I;
  board[5][2] = CELL_I;

  const out = resolveBoard(board);
  assert.equal(out.chain, 2);
  assert.equal(out.scoreDelta, 20);
  assert.equal(board[0][2], CELL_X);
  assert.equal(countCell(board, CELL_V), 0);
  assert.equal(countCell(board, CELL_I), 0);
  assertColumnCompactedTop(board, 2);
});

test('only newly formed coins can trigger the next match step in a chain', () => {
  const board = createBoard();
  board[0][0] = CELL_V;
  board[1][0] = CELL_V;
  for (let c = 1; c <= 5; c++) board[0][c] = CELL_I;

  const out = resolveBoard(board, { applyGravity: false, activeCells: [[0, 0], [1, 0]] });

  assert.equal(out.chain, 1);
  assert.equal(countCell(board, CELL_X), 1);
  assert.equal(countCell(board, CELL_I), 5);
});

test('conversion output anchors to the active/thrown coin position', () => {
  const board = createBoard();
  board[0][0] = CELL_V;
  board[0][1] = CELL_V;

  const out = resolveBoard(board, { applyGravity: false, activeCells: [[0, 0]] });

  assert.equal(out.chain, 1);
  assert.equal(board[0][0], CELL_X);
  assert.equal(board[0][1], CELL_EMPTY);
});

test('chain follow-up output anchors where previous coin was created', () => {
  const board = createBoard();
  board[1][2] = CELL_I;
  board[1][1] = CELL_I;
  board[1][0] = CELL_I;
  board[0][1] = CELL_I;
  board[2][1] = CELL_I;
  board[1][3] = CELL_V;

  const out = resolveBoard(board, { applyGravity: false, activeCells: [[1, 2]] });

  assert.equal(out.chain, 2);
  assert.equal(board[1][2], CELL_X);
  assert.equal(board[1][3], CELL_EMPTY);
});
