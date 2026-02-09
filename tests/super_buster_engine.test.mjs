import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeLevelPack,
  makeBall,
  updateBall,
  collideBallWithSolid,
  advanceHarpoon,
  harpoonHitsBall,
  findLadderAtPosition,
  findPlayerSupportY,
  findLadderExitPlatformY,
  updatePlayerMovement,
} from '../super_buster_engine.mjs';

const WORLD_W = 640;
const FLOOR_Y = 336;
const RADIUS = [10, 16, 24, 34];
const JUMP_SPEED = [520, 650, 780, 920];
const VX_MAG = [210, 190, 170, 150];

test('normalizeLevelPack parses campaign JSON', () => {
  const pack = JSON.parse(readFileSync('levels/levelpack_v1.json', 'utf8'));
  const levels = normalizeLevelPack(pack, { maxSize: RADIUS.length - 1 });
  assert.equal(levels.length, 12);
  assert.equal(levels[0].id, 'L1');
  assert.equal(levels[0].balls.length, 1);
  assert.ok(Array.isArray(levels[1].geometry.solids));
  assert.ok(levels[1].geometry.solids.length > 0);
});

test('normalizeLevelPack rejects invalid format', () => {
  assert.throws(() => normalizeLevelPack({ version: 2, levels: [] }), /Invalid level pack format/);
});

test('makeBall clamps spawn into world and floor bounds', () => {
  const ball = makeBall(
    { size: 99, x: -200, y: 999, dir: -1 },
    { radius: RADIUS, vxMag: VX_MAG, jumpSpeed: JUMP_SPEED, worldW: WORLD_W, floorY: FLOOR_Y },
  );
  assert.equal(ball.size, RADIUS.length - 1);
  assert.equal(ball.x, RADIUS[RADIUS.length - 1]);
  assert.equal(ball.y, FLOOR_Y - RADIUS[RADIUS.length - 1]);
  assert.ok(ball.vx < 0);
});

test('updateBall bounces off floor with size jump speed', () => {
  const ball = { size: 2, x: 200, y: FLOOR_Y - RADIUS[2] - 0.5, vx: 0, vy: 300 };
  updateBall(ball, 1 / 60, {
    gravity: 1800,
    radius: RADIUS,
    jumpSpeed: JUMP_SPEED,
    worldW: WORLD_W,
    floorY: FLOOR_Y,
  });
  assert.equal(ball.y, FLOOR_Y - RADIUS[2]);
  assert.equal(ball.vy, -JUMP_SPEED[2]);
});

test('collideBallWithSolid resolves top-face hit and flips vy upward', () => {
  const rect = { x: 120, y: 180, w: 200, h: 12 };
  const ball = { size: 1, x: 220, y: 188, prevX: 220, prevY: 160, vx: 0, vy: 220 };
  const hit = collideBallWithSolid(ball, rect, RADIUS);
  assert.equal(hit, true);
  assert.equal(ball.y, rect.y - RADIUS[1]);
  assert.ok(ball.vy <= 0);
});

test('collideBallWithSolid resolves side hit and flips vx', () => {
  const rect = { x: 200, y: 100, w: 120, h: 40 };
  const ball = { size: 1, x: 210, y: 120, prevX: 170, prevY: 120, vx: 180, vy: 0 };
  const hit = collideBallWithSolid(ball, rect, RADIUS);
  assert.equal(hit, true);
  assert.equal(ball.x, rect.x - RADIUS[1]);
  assert.ok(ball.vx <= 0);
});

test('advanceHarpoon stops at nearest solid underside while extending', () => {
  const harpoon = {
    active: true,
    x: 250,
    yBottom: 308,
    yTop: 260,
    extendSpeed: 900,
    stickTime: 0.15,
    state: 'extend',
    timer: 0,
  };
  const solids = [
    { x: 200, y: 180, w: 100, h: 12 },
    { x: 220, y: 120, w: 80, h: 12 },
  ];
  const result = advanceHarpoon(harpoon, 0.1, solids, 0);
  assert.equal(result.stuck, true);
  assert.equal(result.stuckAt, 'solid');
  assert.equal(harpoon.state, 'stick');
  assert.equal(harpoon.yTop, 192);
});

test('harpoonHitsBall detects intersection along vertical segment', () => {
  const harpoon = { active: true, x: 300, yTop: 120, yBottom: 308 };
  const hitBall = { size: 1, x: 296, y: 180 };
  const missBall = { size: 1, x: 340, y: 180 };
  assert.equal(harpoonHitsBall(harpoon, hitBall, RADIUS), true);
  assert.equal(harpoonHitsBall(harpoon, missBall, RADIUS), false);
});

test('findLadderAtPosition finds ladder by x/y with margins', () => {
  const ladders = [{ x: 300, y: 180, w: 20, h: 156 }];
  const hit = findLadderAtPosition(310, 330, ladders);
  assert.equal(hit?.index, 0);
});

test('updatePlayerMovement climbs ladder when up is pressed', () => {
  const ladders = [{ x: 300, y: 180, w: 20, h: 156 }];
  const player = {
    x: 309,
    y: FLOOR_Y,
    w: 22,
    h: 28,
    onLadder: false,
    ladderIndex: -1,
  };
  const beforeY = player.y;
  const result = updatePlayerMovement(
    player,
    { left: false, right: false, up: true, down: false },
    1 / 30,
    { floorY: FLOOR_Y, worldW: WORLD_W, moveSpeed: 220, climbSpeed: 180, ladders, solids: [] },
  );
  assert.equal(result.onLadder, true);
  assert.equal(player.onLadder, true);
  assert.equal(player.x, 310);
  assert.ok(player.y < beforeY);
});

test('updatePlayerMovement keeps player on floor when no ladder input', () => {
  const player = {
    x: 320,
    y: 280,
    w: 22,
    h: 28,
    onLadder: false,
    ladderIndex: -1,
  };
  updatePlayerMovement(
    player,
    { left: false, right: true, up: false, down: false },
    1 / 60,
    { floorY: FLOOR_Y, worldW: WORLD_W, moveSpeed: 220, climbSpeed: 180, ladders: [], solids: [] },
  );
  assert.equal(player.y, FLOOR_Y);
  assert.ok(player.x > 320);
});

test('findLadderExitPlatformY finds platform joined to ladder top', () => {
  const ladder = { x: 300, y: 226, w: 20, h: 110 };
  const solids = [{ x: 238, y: 214, w: 164, h: 12 }];
  const exitY = findLadderExitPlatformY(310, ladder, solids, 11);
  assert.equal(exitY, 214);
});

test('findPlayerSupportY returns platform top support before floor', () => {
  const solids = [{ x: 238, y: 214, w: 164, h: 12 }];
  const supportY = findPlayerSupportY(310, 214, solids, FLOOR_Y, 11, 24);
  assert.equal(supportY, 214);
});

test('updatePlayerMovement dismounts onto platform at ladder top', () => {
  const ladders = [{ x: 300, y: 226, w: 20, h: 110 }];
  const solids = [{ x: 238, y: 214, w: 164, h: 12 }];
  const player = {
    x: 310,
    y: 254.3,
    w: 22,
    h: 28,
    onLadder: true,
    ladderIndex: 0,
  };
  const result = updatePlayerMovement(
    player,
    { left: false, right: false, up: true, down: false },
    1 / 60,
    { floorY: FLOOR_Y, worldW: WORLD_W, moveSpeed: 220, climbSpeed: 180, ladders, solids },
  );
  assert.equal(result.onLadder, false);
  assert.equal(player.onLadder, false);
  assert.equal(player.y, 214);
});

test('updatePlayerMovement does not re-enter ladder from platform when holding up', () => {
  const ladders = [{ x: 300, y: 226, w: 20, h: 110 }];
  const solids = [{ x: 238, y: 214, w: 164, h: 12 }];
  const player = {
    x: 310,
    y: 214,
    w: 22,
    h: 28,
    onLadder: false,
    ladderIndex: -1,
  };
  const result = updatePlayerMovement(
    player,
    { left: false, right: false, up: true, down: false },
    1 / 60,
    { floorY: FLOOR_Y, worldW: WORLD_W, moveSpeed: 220, climbSpeed: 180, ladders, solids },
  );
  assert.equal(result.onLadder, false);
  assert.equal(player.onLadder, false);
  assert.equal(player.y, 214);
});
