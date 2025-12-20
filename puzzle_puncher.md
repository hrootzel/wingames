# Goal

Recreate the *core* “falling pairs + build rectangles + detonate with breakers” puzzle loop inspired by **Super Puzzle Fighter II Turbo**.

This spec intentionally ignores the fighting/character presentation and focuses on the puzzle field rules you need to implement a faithful single‑player mode.

---

## 1) Playfield geometry

### Grid

- **Width:** 6 columns.
- **Height:** treat as **12 visible rows**, plus a **drop-alley overflow row**.
  - Implementation-friendly: model the board as **13 rows × 6 columns**.

### Drop Alley (spawn lane)

- **Spawn column:** **Column 4** (1-indexed), i.e. **index 3** in 0-based.
- **Loss condition:** you lose when you cannot spawn a new pair because the **drop‑alley top** is blocked (i.e., column 4 reaches the overflow row).
  - In practice: if **(row=12, col=3)** is occupied when a new piece would appear → game over.

### Coordinate convention (recommended)

- Columns: `0..5` left→right.
- Rows: `0..12` bottom→top (row 0 is the “floor”).
- Visible play area: rows `0..11`. Row `12` is the overflow/spawn row.

---

## 2) Piece model (the falling “pair”)

Each turn you control a **2‑cell piece** consisting of two “gems” linked together.

### Spawn

- Spawn centered in the **drop alley**.
- Default orientation: **vertical** (top cell above bottom cell).
  - Suggested spawn cells: bottom at `(row=11, col=3)` and top at `(row=12, col=3)`.
  - If either cell is occupied → game over.

### Movement

- Horizontal movement: left/right if both cells remain in bounds and do not collide.
- Rotation: clockwise / counter‑clockwise about the bottom cell (or about a pivot you choose), as long as the rotated cells are valid.
- Soft drop: accelerate downward.
- Lock: when the piece cannot move down further, it becomes part of the board.

*(Exact rotation kick behavior varies by version; for a first implementation, do simple “rotate if valid, else ignore.”)*

---

## 3) Gem types

Your board cells contain one of these:

### A) Normal Gems

- **Colors:** 4 colors (commonly **Red, Green, Blue, Yellow**).
- Normal gems do **not** clear by matching alone.

### B) Crash Gems (a.k.a. “bombs”)

- Same 4 colors.
- A crash gem **detonates** when it becomes **orthogonally adjacent** (up/down/left/right) to **any gem of the same color** (normal or power).
- When detonated it destroys itself and triggers a color-clear (see §5).

### C) Diamond / Rainbow Gem (optional but highly characteristic)

- A special gem that appears on a fixed cadence (classic behavior: **every 25th piece**).
- When it lands **on top of** another gem, it “chooses” that gem’s color and clears that color across the board (see §5).
- If you drop it to the **floor without touching a gem**, it yields a **Tech Bonus** (points only) and clears nothing.

### D) Counter Gems (optional; versus mechanic)

- Numbered/grey gems that count down each placed piece and eventually turn into normal gems.
- If you’re building a pure single‑player endless mode, you can omit these entirely.

---

## 4) Power Gems (how they’re constructed)

Power gems are the “big blocks” you build for big clears.

### When a power gem forms

- A **power gem forms when you have a filled rectangle** of **same‑colored normal gems** of size **at least 2×2**.
  - Examples that qualify: 2×2, 3×2, 2×4, 5×3, …
  - Examples that do *not* qualify: 3-in-a-row, L-shapes, diagonal shapes, hollow rectangles.

### Representation

- Internally, treat a power gem as the **set of its occupied cells** (still on the grid), but mark them as **POWER** for scoring/attack and for rendering (no internal grid lines).

### Growing/extending power gems

Power gems can grow by completing larger rectangles that include them.

A practical rule for implementation:

1. After each settle (and after each gravity step during chains), scan the board.
2. For each color, detect any axis‑aligned rectangles with **width≥2 and height≥2** that are **fully filled** with that color.
3. Mark all cells belonging to any qualifying rectangle as **POWER** (for that color).
4. If two POWER regions of the same color touch orthogonally, treat them as one **power group** for scoring/clearing purposes.

This produces the intended behavior:

- You can extend a 2×2 into a 3×2 by adding a full row.
- You can “bridge” power regions by filling gaps to create new rectangles.
- Large power constructions are rewarded.

---

## 5) Clearing rules (the core explosion logic)

### A) Crash gem detonation (color flood clear)

When a crash gem detonates (because it is orthogonally adjacent to the same color):

1. Identify the detonation color `C`.
2. Compute the **orthogonally connected component** of color `C` that touches the crash gem (treat POWER cells as color `C` cells).
3. Remove:
   - the crash gem itself
   - **all cells** in that connected component
4. Award points for this “attack event.”

Notes:

- If multiple crash gems of the same color are adjacent, they can effectively detonate together (simplest approach: resolve in a loop until no detonations remain).

### B) Diamond/Rainbow clear

When a diamond lands on top of a gem:

1. Let `C` be the color of the gem directly beneath the diamond.
2. Remove **all board cells** that are color `C` (normal gems, crash gems, and POWER cells).
3. Remove the diamond itself.
4. Award points (often with a reduced multiplier versus a crash clear; optional).

### C) All Clear

If after resolving a chain the board contains **no gems at all**, trigger an **All Clear** bonus.

---

## 6) Gravity and chain reactions

This is the main state machine you’ll implement.

### Resolution loop (recommended)

After a piece locks:

1. **Gravity:** let every gem fall straight down until supported.
2. **Power formation pass:** update POWER markings/groups.
3. **Trigger detection:**
   - Any crash gems currently adjacent to same color?
   - Any diamond that just landed on a gem?
4. If triggers exist:
   - Resolve the triggers (one “attack event”).
   - Award score for that event.
   - Increase `chainIndex`.
   - Go back to step 1.
5. If no triggers exist:
   - End the turn. Spawn next piece.

### Chain definition

- A “chain” is a sequence of 2+ attack events caused by the same locked piece via gravity.
- Track `chainIndex = 1,2,3,…` per turn.

---

## 7) Scoring (single‑player friendly)

Different releases vary, and the original game’s *versus* math is primarily about “damage” (how many counter gems you send). For a single‑player implementation, use a consistent scoring model that:

- rewards destroying more cells,
- rewards destroying POWER cells more than normal cells,
- rewards chains strongly,
- includes Tech Bonus and All Clear bonuses.

### Recommended scoring model (simple + feels right)

Define constants (tune later):

- `P_NORMAL = 10` points per normal cell destroyed
- `P_POWER = 25` points per POWER cell destroyed
- `CHAIN_MULT(chainIndex) = 1 + 0.5*(chainIndex-1)` (linear boost)
- `TECH_BONUS = 10000`
- `ALL_CLEAR_BONUS = 5000`

For each attack event in a chain:

- `cellsDestroyed = normalCount + powerCount + crashCount` (crash gems count as normal cells)
- `base = P_NORMAL*normalCount + P_POWER*powerCount + P_NORMAL*crashCount`
- `eventScore = round(base * CHAIN_MULT(chainIndex))`
- Add `eventScore` to total.

Tech Bonus:

- If diamond hits the floor without selecting a color → `+TECH_BONUS`.

All Clear:

- If board empty after resolution loop → `+ALL_CLEAR_BONUS`.

### Optional: make diamond clears slightly weaker

If you want the “diamond is defensive” feel:

- Multiply `eventScore` by `0.8` when the event was a diamond clear.

---

## 8) Minimal “single player” modes you can implement

### A) Endless score attack (recommended)

- Ignore counter gems entirely.
- Feed random pairs of normal/crash gems; inject a diamond every 25 pieces.
- Game ends on drop-alley overflow.

### B) Timed score attack

- Same as endless, but with a timer and/or increasing fall speed.

---

## 9) Implementation notes (data structures)

### Cell state

Per grid cell store:

- `kind`: EMPTY | NORMAL | CRASH | DIAMOND | (COUNTER)
- `color`: R/G/B/Y (or null)
- `isPower`: bool (or `powerGroupId`)

### Power detection

If you want an efficient first pass:

- After gravity, for each color, run rectangle detection by scanning possible top-left corners and expanding, or by using histogram-of-consecutive-cells techniques.
- For a simpler (still fine) approach on a 13×6 board: brute-force all rectangles (width 2..6, height 2..13) and mark those fully filled.

### Trigger detection

- Crash trigger: for each CRASH cell, check 4-neighbors for same color.
- Diamond trigger: only needs to be checked when a diamond locks (look at the cell beneath).

---

## 10) Canonical constants summary

- Colors: **4** (R,G,B,Y)
- Board: **6 columns**, **12 visible rows**, plus a **drop-alley overflow row**
- Spawn lane: **Column 4**
- Power gem threshold: **2×2 filled rectangle**
- Diamond cadence: **every 25 pieces** (classic)
- Tech Bonus: **10,000 points** (classic)

---

## 11) What to ignore (for core single-player)

- Character-specific counter-gem color patterns and damage multipliers
- Versus garbage/counter-gem delivery timing
- Super-move meters, character animations, etc.

If you later add versus, you’ll reuse the same clearing + chain engine; you’ll just translate each attack event into “counter gem count” and schedule drops on the opponent.



---

## 12) Rendering hints (HTML5 Canvas, no sprites)

You can get a very “Puzzle Fighter-ish” look using only vector drawing, gradients, and a tiny bit of text/overlay.

### Coordinate mapping

Pick a `cellSize` (e.g. 32–48 px). Convert board coords → pixels:

- `xPx = boardLeft + col * cellSize`
- `yPx = boardTop + (visibleRows-1-row) * cellSize`\
  *(because row 0 is bottom, but canvas y grows downward)*

Draw order each frame (simple):

1. Clear background / draw playfield panel
2. Draw fixed gems on the board
3. Draw active falling pair (interpolated y)
4. Draw UI (score, next piece, etc.)

### A simple color palette

Define a base + highlight + shadow per gem color. Example structure:

- `base`: main fill
- `light`: for top-left highlight
- `dark`: for bottom-right shade
- `stroke`: outline

You can derive `light/dark` by mixing with white/black (HSL or RGB lerp). If you don’t want color math, hard-code 4 palettes.

---

## 13) How to draw gems (vector recipes)

All recipes below assume you have:

- `ctx` (CanvasRenderingContext2D)
- `x,y` top-left pixel of the cell
- `s = cellSize`
- `r = s * 0.18` corner radius (tweak)

### A) Normal gem (glossy rounded-square)

Goal: looks like a “jewel” even without a sprite.

**Recipe**

1. Draw a rounded rect filled with a **diagonal gradient** (light → base → dark).
2. Add an inner bevel (a slightly inset rounded rect stroke).
3. Add a glossy highlight “cap” near the top-left.
4. Add a tiny specular dot.

**Implementation notes (no heavy math)**

- Use `ctx.createLinearGradient(x, y, x+s, y+s)` for the main fill.
- For the gloss, draw a semi-transparent ellipse or arc using `globalAlpha`.

Visual knobs:

- Increase `globalAlpha` of gloss for a more “plastic” look.
- Increase contrast between `light` and `dark` for a more “gem” look.

### B) Power gem (connected big block)

Power gems look best if they feel like **one slab** rather than tiled squares.

You have two good options:

**Option 1 (easiest): per-cell draw, but hide internal borders**

- Still draw each cell as a rounded rect.
- Only draw edge strokes on **outer edges**:
  - For each cell, check its 4 neighbors.
  - If a neighbor is in the same power group, do *not* draw that side’s border.
- Add one subtle “global highlight” across the group by drawing a translucent gradient clipped to the group bounds.

**Option 2 (cleanest): draw each power group as a merged shape**

- For each power group, compute its set of occupied cells.
- Build a path consisting of the union of rectangles.
  - Simplest union rendering trick: draw a filled rect for each cell to an offscreen mask, then stroke/shine once on the combined silhouette.
- Then render:
  1. Fill group silhouette with a single gradient
  2. Stroke the silhouette
  3. Add one gloss sweep across the group

*(Option 1 is totally fine and much faster to implement.)*

### C) Crash gem (breaker/bomb)

Crash gems should read as “special” at a glance.

Start with a normal gem rendering, then overlay an icon:

- A white **X** or starburst
- A small “spark” circle
- Or a centered letter (e.g. “C”) in bold

**Overlay hints**

- Use `ctx.lineWidth = s * 0.10` with rounded caps.
- Draw 2 diagonal lines (X) and maybe a small ring around it.
- Use `ctx.globalAlpha = 0.9` and a subtle shadow for readability.

### D) Diamond / Rainbow gem

This should look distinct from the 4 colors.

**Recipe**

1. Draw a **diamond** (rhombus) centered in the cell.
2. Fill with a light-to-dark neutral gradient.
3. Stroke with a rainbow gradient (or multi-stop gradient).
4. Add a specular highlight.

**Rainbow stroke trick**

- Use a linear gradient across the diamond outline with multiple color stops.
- Keep stroke width relatively thin (e.g. `s*0.08`) so it doesn’t look like a blob.

### E) Counter gem (optional)

If you add counters later:

- Draw a matte grey rounded square
- Add a “metal” gradient (top light → bottom darker)
- Render the countdown number centered:
  - Use `ctx.font = (s*0.5) + 'px sans-serif'`
  - `textAlign='center'`, `textBaseline='middle'`
  - White text with a thin dark outline

---

## 14) Suggested helper functions (structure)

Even without sprites, structure your renderer like you *do* have sprites:

- `drawBoard(ctx, board)`
- `drawCell(ctx, cell, col, row)`
- `drawGemNormal(ctx, x, y, s, palette)`
- `drawGemPowerCell(ctx, x, y, s, palette, neighborsMask)`
- `drawGemCrashOverlay(ctx, x, y, s)`
- `drawGemDiamond(ctx, x, y, s)`

Where `neighborsMask` encodes which sides are “external” so you can draw borders only on the outside:

- bit 0: top, bit 1: right, bit 2: bottom, bit 3: left

---

## 15) Performance + polish tips

### Cache “generated sprites” (still no bitmap art)

You can generate each gem style once into a small offscreen canvas and then `drawImage` it repeatedly:

- Normal gem: 4 colors
- Crash gem: 4 colors
- Diamond: 1
- Counter: maybe a few numbers

This gives you:

- big perf boost
- consistent visuals

### Simple animations that add a lot

- **Falling interpolation:** render the active piece at `y = baseY + fallProgress` rather than snapping cell-by-cell.
- **Lock bounce:** 2–3 frames where the piece slightly squashes (scaleY < 1) then settles.
- **Clear pop:** fade alpha to 0 while scaling up slightly.
- **Chain flash:** briefly overlay a white translucent rect over the playfield each chain step.

### Readability

- Always draw a subtle outline around gems (even power gems).
- Use a darker playfield background so bright gems pop.
- If you draw grid lines, keep them faint; power gems especially should dominate the grid.

---

## 16) Minimal visual language (what players must read instantly)

- **Normal gems:** glossy colored squares
- **Power gems:** same color but “fused” (no internal lines, stronger bevel)
- **Crash gems:** same color + obvious icon overlay (X/star)
- **Diamond:** neutral gem with rainbow stroke

If those four read clearly, the game will feel right even without character art.



---

## 17) Game cycle + timers (JS/HTML implementation)

The easiest way to keep this kind of puzzle game stable is to:

- render every frame with `requestAnimationFrame` (variable FPS is fine), but
- advance gameplay with a **fixed-step simulation** (deterministic grid rules).

### Recommended loop architecture

**A) Render loop (every animation frame)**

- Clears + draws board, active piece (with interpolated position), and UI.
- Uses `alpha = accumulator / fixedDt` to interpolate falling for smooth motion.

**B) Simulation loop (fixed timestep)**

- Runs at e.g. **60 Hz** (`fixedDt = 1000/60` ms) or **30 Hz**.
- Uses an accumulator pattern so gameplay doesn’t speed up / slow down with the browser.

```js
let last = performance.now();
let acc = 0;
const fixedDt = 1000/60;

function frame(now) {
  acc += now - last;
  last = now;

  while (acc >= fixedDt) {
    stepGame(fixedDt);
    acc -= fixedDt;
  }

  const alpha = acc / fixedDt;
  draw(alpha);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

*(You can also do “one step per frame” for a first prototype, but fixed-step will save you later.)*

---

## 18) State machine (what the game is doing right now)

You’ll have a smoother implementation if you treat the game as a small set of explicit states rather than a big tangle of if-statements.

### Core states

- **SPAWN**: create a new falling pair (and roll the next piece).
- **FALLING**: accept input, apply gravity to the active pair.
- **LOCK\_DELAY** (optional but feels good): piece has touched down; allow a brief window for last-second slides/rotations.
- **RESOLVE**: apply the settle/clear/chain loop (gravity → power marking → triggers → clear → repeat).
- **GAME\_OVER**: stop simulation or only allow restart.
- **PAUSED**: ignore input/logic except unpause.

A typical turn:

1. SPAWN → FALLING
2. FALLING (and optionally LOCK\_DELAY)
3. LOCK piece into board
4. RESOLVE (may run 0, 1, or many chain steps)
5. If not game over → SPAWN

---

## 19) Timers you’ll typically want

These timers are independent and can be implemented as “remaining milliseconds” that count down each `stepGame(dt)`.

### A) Gravity timer (the main fall speed)

- A piece normally falls **one row per ****gravityIntervalMs**.
- `gravityIntervalMs` can depend on level/time/score.

Typical tuning (pick your own):

- Start: 700–900 ms per cell
- Mid: 350–500 ms
- Fast: 150–250 ms

Implementation:

- Accumulate `gravityElapsed += dt`.
- While `gravityElapsed >= gravityIntervalMs`: attempt to move the pair down by 1, subtract interval.

### B) Soft drop

Two common approaches:

1. **Multiplier**: while soft drop key held, use `gravityIntervalMs / 10`.
2. **Immediate step**: apply extra downward steps each tick.

Also common: award small score for soft dropping (optional).

### C) Lock delay (optional)

Without lock delay, the moment the piece touches ground it locks; this is playable but less forgiving.

With lock delay:

- When the active piece **cannot move down**, start `lockDelayMs` (e.g. 250–500ms).
- If the player successfully moves/rotates the piece into a position where it can fall again, **cancel** the lock delay.
- When lock delay expires → lock the piece.

### D) DAS/ARR (optional, but makes controls feel “real”)

If you want classic held-key movement:

- **DAS** (Delayed Auto Shift): wait e.g. 150–250ms before repeating left/right.
- **ARR** (Auto Repeat Rate): then repeat every e.g. 30–60ms.

If you don’t want this complexity, start with “one cell per keydown” and add DAS later.

### E) Resolution pacing (animation-friendly)

Even though your rules can resolve instantly, you’ll often want small delays so players can see what happened.

Useful micro-delays:

- `clearAnimMs` (e.g. 150–250ms): fade/pop removed gems.
- `settleAnimMs` (e.g. 120–200ms): let gems fall with easing.
- `chainPauseMs` (e.g. 100–200ms): small beat between chain steps.

If you don’t care about animations yet, you can set these to 0 and resolve immediately.

---

## 20) The “actions” you need to perform each tick

Think in terms of **events** and **actions**.

### Inputs (events)

- KeyDown/KeyUp:
  - left/right
  - rotate CW/CCW
  - soft drop
  - hard drop (optional)
  - pause

### Per-simulation-step actions

Depending on current state:

#### SPAWN

- Create `activePiece` from `nextPiece`.
- Generate a new `nextPiece` (respect diamond cadence).
- Check spawn collision → GAME\_OVER if blocked.
- Enter FALLING.

#### FALLING

- Apply input to attempt moves/rotations (collision-checked).
- Apply gravity step(s) based on gravity timer.
- If cannot move down:
  - if using lock delay: enter LOCK\_DELAY and start timer
  - else: lock immediately and enter RESOLVE

#### LOCK\_DELAY

- Still accept left/right/rotate.
- If a move allows downward motion again: return to FALLING.
- If timer expires: lock piece → RESOLVE.

#### RESOLVE

Implement the resolution loop from §6 as either:

- a tight while-loop (instant), or
- a staged “resolver” that runs across multiple ticks with animation timers.

A staged resolver typically cycles through phases:

1. **SETTLE**: apply gravity to all board gems (you can animate falling).
2. **POWER\_PASS**: mark/merge power groups.
3. **TRIGGER\_CHECK**: find crash detonations / diamond clears.
4. If triggers:
   - **CLEAR**: mark cells to remove, start clear animation timer
   - when timer completes, remove cells and increment chainIndex
   - go back to SETTLE
5. If no triggers:
   - if board empty: All Clear bonus
   - end RESOLVE → SPAWN

This looks like:

```js
switch (resolvePhase) {
  case 'SETTLE': /* apply gravity to board */ break;
  case 'POWER': /* mark power */ break;
  case 'CHECK': /* find triggers */ break;
  case 'CLEAR_ANIM': /* countdown timer */ break;
}
```

#### GAME\_OVER

- Stop accepting gameplay input.
- Render “Game Over” UI.
- Wait for restart.

---

## 21) Practical tip: separate “rules” from “presentation”

Even in a small JS project, you’ll be happier if you separate:

### Rules engine (pure-ish)

- Board grid
- Collision checks
- Gravity
- Power formation
- Trigger detection
- Clear resolution
- Score updates

### Presentation layer

- Animations (tweening y offsets, fades, pops)
- Sound (later)
- Particles (later)

A nice pattern is to have the rules engine emit a list of **effects** each turn, like:

- `{ type: 'LOCK', cells: [...] }`
- `{ type: 'CLEAR', cells: [...], reason: 'CRASH', chainIndex: 2 }`
- `{ type: 'ALL_CLEAR' }`

Your renderer/animator consumes those effects to play visuals, but the rules don’t depend on animation timing.

---

## 22) Minimum viable timeline (what to implement first)

If you want the fastest path to “playable”:

1. Implement FALLING + collision + lock (no lock delay)
2. Implement RESOLVE loop (instant, no animations)
3. Add crash gem triggers + clear
4. Add power rectangle detection
5. Add diamond behavior
6. Add lock delay + soft drop
7. Add staged resolve with small animation timers

This ordering keeps you shipping a playable prototype early while leaving room for polish.



---

## 23) Reference object model (JS-friendly)

This is a practical “drop-in” model that maps cleanly to the state machine above. You can implement it as plain JS objects, ES6 classes, or TypeScript interfaces.

### Naming conventions used below

- `row` increases **upward** (row 0 is bottom).
- `col` increases **rightward**.
- Board storage can be either `cells[row][col]` or a flat array.

---

## 24) Core enums / constants

```js
const W = 6;
const H = 13;        // 12 visible + 1 overflow/spawn row
const VISIBLE_H = 12;
const SPAWN_COL = 3; // 0-based

const Kind = {
  EMPTY: 'EMPTY',
  NORMAL: 'NORMAL',
  CRASH: 'CRASH',
  DIAMOND: 'DIAMOND',
  COUNTER: 'COUNTER',
};

const Color = {
  R: 'R', G: 'G', B: 'B', Y: 'Y',
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
  POWER: 'POWER',
  CHECK: 'CHECK',
  CLEAR_ANIM: 'CLEAR_ANIM',
  CHAIN_PAUSE: 'CHAIN_PAUSE',
  DONE: 'DONE',
};
```

---

## 25) Cell + board data

### Cell

One cell represents one grid location.

```js
// "cell" is a tiny, mutable record.
// For performance: keep it as plain object or even parallel arrays.
function makeEmptyCell() {
  return {
    kind: Kind.EMPTY,
    color: null,        // one of Color or null
    powerGroupId: 0,    // 0 = not power; otherwise group id
    counter: 0,         // used only if kind === COUNTER

    // Animation/presentation fields (optional):
    anim: null,         // { fade:0..1, pop:0..1, ... }
  };
}
```

Notes:

- `powerGroupId` is more useful than a boolean because it supports fused rendering and scoring by group.
- You can keep `kind` and `color` for POWER cells the same as their underlying gem (NORMAL/CRASH), and treat `powerGroupId>0` as the “power overlay.”

### Board

```js
function makeBoard() {
  const cells = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => makeEmptyCell())
  );

  return {
    w: W,
    h: H,
    cells,

    inBounds(row, col) {
      return row >= 0 && row < H && col >= 0 && col < W;
    },

    get(row, col) {
      return this.inBounds(row, col) ? this.cells[row][col] : null;
    },

    isEmpty(row, col) {
      const c = this.get(row, col);
      return !!c && c.kind === Kind.EMPTY;
    },

    setCell(row, col, next) {
      this.cells[row][col] = next;
    },

    // Useful utility: treat "color cell" as any cell with a color (normal/crash/power)
    hasColor(row, col) {
      const c = this.get(row, col);
      return c && c.kind !== Kind.EMPTY && c.color != null;
    },
  };
}
```

If you prefer a flat array:

- `idx = row*W + col`
- store `cells[idx]`

---

## 26) Piece model (active falling pair)

Represent the piece in terms of a **pivot** cell + an **orientation**.

```js
// orientation: 0=up, 1=right, 2=down, 3=left
function makeActivePiece(spec, spawnRow = 11, spawnCol = SPAWN_COL) {
  return {
    pivotRow: spawnRow,
    pivotCol: spawnCol,
    orient: 0,

    // The two gems that make up the pair.
    // gemA is the pivot gem, gemB is the offset gem.
    gemA: { kind: spec.a.kind, color: spec.a.color },
    gemB: { kind: spec.b.kind, color: spec.b.color },

    // For smooth rendering (optional):
    yOffsetPx: 0,

    cells() {
      // returns array of 2 grid cells the piece occupies at current orientation
      const a = { row: this.pivotRow, col: this.pivotCol, gem: this.gemA };
      const off = orientOffset(this.orient);
      const b = { row: this.pivotRow + off.dr, col: this.pivotCol + off.dc, gem: this.gemB };
      return [a, b];
    },
  };
}

function orientOffset(orient) {
  switch (orient & 3) {
    case 0: return { dr: +1, dc: 0 };  // b above pivot
    case 1: return { dr: 0, dc: +1 };  // b right
    case 2: return { dr: -1, dc: 0 };  // b below
    case 3: return { dr: 0, dc: -1 };  // b left
  }
}
```

Why this is convenient:

- Rotations are just `orient = (orient + 1) & 3`.
- Collision checks use `piece.cells()`.

---

## 27) Next-piece generator (bag / RNG)

You want something deterministic and easy to tune:

```js
function makeRng(seed = 12345) {
  // Simple deterministic PRNG (mulberry32 style)
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

function rollGem(rng) {
  const colors = [Color.R, Color.G, Color.B, Color.Y];
  const color = colors[rng.int(colors.length)];

  // Tune crash frequency; 1-in-6 is a decent starting feel.
  const isCrash = rng.int(6) === 0;
  return { kind: isCrash ? Kind.CRASH : Kind.NORMAL, color };
}

function rollPiece(rng, pieceIndex) {
  // Diamond cadence: every 25 pieces (1-indexed). You can choose: pieceIndex starts at 1.
  const isDiamondTurn = (pieceIndex % 25) === 0;
  if (isDiamondTurn) {
    // Common: diamond replaces one of the two gems.
    return {
      a: rollGem(rng),
      b: { kind: Kind.DIAMOND, color: null },
    };
  }

  return { a: rollGem(rng), b: rollGem(rng) };
}
```

Notes:

- You can also implement a “bag” distribution if you want more even color frequency.

---

## 28) Input state

Track *held* keys separately from *pressed this frame*.

```js
function makeInput() {
  return {
    held: {
      left: false,
      right: false,
      down: false,
    },
    pressed: {
      rotateCW: false,
      rotateCCW: false,
      hardDrop: false,
      pause: false,
    },

    // Call once per simulation tick:
    clearPressed() {
      for (const k of Object.keys(this.pressed)) this.pressed[k] = false;
    }
  };
}
```

---

## 29) Timers + control repeat (optional DAS/ARR)

```js
function makeTimers() {
  return {
    gravityElapsed: 0,
    gravityIntervalMs: 800,

    lockDelayRemainingMs: 0,
    lockDelayMs: 350,

    // Optional: horizontal repeat
    dasMs: 170,
    arrMs: 45,
    leftHoldMs: 0,
    rightHoldMs: 0,

    // Resolve pacing
    settleAnimMs: 150,
    clearAnimMs: 180,
    chainPauseMs: 120,
  };
}
```

---

## 30) Resolver (staged RESOLVE engine)

The resolver holds temporary data across multiple ticks.

```js
function makeResolver() {
  return {
    phase: ResolvePhase.SETTLE,
    phaseRemainingMs: 0,

    chainIndex: 1,

    // Transient work buffers:
    triggers: null,      // { type:'CRASH', ... } | { type:'DIAMOND', ... } | null
    toClear: [],         // [{row,col}, ...]

    // Scoring summary for the current clear event:
    clearStats: { normal: 0, crash: 0, power: 0, diamond: false },

    resetForNewResolve() {
      this.phase = ResolvePhase.SETTLE;
      this.phaseRemainingMs = 0;
      this.chainIndex = 1;
      this.triggers = null;
      this.toClear.length = 0;
      this.clearStats = { normal: 0, crash: 0, power: 0, diamond: false };
    }
  };
}
```

---

## 31) Effects (bridge rules → animations)

Emit effects from your rules engine so the renderer can animate without affecting correctness.

```js
function makeEffectsQueue() {
  return {
    items: [],
    push(e) { this.items.push(e); },
    drain() { const out = this.items; this.items = []; return out; },
  };
}

// Example effect shapes:
// { type:'SPAWN', piece: {...} }
// { type:'LOCK', cells:[{row,col},...]} 
// { type:'CLEAR', cells:[...], reason:'CRASH'|'DIAMOND', chainIndex:n }
// { type:'ALL_CLEAR' }
// { type:'GAME_OVER' }
```

---

## 32) Game object (top-level)

```js
function makeGame(seed = 12345) {
  const rng = makeRng(seed);
  const board = makeBoard();

  const game = {
    state: GameState.SPAWN,

    rng,
    board,

    input: makeInput(),
    timers: makeTimers(),
    resolver: makeResolver(),
    effects: makeEffectsQueue(),

    score: 0,
    level: 1,
    linesOrPieces: 0,   // track progression however you like

    pieceIndex: 0,      // increments each time you spawn a new piece
    nextSpec: null,     // {a:{kind,color}, b:{kind,color}}
    active: null,       // active piece object

    // Rendering-only state (optional):
    view: {
      cellSize: 40,
      boardLeft: 50,
      boardTop: 50,
    },

    reset() {
      this.state = GameState.SPAWN;
      this.score = 0;
      this.level = 1;
      this.pieceIndex = 0;
      this.nextSpec = null;
      this.active = null;
      // clear board
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) this.board.cells[r][c] = makeEmptyCell();
      this.resolver.resetForNewResolve();
      this.effects.items.length = 0;
    }
  };

  // Initialize next piece
  game.nextSpec = rollPiece(game.rng, 1);
  return game;
}
```

---

## 33) Renderer caches (no sprites, but cached draws)

Even with vector drawing, you can still treat visuals like sprites by caching small canvases.

```js
function makeRenderCache() {
  return {
    // key: `${kind}:${color}` or `${kind}:*`
    tiles: new Map(),

    get(key) { return this.tiles.get(key); },
    set(key, canvas) { this.tiles.set(key, canvas); },
  };
}
```

Typical keys:

- `NORMAL:R`, `NORMAL:G`, …
- `CRASH:R`, …
- `DIAMOND:*`
- `COUNTER:*`

---

## 34) How the model connects to stepGame(dt)

In pseudocode, your main update function becomes very straightforward:

```js
function stepGame(dt) {
  if (game.state === GameState.PAUSED || game.state === GameState.GAME_OVER) return;

  switch (game.state) {
    case GameState.SPAWN:
      doSpawn();
      break;

    case GameState.FALLING:
      doFalling(dt);
      break;

    case GameState.LOCK_DELAY:
      doLockDelay(dt);
      break;

    case GameState.RESOLVE:
      doResolve(dt);
      break;
  }

  game.input.clearPressed();
}
```

Each `doX` function:

- reads input (for movement/rotation)
- updates timers
- mutates `game.board` / `game.active`
- pushes effects for visuals and sound

With this object model in place, you can implement the rules engine incrementally without refactoring later.

