export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

export function normalizeRect(rect) {
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const w = Number(rect?.w);
  const h = Number(rect?.h);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return null;
  }
  if (w <= 0 || h <= 0) {
    return null;
  }
  return { x, y, w, h };
}

export function normalizeLevel(level, index, options = {}) {
  const timeDefault = Number.isFinite(Number(options.timeDefault)) ? Number(options.timeDefault) : 60;
  const maxSize = Number.isFinite(Number(options.maxSize)) ? Number(options.maxSize) : 3;
  const solids = (level.geometry?.solids || [])
    .map((rect) => normalizeRect(rect))
    .filter(Boolean);
  const ladders = (level.geometry?.ladders || [])
    .map((rect) => normalizeRect(rect))
    .filter(Boolean);
  const balls = (level.balls || []).map((ball) => ({
    size: clamp(Math.round(Number(ball.size) || 0), 0, maxSize),
    x: Number(ball.x),
    y: Number(ball.y),
    dir: Number(ball.dir) >= 0 ? 1 : -1,
  }));
  return {
    id: level.id || `L${index + 1}`,
    name: level.name || `Level ${index + 1}`,
    timeLimitSec: Number.isFinite(Number(level.timeLimitSec)) ? Number(level.timeLimitSec) : timeDefault,
    geometry: { solids, ladders },
    balls,
  };
}

export function normalizeLevelPack(pack, options = {}) {
  if (!pack || pack.version !== 1 || !Array.isArray(pack.levels)) {
    throw new Error('Invalid level pack format');
  }
  const defaultTime = Number.isFinite(Number(pack.defaults?.timeLimitSec))
    ? Number(pack.defaults.timeLimitSec)
    : (Number.isFinite(Number(options.timeDefault)) ? Number(options.timeDefault) : 60);
  const maxSize = Number.isFinite(Number(options.maxSize)) ? Number(options.maxSize) : 3;
  const levels = pack.levels.map((level, index) => normalizeLevel(level, index, { timeDefault: defaultTime, maxSize }));
  if (!levels.length) {
    throw new Error('Level pack has no levels');
  }
  return levels;
}

export function makeBall(spec, options = {}) {
  const radius = options.radius || [10, 16, 24, 34];
  const vxMag = options.vxMag || [210, 190, 170, 150];
  const jumpSpeed = options.jumpSpeed || [520, 650, 780, 920];
  const worldW = Number.isFinite(Number(options.worldW)) ? Number(options.worldW) : 640;
  const floorY = Number.isFinite(Number(options.floorY)) ? Number(options.floorY) : 336;
  const size = clamp(Math.round(Number(spec.size) || 0), 0, radius.length - 1);
  const r = radius[size];
  const rawX = Number(spec.x);
  const rawY = Number(spec.y);
  const x = clamp(Number.isFinite(rawX) ? rawX : worldW * 0.5, r, worldW - r);
  const y = clamp(Number.isFinite(rawY) ? rawY : floorY - r - 12, r, floorY - r);
  const dir = Number(spec.dir) >= 0 ? 1 : -1;
  return {
    size,
    x,
    y,
    vx: vxMag[size] * dir,
    vy: -jumpSpeed[size] * 0.8,
  };
}

export function advanceHarpoon(harpoon, dt, solids = [], ceilingY = 0) {
  const h = harpoon;
  if (!h.active) {
    return { stuck: false, stuckAt: null };
  }
  if (h.state === 'extend') {
    const oldTop = h.yTop;
    const newTop = h.yTop - h.extendSpeed * dt;
    let hitBottomY = -1;
    for (const rect of solids) {
      const left = rect.x;
      const right = rect.x + rect.w;
      const bottom = rect.y + rect.h;
      if (h.x < left || h.x > right) continue;
      if (oldTop >= bottom && newTop <= bottom) {
        hitBottomY = Math.max(hitBottomY, bottom);
      }
    }
    if (hitBottomY >= 0) {
      h.yTop = hitBottomY;
      h.state = 'stick';
      h.timer = h.stickTime;
      return { stuck: true, stuckAt: 'solid' };
    }
    if (newTop <= ceilingY) {
      h.yTop = ceilingY;
      h.state = 'stick';
      h.timer = h.stickTime;
      return { stuck: true, stuckAt: 'ceiling' };
    }
    h.yTop = newTop;
    return { stuck: false, stuckAt: null };
  }
  if (h.state === 'stick') {
    h.timer -= dt;
    if (h.timer <= 0) {
      h.active = false;
    }
  }
  return { stuck: false, stuckAt: null };
}

export function updateBall(ball, dt, options = {}) {
  const gravity = Number.isFinite(Number(options.gravity)) ? Number(options.gravity) : 1800;
  const radius = options.radius || [10, 16, 24, 34];
  const jumpSpeed = options.jumpSpeed || [520, 650, 780, 920];
  const vxMag = options.vxMag || null;
  const capFactor = Number.isFinite(Number(options.capFactor)) ? Number(options.capFactor) : 1.08;
  const worldW = Number.isFinite(Number(options.worldW)) ? Number(options.worldW) : 640;
  const floorY = Number.isFinite(Number(options.floorY)) ? Number(options.floorY) : 336;

  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.vy += gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const r = radius[ball.size];
  if (ball.y + r > floorY) {
    ball.y = floorY - r;
    ball.vy = -jumpSpeed[ball.size];
  }
  if (ball.y - r < 0) {
    ball.y = r;
    ball.vy = Math.abs(ball.vy);
  }
  if (ball.x - r < 0) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + r > worldW) {
    ball.x = worldW - r;
    ball.vx = -Math.abs(ball.vx);
  }
  clampBallVelocity(ball, { jumpSpeed, vxMag, capFactor });
}

export function clampBallVelocity(ball, options = {}) {
  const jumpSpeed = options.jumpSpeed || [520, 650, 780, 920];
  const vxMag = options.vxMag || null;
  const capFactor = Number.isFinite(Number(options.capFactor)) ? Number(options.capFactor) : 1.08;
  const size = ball.size;

  const maxVy = Math.max(1, jumpSpeed[size] * capFactor);
  if (ball.vy > maxVy) ball.vy = maxVy;
  if (ball.vy < -maxVy) ball.vy = -maxVy;

  if (vxMag) {
    const maxVx = Math.max(1, vxMag[size] * capFactor);
    if (ball.vx > maxVx) ball.vx = maxVx;
    if (ball.vx < -maxVx) ball.vx = -maxVx;
  }
}

export function collideBallWithSolid(ball, rect, radius = [10, 16, 24, 34]) {
  const r = radius[ball.size];
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;

  const closestX = clamp(ball.x, left, right);
  const closestY = clamp(ball.y, top, bottom);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  if (dx * dx + dy * dy >= r * r) {
    return false;
  }

  if (ball.prevY + r <= top && ball.y + r > top) {
    ball.y = top - r;
    ball.vy = -Math.abs(ball.vy);
    return true;
  }
  if (ball.prevY - r >= bottom && ball.y - r < bottom) {
    ball.y = bottom + r;
    ball.vy = Math.abs(ball.vy);
    return true;
  }
  if (ball.prevX + r <= left && ball.x + r > left) {
    ball.x = left - r;
    ball.vx = -Math.abs(ball.vx);
    return true;
  }
  if (ball.prevX - r >= right && ball.x - r < right) {
    ball.x = right + r;
    ball.vx = Math.abs(ball.vx);
    return true;
  }

  let nx = 0;
  let ny = 0;
  let penetration = 0;
  if (dx === 0 && dy === 0) {
    const distLeft = Math.abs(ball.x - left);
    const distRight = Math.abs(right - ball.x);
    const distTop = Math.abs(ball.y - top);
    const distBottom = Math.abs(bottom - ball.y);
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft) nx = -1;
    else if (minDist === distRight) nx = 1;
    else if (minDist === distTop) ny = -1;
    else ny = 1;
    penetration = r;
  } else {
    const length = Math.sqrt(dx * dx + dy * dy);
    nx = dx / length;
    ny = dy / length;
    penetration = r - length;
  }

  ball.x += nx * penetration;
  ball.y += ny * penetration;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= 2 * vn * nx;
    ball.vy -= 2 * vn * ny;
  }
  return true;
}

export function harpoonHitsBall(harpoon, ball, radius = [10, 16, 24, 34]) {
  if (!harpoon.active) return false;
  const r = radius[ball.size];
  const dx = Math.abs(ball.x - harpoon.x);
  if (dx > r) return false;
  const yTop = Math.min(harpoon.yTop, harpoon.yBottom);
  const yBottom = Math.max(harpoon.yTop, harpoon.yBottom);
  return ball.y + r >= yTop && ball.y - r <= yBottom;
}

export function findLadderAtPosition(x, y, ladders = [], marginX = 8, marginY = 8) {
  for (let i = 0; i < ladders.length; i += 1) {
    const ladder = ladders[i];
    if (!ladder) continue;
    if (
      x >= ladder.x - marginX &&
      x <= ladder.x + ladder.w + marginX &&
      y >= ladder.y - marginY &&
      y <= ladder.y + ladder.h + marginY
    ) {
      return { index: i, ladder };
    }
  }
  return null;
}

export function findPlayerSupportY(x, currentY, solids = [], floorY = 336, halfW = 11, snapDistance = 20) {
  let supportY = floorY;
  for (const solid of solids) {
    if (!solid) continue;
    const left = solid.x + halfW - 2;
    const right = solid.x + solid.w - halfW + 2;
    if (x < left || x > right) continue;
    const top = solid.y;
    if (top < supportY && currentY <= top + snapDistance) {
      supportY = top;
    }
  }
  return supportY;
}

export function findLadderTopSupportY(x, currentY, ladders = [], halfW = 11, snapDistance = 20) {
  let supportY = Number.POSITIVE_INFINITY;
  for (const ladder of ladders) {
    if (!ladder) continue;
    const standMargin = Math.max(6, halfW * 0.65);
    const left = ladder.x - standMargin;
    const right = ladder.x + ladder.w + standMargin;
    if (x < left || x > right) continue;
    const top = ladder.y;
    if (currentY <= top + snapDistance && top < supportY) {
      supportY = top;
    }
  }
  return Number.isFinite(supportY) ? supportY : null;
}

export function findSupportBelowY(x, minY, solids = [], floorY = 336, halfW = 11, ladders = []) {
  let supportY = floorY;
  for (const solid of solids) {
    if (!solid) continue;
    const left = solid.x + halfW - 2;
    const right = solid.x + solid.w - halfW + 2;
    if (x < left || x > right) continue;
    const top = solid.y;
    if (top >= minY - 0.5 && top < supportY) {
      supportY = top;
    }
  }
  for (const ladder of ladders) {
    if (!ladder) continue;
    const standMargin = Math.max(6, halfW * 0.65);
    const left = ladder.x - standMargin;
    const right = ladder.x + ladder.w + standMargin;
    if (x < left || x > right) continue;
    const top = ladder.y;
    if (top >= minY - 0.5 && top < supportY) {
      supportY = top;
    }
  }
  return supportY;
}

export function findLadderExitPlatformY(x, ladder, solids = [], halfW = 11, joinTolerance = 5) {
  if (!ladder) return null;
  let bestY = Number.POSITIVE_INFINITY;
  for (const solid of solids) {
    if (!solid) continue;
    const left = solid.x + halfW - 2;
    const right = solid.x + solid.w - halfW + 2;
    if (x < left || x > right) continue;
    const bottom = solid.y + solid.h;
    if (Math.abs(bottom - ladder.y) <= joinTolerance && solid.y < bestY) {
      bestY = solid.y;
    }
  }
  return Number.isFinite(bestY) ? bestY : null;
}

export function updatePlayerMovement(player, input, dt, options = {}) {
  const floorY = Number.isFinite(Number(options.floorY)) ? Number(options.floorY) : 336;
  const worldW = Number.isFinite(Number(options.worldW)) ? Number(options.worldW) : 640;
  const moveSpeed = Number.isFinite(Number(options.moveSpeed)) ? Number(options.moveSpeed) : 220;
  const climbSpeed = Number.isFinite(Number(options.climbSpeed)) ? Number(options.climbSpeed) : 170;
  const gravity = Number.isFinite(Number(options.gravity)) ? Number(options.gravity) : 1500;
  const ladders = options.ladders || [];
  const solids = options.solids || [];

  const up = !!input.up;
  const down = !!input.down;
  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const halfW = player.w * 0.5;
  const minX = halfW;
  const maxX = worldW - halfW;

  if (!Number.isFinite(player.y)) {
    player.y = floorY;
  }
  if (!Number.isFinite(player.vy)) {
    player.vy = 0;
  }
  if (!Number.isFinite(player.ladderIndex)) {
    player.ladderIndex = -1;
  }
  if (!Number.isFinite(player.gapBridgeRemaining)) {
    player.gapBridgeRemaining = 0;
  }
  if (!Number.isFinite(player.gapBridgeY)) {
    player.gapBridgeY = player.y;
  }
  if (typeof player.onLadder !== 'boolean') {
    player.onLadder = false;
  }

  const tryEnter = up || down;
  if (!player.onLadder && tryEnter) {
    const candidate = findLadderAtPosition(player.x, player.y, ladders, 10, player.h);
    if (candidate) {
      const ladderTopY = candidate.ladder.y;
      const canEnterFromUp = up && player.y >= ladderTopY - 1;
      const canEnterFromDown = down && player.y <= ladderTopY + player.h + 2;
      if (canEnterFromUp || canEnterFromDown) {
        player.onLadder = true;
        player.ladderIndex = candidate.index;
        player.x = candidate.ladder.x + candidate.ladder.w * 0.5;
        player.y = Math.min(player.y, floorY);
      }
    }
  }

  const oldX = player.x;
  if (player.onLadder) {
    let candidate = null;
    if (player.ladderIndex >= 0 && player.ladderIndex < ladders.length) {
      const ladder = ladders[player.ladderIndex];
      candidate = findLadderAtPosition(player.x, player.y, [ladder], 14, 10);
      if (candidate) candidate.index = player.ladderIndex;
    }
    if (!candidate) {
      candidate = findLadderAtPosition(player.x, player.y, ladders, 14, 10);
    }
    if (!candidate) {
      player.onLadder = false;
      player.ladderIndex = -1;
      const oldY = player.y;
      player.vy += gravity * dt;
      const nextY = player.y + player.vy * dt;
      const landingY = findSupportBelowY(player.x, oldY, solids, floorY, halfW, ladders);
      if (nextY >= landingY) {
        player.y = landingY;
        player.vy = 0;
      } else {
        player.y = nextY;
      }
    } else {
      const ladder = candidate.ladder;
      player.ladderIndex = candidate.index;
      const climbDir = (down ? 1 : 0) - (up ? 1 : 0);
      const climbMinY = ladder.y + player.h;
      const climbMaxY = Math.min(floorY, ladder.y + ladder.h);
      const exitPlatformY = findLadderExitPlatformY(player.x, ladder, solids, halfW);
      if (climbDir < 0 && player.y <= climbMinY + 0.6) {
        player.onLadder = false;
        player.ladderIndex = -1;
        player.y = exitPlatformY != null ? exitPlatformY : ladder.y;
        player.vy = 0;
        if (horizontal !== 0) {
          player.x = clamp(player.x + horizontal * moveSpeed * dt, minX, maxX);
        }
        return {
          movedHorizontally: Math.abs(player.x - oldX) > 1e-6,
          onLadder: player.onLadder,
        };
      }

      if (climbDir !== 0) {
        player.x = ladder.x + ladder.w * 0.5;
      } else if (horizontal !== 0) {
        player.x = clamp(player.x + horizontal * moveSpeed * 0.45 * dt, minX, maxX);
      }

      player.y = clamp(player.y + climbDir * climbSpeed * dt, climbMinY, climbMaxY);

      const stillNear = findLadderAtPosition(player.x, player.y, [ladder], 7, 6);
      if (!stillNear && player.y >= floorY - 0.5) {
        player.onLadder = false;
        player.ladderIndex = -1;
        player.y = floorY;
        player.vy = 0;
      }
    }
  } else {
    if (horizontal !== 0) {
      player.x = clamp(player.x + horizontal * moveSpeed * dt, minX, maxX);
    }
    const supportSnap = 16;
    let supportY = findPlayerSupportY(player.x, player.y, solids, floorY, halfW, supportSnap);
    const ladderTopY = findLadderTopSupportY(player.x, player.y, ladders, halfW, supportSnap);
    if (ladderTopY != null && ladderTopY < supportY) {
      supportY = ladderTopY;
    }
    const onSupport = Math.abs(player.y - supportY) <= 0.5;
    if (onSupport && supportY < floorY - 0.5) {
      player.gapBridgeRemaining = 42;
      player.gapBridgeY = supportY;
    } else if (onSupport) {
      player.gapBridgeRemaining = 0;
      player.gapBridgeY = supportY;
    }

    const unsupportedAtHeight = player.y < floorY - 0.5 && supportY > player.y + 1;
    if (
      unsupportedAtHeight &&
      horizontal !== 0 &&
      player.vy >= 0 &&
      player.gapBridgeRemaining > 0 &&
      Math.abs(player.y - player.gapBridgeY) <= 2.5
    ) {
      const moved = Math.abs(player.x - oldX);
      player.gapBridgeRemaining = Math.max(0, player.gapBridgeRemaining - Math.max(0.01, moved));
      player.y = player.gapBridgeY;
      player.vy = 0;
      return {
        movedHorizontally: moved > 1e-6,
        onLadder: player.onLadder,
      };
    }

    if (player.y < supportY - 0.5 || player.vy > 0) {
      const oldY = player.y;
      player.vy += gravity * dt;
      const nextY = player.y + player.vy * dt;
      const landingY = findSupportBelowY(player.x, oldY, solids, floorY, halfW, ladders);
      if (nextY >= landingY) {
        player.y = landingY;
        player.vy = 0;
      } else {
        player.y = nextY;
      }
    } else {
      player.y = supportY;
      player.vy = 0;
    }
  }

  return {
    movedHorizontally: Math.abs(player.x - oldX) > 1e-6,
    onLadder: player.onLadder,
  };
}
