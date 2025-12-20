# Goal

Build a *Pang / Super Pang / Super Buster Bros.*-style **single-player** game in **JS + HTML5 Canvas**.

Scope for v1:
- Player is a **triangle** on the ground.
- Player moves **left/right**.
- Player shoots a **vertical harpoon/wire**.
- Balls **bounce** under gravity and **split into two smaller balls** when hit; the smallest size disappears. (Core series mechanic.)
- A **linear list of levels** (no world map needed).

No powerups, monsters, ladders, or platforms in v1 (we’ll leave extension hooks for those).

---

## 1) Coordinate system + playfield

### Screen/world coordinates
Use pixel units directly:
- `x` increases to the right
- `y` increases downward

World bounds (example):
- `WORLD_W = 640`
- `WORLD_H = 360`
- Floor is at `FLOOR_Y = WORLD_H - 24` (gives you a HUD band / margin)

### Canonical geometry helpers
- Walls: `x ∈ [0, WORLD_W]`
- Ceiling: `y = 0`
- Floor: `y = FLOOR_Y`

Balls collide with the bounds using their radius.

---

## 2) Core entities

### Player
Player is constrained to the ground.

Recommended representation:
- Position: `player.x` (center)
- `player.y = FLOOR_Y` (base on floor)
- Triangle size: `player.h` and `player.w`
- Hitbox: start with a **circle** or **AABB** around the triangle

Suggested defaults:
- `player.w = 22`, `player.h = 28`
- `player.speed = 220 px/s`
- Hit circle: `player.hitR = 12`

### Harpoon (wire)
One harpoon on screen at a time in v1.

Representation:
- `active: boolean`
- `x`: fixed at `player.x` when fired
- `y0`: bottom (starts at `FLOOR_Y - player.h`)
- `y1`: top (animated upward until `0`, or instantly `0`)

Two implementation styles:
1) **Instant harpoon** (simplest): create a segment from `y0` to `0` immediately and keep it for a short lifetime or until hit.
2) **Extending harpoon** (more authentic feel): animate `y1` upward with `harpoon.extendSpeed`.

Suggested v1:
- Extending with `extendSpeed = 900 px/s`
- After reaching ceiling: remain for `0.15s`, then retract (or just despawn)

### Ball (bubble)
Representation:
- `pos: {x,y}`
- `vel: {vx, vy}`
- `sizeIndex` in `[0..N-1]` (0 = smallest)
- `r = radiusTable[sizeIndex]`

Size tiers (classic feel uses 4-ish tiers):
- `radiusTable = [10, 16, 24, 34]`  // small→large

---

## 3) Motion model for balls (Pang-feel physics)

A key trick: Pang balls *feel* like they bounce to characteristic heights per size.

### Recommended: ballistic gravity + per-size floor impulse
Instead of a pure “multiply vy by -restitution” bounce (which can drift over time), do:

Each frame:
- Apply gravity: `vy += g * dt`
- Integrate: `x += vx*dt`, `y += vy*dt`

On floor collision:
- Clamp: `y = FLOOR_Y - r`
- Reset vertical speed to a **size-based jump speed**:
  - `vy = -jumpSpeed[sizeIndex]`

This gives you consistent bounce arcs and is very stable.

Suggested constants:
- `g = 1800 px/s^2`
- `jumpSpeed = [520, 650, 780, 920]` // small→large (tune by feel)
- `vx` magnitude grows slightly for small balls:
  - `vxMag = [210, 190, 170, 150]`  // small→large

### Walls + ceiling
- Left wall: if `x - r < 0` → `x = r`, `vx = +abs(vx)`
- Right wall: if `x + r > WORLD_W` → `x = WORLD_W - r`, `vx = -abs(vx)`
- Ceiling: if `y - r < 0` → `y = r`, `vy = +abs(vy)` (or just clamp; ceiling bounces add chaos)

### Optional damping (if needed)
If balls feel too “floaty” you can add mild air drag:
- `vx *= (1 - drag*dt)` with `drag ~ 0.05`
- Usually not necessary if jumpSpeed is doing the heavy lifting.

---

## 4) Splitting rules

When a ball is hit by a harpoon:

- If `sizeIndex == 0`: **destroy** the ball.
- Else: remove the ball and **spawn two children** with:
  - `childSize = sizeIndex - 1`
  - `r = radiusTable[childSize]`
  - Positions offset slightly so they don’t overlap:
    - left child at `x - r*0.25`, right child at `x + r*0.25`
    - y clamped so it stays above floor: `y = min(y, FLOOR_Y - r)`
  - Velocities:
    - `vx = ±vxMag[childSize]` (left negative, right positive)
    - `vy = -jumpSpeed[childSize] * 0.85` (gives an immediate “pop upward” feel)

### Score per pop
Simple and satisfying:
- Award more for smaller balls (harder to hit):
  - `scoreAdd = [120, 80, 50, 30][sizeIndex]`

Or award more for larger balls (arcade-y):
- `scoreAdd = [30, 50, 80, 120][sizeIndex]`

Pick one and tune later.

---

## 5) Collision detection

### A) Harpoon vs ball (segment-circle)
Harpoon is a vertical segment at `x = hx` from `yTop` to `yBottom`.

Fast test (because segment is vertical):
1) Horizontal distance: `dx = abs(ball.x - hx)`
   - if `dx > ball.r`: no hit
2) Vertical overlap:
   - Segment Y range: `[yTop, yBottom]` (ensure `yTop < yBottom`)
   - Ball overlaps segment if `ball.y + ball.r >= yTop && ball.y - ball.r <= yBottom`

If both pass → hit.

### B) Player vs ball (circle-circle for v1)
Approximate player as a circle at:
- `px = player.x`
- `py = FLOOR_Y - player.h * 0.55`
- `pr = player.hitR`

Hit if:
- `(ball.x - px)^2 + (ball.y - py)^2 <= (ball.r + pr)^2`

Later you can refine to triangle collision, but circle works well.

---

## 6) Input mapping (minimal)

- Left arrow / A: move left
- Right arrow / D: move right
- Space / Enter: fire harpoon (if none active)

Movement constraints:
- Clamp `player.x` so triangle stays in bounds:
  - `player.x = clamp(player.x, player.w/2, WORLD_W - player.w/2)`

---

## 7) Game states + flow

### State machine
- `BOOT` → load assets (optional) → `LEVEL_START`
- `LEVEL_START` → spawn level entities → `PLAYING`
- `PLAYING` → update & collisions
- `PLAYER_HIT` → death anim / pause → restart level or lose life
- `LEVEL_CLEAR` → brief pause → next level
- `GAME_OVER`

For v1, you can skip lives and simply restart the level on hit.

### Level completion
A level is cleared when:
- `balls.length === 0`

---

## 8) Timers + fixed timestep loop

Use `requestAnimationFrame` for rendering and run your simulation at a fixed step for stability.

Suggested:
- Simulation step: `FIXED_DT = 1/120` (or `1/60`)

Pattern:
- accumulate frame time
- while accumulator >= FIXED_DT: update(FIXED_DT)
- render with interpolation alpha = accumulator / FIXED_DT

Even if you don’t do interpolation, fixed-step update makes ball physics predictable.

---

## 9) Rendering (Canvas, no sprites yet)

### Player triangle
Draw a triangle with base on floor:
- apex: `(player.x, FLOOR_Y - player.h)`
- base left: `(player.x - player.w/2, FLOOR_Y)`
- base right: `(player.x + player.w/2, FLOOR_Y)`

### Balls
Draw circles with simple shading:
- `ctx.arc(ball.x, ball.y, ball.r, 0, 2π)`
- Add a radial gradient highlight for a bubble look.

### Harpoon
Draw a line with thickness:
- `ctx.lineWidth = 3`
- `ctx.beginPath(); ctx.moveTo(hx, yBottom); ctx.lineTo(hx, yTop); ctx.stroke();`

### HUD
Draw score + level number.

---

## 10) Linear levels (data-driven)

Start with a compact level definition format.

### Level schema
Each level defines:
- initial ball spawns
- optional difficulty tuning (speed multiplier, etc.)

Example:

```js
const LEVELS = [
  {
    name: 'Level 1',
    balls: [
      { size: 3, x: 160, y: 120, dir: +1 },
    ],
  },
  {
    name: 'Level 2',
    balls: [
      { size: 3, x: 140, y: 140, dir: +1 },
      { size: 2, x: 420, y: 110, dir: -1 },
    ],
  },
  {
    name: 'Level 3',
    balls: [
      { size: 3, x: 200, y:  90, dir: +1 },
      { size: 3, x: 440, y:  90, dir: -1 },
    ],
  },
  {
    name: 'Level 4',
    balls: [
      { size: 2, x: 140, y:  80, dir: +1 },
      { size: 2, x: 320, y: 120, dir: -1 },
      { size: 2, x: 500, y:  80, dir: +1 },
    ],
  },
];
```

Spawner rule:
- For each spawn `{size, x, y, dir}`:
  - `r = radiusTable[size]`
  - `vx = dir * vxMag[size]`
  - `vy = -jumpSpeed[size] * 0.8` (or 0)
  - `y = clamp(y, r, FLOOR_Y - r)`

---

## 11) Object model (JS-friendly)

### Constants

```js
const WORLD_W = 640;
const WORLD_H = 360;
const FLOOR_Y = WORLD_H - 24;

const g = 1800;
const radiusTable = [10, 16, 24, 34];
const jumpSpeed   = [520, 650, 780, 920];
const vxMag       = [210, 190, 170, 150];

const GameState = {
  LEVEL_START: 'LEVEL_START',
  PLAYING: 'PLAYING',
  PLAYER_HIT: 'PLAYER_HIT',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER: 'GAME_OVER',
};
```

### Entities

```js
class Player {
  constructor() {
    this.x = WORLD_W * 0.5;
    this.w = 22;
    this.h = 28;
    this.speed = 220;
    this.hitR = 12;
  }
  get yBase() { return FLOOR_Y; }
  get hitCenter() {
    return { x: this.x, y: FLOOR_Y - this.h * 0.55 };
  }
}

class Harpoon {
  constructor() {
    this.active = false;
    this.x = 0;
    this.yBottom = 0;
    this.yTop = 0;
    this.extendSpeed = 900;
    this.mode = 'extend'; // 'instant' | 'extend'
    this.stickMs = 120;
    this.lifeMs = 0;
  }
}

class Ball {
  constructor(sizeIndex, x, y, vx, vy) {
    this.size = sizeIndex;
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
  }
  get r() { return radiusTable[this.size]; }
}
```

### Game container

```js
class Game {
  constructor(levels) {
    this.levels = levels;
    this.levelIndex = 0;
    this.state = GameState.LEVEL_START;

    this.player = new Player();
    this.harpoon = new Harpoon();
    this.balls = [];

    this.score = 0;

    this.timers = {
      stateMs: 0,
    };

    this.input = {
      left:false, right:false,
      firePressed:false,
      consumeFire(){ const v=this.firePressed; this.firePressed=false; return v; }
    };
  }
}
```

---

## 12) Update steps (the “tick”)

Order matters for feel and correctness.

### `update(dt)` outline

1) **Handle state transitions**
   - if `LEVEL_START`: `loadLevel(levelIndex)` then `PLAYING`

2) **Read input → move player**
   - `dx = (right-left) * player.speed * dt`
   - clamp x

3) **Fire harpoon** (if pressed and harpoon inactive)
   - set `harpoon.active = true`
   - set `harpoon.x = player.x`
   - `harpoon.yBottom = FLOOR_Y - player.h`
   - if `instant`: `harpoon.yTop = 0; harpoon.lifeMs = 250`
   - if `extend`: `harpoon.yTop = harpoon.yBottom`

4) **Update harpoon**
   - if extending: `harpoon.yTop -= extendSpeed*dt`
   - clamp at 0
   - if reached ceiling: count down `stickMs` then deactivate
   - if instant: decrement `lifeMs`

5) **Update balls**
   - integrate with gravity
   - resolve wall/floor collisions

6) **Harpoon hits**
   - find first ball that intersects harpoon (or all; v1: first)
   - if hit: split/remove ball, deactivate harpoon

7) **Player hits**
   - if any ball overlaps player hit circle: state = `PLAYER_HIT`

8) **Level clear check**
   - if no balls: state = `LEVEL_CLEAR`

### `PLAYER_HIT` behavior (v1)
- wait `600ms`, then reload the level and continue

### `LEVEL_CLEAR` behavior (v1)
- wait `800ms`, increment levelIndex
- if beyond last: GAME_OVER (or loop)

---

## 13) Collision + split helpers (pseudocode)

### Harpoon-ball hit test

```js
function harpoonHitsBall(h, b) {
  if (!h.active) return false;
  const dx = Math.abs(b.x - h.x);
  if (dx > b.r) return false;

  const yTop = Math.min(h.yTop, h.yBottom);
  const yBot = Math.max(h.yTop, h.yBottom);
  return (b.y + b.r >= yTop) && (b.y - b.r <= yBot);
}
```

### Split

```js
function splitBall(game, idx) {
  const b = game.balls[idx];
  const size = b.size;
  game.balls.splice(idx, 1);

  // score
  const scoreBySize = [120, 80, 50, 30];
  game.score += scoreBySize[size] ?? 10;

  if (size === 0) return;

  const child = size - 1;
  const r = radiusTable[child];

  const baseY = Math.min(b.y, FLOOR_Y - r);

  const vx = vxMag[child];
  const vy = -jumpSpeed[child] * 0.85;

  game.balls.push(new Ball(child, b.x - r*0.25, baseY, -vx, vy));
  game.balls.push(new Ball(child, b.x + r*0.25, baseY, +vx, vy));
}
```

---

## 14) Rendering module sketch

Keep rendering separate from logic. The renderer reads state and draws.

Files:
- `renderer.js` exports `render(ctx, game)`
- `game.js` owns update and rules

`render` responsibilities:
- clear background
- draw floor line
- draw balls
- draw harpoon
- draw player triangle
- draw HUD

---

## 15) Upgrade path (after v1)

Once the basic loop is fun, here are safe additions in order:

1) **Platforms** (segments / rectangles)
   - Add additional colliders that balls bounce off.
   - Harpoon should stop at the platform ceiling if it hits one.

2) **Powerups**
   - Double harpoon (two wires)
   - Rapid fire (short lockout)
   - Shield (ignore one hit)

3) **Enemies**
   - Simple walkers that can also collide with balls.

4) **Real stage layouts**
   - Introduce ladders, destructible blocks, etc.

---

## 16) Notes on authenticity vs simplicity

Pang games have lots of stage gimmicks. For a JS clone that feels right quickly:
- The **consistent bounce arc** per size is more important than perfect physics.
- A single harpoon with a clear cooldown is enough to create the classic “thread the needle” tension.
- Keep levels short and increase density/speed gradually.

