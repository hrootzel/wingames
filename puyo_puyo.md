# Goal

Recreate the *core* **Puyo Puyo (Tsu-style)** single-player loop: falling pairs of colored blobs, clear **4+ connected**, resolve gravity-driven **chains**, and compute score in a way that feels authentic.

This spec focuses on deterministic puzzle rules you can implement in JS/HTML. It intentionally ignores character cut-ins, versus garbage exchange timing, fever modes, etc.

---

## 1) Playfield geometry

### Grid

- **Width:** 6 columns
- **Visible height:** 12 rows
- **Hidden/spawn rows:** 2 rows above the visible area

Implementation-friendly:
- Model as **14 rows × 6 columns**.
- Rows `0..11` are visible.
- Rows `12..13` are hidden (spawn/overflow).

### Spawn point (classic)

Puyo games are famous for the “**3rd column**” top-out behavior.

- Use **spawn column = 3rd from the left**.
  - 0-based: `SPAWN_COL = 2`.
- Suggested spawn cells (axis on bottom, child above):
  - Axis: `(row=12, col=2)`
  - Child: `(row=13, col=2)`

### Loss condition

- If you cannot spawn a new pair because one of the spawn cells is occupied → **game over**.

*(This matches the classic feel: if the 3rd column stacks too high, you lose.)*

### Coordinate convention (recommended)

- Columns: `0..5` left→right
- Rows: `0..13` bottom→top (row 0 is the floor)

---

## 2) Piece model (the falling “pair”)

Each turn you control a **pair** of two Puyo:

- **Axis Puyo**: the pivot, typically the **bottom** one in the NEXT window.
- **Child Puyo**: rotates around the axis.

### Spawn

- Spawn in the hidden rows at the spawn column.
- Default orientation: **vertical** (child above axis).

### Movement

- Left/right: if both occupied cells remain in bounds and not colliding.
- Rotation CW/CCW: rotate the child around the axis.
  - For a first pass: “rotate if the destination cell is empty; otherwise ignore.”
  - Optional polish: implement **pushback/wall-kick** rules later.

### Soft drop / hard drop (optional)

- Soft drop: accelerates falling.
- Hard drop: instantly drops to the lowest valid position and locks.

### Locking

- When the pair can no longer move downward, it **locks** into the board.
- Optional: use **lock delay** (see timers section) for a more modern feel.

---

## 3) Cell types

For a minimal single-player clone, you only need:

### A) Colored Puyo

- **Colors:** choose **4 colors** for classic competitive feel.
  - Common set: Red, Green, Blue, Yellow.
- Connected orthogonally (no diagonals).

### B) Garbage Puyo (optional)

If you want an endurance mode or a later versus mode:

- **Ojama (garbage):** colorless blocks.
- They **do not** clear in groups.
- They clear only when adjacent to a popping colored group (implementation in §5).

You can omit garbage entirely for a pure score attack.

---

## 4) Clear rules (the core match logic)

### Connectivity

- Puyo connect **orthogonally** (up/down/left/right).
- Diagonals do not connect.

### Pop condition

- Any connected component of **same color** with size **≥ 4** pops.

### Multi-group pop in one step

Within a single chain step (a “link”):

- You may pop **multiple groups**.
- You may pop **multiple colors**.
- All qualifying groups pop **simultaneously** for scoring.

---

## 5) Garbage clearing rules (optional)

When a colored group pops:

- Any **garbage Puyo orthogonally adjacent** to *any* popped colored Puyo also clears.
- Garbage that clears this way may cause additional falling and chain steps, but garbage **never** forms a pop group on its own.

If you’re not using garbage, skip this section.

---

## 6) Gravity + chain resolution

This is the “resolve loop” that happens after each lock.

### Resolution loop (recommended)

After a piece locks:

1. **Settle:** apply gravity so all unsupported Puyo fall straight down until stable.
2. **Find pops:** scan board for all color groups of size ≥ 4.
3. If none → end the turn; spawn next pair.
4. If pops exist:
   - Determine the full set of cells that will clear (colored pops + adjacent garbage, if enabled).
   - **Score this link** (see §7).
   - Remove cleared cells.
   - Increment `chainIndex`.
   - Go back to step 1.

### Chain definition

- A chain is a sequence of 2+ pop links caused by the same locked piece.
- Track `chainIndex = 1,2,3,...` *per turn*.

---

## 7) Scoring (Tsu-style classic scoring)

This section gives you an “authentic-feeling” scoring system that matches the classic structure:

> **Score(link) = (10 × PC) × clamp( CP + CB + GB, 1..999 )**

Where:

- `PC` = total number of Puyo cleared in that link (typically **colored**, plus **garbage cleared** if you want)
- `CP` = Chain Power for this chain link (depends on `chainIndex`)
- `CB` = Color Bonus (depends on how many distinct colors cleared this link)
- `GB` = Group Bonus (sum of bonuses based on the size of each group cleared this link)

### A) Chain Power table (classic / Tsu)

Use this for `CP` by chain index (1..24). For longer chains, a common extension is to keep adding +32 and cap at 999.

| chainIndex | CP |
|---:|---:|
| 1 | 0 |
| 2 | 8 |
| 3 | 16 |
| 4 | 32 |
| 5 | 64 |
| 6 | 96 |
| 7 | 128 |
| 8 | 160 |
| 9 | 192 |
| 10 | 224 |
| 11 | 256 |
| 12 | 288 |
| 13 | 320 |
| 14 | 352 |
| 15 | 384 |
| 16 | 416 |
| 17 | 448 |
| 18 | 480 |
| 19 | 512 |
| 20 | 544 |
| 21 | 576 |
| 22 | 608 |
| 23 | 640 |
| 24 | 672 |

Suggested extension:
- for `chainIndex >= 25`: `CP = min(999, 672 + 32*(chainIndex-24))`

### B) Color Bonus (classic)

Count distinct colors that pop *in the same link*.

| colors cleared | CB |
|---:|---:|
| 1 | 0 |
| 2 | 3 |
| 3 | 6 |
| 4 | 12 |
| 5 | 24 |

If you only use 4 colors, you’ll never hit the 5-color row.

### C) Group Bonus (classic)

Compute per-group bonus from its size, then sum for all popped groups in the link.

| group size | bonus |
|---:|---:|
| 4 | 0 |
| 5 | 2 |
| 6 | 3 |
| 7 | 4 |
| 8 | 5 |
| 9 | 6 |
| 10 | 7 |
| 11+ | 10 |

Example:
- If in one link you clear a 4-group and a 7-group, then `GB = 0 + 4 = 4`.

### D) Bonus clamp

After you compute `CP + CB + GB`, clamp it:

- `bonus = clamp(CP + CB + GB, 1, 999)`

This is important because a 1-chain clearing exactly 4 of one color yields:
- `CP=0, CB=0, GB=0` → bonus would be 0, but clamp makes it 1 → you get **40 points**, which is the expected base.

### E) Optional: drop bonus

If you want the “soft/hard drop gives a little score” feel:

- Award a small `dropBonus += 1` (or `+=2`) per row traversed while soft dropping, and/or
- `dropBonus += 20` for a hard drop.

Then:
- Either add drop bonus directly to total score, or
- Add it to `10*PC` before multiplying (more authentic in some rulesets, but optional).

### F) Optional: all clear (zenkeshi)

If the board is empty after a resolve loop finishes:

- Add `ALL_CLEAR_BONUS` (e.g. `+5000` or `+10000`).

---

## 8) Minimal single-player modes

### A) Endless score attack (recommended)

- No garbage.
- Score using §7.
- Gradually increase fall speed (see §9 timers).
- Game ends on spawn collision.

### B) Survival / “pressure” mode

- Periodically inject garbage rows (e.g. every N pieces) to force efficiency.
- Still score with §7.

---

## 9) Game cycle + timers (JS/HTML)

Use the same high-level structure as your other puzzle engine:

- `requestAnimationFrame` for drawing
- fixed-timestep simulation for deterministic rules

### State machine

- **SPAWN** → create active pair from next queue
- **FALLING** → accept input; apply gravity to active pair
- **LOCK_DELAY** (optional) → brief window before locking
- **RESOLVE** → settle + pop loop across one or more chain links
- **GAME_OVER** / **PAUSED**

### Timers you typically want

- `gravityIntervalMs`: time per row step (depends on level)
- `lockDelayMs`: 250–500 ms (optional)
- `softDropMultiplier`: e.g. gravityInterval/10
- Optional control repeat:
  - DAS/ARR for left/right hold
- Resolve pacing timers (optional but helps readability):
  - `popAnimMs`
  - `settleAnimMs`
  - `chainPauseMs`

### Resolver phases (staged)

A staged resolver is easier to animate:

1. `SETTLE` (apply gravity to board)
2. `FIND_POPS` (compute groups ≥4)
3. `POP_ANIM` (countdown timer)
4. `CLEAR` (remove cells, compute score for link)
5. `CHAIN_PAUSE` then back to `SETTLE`

---

## 10) Reference object model (JS-friendly)

This mirrors the structure in your other spec, but with Puyo-specific fields.

### A) Constants / enums

```js
const W = 6;
const H = 14;          // 12 visible + 2 hidden
const VISIBLE_H = 12;
const SPAWN_COL = 2;   // 3rd column, 0-based
const SPAWN_AXIS_ROW = 12;
const SPAWN_CHILD_ROW = 13;

const Kind = {
  EMPTY: 'EMPTY',
  COLOR: 'COLOR',
  GARBAGE: 'GARBAGE',
};

const Color = {
  R: 'R', G: 'G', B: 'B', Y: 'Y',
  // Optional 5th: P: 'P'
};

const GameState = {
  SPAWN: 'SPAWN',
  FALLING: 'FALLING',
  LOCK_DELAY: 'LOCK_DELAY',
  RESOLVE: 'RESOLVE',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
};

const ResolvePhase = {
  SETTLE: 'SETTLE',
  FIND_POPS: 'FIND_POPS',
  POP_ANIM: 'POP_ANIM',
  CLEAR: 'CLEAR',
  CHAIN_PAUSE: 'CHAIN_PAUSE',
  DONE: 'DONE',
};
```

### B) Cell + board

```js
function makeEmptyCell() {
  return {
    kind: Kind.EMPTY,
    color: null,   // only for Kind.COLOR

    // optional presentation fields
    anim: null,    // { fade, pop, ... }
  };
}

function makeBoard() {
  const cells = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => makeEmptyCell())
  );

  return {
    w: W,
    h: H,
    cells,

    inBounds(r, c) { return r >= 0 && r < H && c >= 0 && c < W; },
    get(r, c) { return this.inBounds(r,c) ? this.cells[r][c] : null; },
    set(r, c, cell) { this.cells[r][c] = cell; },
    isEmpty(r, c) { const x = this.get(r,c); return x && x.kind === Kind.EMPTY; },
  };
}
```

### C) Active piece (axis + child)

```js
function orientOffset(orient) {
  // 0=up,1=right,2=down,3=left (relative to axis)
  switch (orient & 3) {
    case 0: return { dr: +1, dc: 0 };
    case 1: return { dr: 0, dc: +1 };
    case 2: return { dr: -1, dc: 0 };
    case 3: return { dr: 0, dc: -1 };
  }
}

function makeActivePair(spec) {
  return {
    axisRow: SPAWN_AXIS_ROW,
    axisCol: SPAWN_COL,
    orient: 0,

    axis: { kind: Kind.COLOR, color: spec.axisColor },
    child: { kind: Kind.COLOR, color: spec.childColor },

    // render smoothing (optional)
    yOffsetPx: 0,

    cells() {
      const a = { row: this.axisRow, col: this.axisCol, puyo: this.axis };
      const off = orientOffset(this.orient);
      const b = { row: this.axisRow + off.dr, col: this.axisCol + off.dc, puyo: this.child };
      return [a, b];
    }
  };
}
```

### D) RNG + next queue

```js
function makeRng(seed = 12345) {
  let t = seed >>> 0;
  return {
    next() {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(this.next() * n); }
  };
}

function rollColor(rng, colorCount = 4) {
  const colors4 = [Color.R, Color.G, Color.B, Color.Y];
  const colors5 = [Color.R, Color.G, Color.B, Color.Y, Color.P];
  const arr = (colorCount === 5) ? colors5 : colors4;
  return arr[rng.int(arr.length)];
}

function rollPairSpec(rng, colorCount = 4) {
  return {
    axisColor: rollColor(rng, colorCount),
    childColor: rollColor(rng, colorCount),
  };
}
```

### E) Scoring helper tables

```js
const CHAIN_POWER = [
  0,   // 1
  8,   // 2
  16,  // 3
  32,  // 4
  64,  // 5
  96,  // 6
  128, // 7
  160, // 8
  192, // 9
  224, // 10
  256, // 11
  288, // 12
  320, // 13
  352, // 14
  384, // 15
  416, // 16
  448, // 17
  480, // 18
  512, // 19
  544, // 20
  576, // 21
  608, // 22
  640, // 23
  672, // 24
];

function chainPower(chainIndex) {
  if (chainIndex <= 24) return CHAIN_POWER[chainIndex - 1];
  return Math.min(999, 672 + 32 * (chainIndex - 24));
}

function colorBonus(distinctColorsCleared) {
  switch (distinctColorsCleared) {
    case 1: return 0;
    case 2: return 3;
    case 3: return 6;
    case 4: return 12;
    case 5: return 24;
    default: return 0;
  }
}

function groupBonusForSize(n) {
  if (n <= 4) return 0;
  if (n === 5) return 2;
  if (n === 6) return 3;
  if (n === 7) return 4;
  if (n === 8) return 5;
  if (n === 9) return 6;
  if (n === 10) return 7;
  return 10; // 11+
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function scoreLink({ chainIndex, clearedCount, distinctColors, groupSizes }) {
  const PC = clearedCount;
  const CP = chainPower(chainIndex);
  const CB = colorBonus(distinctColors);
  const GB = groupSizes.reduce((sum, n) => sum + groupBonusForSize(n), 0);
  const bonus = clamp(CP + CB + GB, 1, 999);
  return (10 * PC) * bonus;
}
```

### F) Resolver work buffers

```js
function makeResolver() {
  return {
    phase: ResolvePhase.SETTLE,
    phaseRemainingMs: 0,

    chainIndex: 1,

    // computed each FIND_POPS
    popGroups: [],      // [{ color, cells:[{r,c}...] }]
    popSet: new Set(),  // fast membership of cells to clear

    // scoring summary per link
    link: { clearedCount: 0, distinctColors: 0, groupSizes: [] },

    reset() {
      this.phase = ResolvePhase.SETTLE;
      this.phaseRemainingMs = 0;
      this.chainIndex = 1;
      this.popGroups.length = 0;
      this.popSet.clear();
      this.link = { clearedCount: 0, distinctColors: 0, groupSizes: [] };
    }
  };
}
```

### G) Top-level game object

```js
function makeGame(seed = 12345) {
  const rng = makeRng(seed);
  const game = {
    state: GameState.SPAWN,

    rng,
    board: makeBoard(),

    score: 0,
    level: 1,
    pieceIndex: 0,

    // next queue (simple 2-deep)
    nextA: rollPairSpec(rng),
    nextB: rollPairSpec(rng),

    active: null,

    input: {
      held: { left:false, right:false, down:false },
      pressed: { rotCW:false, rotCCW:false, hardDrop:false, pause:false },
      clearPressed() { for (const k of Object.keys(this.pressed)) this.pressed[k] = false; }
    },

    timers: {
      gravityElapsed: 0,
      gravityIntervalMs: 800,
      lockDelayMs: 350,
      lockDelayRemainingMs: 0,

      popAnimMs: 180,
      settleAnimMs: 120,
      chainPauseMs: 120,
    },

    resolver: makeResolver(),

    effects: {
      items: [],
      push(e){ this.items.push(e); },
      drain(){ const out = this.items; this.items = []; return out; }
    },
  };

  return game;
}
```

---

## 11) Notes on implementation order (fast path to playable)

1. Falling pair + collision + lock
2. Board gravity settle
3. Pop detection (groups ≥ 4)
4. Clear + repeat settle for chains
5. Score per link using §7
6. Add lock delay + soft drop polish
7. Optional: garbage rules + pressure mode

Once you have (1–5), you’ve got a real, playable Puyo engine.



---

## 12) Rendering hints (HTML5 Canvas, “blob” puyos with no sprites)

You can get a convincing Puyo look using **circles + connecting capsules** (a simple “metaball-ish” technique) and a little gradient shading.

### Coordinate mapping
Pick a `cellSize` (e.g. 40px). Convert board coords → pixels:
- `x = boardLeft + col * cellSize`
- `y = boardTop + (VISIBLE_H - 1 - row) * cellSize`  
  *(because row 0 is bottom, but canvas y grows downward)*

Define:
- `cx = x + cellSize/2`
- `cy = y + cellSize/2`
- `r = cellSize * 0.42` (puyo radius)

You can draw only visible rows, but it’s handy to also draw the hidden rows when the active piece is up there.

---

## 13) The core trick: circles + “capsule” connectors

Instead of drawing separate circles that just touch, draw **one merged filled shape** per connected component (or at least per color). Do this by filling a path that contains:

1. A circle for each occupied cell.
2. A connecting **capsule** between orthogonally adjacent same-color cells.

A capsule is basically a rounded rectangle (or two semicircles) bridging the centers.

### Capsule builder
For two neighbors with centers `(cx1, cy1)` and `(cx2, cy2)`:
- If they’re horizontal neighbors, draw a rounded rect from `min(cx1,cx2)` to `max(cx1,cx2)` with height `2r`.
- If vertical neighbors, similar but swapped.

You can approximate a capsule using `ctx.roundRect()` (supported in modern browsers) or by manually drawing arcs.

---

## 14) Draw per connected component (best result)

If you draw one big path per color for the whole board, gradients can look weird across separate groups. A better approach is:

1. Find connected components (BFS/DFS) of same-color cells.
2. For each component:
   - build a Path2D consisting of circles + capsules
   - fill with a gradient anchored to the component’s bounding box
   - stroke once (optional)

Because the board is tiny (6×14), doing a BFS per frame is totally fine.

### Component building (pseudo)

```js
function findColorComponents(board) {
  // returns [{ color, cells:[{r,c}], bounds:{minR,maxR,minC,maxC} }...]
}
```

### Building the blob Path2D

```js
function buildBlobPath(cells, cellSize, boardLeft, boardTop) {
  const path = new Path2D();
  const r = cellSize * 0.42;

  // Fast lookup for adjacency
  const set = new Set(cells.map(({r,c}) => `${r},${c}`));

  for (const {r:row, c:col} of cells) {
    const x = boardLeft + col * cellSize;
    const y = boardTop + (VISIBLE_H - 1 - row) * cellSize;
    const cx = x + cellSize/2;
    const cy = y + cellSize/2;

    // Circle
    path.moveTo(cx + r, cy);
    path.arc(cx, cy, r, 0, Math.PI * 2);

    // Connect right
    if (set.has(`${row},${col+1}`)) {
      const x2 = boardLeft + (col+1) * cellSize;
      const cx2 = x2 + cellSize/2;
      const left = Math.min(cx, cx2);
      const w = Math.abs(cx2 - cx);
      // Capsule as rounded rect (height 2r)
      // top-left: (left, cy-r), size: (w, 2r), radius: r
      path.roundRect(left, cy - r, w, 2*r, r);
    }

    // Connect up
    if (set.has(`${row+1},${col}`)) {
      const y2 = boardTop + (VISIBLE_H - 1 - (row+1)) * cellSize;
      const cy2 = y2 + cellSize/2;
      const top = Math.min(cy, cy2);
      const h = Math.abs(cy2 - cy);
      path.roundRect(cx - r, top, 2*r, h, r);
    }
  }

  return path;
}
```

Notes:
- Only connect **right** and **up** to avoid double-adding capsules.
- Overlaps are fine; filling merges visually.

---

## 15) Making it look like a “puyo” (shading without faces)

### A) Gradient fill
Use a radial gradient per component for a soft, toy-like look.

```js
function makePuyoFill(ctx, boundsPx, base, light, dark) {
  const { x0, y0, x1, y1 } = boundsPx;
  const w = x1 - x0;
  const h = y1 - y0;

  // Highlight toward top-left
  const gx = x0 + w * 0.35;
  const gy = y0 + h * 0.30;
  const r0 = Math.min(w, h) * 0.05;
  const r1 = Math.max(w, h) * 0.75;

  const g = ctx.createRadialGradient(gx, gy, r0, gx, gy, r1);
  g.addColorStop(0.0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1.0, dark);
  return g;
}
```

Then:
- `ctx.fillStyle = gradient; ctx.fill(path);`

### B) Outline (optional)
A subtle outline helps readability.
- `ctx.lineWidth = cellSize * 0.08`
- `ctx.strokeStyle = 'rgba(0,0,0,0.25)'` (or a darker shade of the base color)
- `ctx.stroke(path)`

Because you stroke the **merged component path**, you avoid internal outlines.

### C) Extra gloss (optional)
Add a soft highlight sweep:
- Save/clip to the blob path, then draw a translucent ellipse near top-left.

```js
ctx.save();
ctx.clip(path);
ctx.globalAlpha = 0.18;
ctx.beginPath();
ctx.ellipse(x0 + w*0.35, y0 + h*0.28, w*0.35, h*0.22, -0.3, 0, Math.PI*2);
ctx.fillStyle = 'white';
ctx.fill();
ctx.restore();
ctx.globalAlpha = 1;
```

---

## 16) Rendering pipeline suggestion

Per frame:
1. Draw background + playfield border
2. Draw **fixed board** blobs:
   - find components
   - draw each component
3. Draw active falling pair:
   - easiest: draw as two separate circles (still looks fine)
   - nicer: treat the two as a tiny “component” and draw the same blob path
4. Draw UI (score, next pieces)

Because the grid is small, you can recompute components every frame. If you later want more performance, cache components until the board changes.

---

## 17) Garbage (ojama) rendering (optional)

If you add garbage:
- Draw as slightly smaller circles (e.g. `r = cellSize*0.40`)
- Use a grey gradient
- Add small “pips” (2–4 tiny darker circles) for texture (no faces)

They should look matte compared to colored Puyo (less gloss, slightly darker outline).

---

## 18) Pop animation ideas (no sprites)

When a group pops:
- Store `anim = { t:0..1 }` on those cells, or emit an effect with the cell list.
- Animate:
  - scale: `scale = 1 + 0.25 * easeOut(t)`
  - alpha: `alpha = 1 - easeIn(t)`
  - optional: flash white overlay briefly

If you’re rendering by component, during pop animation you can still draw the same blob path but with animated `globalAlpha` and `ctx.scale` around the component center.

---

## 19) Browser compatibility note

- `Path2D` is widely supported.
- `roundRect` on Path2D is newer; if you need a fallback, replace capsules with a simple rectangle + two semicircle arcs, or just draw a thick line between centers using `ctx.lineCap='round'` and `ctx.lineWidth = 2*r` (this is a great capsule substitute).

**Line-based capsule fallback:**
- `ctx.beginPath(); ctx.moveTo(cx1,cy1); ctx.lineTo(cx2,cy2); ctx.lineWidth = 2*r; ctx.lineCap='round'; ctx.stroke();`
- Combine this with circles: stroke the connectors into a path on an offscreen canvas, then fill—OR simply draw connectors first and then circles on top.

This approach is simple and still gives the classic “joined blobs” look.



---

## 20) Drop‑in renderer module (Canvas, no sprites)

Below is a **self-contained** renderer you can paste into your project. It assumes you have the object model from §10:
- `game.board.cells[row][col]` with `{ kind, color }`
- `game.active` with `axisRow/axisCol/orient` and `axis.color` / `child.color`
- `game.view` with `{ cellSize, boardLeft, boardTop }` (add it if you don’t have it)

It draws:
- the playfield frame
- merged “blob” puyos per connected component
- the active falling pair (also merged)
- a simple score readout

> Tip: Keep your rules engine independent of rendering; the renderer only reads state.

```js
// puyo_renderer.js

export function createPuyoRenderer(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  const cfg = {
    // Tweak these to taste
    radiusFactor: opts.radiusFactor ?? 0.42, // r = cellSize * radiusFactor
    pinch: opts.pinch ?? 0.65,              // mid-bridge thickness (0..1)
    bridgeSteps: opts.bridgeSteps ?? 7,      // samples per bridge (6–10 looks good)

    // Background
    bg: opts.bg ?? '#101218',
    frame: opts.frame ?? 'rgba(255,255,255,0.18)',
    frameFill: opts.frameFill ?? 'rgba(255,255,255,0.06)',
  };

  // Simple palettes (base/light/dark). Replace with your own.
  const PALETTE = {
    R: { base: '#e44b4b', light: '#ffb0b0', dark: '#8a1f1f' },
    G: { base: '#33c46a', light: '#b7ffd1', dark: '#137338' },
    B: { base: '#3f7bff', light: '#b7d1ff', dark: '#1d3a9e' },
    Y: { base: '#f1c232', light: '#fff1b0', dark: '#9c6f12' },
    OJ: { base: '#9aa1ad', light: '#e3e6ec', dark: '#4b515b' },
  };

  function resizeToClient() {
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  function boardToPx(game, row, col) {
    const s = game.view.cellSize;
    const x = game.view.boardLeft + col * s;
    const y = game.view.boardTop + (VISIBLE_H - 1 - row) * s;
    return { x, y, cx: x + s / 2, cy: y + s / 2, s };
  }

  function drawFrame(game) {
    const s = game.view.cellSize;
    const wPx = W * s;
    const hPx = VISIBLE_H * s;
    const x0 = game.view.boardLeft;
    const y0 = game.view.boardTop;

    ctx.fillStyle = cfg.frameFill;
    ctx.fillRect(x0 - 6, y0 - 6, wPx + 12, hPx + 12);

    ctx.strokeStyle = cfg.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 6, y0 - 6, wPx + 12, hPx + 12);
  }

  // --- Component discovery (BFS) ---
  function findColorComponents(board) {
    const seen = Array.from({ length: board.h }, () => Array(board.w).fill(false));
    const out = [];

    function isColorCell(cell) {
      return cell && cell.kind === Kind.COLOR && cell.color != null;
    }

    for (let r = 0; r < board.h; r++) {
      for (let c = 0; c < board.w; c++) {
        if (seen[r][c]) continue;
        const cell = board.get(r, c);
        if (!isColorCell(cell)) continue;

        const color = cell.color;
        const q = [{ r, c }];
        seen[r][c] = true;

        const cells = [];
        let minR = r, maxR = r, minC = c, maxC = c;

        while (q.length) {
          const cur = q.pop();
          cells.push(cur);
          minR = Math.min(minR, cur.r); maxR = Math.max(maxR, cur.r);
          minC = Math.min(minC, cur.c); maxC = Math.max(maxC, cur.c);

          const n4 = [
            { r: cur.r, c: cur.c - 1 },
            { r: cur.r, c: cur.c + 1 },
            { r: cur.r - 1, c: cur.c },
            { r: cur.r + 1, c: cur.c },
          ];

          for (const n of n4) {
            if (!board.inBounds(n.r, n.c)) continue;
            if (seen[n.r][n.c]) continue;
            const nc = board.get(n.r, n.c);
            if (!isColorCell(nc) || nc.color !== color) continue;
            seen[n.r][n.c] = true;
            q.push(n);
          }
        }

        out.push({ color, cells, bounds: { minR, maxR, minC, maxC } });
      }
    }

    return out;
  }

  // --- Blob path construction ---
  function addCircle(path, cx, cy, r) {
    path.moveTo(cx + r, cy);
    path.arc(cx, cy, r, 0, Math.PI * 2);
  }

  // The “surface tension” bridge: starts thick at circles, tapers at midpoint.
  // Works for horizontal OR vertical neighbors.
  function addTaperBridge(path, ax, ay, bx, by, r, pinch, steps) {
    const dx = bx - ax;
    const dy = by - ay;

    // We only expect orthogonal adjacency, but keep it generic.
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;

    // Unit direction from A to B
    const ux = dx / len;
    const uy = dy / len;

    // Perpendicular unit
    const px = -uy;
    const py = ux;

    // Thickness profile w(t): w(0)=r, w(1)=r, w(0.5)=r*pinch
    // Using a sin^2 bump gives a smooth, organic pinch.
    function w(t) {
      const s = Math.sin(Math.PI * t);
      const s2 = s * s;
      return r * (1 - (1 - pinch) * s2);
    }

    // Sample top edge points from A→B, bottom edge from B→A.
    const top = [];
    const bot = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wx = w(t);
      const x = ax + dx * t;
      const y = ay + dy * t;
      top.push({ x: x + px * wx, y: y + py * wx });
      bot.push({ x: x - px * wx, y: y - py * wx });
    }

    // Build a closed polygon path.
    path.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i++) path.lineTo(top[i].x, top[i].y);
    for (let i = bot.length - 1; i >= 0; i--) path.lineTo(bot[i].x, bot[i].y);
    path.closePath();
  }

  function componentBoundsPx(game, comp) {
    const s = game.view.cellSize;
    const r = s * cfg.radiusFactor;

    // Convert min/max cell bounds to pixel bounds (expanded by radius)
    const min = boardToPx(game, comp.bounds.minR, comp.bounds.minC);
    const max = boardToPx(game, comp.bounds.maxR, comp.bounds.maxC);

    const x0 = min.cx - r;
    const y0 = max.cy - r; // note: maxR is visually higher, but we just want bounds
    const x1 = max.cx + r;
    const y1 = min.cy + r;

    return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
  }

  function makeFill(ctx, boundsPx, pal) {
    const { x0, y0, x1, y1 } = boundsPx;
    const w = x1 - x0;
    const h = y1 - y0;

    const gx = x0 + w * 0.35;
    const gy = y0 + h * 0.30;
    const r0 = Math.min(w, h) * 0.05;
    const r1 = Math.max(w, h) * 0.80;

    const g = ctx.createRadialGradient(gx, gy, r0, gx, gy, r1);
    g.addColorStop(0.0, pal.light);
    g.addColorStop(0.55, pal.base);
    g.addColorStop(1.0, pal.dark);
    return g;
  }

  function buildComponentPath(game, comp) {
    const path = new Path2D();
    const s = game.view.cellSize;
    const r = s * cfg.radiusFactor;
    const pinch = cfg.pinch;
    const steps = cfg.bridgeSteps;

    // Membership set for adjacency checks
    const set = new Set(comp.cells.map(({ r, c }) => `${r},${c}`));

    for (const { r: row, c: col } of comp.cells) {
      const p = boardToPx(game, row, col);
      addCircle(path, p.cx, p.cy, r);

      // Right neighbor bridge (avoid double add)
      if (set.has(`${row},${col + 1}`)) {
        const q = boardToPx(game, row, col + 1);
        addTaperBridge(path, p.cx, p.cy, q.cx, q.cy, r, pinch, steps);
      }

      // Up neighbor bridge
      if (set.has(`${row + 1},${col}`)) {
        const q = boardToPx(game, row + 1, col);
        addTaperBridge(path, p.cx, p.cy, q.cx, q.cy, r, pinch, steps);
      }
    }

    return path;
  }

  function drawComponent(game, comp) {
    const pal = PALETTE[comp.color] ?? PALETTE.R;
    const bounds = componentBoundsPx(game, comp);
    const path = buildComponentPath(game, comp);

    ctx.fillStyle = makeFill(ctx, bounds, pal);
    ctx.fill(path);

    // Optional outline
    ctx.lineWidth = game.view.cellSize * 0.07;
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.stroke(path);

    // Optional gloss sweep
    ctx.save();
    ctx.clip(path);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(
      bounds.x0 + (bounds.x1 - bounds.x0) * 0.35,
      bounds.y0 + (bounds.y1 - bounds.y0) * 0.28,
      (bounds.x1 - bounds.x0) * 0.35,
      (bounds.y1 - bounds.y0) * 0.22,
      -0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBoard(game) {
    const comps = findColorComponents(game.board);
    for (const comp of comps) drawComponent(game, comp);

    // Optional: draw garbage as simple matte circles
    // If you implement garbage cells, add a second pass here.
  }

  // --- Active pair drawing (also blobbed) ---
  function drawActivePair(game, alpha = 0) {
    const a = game.active;
    if (!a) return;

    const s = game.view.cellSize;
    const r = s * cfg.radiusFactor;

    // If you use interpolation, store pixel offset on active piece (e.g. a.yOffsetPx)
    const yOff = a.yOffsetPx ?? 0;

    const axisPx = boardToPx(game, a.axisRow, a.axisCol);
    const off = orientOffset(a.orient);
    const childPx = boardToPx(game, a.axisRow + off.dr, a.axisCol + off.dc);

    const ax = axisPx.cx;
    const ay = axisPx.cy + yOff;
    const bx = childPx.cx;
    const by = childPx.cy + yOff;

    // Draw each puyo as its own color blob (classic next pieces can be different colors)
    // If you want them to merge only when same color, keep them separate unless colors match.
    // In classic Puyo, different colors do NOT merge visually.

    // Helper: draw one circle blob
    function drawSingle(colorKey, cx, cy) {
      const pal = PALETTE[colorKey] ?? PALETTE.R;
      const bounds = { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r };
      const path = new Path2D();
      addCircle(path, cx, cy, r);
      ctx.fillStyle = makeFill(ctx, bounds, pal);
      ctx.fill(path);
      ctx.lineWidth = s * 0.07;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.stroke(path);
    }

    // If same color, render as a tiny component with a bridge (looks great)
    if (a.axis.color === a.child.color) {
      const comp = {
        color: a.axis.color,
        cells: [],
        bounds: { minR: 0, maxR: 0, minC: 0, maxC: 0 },
      };
      const path = new Path2D();
      addCircle(path, ax, ay, r);
      addCircle(path, bx, by, r);
      addTaperBridge(path, ax, ay, bx, by, r, cfg.pinch, cfg.bridgeSteps);

      const pal = PALETTE[a.axis.color] ?? PALETTE.R;
      const bounds = { x0: Math.min(ax, bx) - r, y0: Math.min(ay, by) - r, x1: Math.max(ax, bx) + r, y1: Math.max(ay, by) + r };
      ctx.fillStyle = makeFill(ctx, bounds, pal);
      ctx.fill(path);
      ctx.lineWidth = s * 0.07;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.stroke(path);
    } else {
      drawSingle(a.axis.color, ax, ay);
      drawSingle(a.child.color, bx, by);
    }
  }

  function drawHud(game) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${game.score}`, 16, 12);
  }

  function draw(game, alpha = 0) {
    clear();
    drawFrame(game);
    drawBoard(game);
    drawActivePair(game, alpha);
    drawHud(game);
  }

  return {
    ctx,
    resizeToClient,
    draw,
    config: cfg,
  };
}
```

### Usage

```js
import { createPuyoRenderer } from './puyo_renderer.js';

const canvas = document.querySelector('canvas');
const renderer = createPuyoRenderer(canvas, { pinch: 0.62, bridgeSteps: 8 });
renderer.resizeToClient();
window.addEventListener('resize', () => renderer.resizeToClient());

function draw(alpha) {
  renderer.draw(game, alpha);
}
```

---

## 21) The “surface tension” bridge formula (why it works)

The bridge in `addTaperBridge()` uses a *very simple* thickness profile:

- Let `t` go from 0 → 1 along the line from center A to center B.
- Let `w(t)` be the half-thickness of the bridge at that point.

We want:
- `w(0) = r` (full thickness near circle A)
- `w(1) = r` (full thickness near circle B)
- `w(0.5) = r * pinch` (narrowest “neck” in the middle)

A smooth, efficient function that does this is:

- `w(t) = r * (1 - (1 - pinch) * sin^2(pi * t))`

Properties:
- `sin^2(pi*t)` is 0 at the ends and 1 at the middle.
- So you get a clean “peanut” neck that looks like surface tension pulled two droplets together.

### Tuning knobs
- `pinch` in **[0.55 .. 0.80]** is a good range.
  - lower = more pinched/peanut
  - higher = more capsule-like
- `bridgeSteps` in **[6 .. 10]** looks smooth without being expensive.

### If you want an even “rounder” neck
Swap `sin^2` for `sin^4`:
- `w(t) = r * (1 - (1 - pinch) * sin^4(pi * t))`

That keeps the bridge thicker for longer near the circles and pinches more abruptly near the center.

---

## 22) Practical rendering note

In classic Puyo, **different colors do not visually fuse**—only same-color blobs join. The module follows that:
- board components are per-color
- the active pair only bridges if the two puyos share a color

If you ever want a “gooey” style where all blobs join regardless of color, build components across all colors, but fill them separately (or use clip masks).



---

## 23) Efficiency notes + “peanut” fallback bridge

### Is the current renderer efficient?
Yes—on a **6×14** board the workload is tiny.

Worst-case upper bounds (very conservative):
- Total cells: `84`
- Total possible orthogonal adjacencies: `(W-1)*H + W*(H-1) = 5*14 + 6*13 = 148`
- With `bridgeSteps = 7`, each bridge samples `8` positions.

Even if the board were one giant component, you’re still only building a few thousand line segments per frame. That’s typically fine at 60fps in modern browsers.

That said, the **main cost** in the current `addTaperBridge()` implementation is **allocations** (arrays of point objects) more than the math.

If you ever see perf hiccups:
- reduce `bridgeSteps` to **6**
- avoid object allocations (use arrays of numbers, or draw top edge directly and only store bottom)
- use numeric keys (`id = r*W+c`) instead of string keys (`"r,c"`) in Sets
- only rebuild component paths when the board changes (optional optimization)

---

## 24) Peanut bridge mode (faster, still looks “surface tension”)

If you want a cheaper connector that still gives a fluid “peanut” neck, use the **union of a few circles** along the segment.

It works because filling overlapping shapes in the same Path2D naturally merges into a single blob.

### Minimal peanut (3 circles)
- Draw the two endpoint circles (you already do this).
- Add a midpoint circle with a smaller radius.

```js
function addPeanutBridge(path, ax, ay, bx, by, r, pinch) {
  // Midpoint circle creates the neck.
  const mx = (ax + bx) * 0.5;
  const my = (ay + by) * 0.5;
  addCircle(path, mx, my, r * pinch);
}
```

This is *extremely* fast: no loops, no sin(), no arrays.

### “Smoother peanut” (5 circles)
If you want a more gradual taper:

```js
function addPeanutBridge5(path, ax, ay, bx, by, r, pinch) {
  const qx1 = ax + (bx - ax) * 0.25;
  const qy1 = ay + (by - ay) * 0.25;
  const mx  = ax + (bx - ax) * 0.50;
  const my  = ay + (by - ay) * 0.50;
  const qx2 = ax + (bx - ax) * 0.75;
  const qy2 = ay + (by - ay) * 0.75;

  // Linear radii toward the neck
  const rQ = r * (0.5 + 0.5 * pinch);
  const rM = r * pinch;

  addCircle(path, qx1, qy1, rQ);
  addCircle(path, mx,  my,  rM);
  addCircle(path, qx2, qy2, rQ);
}
```

### When peanut circles can leave a gap
Peanut-bridging relies on overlaps. A simple condition to avoid visible gaps:

- Let `d` be the center distance between neighbors (≈ `cellSize`).
- With 3 circles (end radii `r` and mid radius `r*pinch`), you want:
  - `r + r*pinch > d/2`

Given the defaults `r = 0.42*cellSize` and `pinch ≈ 0.65`:
- `r(1+pinch) = 0.42*1.65 ≈ 0.693*cellSize` which is safely `> 0.5*cellSize`.

So with the recommended ranges it will look solid.

---

## 25) How to switch the renderer to peanut mode

In the drop-in module (§20), add a config option:

```js
bridgeMode: opts.bridgeMode ?? 'taper', // 'taper' | 'peanut' | 'peanut5'
```

Then define a wrapper:

```js
function addBridge(path, ax, ay, bx, by, r) {
  if (cfg.bridgeMode === 'peanut') {
    addPeanutBridge(path, ax, ay, bx, by, r, cfg.pinch);
  } else if (cfg.bridgeMode === 'peanut5') {
    addPeanutBridge5(path, ax, ay, bx, by, r, cfg.pinch);
  } else {
    addTaperBridge(path, ax, ay, bx, by, r, cfg.pinch, cfg.bridgeSteps);
  }
}
```

Finally, replace calls:
- `addTaperBridge(...)` → `addBridge(path, ax, ay, bx, by, r)`

### Recommendation
- If you want *best visuals*: `bridgeMode: 'taper'` with `bridgeSteps: 7–9`
- If you want *best speed / simplest code*: `bridgeMode: 'peanut5'`
- If you want *absolute minimum*: `bridgeMode: 'peanut'`

