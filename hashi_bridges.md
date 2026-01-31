# Hashi (Bridges) — CSS/JS/HTML Implementation Guide

## Scope & goals
Build a standalone, in-browser **Hashi (a.k.a. Bridges / Hashiwokakero)** game that fits the “between meetings” vibe:
- Single HTML page + one JS + one CSS (no build step).
- Instant play, instant resume (localStorage).
- Multiple puzzles sorted by difficulty **and/or** a deterministic seeded generator.
- Smooth UX: click/drag to place bridges, undo/redo, quick reset, optional error highlighting.

Non-goals (for v1): fancy animations, multiplayer, leaderboards, cloud sync.

---

## File layout
- `hashi.html`
- `hashi.css`
- `hashi.js`
- (optional) `hashi_puzzles.js` (or `hashi_puzzles.json`)

If you have a hub page (`index.html`) that lists games, add an entry linking to `hashi.html`.

---

## Game rules (implement precisely)
1. The board is a rectangular grid containing numbered **islands**.
2. You may draw bridges between islands that are:
   - in the **same row or column**,
   - with **no other island between** them.
3. Bridges run straight (horizontal/vertical).
4. Between any two islands, there can be **0, 1, or 2 bridges**.
5. Bridges **may not cross** other bridges.
6. Each island’s number is the **total number of incident bridges** (counting doubles as 2).
7. When solved:
   - all islands satisfy their counts exactly,
   - and **all islands are connected** (one connected component via bridges > 0).

---

## Architecture overview
Split into three layers:
1. **Model**: puzzle definition, graph topology, current edge counts, history stack.
2. **Rules/Validation**: legality checks, totals, connectivity, solved detection.
3. **View/Controller**: DOM render, input events, UI controls.

Keep the model independent of the DOM so it’s testable.

---

## Data model

### Coordinates
Use integer grid coordinates:
- rows: `0..H-1`
- cols: `0..W-1`

### Island
```js
// immutable per puzzle
{ id: number, r: number, c: number, target: number }
```

### Edge (candidate bridge)
Precompute edges between “visible neighbors” (closest island in each cardinal direction).
```js
// immutable topology
{ id: number, a: islandId, b: islandId, orient: 'h'|'v',
  // inclusive-exclusive ranges are handy for crossing checks
  r0, c0, r1, c1,  // endpoints coords (a -> b)
  crosses: number[] // edgeIds that would cross this edge
}
```

### State
```js
{
  edgeCounts: Uint8Array, // per edge: 0,1,2
  markedComplete: Uint8Array, // optional per island (UI only)
  // derived, cached for speed
  islandTotals: Uint8Array,
  solved: boolean,
}
```

### History (undo/redo)
Store diffs, not whole states:
```js
{ edgeId, prev, next }
```
Push one diff per action; redo stack cleared on new action.

---

## Puzzle input formats
Support **one canonical internal format**, but allow importing:

### Option A: JSON islands
```js
{
  id: 'easy-001',
  w: 10, h: 10,
  islands: [ {r:0,c:2,target:3}, ... ]
}
```
Pros: simple, readable.

### Option B: Compact “task string”
If you want ultra-compact puzzle packs, implement a tiny RLE encoding:
- Flatten cells row-major.
- Digits `1..8` represent an island at that cell.
- Letters `a..z` represent “skip N empty cells” (a=1, b=2, ...).

You can store `{w,h,task:"..."}` and decode into islands.

(If you do this, keep it strictly **single-digit islands**; Hashi targets are typically 1–8.)

---

## Precomputations (topology build)
Given islands and board size:

1. **Index islands by row and by column**:
   - `rowBuckets[r] = islands sorted by c`
   - `colBuckets[c] = islands sorted by r`

2. For each island, find nearest neighbor in four directions:
   - right: next island in same row with larger `c`
   - left: previous island in same row
   - down: next island in same col with larger `r`
   - up: previous island in same col

3. Create an undirected edge only once (e.g. only right and down) to avoid duplicates.

4. **Crossing pairs**:
   - For each horizontal edge and vertical edge:
     - They cross if the vertical column lies strictly between the horizontal endpoints and
       the horizontal row lies strictly between the vertical endpoints.
     - Exclude cases where they meet at an island.
   - Precompute `crosses[]` list for each edge for O(1) crossing validation during play.

---

## Rules & validation

### Adding/changing a bridge
Action = select an edge and set its count to 0/1/2 (usually cycling).
Validate:
1. Not exceeding per-island target:
   - For island i: `currentTotal(i) - oldContribution + newContribution <= target(i)`
   - (Optional: allow temporarily exceeding if you prefer “free play”, but default should prevent it.)
2. Crossing:
   - If `newCount > 0`, all edges in `edge.crosses` must have count == 0.
3. Optional: No-island-between is guaranteed by topology (nearest neighbors only).

### Totals recompute
After each action:
- Update `islandTotals` incrementally (subtract old, add new for the two endpoints).

### Solved check
Solved iff:
1. For all islands: `islandTotals[i] == target[i]`.
2. Connectivity: BFS/DFS from any island, traversing edges with `count>0`. All islands visited.

### Error highlighting (optional UI toggle)
- Highlight islands where `total > target` (hard error)
- If “strict check”: also highlight `total != target`.
- If connectivity fails on strict check, show “disconnected” banner.

---

## UI / DOM structure

### Layout
- Top bar: difficulty dropdown, puzzle selector, new/random, seed input, undo/redo, reset, check.
- Main board: layered absolute-positioned container.

### Board layers (recommended)
1. `board-grid` (optional faint grid)
2. `board-bridges` (bridge segments)
3. `board-islands` (island circles with numbers)
4. `board-overlays` (selection highlight, hints, error glow)

### Rendering strategy
Pre-create DOM elements once per puzzle:
- One `.bridge` div per edge, sized/positioned between endpoints.
- One `.island` div per island.

On state changes, **only update classes** (don’t rebuild DOM).

### CSS bridge styling
Use classes:
- `.bridge.h` / `.bridge.v`
- `.b0` `.b1` `.b2` (0 hidden, 1 single line, 2 double lines)

Implementation trick:
- Use `::before` and `::after` pseudo-elements to draw 1 or 2 parallel strokes.
- For `.b1`: show `::before`, hide `::after`.
- For `.b2`: show both with slight offset.

### Island styling
- Circle with number centered.
- Visual states:
  - `.selected`
  - `.satisfied` (total == target)
  - `.over` (total > target)
  - `.disconnected` (optional)

Also show “remaining” as a small subscript: `target - total` (optional).

### Direction “pips” (optional but nice)
Show up to 4 little indicators around the island for current bridge count in each direction.
- For each island, compute direction counts from incident edges.
- Update pips with classes `.p0/.p1/.p2/.pNA`.

---

## Input model (mouse + touch + keyboard)

### Mouse
- Click island A, then click island B (same row/col, visible neighbor): cycles edge count.
- Click-and-drag from A toward a neighbor, release over B: sets/cycles.
- Right-click: cycle backwards.
- Clicking empty space clears selection.

### Touch
- Tap-select island; tap neighbor to cycle.
- (Optional) drag gesture for quick play.

### Keyboard (accessibility)
- Arrow keys: move selection to nearest island in that direction.
- Space/Enter: cycle edge to last-used direction (or open a small direction picker).
- 1/2/0 keys: set exact bridge count on selected neighbor direction.
- Ctrl/Cmd+Z / Ctrl/Cmd+Y: undo/redo.

---

## Persistence (between-meetings friendly)
Persist to localStorage:
- last puzzle id
- edgeCounts (as base64 or comma string)
- elapsed time
- user settings (show errors, show pips, etc.)

Key format:
- `hashi:v1:save:<puzzleId>`
- `hashi:v1:lastPuzzle`

Make “Resume” the default on load if a save exists.

---

## Puzzle packs & difficulty sorting

### Recommended pack structure
```js
const HASHI_PACKS = {
  easy:   [ {id,w,h,islands}, ... ],
  medium: [ ... ],
  hard:   [ ... ],
  expert: [ ... ],
};
```

### Difficulty metadata
If you have (or compute) a rating:
```js
{ id, w, h, islands, rating: { difficulty: 'easy', score: 17, steps: 42, backtracks: 0 } }
```
Sort by `score`, break ties by islands count.

If you don’t have ratings yet, curate by hand first, then add computed ratings later.

---

## Solver (for validation, hints, and generator)

### Why you want it
- Ensure generated puzzles have a **unique solution**.
- Provide hints (optional).
- Compute difficulty (number of forced moves, backtracks).

### Constraint model
Variables: each edge `e` has domain `{0,1,2}`.
Constraints:
- Island sum constraint: Σ incident edge counts = target.
- Crossing constraint: if `e` crosses `f`, then NOT( e>0 AND f>0 ).
- Connectivity: final graph connected (can be checked at end; optional pruning during search).

### Propagation (must-have)
For each island i:
- `sumAssigned = Σ assigned edges`
- `remaining = target - sumAssigned`
- `maxPossible = Σ max(domain(edge))`
- `minPossible = Σ min(domain(edge))`

If `remaining < minPossible` or `remaining > maxPossible` → contradiction.
If `remaining == minPossible` → force all incident edges to their minimum.
If `remaining == maxPossible` → force all incident edges to their maximum.

Crossing propagation:
- If set `edgeCount(e) > 0`, force all `crosses` edges to 0.

### Search heuristic
- Choose an unassigned edge with smallest domain (MRV).
- Try values in an order that tends to satisfy islands (e.g. prefer 0 if islands nearly full, else 2).

### Uniqueness check
Run solver with `solutionLimit=2`:
- 0 solutions → invalid puzzle
- 1 solution → good
- 2+ solutions → non-unique

---

## Seeded generator (optional; can come after curated packs)

### High-level approach
1. Use a deterministic PRNG (seeded) for reproducible puzzles.
2. Generate a **random valid solution graph**:
   - Place islands.
   - Connect them with non-crossing edges to make the graph connected.
   - Add extra edges / doubles within constraints.
3. Derive island numbers from that solution.
4. Run solver to ensure **unique solution**.
5. Score difficulty based on solver stats; accept/reject until you hit target difficulty band.

### Island placement
A pragmatic method:
- Start with empty grid.
- Repeatedly place islands with minimum Manhattan spacing.
- Ensure each island has at least one potential neighbor in row/col (or retry).

### Building a connected planar graph
- Precompute candidate neighbor edges (nearest in each direction).
- Build a random spanning tree:
  - Start with one island in the connected set.
  - Randomly add an edge that connects a connected island to an unconnected island
    while not crossing already-chosen edges.
- Then add extra edges and doubles based on difficulty target.

### Difficulty knobs
- Easy: fewer islands, mostly single bridges, low branching.
- Medium: more islands, some doubles.
- Hard/Expert: higher density, more doubles, tighter constraints, more branching.

---

## Unit tests (Node.js)

Add a small unit-test suite that targets the **pure logic** (no DOM) so you can refactor confidently.

### Recommended refactor for testability
Split into:
- `hashi_core.js` — parsing, topology, rules, state transitions, solver helpers (pure functions)
- `hashi_ui.js` — DOM creation, event handling, rendering (calls core)
- `hashi.js` — glue that loads puzzles, wires UI → core

In `hashi_core.js`, expose a minimal API:
```js
export function buildTopology(puzzle) {}
export function newState(topology) {}
export function applyEdgeChange(topology, state, edgeId, nextCount, opts) {}
export function isSolved(topology, state) {}
export function connectivity(topology, state) {}
export function islandTotals(topology, state) {}
```
Where `applyEdgeChange` returns `{ state2, ok, reason }` (and does not mutate inputs), OR mutates in-place but returns a `diff` for undo—either is fine as long as it’s deterministic.

### Test runner: Node built-in
Use Node’s built-in test runner (no dependencies):
- Run: `node --test`
- Assertions: `node:assert/strict`

`package.json` example:
```json
{
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

Folder structure:
- `test/hashi_core.test.js`
- `test/fixtures/puzzles.js` (optional)

### Fixtures for predictable tests
Use tiny puzzles you can reason about by inspection. Keep them very small (e.g. 5×5).
Example idea fixtures:
1. **Two islands** in same row with targets that require exactly 2 bridges.
2. **Crossing attempt**: 4 islands in a plus shape where a horizontal bridge would cross a vertical bridge.
3. **Disconnected**: two pairs of islands far apart.
4. **Nearest-neighbor visibility**: three islands in a row; only edges between adjacent islands should exist.

### Core unit tests to write

#### 1) Topology construction
- Builds edges only between nearest visible neighbors.
- Each edge has correct orientation and endpoint coordinates.
- Crossing lists are correct.

Suggested tests:
- “Three in a row” → only 2 edges, no edge spanning over the middle island.
- One horizontal + one vertical crossing geometry → crossing pair detected.

#### 2) Move legality
- Cannot set edge to 2 if any endpoint would exceed its target.
- Cannot set edge >0 if it would cross any existing edge >0.
- Edge count always clamped to {0,1,2}.

#### 3) Totals accounting
- After each edge change, totals update for both endpoints only.
- Double bridges count as 2.

#### 4) Undo/redo diffs (if implemented)
- Applying diff then inverse diff returns to original state.
- Redo stack cleared after a new action.

#### 5) Connectivity and solved detection
- Connectivity returns all islands visited for a connected solution.
- `isSolved` requires BOTH: exact island totals and full connectivity.

#### 6) (Optional) Solver primitives
If you add a solver later, unit-test the propagation rules:
- “remaining == minPossible” forces mins
- “remaining == maxPossible” forces maxes
- crossing propagation sets crossing edges to 0

### Example tests (Node built-in)
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTopology, newState, applyEdgeChange, isSolved } from '../hashi_core.js';

const P_TWO = {
  id: 'two', w: 5, h: 3,
  islands: [
    { r: 1, c: 1, target: 2 },
    { r: 1, c: 3, target: 2 },
  ]
};

test('topology: two islands creates one horizontal edge', () => {
  const topo = buildTopology(P_TWO);
  assert.equal(topo.islands.length, 2);
  assert.equal(topo.edges.length, 1);
  const e = topo.edges[0];
  assert.equal(e.orient, 'h');
  assert.deepEqual([e.a, e.b].sort((a,b)=>a-b), [0,1]);
});

test('applyEdgeChange: double bridge satisfies totals and solves when connected', () => {
  const topo = buildTopology(P_TWO);
  const s0 = newState(topo);

  const r1 = applyEdgeChange(topo, s0, 0, 2, { strict: true });
  assert.equal(r1.ok, true);
  assert.equal(isSolved(topo, r1.state2), true);
});

test('applyEdgeChange: prevents exceeding target in strict mode', () => {
  const topo = buildTopology(P_TWO);
  const s0 = newState(topo);

  const r1 = applyEdgeChange(topo, s0, 0, 2, { strict: true });
  assert.equal(r1.ok, true);

  const r2 = applyEdgeChange(topo, r1.state2, 0, 1, { strict: true });
  // moving from 2 → 1 is allowed; to test exceed, you need a fixture with multiple incident edges
  assert.equal(r2.ok, true);
});
```

### A better “exceed target” fixture (multi-edge)
Create an L-shape with three islands where the center has target 1 and two possible edges.
Then verify that setting both edges to 1 is rejected in strict mode.

### CI sanity (optional)
Add a
- Bridge placement rules:
  - cannot connect non-neighbors
  - cannot exceed 2
  - cannot cross
- Totals update correctly and incrementally
- Undo/redo across many actions
- Save/resume persists exactly
- Solved detection requires connectivity
- Keyboard navigation works
- Touch works on mobile

---

## Implementation milestones (recommended)
1. Parse + render a single hardcoded puzzle (no input UI yet).
2. Implement edge cycling with click island → click neighbor.
3. Enforce crossing + max-2 + totals.
4. Add undo/redo.
5. Add solved detection + connectivity.
6. Add puzzle selector + difficulty grouping.
7. Add localStorage resume.
8. Optional: error highlighting toggle.
9. Optional: solver.
10. Optional: seeded generator.

---

## Notes from your attached `bbs.js`
Your `bbs.js` already contains a Bridges/Hashi implementation with useful ideas:
- Pre-creating bridge DOM elements per island-to-right and island-to-down neighbor.
- Keeping bridge counts only on “right” and “bottom” edges to avoid duplicates.
- Updating per-island totals and doing a connectivity pass to detect isolated islands.

Use it as a reference for behavior, but rewrite into a clean, standalone module without the surrounding site framework dependencies.

