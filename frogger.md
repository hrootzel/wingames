<!-- AMENDMENT INSERT (2026-01-27): Vehicle lengths + snakes + otters -->

## Amendments (2026-01-27)

### Vehicle lengths (16px “cell” model)
- **All road “cars” are 2 cells long** (32px wide) in the simplified 16×16 cell grid: race cars, sedans, dune buggies, and bulldozers all occupy **2 contiguous columns** in their lane.
- **Trucks are 4 cells long** (64px wide) and occupy **4 contiguous columns** in their lane.
- If any earlier section in this spec implies different vehicle lengths, **this amendment overrides it**.

### Snakes (bank + on logs)
- **Where snakes can appear (arcade behavior):**
  1) **On the river bank (the safe median strip between road and river).**
  2) **On the large log that floats through the middle of the river.**
- **Hit rules:** only the **snake head** is lethal; the **body is safe to stand on**.
- **Implementation detail (recommended):** represent the snake as a 2-cell sprite (head+body) where `headRect` is lethal and `bodyRect` is rideable/harmless. If you want closer fidelity, keep a 2-cell visual but only the leading ~½-cell of the head counts as the lethal region.

### Otters (chasing logs)
- Otters appear **starting after Round 2** and **chase after logs**, **submerging when they reach them**.
- **Practical faithful model (works well in JS):**
  - Spawn an otter in a chosen river lane that contains logs.
  - The otter selects a **target log instance** in that lane and “chases” it (otter speed > log speed).
  - When the otter reaches the log, it transitions into a short **attached** phase, occupying the **left end of the log**. During this phase:
    - Frogger can still ride the log, **but the left-end cell is dangerous** (treat it like an unrideable hazard patch).
  - After a short duration, the otter **submerges** (despawns).
- **Kill rule (arcade guides):** you are safe as long as you are **not close to the edge of the log the otter is swimming toward**; if you’re on that edge when it arrives/attaches, you die.

---

# Arcade Frogger (1981) — JS/Canvas implementation spec

This doc is written to be handed to Codex to implement a **classic arcade-accurate Frogger** in plain **JS + HTML5 Canvas** (no framework). It focuses on **banded lanes**, **tile/sprite grid**, **deterministic spawn patterns**, classic hazards (**snakes, otters, gators, diving turtles**), classic bonuses (**lady frog, flies**), and classic scoring/level scaling.

> Notes on accuracy: the original arcade logic is extremely deterministic (table-driven and cycle-based). This spec uses the same **“scrolling lane with a repeating pattern”** model so behavior can be tuned to match reference footage. Where exact per-ROM numbers vary, values are exposed as constants.

---

## 1) Coordinate system, tiles, and sprite grid

### 1.1 Native resolution
* Arcade-style logical resolution: **224 × 256** (portrait-ish feel; you can present rotated or just keep upright).
* Draw at an integer scale (e.g., 3× or 4×) to avoid blur.

### 1.2 Background tilemap
* Background is an **8×8 tile grid**: **28 columns × 32 rows**.
* Background tiles are static art: grass, road, water, median, home bays, bushes, UI frame.

### 1.3 Frog movement grid (the “cell” system)
Even though the background is 8×8 tiles, movement and collisions are naturally modeled on **16×16 cells**:
* **CELL = 16 px**
* **GRID_W = 14 cells** (14×16 = 224 px)
* Each lane band is **1 cell tall** (16 px)
* Frog occupies **1 cell** (treated as 16×16 for collisions).

This matches the classic feel: each joystick press moves the frog **exactly 1 cell**.

---

## 2) Band layout (rows) and what spawns where

Model the playfield as 13 movement bands (16 px each) inside the 224×256 area, reserving remaining pixels for HUD.

### 2.1 Band indices
Use `bandY(band)` where band 0 is **top (homes)**, band increases downward.

```
// bands are 16px tall
const CELL = 16;
const GRID_W = 14;
const BAND_H = 16;

function bandToY(band){ return band * BAND_H; }
function cellToX(cell){ return cell * CELL; }
```

### 2.2 Bands (top to bottom)

#### Band 0 — HOME BAY (5 homes)
* 5 home slots. Between homes are bushes/blocked tiles.
* An empty home may temporarily show:
  * **Fly bonus** (safe) OR
  * **Home gator** (deadly if you enter).

#### Bands 1–5 — RIVER (5 lanes)
From **top river lane** (closest to homes) down to **bottom river lane** (closest to the median):

**Band 1 (River-5, nearest homes)**
* **Standard logs** moving **RIGHT**.
* Later difficulty: some logs replaced with **log gators** (alligator/crocodile body) moving right.
  * You may stand on the **body**.
  * The **head/jaws** at the front end are deadly.
* Occasional **snake** can appear on this lane’s platforms at higher difficulty (optional; enable by config).

**Band 2 (River-4)**
* **Pairs of turtles (2)** moving **LEFT**.
* Some pairs are **diving turtles**:
  * cycle: surface → warning → submerged → surface.

**Band 3 (River-3)**
* **Very long logs** moving **RIGHT**.
* Hazards that may appear here on higher difficulty:
  * **Snake on log** (lethal head).
  * **Otter** (lethal on contact; rides with lane motion).

**Band 4 (River-2)**
* **Short logs** moving **RIGHT**, in quicker succession (smaller gaps).
* **Lady frog** bonus typically appears on a log here (configurable):
  * When you land on the platform, she “hops on your back”.

**Band 5 (River-1, nearest median)**
* **Triples of turtles (3)** moving **LEFT**.
* Mix of normal + diving triples.

#### Band 6 — SAFE MEDIAN (river bank)
* Safe strip between river and road (often rendered as a **purple speckled bank** in captures, like your screenshot).
* **Snakes can spawn here** (they slither horizontally across the bank). See **Snakes** section in Amendments.

#### Bands 7–11 — ROAD (5 lanes)
From top road lane (closest to median) down to bottom road lane (closest to start):

**Band 7 (Road-5, nearest median)**
* **Trucks** moving **LEFT**.

**Band 8 (Road-4)**
* **Race cars** moving **RIGHT**.

**Band 9 (Road-3)**
* **Dune buggies** moving **LEFT**.

**Band 10 (Road-2)**
* **Bulldozers / tractors** moving **RIGHT**.

**Band 11 (Road-1, nearest start)**
* **Race cars** moving **LEFT**.

> Classic note: Road lanes 1 and 4 are the “same” race car type (palette swapped) traveling opposite directions; Road-3 vehicles are dune buggies.

#### Band 12 — START BANK
* Safe grass with frog spawn position.

---

## 3) Object sizes (in 16×16 cells)
These are chosen to match the classic silhouettes and spacing; tune if needed.

### 3.1 Frog
* Size: **1×1 cell**.

### 3.2 Road vehicles
Based on the original arcade sprites (and matching your screenshot):
* **Cars (all small road vehicles)**: **2 cells** long.
  * This includes the different palette/body styles you see across lanes (yellow car, purple car, green/white car, etc.). Treat them as *2-cell lethal vehicles* with lane-specific sprite selection.
* **Bulldozer/tractor**: **2 cells** long (sprite looks bulkier, often with a “front”/treads).
* **Truck**: **4 cells** long (the long white truck in your screenshot).

> If any earlier section implies 3-cell bulldozers or 3-cell trucks, ignore it; this section is authoritative.

### 3.3 River platforms
* Turtle group of 2: **2 cells**.
* Turtle group of 3: **3 cells**.
* Short log: **3 cells**.
* Standard log: **4 cells**.
* Very long log: **6 cells**.
* Log gator (alligator): **4 cells body + 2 cells head** (**6 total**); body is rideable, head/mouth is lethal.

---

## 4) Deterministic lane patterns (spawn tables)

The arcade feel comes from **repeatable patterns** rather than random spawning. Implement each lane as a *cyclic conveyor belt* with:
* direction (+1 right, −1 left)
* speed (cells/sec)
* a repeating “pattern” made of **segments** (object length + gap length)

### 4.1 Lane pattern representation
Use a declarative segment list. Each lane’s pattern repeats forever.

```
// lengths are in CELLS
// `kind` is for drawing and collision rules

/** @typedef {{ kind:string, len:number }} Seg */

/** @typedef {{
 *  name: string,
 *  band: number,
 *  dir: -1|1,
 *  speedCps: number,           // cells per second
 *  cycle: Seg[],               // repeating lane content
 * }} LaneConfig */
```

Interpretation:
* Road lanes: `kind:"vehicle"` segments are lethal.
* River lanes:
  * `kind:"water"` is lethal (drown).
  * `kind:"log" | "turtle" | "gatorBody"` are safe platforms.
  * `kind:"gatorHead"` is lethal.

### 4.2 Suggested base patterns (Round 1)
These are designed to “look right” immediately, then you tune spacing to match footage.

**Road-1 racecars (left)**
```
[{kind:'racecar', len:2}, {kind:'gap', len:5},
 {kind:'racecar', len:2}, {kind:'gap', len:7}]
```

**Road-2 bulldozers (right)**
```
[{kind:'bulldozer', len:2}, {kind:'gap', len:6},
 {kind:'bulldozer', len:2}, {kind:'gap', len:4}]
```

**Road-3 dune buggies (left)**
```
[{kind:'buggy', len:2}, {kind:'gap', len:4},
 {kind:'buggy', len:2}, {kind:'gap', len:6}]
```

**Road-4 racecars (right)**
```
[{kind:'racecar', len:2}, {kind:'gap', len:6},
 {kind:'racecar', len:2}, {kind:'gap', len:5}]
```

**Road-5 trucks (left)**
```
[{kind:'truck', len:4}, {kind:'gap', len:7},
 {kind:'truck', len:4}, {kind:'gap', len:5}]
```

**River-1 (nearest median): triples of turtles (left)**
```
[{kind:'turtle3', len:3}, {kind:'water', len:3},
 {kind:'turtle3_dive', len:3}, {kind:'water', len:4}]
```

**River-2 short logs (right)**
```
[{kind:'logS', len:3}, {kind:'water', len:1},
 {kind:'logS', len:3}, {kind:'water', len:2}]
```

**River-3 very long logs (right)**
```
[{kind:'logXL', len:6}, {kind:'water', len:4},
 {kind:'logXL', len:6}, {kind:'water', len:6}]
```

**River-4 pairs of turtles (left)**
```
[{kind:'turtle2', len:2}, {kind:'water', len:3},
 {kind:'turtle2_dive', len:2}, {kind:'water', len:4}]
```

**River-5 standard logs (right)**
```
[{kind:'logM', len:4}, {kind:'water', len:3},
 {kind:'logM', len:4}, {kind:'water', len:5}]
```

### 4.3 Difficulty “rounds” (1–5) change density, not geometry
The classic cabinet cycles the board in **rounds of five**: traffic density increases within the set.

Implement this by swapping lane patterns based on `roundInSet = 1..5`:
* Racecar lanes: increase number of cars per cycle from 1 → 4.
* Trucks: compress gaps and/or allow “3 trucks in succession” at high round.
* River: reduce safe gaps and increase speed.

Codex implementation approach: have `lanePatterns[roundInSet][laneName]`.

### 4.4 Spawn tables for rounds 1–5 (authoritative)
Use these as the **exact per-round lane cycles**. These cycles are designed to be tuned, but they already follow the arcade principle: **same lane ordering**, **same directions**, **density increases each round**.

**How to use:**
- Keep the lane `speedCps` from `LANE_CFGS` as the baseline.
- Multiply by `ROUND_SPEED_SCALE[round]` (optional but recommended).
- Replace each lane’s `cycle` with `LANE_CYCLES_BY_ROUND[round][laneName]`.

```js
// Optional (simple, arcade-feel): later rounds are slightly faster too.
const ROUND_SPEED_SCALE = {
  1: 1.00,
  2: 1.05,
  3: 1.10,
  4: 1.15,
  5: 1.20,
};

// NOTE: laneName keys must match your LaneConfig.name exactly.
const LANE_CYCLES_BY_ROUND = {
  1: {
    'Road-1 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:5},
      {kind:'racecar', len:2}, {kind:'gap', len:7},
    ],
    'Road-2 Bulldozers': [
      {kind:'bulldozer', len:2}, {kind:'gap', len:6},
      {kind:'bulldozer', len:2}, {kind:'gap', len:4},
    ],
    'Road-3 Buggies': [
      {kind:'buggy', len:2}, {kind:'gap', len:4},
      {kind:'buggy', len:2}, {kind:'gap', len:6},
    ],
    'Road-4 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:6},
      {kind:'racecar', len:2}, {kind:'gap', len:5},
    ],
    'Road-5 Trucks': [
      {kind:'truck', len:4}, {kind:'gap', len:7},
      {kind:'truck', len:4}, {kind:'gap', len:5},
    ],

    'River-1 Turtle3': [
      {kind:'turtle3', len:3}, {kind:'water', len:3},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:4},
    ],
    'River-2 LogS': [
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:2},
    ],
    'River-3 LogXL': [
      {kind:'logXL', len:6}, {kind:'water', len:4},
      {kind:'logXL', len:6}, {kind:'water', len:6},
    ],
    'River-4 Turtle2': [
      {kind:'turtle2', len:2}, {kind:'water', len:3},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:4},
    ],
    'River-5 LogM/Gator': [
      {kind:'logM', len:4}, {kind:'water', len:3},
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:4},
    ],
  },

  2: {
    'Road-1 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:6},
      {kind:'racecar', len:2}, {kind:'gap', len:6},
    ],
    'Road-2 Bulldozers': [
      {kind:'bulldozer', len:2}, {kind:'gap', len:5},
      {kind:'bulldozer', len:2}, {kind:'gap', len:4},
      {kind:'bulldozer', len:2}, {kind:'gap', len:5},
    ],
    'Road-3 Buggies': [
      {kind:'buggy', len:2}, {kind:'gap', len:3},
      {kind:'buggy', len:2}, {kind:'gap', len:5},
      {kind:'buggy', len:2}, {kind:'gap', len:5},
    ],
    'Road-4 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:5},
      {kind:'racecar', len:2}, {kind:'gap', len:5},
      {kind:'racecar', len:2}, {kind:'gap', len:6},
    ],
    'Road-5 Trucks': [
      {kind:'truck', len:4}, {kind:'gap', len:6},
      {kind:'truck', len:4}, {kind:'gap', len:5},
      {kind:'truck', len:4}, {kind:'gap', len:6},
    ],

    'River-1 Turtle3': [
      {kind:'turtle3', len:3}, {kind:'water', len:2},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:3},
      {kind:'turtle3', len:3}, {kind:'water', len:4},
    ],
    'River-2 LogS': [
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:2},
    ],
    'River-3 LogXL': [
      {kind:'logXL', len:6}, {kind:'water', len:3},
      {kind:'logXL', len:6}, {kind:'water', len:5},
    ],
    'River-4 Turtle2': [
      {kind:'turtle2', len:2}, {kind:'water', len:2},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:3},
      {kind:'turtle2', len:2}, {kind:'water', len:3},
    ],
    'River-5 LogM/Gator': [
      {kind:'logM', len:4}, {kind:'water', len:2},
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:4},
      {kind:'logM', len:4}, {kind:'water', len:3},
    ],
  },

  3: {
    'Road-1 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:5},
      {kind:'racecar', len:2}, {kind:'gap', len:5},
      {kind:'racecar', len:2}, {kind:'gap', len:5},
    ],
    'Road-2 Bulldozers': [
      {kind:'bulldozer', len:2}, {kind:'gap', len:4},
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
      {kind:'bulldozer', len:2}, {kind:'gap', len:4},
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
    ],
    'Road-3 Buggies': [
      {kind:'buggy', len:2}, {kind:'gap', len:2},
      {kind:'buggy', len:2}, {kind:'gap', len:4},
      {kind:'buggy', len:2}, {kind:'gap', len:4},
      {kind:'buggy', len:2}, {kind:'gap', len:4},
    ],
    'Road-4 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:5},
    ],
    'Road-5 Trucks': [
      {kind:'truck', len:4}, {kind:'gap', len:5},
      {kind:'truck', len:4}, {kind:'gap', len:4},
      {kind:'truck', len:4}, {kind:'gap', len:5},
    ],

    'River-1 Turtle3': [
      {kind:'turtle3', len:3}, {kind:'water', len:2},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:2},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:3},
    ],
    'River-2 LogS': [
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:2},
    ],
    'River-3 LogXL': [
      {kind:'logXL', len:6}, {kind:'water', len:3},
      {kind:'logXL', len:6}, {kind:'water', len:4},
      {kind:'logXL', len:6}, {kind:'water', len:5},
    ],
    'River-4 Turtle2': [
      {kind:'turtle2_dive', len:2}, {kind:'water', len:2},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:3},
      {kind:'turtle2', len:2}, {kind:'water', len:3},
    ],
    'River-5 LogM/Gator': [
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:3},
      {kind:'logM', len:4}, {kind:'water', len:2},
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:4},
    ],
  },

  4: {
    'Road-1 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:4},
      {kind:'racecar', len:2}, {kind:'gap', len:4},
    ],
    'Road-2 Bulldozers': [
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
      {kind:'bulldozer', len:2}, {kind:'gap', len:3},
    ],
    'Road-3 Buggies': [
      {kind:'buggy', len:2}, {kind:'gap', len:2},
      {kind:'buggy', len:2}, {kind:'gap', len:2},
      {kind:'buggy', len:2}, {kind:'gap', len:2},
      {kind:'buggy', len:2}, {kind:'gap', len:2},
      {kind:'buggy', len:2}, {kind:'gap', len:2},
      {kind:'buggy', len:2}, {kind:'gap', len:2},
    ],
    'Road-4 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
    ],
    'Road-5 Trucks': [
      {kind:'truck', len:4}, {kind:'gap', len:4},
      {kind:'truck', len:4}, {kind:'gap', len:4},
      {kind:'truck', len:4}, {kind:'gap', len:4},
      {kind:'truck', len:4}, {kind:'gap', len:4},
    ],

    'River-1 Turtle3': [
      {kind:'turtle3_dive', len:3}, {kind:'water', len:2},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:2},
      {kind:'turtle3', len:3}, {kind:'water', len:2},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:3},
    ],
    'River-2 LogS': [
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
    ],
    'River-3 LogXL': [
      {kind:'logXL', len:6}, {kind:'water', len:2},
      {kind:'logXL', len:6}, {kind:'water', len:4},
      {kind:'logXL', len:6}, {kind:'water', len:4},
    ],
    'River-4 Turtle2': [
      {kind:'turtle2', len:2}, {kind:'water', len:2},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:2},
      {kind:'turtle2', len:2}, {kind:'water', len:2},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:3},
    ],
    'River-5 LogM/Gator': [
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:2},
      {kind:'logM', len:4}, {kind:'water', len:2},
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:3},
      {kind:'logM', len:4}, {kind:'water', len:3},
    ],
  },

  5: {
    'Road-1 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:1},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
      {kind:'racecar', len:2}, {kind:'gap', len:3},
    ],
    'Road-2 Bulldozers': [
      {kind:'bulldozer', len:2}, {kind:'gap', len:2},
      {kind:'bulldozer', len:2}, {kind:'gap', len:2},
      {kind:'bulldozer', len:2}, {kind:'gap', len:2},
      {kind:'bulldozer', len:2}, {kind:'gap', len:2},
      {kind:'bulldozer', len:2}, {kind:'gap', len:2},
      {kind:'bulldozer', len:2}, {kind:'gap', len:2},
    ],
    'Road-3 Buggies': [
      {kind:'buggy', len:2}, {kind:'gap', len:1},
      {kind:'buggy', len:2}, {kind:'gap', len:1},
      {kind:'buggy', len:2}, {kind:'gap', len:1},
      {kind:'buggy', len:2}, {kind:'gap', len:1},
      {kind:'buggy', len:2}, {kind:'gap', len:1},
      {kind:'buggy', len:2}, {kind:'gap', len:1},
      {kind:'buggy', len:2}, {kind:'gap', len:1},
    ],
    'Road-4 Racecars': [
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:2},
      {kind:'racecar', len:2}, {kind:'gap', len:2},
    ],
    'Road-5 Trucks': [
      {kind:'truck', len:4}, {kind:'gap', len:3},
      {kind:'truck', len:4}, {kind:'gap', len:3},
      {kind:'truck', len:4}, {kind:'gap', len:3},
      {kind:'truck', len:4}, {kind:'gap', len:3},
    ],

    'River-1 Turtle3': [
      {kind:'turtle3_dive', len:3}, {kind:'water', len:1},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:2},
      {kind:'turtle3_dive', len:3}, {kind:'water', len:2},
      {kind:'turtle3', len:3}, {kind:'water', len:2},
    ],
    'River-2 LogS': [
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
      {kind:'logS', len:3}, {kind:'water', len:1},
    ],
    'River-3 LogXL': [
      {kind:'logXL', len:6}, {kind:'water', len:2},
      {kind:'logXL', len:6}, {kind:'water', len:3},
      {kind:'logXL', len:6}, {kind:'water', len:3},
    ],
    'River-4 Turtle2': [
      {kind:'turtle2_dive', len:2}, {kind:'water', len:1},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:2},
      {kind:'turtle2_dive', len:2}, {kind:'water', len:2},
      {kind:'turtle2', len:2}, {kind:'water', len:2},
    ],
    'River-5 LogM/Gator': [
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:2},
      {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:3},
      {kind:'logM', len:4}, {kind:'water', len:2},
      {kind:'logM', len:4}, {kind:'water', len:2},
    ],
  },
};
```

**Round-linked hazards (not part of lane cycles):**
- Enable **bank snake** starting Round 3.
- Enable **log snake** (on the big log lane) starting Round 3.
- Enable **otters** starting Round 3–4 (configurable; keep them sparse).


---

## 5) Movement model (fixed timestep)

### 5.1 Fixed timestep
Use a stable arcade-like update loop:

```
const FIXED_DT = 1/60; // seconds
let acc = 0;
let last = performance.now();

function frame(now){
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  acc += dt;
  while (acc >= FIXED_DT){
    update(FIXED_DT);
    acc -= FIXED_DT;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

### 5.2 Lane scrolling
Maintain a scroll offset per lane in **cells (fixed-point)**.

```
// fixed-point 16.16 for deterministic feel
const FP = 1<<16;

class Lane {
  constructor(cfg){
    this.cfg = cfg;
    this.off = 0; // fixed-point cells
    this.cycleLen = cfg.cycle.reduce((a,s)=>a+s.len,0);
  }
  step(dt, speedScale){
    const cps = this.cfg.speedCps * speedScale * this.cfg.dir;
    this.off = (this.off + (cps * dt * FP))|0;
    // wrap in fixed-point cells
    const wrap = this.cycleLen * FP;
    this.off %= wrap;
    if (this.off < 0) this.off += wrap;
  }
}
```

### 5.3 Sampling the lane at an x-cell
To decide collision/platform behavior at frog’s column `xCell`, convert into a position in the cyclic pattern.

```
function sampleLane(lane, xCell){
  // position along the cycle in cells, shifted by offset
  // When lane moves right, the content appears to move right, so the sampling coordinate shifts opposite.
  const wrap = lane.cycleLen;
  const offCells = lane.off / FP;
  let p = xCell - (lane.cfg.dir * offCells);
  // wrap
  p = ((p % wrap) + wrap) % wrap;

  let cursor = 0;
  for (const seg of lane.cfg.cycle){
    if (p < cursor + seg.len) return {kind: seg.kind, local: p - cursor};
    cursor += seg.len;
  }
  return {kind:'water', local:0};
}
```

---

## 6) Frog motion, riding platforms, and death conditions

### 6.1 Frog input
* Each input moves exactly **1 cell** in the cardinal direction.
* Moves are instantaneous (no smooth tween) for arcade snap.

### 6.2 Riding platforms
If frog is standing on a river platform, it is carried horizontally with that lane’s velocity.

```
function carryFrogOnLane(frog, lane, dt, speedScale){
  const cps = lane.cfg.speedCps * speedScale * lane.cfg.dir;
  frog.x += cps * dt; // in cells (float OK here)
}
```

Clamp and kill rules:
* If frog’s x leaves `[0, GRID_W)` due to being carried: **death (swept off screen)**.
* If frog is in river bands and sampled kind is `water`: **death (drown)**.

### 6.3 Road collisions
If frog is in road bands and sampled kind is a vehicle segment: **death (run over)**.

### 6.4 River hazards
* **Diving turtle**: if turtle is submerged while frog is on it: **death**.
* **Log gator**:
  * standing on body is safe
  * collision with head/jaws region is **death**
* **Snake**: collision with snake **head** is death (body can be treated as lethal too if you want simpler, but arcade-accurate is “head lethal”).
* **Otter**: always lethal on contact.

### 6.5 Home bay rules
A move into band 0 must land in an **open home slot**:
* If slot already occupied: death.
* If slot has home-gator: death.
* If frog hits a bush/wall tile between slots: death.

---

## 7) Diving turtles (state machine)

Treat each diving turtle group as a platform segment that has its own **phase timer**.

Suggested cycle (tunable):
* `SURFACE` 2.5s
* `WARNING` 0.7s (visual cue)
* `SUBMERGED` 1.3s

Implementation sketch:

```
class DivingGroup {
  constructor(period={surface:2.5, warn:0.7, sub:1.3}){
    this.t = 0;
    this.p = period;
  }
  step(dt){
    this.t += dt;
    const total = this.p.surface + this.p.warn + this.p.sub;
    this.t %= total;
  }
  state(){
    if (this.t < this.p.surface) return 'surface';
    if (this.t < this.p.surface + this.p.warn) return 'warn';
    return 'sub';
  }
}
```

How to hook to lane sampling:
* When `sampleLane()` returns `turtle2_dive` or `turtle3_dive`, you also look up which diving group instance covers that local segment to check `state() === 'sub'`.

(For simplicity you can assign a repeating list of DivingGroup instances to each dive segment occurrence in the lane cycle.)

---

## 8) Bonus items and special hazards

### 8.1 Lady frog (female frog) bonus
* Spawns on a river platform (commonly on the short-log lane).
* Moves with the platform.
* When frog jumps onto the same cell, lady frog becomes **carried**.
* When frog reaches home safely while carrying her: **+200**.
* Lady frog disappears if the frog dies or after delivery.

```
class LadyFrog {
  constructor(){ this.active=false; this.laneBand=4; this.x=0; this.carried=false; }
}
```

Spawn rule (deterministic-ish):
* On each new frog attempt, with probability `pLady = 0.2` (or a fixed schedule), spawn her on a randomly chosen platform segment in band 4.

### 8.2 Fly bonus
* Fly appears inside an **empty home slot** for a limited time.
* If frog reaches that home while fly is present: **+200**.

> Screenshot note: your capture shows a **green “bug” sprite out on the river** (not inside a home). That sprite exists in some arcade sprite sheets as a **bug bonus** that can appear after collecting an “invisible lady frog” (a later-round variant). If you are targeting strict baseline Frogger rules, you can omit it; if you want to match that capture/sprite set, implement it as an optional bonus (see below).

#### Optional: Bug bonus (invisible lady-frog variant)
* Spawns on a river platform for a short window.
* If collected, award **+200** (configurable).
* Treat it like Lady Frog: it rides with the platform’s motion.

### 8.3 Home gator
* A home slot may become occupied by a gator head/jaws for a limited time.
* If frog enters that slot during this time: **death**.

Suggested home-slot overlay scheduler:
* Every few seconds, choose a random empty home.
* Roll either fly or gator:
  * fly for ~3.0s
  * gator for ~2.0s

---

## 9) Scoring (arcade style)

Use classic scoring:
* **+10** per **forward** hop (upwards only).
* **+50** when a frog reaches a home.
* **Time bonus:** **+10 per unused 0.5 second** remaining when you reach home.
  * Implement a timer in “half-second ticks”. Start at **60 ticks** (= 30s).
* **+200** for eating a **fly** (by reaching a home with fly present).
* **+200** for delivering a **lady frog**.
* **+1000** when all 5 homes are filled (level complete).
* **Extra life:** award **one** bonus frog at **20,000** points.
* Display is 5 digits; you may allow score to exceed but optionally show `score % 100000`.

Timer behavior:
* Timer resets to full when:
  * frog reaches home
  * frog dies (new frog spawns)

---

## 10) Level progression and scaling

### 10.1 Base rule
A “level/round” is completed when **all 5 homes** are filled.

### 10.2 Scaling knobs
Two primary scaling knobs that preserve the arcade feel:
1) **Density round (1..5)**: changes spacing/patterns (more vehicles, fewer gaps).
2) **Speed profile (transition tier)**: changes speed multipliers per lane.

A good faithful approximation is:
* `roundInSet = (levelIndex % 5) + 1`
* Every 5 levels, increase a global `speedTier`.

### 10.3 Speed profiles
Define per-tier lane multipliers so some lanes speed up earlier than others.

```
const SPEED_TIERS = [
  { name:'T0', road:1.00, river:1.00 },
  { name:'T1', road:1.10, river:1.05 },
  { name:'T2', road:1.20, river:1.10 },
  { name:'T3', road:1.30, river:1.15 },
];

function speedScaleForLane(cfg, tier){
  const t = SPEED_TIERS[tier] ?? SPEED_TIERS.at(-1);
  return (cfg.name.startsWith('Road')) ? t.road : t.river;
}
```

Optional “arcade quirk”:
* After 5 levels, difficulty briefly eases; you can implement by dropping tier by 1 for one cycle, then continuing upward.

---

## 11) Suggested simplified-but-faithful engine structure

### 11.1 Data-driven, lane-centric simulation
Do NOT “spawn objects randomly each second.” Instead:
* Keep **one Lane instance per moving band**.
* Each Lane has a repeating **cycle segment list** + **scroll offset**.
* Collision and platform behavior come from `sampleLane()`.

This matches how old hardware *feels* and makes tuning easy.

### 11.2 Entities (small list)
Keep only the truly dynamic overlays as entities:
* `Frog` (player)
* `LadyFrog` (bonus pickup, sometimes)
* `Snake` on bank/log (optional)
* `Otter` (optional)
* `HomeOverlay` per home slot (fly/gator)

Everything else is implicit in lane patterns.

### 11.3 Game state
* `score`, `lives`, `homes[5]` occupancy
* `levelIndex`, `roundInSet`, `speedTier`
* `timerTicks` (half-second ticks)

---

## 12) Implementation checklist for Codex

1) **Canvas + scaling** (224×256 logical, integer upscale).
2) **Input** (keydown repeat off; one hop per key press).
3) **Bands** defined exactly as above.
4) **Lane engine** (fixed timestep, lane offset, sampling).
5) **Frog rules** (death conditions, riding, home entry).
6) **Home slots** (occupancy + fly/gator overlays).
7) **Bonuses** (lady frog pickup/delivery, fly scoring).
8) **Diving turtle cycle** and drowning when submerged.
9) **Scoring + timer ticks** (half-second tick decrement).
10) **Level progression** and density/speed scaling.

---

## 13) Starter lane config (drop-in)

```
const LANE_CFGS = [
  // ROAD (bands 7..11)
  { name:'Road-1 Racecars', band:11, dir:-1, speedCps:4.2, cycle:[
    {kind:'racecar', len:2}, {kind:'gap', len:5},
    {kind:'racecar', len:2}, {kind:'gap', len:7},
  ]},
  { name:'Road-2 Bulldozers', band:10, dir:+1, speedCps:3.2, cycle:[
    {kind:'bulldozer', len:2}, {kind:'gap', len:6},
    {kind:'bulldozer', len:2}, {kind:'gap', len:4},
  ]},
  { name:'Road-3 Buggies', band:9, dir:-1, speedCps:3.4, cycle:[
    {kind:'buggy', len:2}, {kind:'gap', len:4},
    {kind:'buggy', len:2}, {kind:'gap', len:6},
  ]},
  { name:'Road-4 Racecars', band:8, dir:+1, speedCps:4.6, cycle:[
    {kind:'racecar', len:2}, {kind:'gap', len:6},
    {kind:'racecar', len:2}, {kind:'gap', len:5},
  ]},
  { name:'Road-5 Trucks', band:7, dir:-1, speedCps:2.6, cycle:[
    {kind:'truck', len:4}, {kind:'gap', len:7},
    {kind:'truck', len:4}, {kind:'gap', len:5},
  ]},

  // RIVER (bands 1..5)
  { name:'River-1 Turtle3', band:5, dir:-1, speedCps:2.4, cycle:[
    {kind:'turtle3', len:3}, {kind:'water', len:3},
    {kind:'turtle3_dive', len:3}, {kind:'water', len:4},
  ]},
  { name:'River-2 LogS', band:4, dir:+1, speedCps:3.2, cycle:[
    {kind:'logS', len:3}, {kind:'water', len:1},
    {kind:'logS', len:3}, {kind:'water', len:2},
  ]},
  { name:'River-3 LogXL', band:3, dir:+1, speedCps:2.6, cycle:[
    {kind:'logXL', len:6}, {kind:'water', len:4},
    {kind:'logXL', len:6}, {kind:'water', len:6},
  ]},
  { name:'River-4 Turtle2', band:2, dir:-1, speedCps:3.0, cycle:[
    {kind:'turtle2', len:2}, {kind:'water', len:3},
    {kind:'turtle2_dive', len:2}, {kind:'water', len:4},
  ]},
  { name:'River-5 LogM/Gator', band:1, dir:+1, speedCps:3.0, cycle:[
    {kind:'logM', len:4}, {kind:'water', len:3},
    {kind:'gatorBody', len:4}, {kind:'gatorHead', len:2}, {kind:'water', len:4},
  ]},
];

const LANES = LANE_CFGS.map(cfg=>new Lane(cfg));
```

---

If you want, I can provide a second canvas with **a complete runnable single-file Frogger clone skeleton** (HTML+JS) that implements this lane engine, with placeholder vector art and sound stubs, ready for tuning.

