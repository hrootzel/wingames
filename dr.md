# Goal

Recreate the *core* **Dr. Mario (NES/Game Boy–style)** single‑player loop: falling **two‑segment capsules**, fixed **viruses**, clear **4+ in a line** (row/column) by color, resolve **cascades** (segments fall; viruses do not), and score primarily from **viruses destroyed**.

This spec focuses on deterministic rules you can implement in **JS + HTML5 Canvas**. It ignores versus garbage, modern assists, “Dr. Mario World” 3‑match rules, etc.

---

## 1) Playfield geometry

### Bottle grid

- **Width:** 8 columns
- **Height (visible):** 16 rows
- Suggested internal model: **18×8** (16 visible + 2 hidden spawn rows)

Recommended coordinate convention:
- Columns `0..7` left→right
- Rows `0..17` bottom→top (row 0 is the floor)
- Visible rows: `0..15`
- Hidden rows: `16..17`

### Spawn

Capsules enter near the top center.

Recommended spawn for a **horizontal** capsule:
- Left half: `(row=17, col=3)`
- Right half: `(row=17, col=4)`

If you spawn **vertical** by default instead, use:
- Bottom half: `(row=16, col=3)`
- Top half: `(row=17, col=3)`

### Loss condition (classic feel)

- If the game cannot spawn a new capsule because spawn cells are occupied → **game over**.
- (Optional cosmetic rule): the “bottle neck” is narrow visually, but you can still treat collision/spawn as the real top‑out rule.

### Win condition

- A stage is cleared when **all viruses are eliminated**.

---

## 2) Pieces and colors

### A) Capsule (the falling piece)

A capsule has **two segments** (domino):
- Segment **A** (the one on the left when horizontal, or bottom when vertical)
- Segment **B** (the other half)

### B) Colors

Classic Dr. Mario uses **3 colors**:
- **Red**, **Blue**, **Yellow**

Capsule generation (simple/authentic):
- Choose each half independently from {R,B,Y} → **9 ordered pairs**.
- (If you prefer the manual’s “6 types”, treat RB and BR as the same “type”, but in code you’ll still store both halves explicitly.)

### C) Cell types

You need only:
- **EMPTY**
- **VIRUS** (fixed, never falls)
- **SEGMENT** (a capsule half; falls in cascades)

---

## 3) Active capsule control

### Movement

While falling, the player can:
- **Left / Right**: shift the capsule if both destination cells are in-bounds and empty.
- **Down**: soft drop (increase fall speed).
- **Rotate CW / CCW**: rotate within a 2×2 box (see below).

### Rotation model (easy + feels right)

Treat the active capsule as always occupying two cells and having an orientation:
- `0 = horizontal (A left, B right)`
- `1 = vertical (A bottom, B top)`

Rotation changes orientation and relocates the “other” half around a chosen anchor.

**Practical approach:** pick **segment A** as the anchor.

- If horizontal → vertical: B moves to **above** A.
- If vertical → horizontal: B moves to **right** of A.

If the target cell is blocked, apply a tiny “kick”:
- Try shifting the capsule **left by 1** (if in bounds and empty) and re-test.
- Else try shifting **right by 1**.
- Else rotation fails.

This captures the feel that rotations “wiggle” into place at walls/blocks without implementing every platform’s exact quirks.

### Locking

- If the capsule cannot move down, it **locks** into the board.
- Optional polish: **lock delay** (e.g. 250–500 ms) so last-second slides/rotations are possible.

---

## 4) Match / clear rules (the core)

### Connectivity and matching

- Matching is **by color**.
- A clear happens when there are **4 or more** of the same color in a **straight line**:
  - horizontal row OR vertical column
- The line can include any mix of:
  - VIRUS cells
  - SEGMENT cells

### What disappears

When a match exists:
- **All cells in every qualifying line** disappear simultaneously.
- This can remove viruses and/or segments.

Important nuance:
- A segment can be part of **both** a horizontal and vertical line; it disappears once.

### Minimal line-finder algorithm

1. Scan each row for runs of same-color length ≥ 4.
2. Scan each column for runs of same-color length ≥ 4.
3. Union all matched cells into a `clearSet`.

---

## 5) Gravity + cascades

After clearing, **segments fall**; **viruses do not**.

### Segment linking rule

Each capsule half knows if it’s still connected to its partner.
- If a segment’s partner is missing (because cleared), it becomes a **single**.

### How linked halves fall

When applying gravity:

- **Single segment**: falls straight down if the cell below is empty.

- **Vertical linked pair** (A bottom, B top):
  - If the cell below the **bottom** segment is empty, **both fall together**.
  - Otherwise they stay.

- **Horizontal linked pair** (A left, B right):
  - If both cells below are empty → the pair falls together.
  - If only one side can fall → the pair **splits**:
    - break the link
    - the unsupported half falls (on subsequent gravity steps)

### Settle strategy

Use a repeated “tick” settle until stable:
- Iterate rows bottom→top.
- Drop any movable singles, then any movable pairs.
- Repeat passes until nothing moved.

(For a tiny 8×16 field, this is plenty fast.)

---

## 6) Resolve loop (after every lock)

After the active capsule locks:

1. **Find matches** (all 4+ lines) → if none, end turn.
2. If matches exist:
   - count viruses removed in this step (for scoring)
   - clear all matched cells
3. **Cascade**: apply gravity until stable
4. Go back to step 1

This naturally produces classic “chain reactions”.

---

## 7) Scoring (NES-style single player)

In classic Dr. Mario, you score **only when viruses are destroyed**.

For each **resolve step** (each time you clear lines):
1. Let `V = number of VIRUS cells cleared in that step`.
2. Points depend on:
   - SPEED setting (LOW / MED / HI)
   - `V` (capped at 6)

### Score table

If `V > 6`, treat it as `6`.

| Viruses destroyed at once | LOW | MED | HI |
|---:|---:|---:|---:|
| 1 | 100 | 200 | 300 |
| 2 | 200 | 400 | 600 |
| 3 | 400 | 800 | 1200 |
| 4 | 800 | 1600 | 2400 |
| 5 | 1600 | 3200 | 4800 |
| 6 | 3200 | 6400 | 9600 |

### Practical scoring function

```js
const Speed = { LOW:'LOW', MED:'MED', HI:'HI' };

const VIRUS_POINTS = {
  LOW: [0,100,200,400,800,1600,3200],
  MED: [0,200,400,800,1600,3200,6400],
  HI:  [0,300,600,1200,2400,4800,9600],
};

function scoreViruses(speed, virusCount) {
  const v = Math.max(0, Math.min(6, virusCount|0));
  return VIRUS_POINTS[speed][v];
}
```

### Notes

- Clearing only capsule segments (no viruses) gives **0 points**.
- Total score is the sum of `scoreViruses()` across all resolve steps in the stage.

---

## 8) Virus count + stage setup

### Virus level → number of viruses

A classic simple rule:
- `virusCount = (virusLevel + 1) * 4`
- virusLevel range: `0..20` (max 84 viruses)

You can implement any mapping you want, but that one feels very “NES”.

### Virus placement (reasonable clone generator)

Constraints that help the stage feel fair:
- Place viruses only in rows `0..(maxRow)` (lower portion)
- Avoid creating a pre-existing 4‑line at start
- Optional: avoid placing same-color viruses too close (reduces trivial clears)

Simple generator:

```js
function generateViruses(board, rng, virusCount) {
  // 1) Decide an allowed max spawn row (difficulty knob)
  const maxRow = Math.min(13, 6 + Math.floor(virusCount / 6));

  // 2) Keep trying random cells until filled
  let placed = 0;
  let guard = 0;

  while (placed < virusCount && guard++ < 20000) {
    const r = rng.int(maxRow + 1);
    const c = rng.int(board.w);
    if (!board.isEmpty(r,c)) continue;

    const color = rollColor3(rng);
    board.set(r,c,{ kind:Kind.VIRUS, color });

    // If you accidentally created a 4-line, undo and retry
    if (hasAnyMatch(board)) {
      board.set(r,c, makeEmptyCell());
      continue;
    }

    placed++;
  }
}
```

---

## 9) Game cycle + timers (JS/HTML)

Use:
- `requestAnimationFrame` for drawing
- a fixed timestep update (or an accumulator) for deterministic rules

### State machine

- **SPAWN** → create active capsule (and check spawn collision)
- **FALLING** → accept input; gravity on active capsule
- **LOCK_DELAY** (optional)
- **RESOLVE** → match/clear + cascade loop
- **STAGE_CLEAR** → celebrate, then generate next stage
- **GAME_OVER**

### Timers you want

- `gravityIntervalMs` (depends on speed + difficulty)
- `softDropMultiplier` (e.g. 8× faster)
- `lockDelayMs` (optional)

For RESOLVE animations (optional but feels great):
- `clearAnimMs` (flash/fade)
- `cascadeStepMs` (if you want visible falling)

A simple staged resolver:
- `FIND_MATCHES` → `CLEAR_ANIM` → `CLEAR` → `CASCADE` → repeat

---

## 10) Object model (JS-friendly)

### A) Constants / enums

```js
const W = 8;
const H = 18;           // 16 visible + 2 hidden
const VISIBLE_H = 16;

const Kind = {
  EMPTY: 'EMPTY',
  VIRUS: 'VIRUS',
  SEGMENT: 'SEGMENT',
};

const Color = { R:'R', B:'B', Y:'Y' };

// For capsule linkage (which neighbor is my partner?)
const Link = { L:'L', R:'R', U:'U', D:'D', NONE:null };

const GameState = {
  SPAWN: 'SPAWN',
  FALLING: 'FALLING',
  LOCK_DELAY: 'LOCK_DELAY',
  RESOLVE: 'RESOLVE',
  STAGE_CLEAR: 'STAGE_CLEAR',
  GAME_OVER: 'GAME_OVER',
  PAUSED: 'PAUSED',
};

const ResolvePhase = {
  FIND_MATCHES: 'FIND_MATCHES',
  CLEAR_ANIM: 'CLEAR_ANIM',
  CLEAR: 'CLEAR',
  CASCADE: 'CASCADE',
  DONE: 'DONE',
};
```

### B) Cells + board

```js
function makeEmptyCell() {
  return { kind: Kind.EMPTY, color: null, pillId: null, link: null };
}

function makeBoard() {
  const cells = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => makeEmptyCell())
  );

  return {
    w: W, h: H, cells,
    inBounds(r,c){ return r>=0 && r<H && c>=0 && c<W; },
    get(r,c){ return this.inBounds(r,c) ? this.cells[r][c] : null; },
    set(r,c,v){ this.cells[r][c] = v; },
    isEmpty(r,c){ const x=this.get(r,c); return x && x.kind===Kind.EMPTY; },
  };
}
```

### C) Active capsule

```js
function makeActiveCapsule(spec) {
  return {
    // Anchor at segment A
    aRow: 17, aCol: 3,
    orient: 0, // 0 horizontal (A left), 1 vertical (A bottom)

    aColor: spec.aColor,
    bColor: spec.bColor,

    yOffsetPx: 0, // optional render interpolation

    cells() {
      const A = { r: this.aRow, c: this.aCol, color: this.aColor, which:'A' };
      const B = (this.orient === 0)
        ? { r: this.aRow, c: this.aCol + 1, color: this.bColor, which:'B' }
        : { r: this.aRow + 1, c: this.aCol, color: this.bColor, which:'B' };
      return [A, B];
    },
  };
}
```

### D) RNG helpers

```js
function rollColor3(rng){
  return [Color.R, Color.B, Color.Y][rng.int(3)];
}

function rollCapsuleSpec(rng){
  return { aColor: rollColor3(rng), bColor: rollColor3(rng) };
}
```

### E) Locking into the board

When the capsule locks, write two SEGMENT cells with a shared `pillId`:

```js
function lockCapsule(board, active, nextPillId) {
  const [A,B] = active.cells();
  const id = nextPillId;

  // Segment A
  board.set(A.r, A.c, {
    kind: Kind.SEGMENT,
    color: A.color,
    pillId: id,
    link: (active.orient === 0) ? Link.R : Link.U,
  });

  // Segment B
  board.set(B.r, B.c, {
    kind: Kind.SEGMENT,
    color: B.color,
    pillId: id,
    link: (active.orient === 0) ? Link.L : Link.D,
  });
}
```

---

## 11) Match detection (reference)

Return a `Set` of cells to clear.

```js
function key(r,c){ return r*100 + c; } // fast numeric key

function findMatches(board) {
  const clear = new Set();

  // Horizontal runs
  for (let r=0; r<VISIBLE_H; r++) {
    let c=0;
    while (c < board.w) {
      const cell = board.get(r,c);
      const color = cell?.color;
      if (!color || cell.kind===Kind.EMPTY) { c++; continue; }

      let c2 = c;
      while (c2 < board.w) {
        const x = board.get(r,c2);
        if (!x || x.kind===Kind.EMPTY || x.color !== color) break;
        c2++;
      }

      const len = c2 - c;
      if (len >= 4) for (let k=c; k<c2; k++) clear.add(key(r,k));
      c = c2;
    }
  }

  // Vertical runs
  for (let c=0; c<board.w; c++) {
    let r=0;
    while (r < VISIBLE_H) {
      const cell = board.get(r,c);
      const color = cell?.color;
      if (!color || cell.kind===Kind.EMPTY) { r++; continue; }

      let r2 = r;
      while (r2 < VISIBLE_H) {
        const x = board.get(r2,c);
        if (!x || x.kind===Kind.EMPTY || x.color !== color) break;
        r2++;
      }

      const len = r2 - r;
      if (len >= 4) for (let k=r; k<r2; k++) clear.add(key(k,c));
      r = r2;
    }
  }

  return clear;
}
```

---

## 12) Clearing + link maintenance

When you clear a segment, you must update its partner (if present) to become a single:

```js
function breakPartnerLink(board, r, c, cell) {
  if (cell.kind !== Kind.SEGMENT || !cell.link) return;

  const dir = cell.link;
  const dr = (dir===Link.U) ? +1 : (dir===Link.D) ? -1 : 0;
  const dc = (dir===Link.R) ? +1 : (dir===Link.L) ? -1 : 0;
  const pr = r + dr, pc = c + dc;

  const p = board.get(pr,pc);
  if (!p || p.kind !== Kind.SEGMENT || p.pillId !== cell.pillId) return;

  // Partner becomes single
  p.link = null;
  board.set(pr,pc,p);
}

function clearCells(board, clearSet) {
  // First pass: break links
  for (const k of clearSet) {
    const r = Math.floor(k / 100);
    const c = k % 100;
    const cell = board.get(r,c);
    if (!cell || cell.kind===Kind.EMPTY) continue;
    breakPartnerLink(board, r, c, cell);
  }

  // Second pass: actually clear
  for (const k of clearSet) {
    const r = Math.floor(k / 100);
    const c = k % 100;
    board.set(r,c, makeEmptyCell());
  }
}
```

---

## 13) Gravity settle (reference)

A simple settle loop:

```js
function canFallSingle(board, r, c) {
  return r > 0 && board.isEmpty(r-1, c);
}

function settleOnce(board) {
  let moved = false;

  // Work bottom→top so you don't double-move
  for (let r=1; r<VISIBLE_H; r++) {
    for (let c=0; c<board.w; c++) {
      const cell = board.get(r,c);
      if (!cell || cell.kind !== Kind.SEGMENT) continue;

      // Skip if this is the "right" half of a horizontal pair or the "top" half of a vertical pair;
      // let the "leader" handle the pair movement.
      if (cell.link === Link.L || cell.link === Link.D) continue;

      // SINGLE
      if (!cell.link) {
        if (canFallSingle(board, r, c)) {
          board.set(r-1, c, cell);
          board.set(r, c, makeEmptyCell());
          moved = true;
        }
        continue;
      }

      // HORIZONTAL pair leader (link=R)
      if (cell.link === Link.R) {
        const other = board.get(r, c+1);
        if (!other || other.kind !== Kind.SEGMENT || other.pillId !== cell.pillId) {
          // Link is inconsistent; treat as single
          cell.link = null;
          board.set(r,c,cell);
          continue;
        }

        const leftCan = (r>0 && board.isEmpty(r-1,c));
        const rightCan = (r>0 && board.isEmpty(r-1,c+1));

        if (leftCan && rightCan) {
          board.set(r-1,c, cell);
          board.set(r-1,c+1, other);
          board.set(r,c, makeEmptyCell());
          board.set(r,c+1, makeEmptyCell());
          moved = true;
        } else if (leftCan !== rightCan) {
          // Split
          cell.link = null;
          other.link = null;
          board.set(r,c,cell);
          board.set(r,c+1,other);
        }
        continue;
      }

      // VERTICAL pair leader (link=U)
      if (cell.link === Link.U) {
        const other = board.get(r+1, c);
        if (!other || other.kind !== Kind.SEGMENT || other.pillId !== cell.pillId) {
          cell.link = null;
          board.set(r,c,cell);
          continue;
        }

        if (r>0 && board.isEmpty(r-1,c)) {
          board.set(r-1,c, cell);
          board.set(r,c, other);
          board.set(r+1,c, makeEmptyCell());
          moved = true;
        }
        continue;
      }
    }
  }

  return moved;
}

function settleAll(board) {
  while (settleOnce(board)) {}
}
```

---

## 14) Rendering hints (Canvas, no sprites)

Goal: a clean Dr. Mario look using pure vector shapes.

### Coordinate mapping

Choose `cellSize` (e.g. 32–40px).

- `x = boardLeft + col * cellSize`
- `y = boardTop + (VISIBLE_H - 1 - row) * cellSize`

### Drawing styles

#### A) Viruses (simple)

- Draw a **circle** slightly smaller than the cell (`r = 0.40*cellSize`).
- Add a subtle highlight (radial gradient).
- Optional: add 3–4 tiny darker “spots” to make it feel distinct from capsules.

#### B) Capsule segments (tile-like but rounded)

A capsule segment is like a rounded square with **one rounded end** and **one flat end**:
- If it’s **single**: rounded on all sides (rounded rect).
- If it’s linked:
  - Horizontal pair:
    - left half: rounded on **left**, flat on right
    - right half: rounded on **right**, flat on left
  - Vertical pair:
    - bottom half: rounded on **bottom**, flat on top
    - top half: rounded on **top**, flat on bottom

A very practical way to do this:
- Build a `Path2D` per segment as:
  - start with a rounded rect
  - then “flatten” the linked side by overlaying a rectangle (or by constructing the path with one side straight)

#### C) Connection seam (optional)

To get the classic “two halves joined” feel:
- Draw a thin darker line at the seam between linked halves.
- Or draw a small inset rectangle/line.

### Drop-in drawing approach

Per frame:
1. Draw background + bottle frame
2. Draw fixed cells (viruses + settled segments)
3. Draw active capsule (two segments) at interpolated y
4. Draw UI (score, virus count, level)

Because the grid is tiny, you can redraw everything each frame.

---

## 15) Drop-in renderer module (Canvas, no sprites)

This is intentionally minimal; it draws clean shapes and reads from your game state.

```js
// drmario_renderer.js

export function createDrMarioRenderer(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  const cfg = {
    bg: opts.bg ?? '#0f1220',
    frame: opts.frame ?? 'rgba(255,255,255,0.20)',
    frameFill: opts.frameFill ?? 'rgba(255,255,255,0.06)',
    cellPad: opts.cellPad ?? 0.08, // whitespace inside each cell
  };

  const PAL = {
    R: { base:'#e44b4b', light:'#ffb0b0', dark:'#8a1f1f' },
    B: { base:'#3f7bff', light:'#b7d1ff', dark:'#1d3a9e' },
    Y: { base:'#f1c232', light:'#fff1b0', dark:'#9c6f12' },
  };

  function resizeToClient() {
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear() {
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  function cellToPx(game, row, col) {
    const s = game.view.cellSize;
    const x = game.view.boardLeft + col * s;
    const y = game.view.boardTop + (VISIBLE_H - 1 - row) * s;
    return { x, y, s, cx:x+s/2, cy:y+s/2 };
  }

  function makeRadial(ctx, x0, y0, w, h, pal) {
    const gx = x0 + w * 0.35;
    const gy = y0 + h * 0.30;
    const r0 = Math.min(w, h) * 0.05;
    const r1 = Math.max(w, h) * 0.85;
    const g = ctx.createRadialGradient(gx, gy, r0, gx, gy, r1);
    g.addColorStop(0.0, pal.light);
    g.addColorStop(0.55, pal.base);
    g.addColorStop(1.0, pal.dark);
    return g;
  }

  function roundRectPath(x, y, w, h, r) {
    const p = new Path2D();
    const rr = Math.min(r, w/2, h/2);
    p.moveTo(x+rr, y);
    p.arcTo(x+w, y, x+w, y+h, rr);
    p.arcTo(x+w, y+h, x, y+h, rr);
    p.arcTo(x, y+h, x, y, rr);
    p.arcTo(x, y, x+w, y, rr);
    p.closePath();
    return p;
  }

  function drawVirusSimple(game, row, col, colorKey) {
    const pal = PAL[colorKey];
    const { x, y, s, cx, cy } = cellToPx(game, row, col);
    const pad = s * cfg.cellPad;
    const r = (s - 2*pad) * 0.45;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = makeRadial(ctx, cx-r, cy-r, 2*r, 2*r, pal);
    ctx.fill();

    ctx.lineWidth = Math.max(1, s*0.06);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();

    // Optional spots
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = pal.dark;
    for (let i=0;i<3;i++) {
      const a = (i*2.1);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a)*r*0.35, cy + Math.sin(a)*r*0.25, r*0.12, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }


  // Improved virus drawing function
  function drawVirus(game, row, col, colorKey) {
    const pal = PAL[colorKey];
    const { s, cx, cy } = cellToPx(game, row, col);

    const pad = s * cfg.cellPad;
    const r = (s - 2 * pad) * 0.45;

    // --- Body ---
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = makeRadial(ctx, cx - r, cy - r, 2 * r, 2 * r, pal);
    ctx.fill();

    // --- Outer outline ---
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();

    // --- Inner membrane ring (subtle bright ring) ---
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeStyle = pal.light;
    ctx.stroke();
    ctx.restore();

    // --- Highlight crescent + specular dot (clipped to circle) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Crescent sweep
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(
      cx - r * 0.28,
      cy - r * 0.38,
      r * 0.70,
      r * 0.48,
      -0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Tiny specular dot
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(cx - r * 0.38, cy - r * 0.48, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // --- Optional: texture spots so viruses read differently from capsule segments ---
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pal.dark;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(a) * r * 0.35,
        cy + Math.sin(a) * r * 0.25,
        r * 0.12,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // Segment path: rounded rect, then flatten the linked side.
  function segmentPath(x, y, s, link) {
    const pad = s * cfg.cellPad;
    const xx = x + pad;
    const yy = y + pad;
    const ww = s - 2*pad;
    const hh = s - 2*pad;
    const rr = ww * 0.28;

    const p = roundRectPath(xx, yy, ww, hh, rr);

    // Flatten the linked side by adding a rectangle that “cuts” the curvature visually.
    // We don't actually subtract; instead we'll draw the seam on top.
    // The rounded rect alone already looks fine; the seam line sells the connection.
    return p;
  }

  function drawSegment(game, row, col, cell) {
    const pal = PAL[cell.color];
    const { x, y, s } = cellToPx(game, row, col);

    const path = segmentPath(x, y, s, cell.link);
    ctx.fillStyle = makeRadial(ctx, x, y, s, s, pal);
    ctx.fill(path);

    ctx.lineWidth = Math.max(1, s*0.06);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke(path);

    // Seam hint
    if (cell.link) {
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = Math.max(1, s*0.04);
      ctx.beginPath();
      const pad = s * cfg.cellPad;
      const xx = x + pad;
      const yy = y + pad;
      const ww = s - 2*pad;
      const hh = s - 2*pad;

      if (cell.link === Link.R) {
        ctx.moveTo(xx+ww, yy);
        ctx.lineTo(xx+ww, yy+hh);
      } else if (cell.link === Link.L) {
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy+hh);
      } else if (cell.link === Link.U) {
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx+ww, yy);
      } else if (cell.link === Link.D) {
        ctx.moveTo(xx, yy+hh);
        ctx.lineTo(xx+ww, yy+hh);
      }
      ctx.stroke();
    }
  }

  function drawFrame(game) {
    const s = game.view.cellSize;
    const x0 = game.view.boardLeft;
    const y0 = game.view.boardTop;
    const wPx = W * s;
    const hPx = VISIBLE_H * s;

    ctx.fillStyle = cfg.frameFill;
    ctx.fillRect(x0-6, y0-6, wPx+12, hPx+12);

    ctx.strokeStyle = cfg.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0-6, y0-6, wPx+12, hPx+12);
  }

  function drawBoard(game) {
    for (let r=0; r<VISIBLE_H; r++) {
      for (let c=0; c<W; c++) {
        const cell = game.board.get(r,c);
        if (!cell || cell.kind===Kind.EMPTY) continue;
        if (cell.kind===Kind.VIRUS) drawVirus(game, r, c, cell.color);
        else drawSegment(game, r, c, cell);
      }
    }
  }

  function drawActive(game) {
    const a = game.active;
    if (!a) return;

    const yOff = a.yOffsetPx ?? 0;
    const parts = a.cells();

    for (const p of parts) {
      const cell = { kind:Kind.SEGMENT, color:p.color, link:null };
      const px = cellToPx(game, p.r, p.c);

      ctx.save();
      ctx.translate(0, yOff);
      drawSegment(game, p.r, p.c, cell);
      ctx.restore();
    }
  }

  function drawHud(game) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${game.score}`, 16, 12);
    ctx.fillText(`Viruses: ${game.virusesRemaining}`, 16, 32);
    ctx.fillText(`Level: ${game.virusLevel}`, 16, 52);
  }

  function draw(game) {
    clear();
    drawFrame(game);
    drawBoard(game);
    drawActive(game);
    drawHud(game);
  }

  return { ctx, resizeToClient, draw, config: cfg };
}
```

---

## 16) Implementation order (fast path)

1. Board + virus generation + spawn capsule
2. Active capsule movement + collision + lock
3. Line match detection (4+)
4. Clear + link maintenance
5. Gravity settle (singles + pairs)
6. Resolve loop until stable
7. Scoring (viruses only)
8. Stage clear + next stage
9. Lock delay + animations + UI polish

