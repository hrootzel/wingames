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

test('five connected I coins convert into one V at bottom-right of group', () => {
  const board = createBoard();
  board[ROWS - 2][0] = CELL_I;
  board[ROWS - 2][1] = CELL_I;
  board[ROWS - 2][2] = CELL_I;
  board[ROWS - 3][2] = CELL_I;
  board[ROWS - 4][2] = CELL_I;

  const out = resolveBoard(board);
  assert.equal(out.chain, 1);
  assert.equal(countCell(board, CELL_V), 1);
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

test('six connected I coins still produce only one V (extras vanish)', () => {
  const board = createBoard();
  for (let c = 0; c < 6; c++) board[ROWS - 2][c] = CELL_I;
  resolveBoard(board);

  let nonEmpty = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c] !== CELL_EMPTY) nonEmpty++;
  assert.equal(nonEmpty, 1);
});

test('plus token upgrades all coins matching tier found below it', () => {
  const board = createBoard();
  board[ROWS - 6][0] = CELL_PLUS;
  board[ROWS - 5][0] = CELL_V;
  board[ROWS - 4][3] = CELL_V;
  board[ROWS - 3][5] = CELL_V;
  resolveBoard(board);
  assert.equal(countCell(board, CELL_V), 0);
  assert.equal(countCell(board, CELL_X), 3);
});

test('minus token removes all coins matching tier found below it', () => {
  const board = createBoard();
  board[ROWS - 6][0] = CELL_MINUS;
  board[ROWS - 5][0] = CELL_I;
  board[ROWS - 4][2] = CELL_I;
  board[ROWS - 3][4] = CELL_I;
  resolveBoard(board);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      assert.notEqual(board[r][c], CELL_I);
    }
  }
});

test('D pair clear awards +1000 bonus once in the step', () => {
  const board = createBoard();
  board[ROWS - 2][0] = CELL_D;
  board[ROWS - 2][1] = CELL_D;
  const out = resolveBoard(board);
  assert.equal(out.chain, 1);
  assert.equal(out.scoreDelta, 11000);
});

test('grab takes bottom contiguous run and throw places stack on column top', () => {
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
  assert.equal(board[ROWS - 1][1], CELL_I);
  assert.equal(board[ROWS - 2][1], CELL_I);
  assert.equal(board[ROWS - 3][1], CELL_I);
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
