# Sudoku Solver Strategies

This document describes the logical techniques used by the Wingames Sudoku solver. The techniques are ordered from the simplest placements to advanced candidate-chain deductions.

The solver never guesses. Every placement or candidate elimination must follow from the ordinary Sudoku rules:

- Each row contains the digits 1 through 9 exactly once.
- Each column contains the digits 1 through 9 exactly once.
- Each 3x3 box contains the digits 1 through 9 exactly once.

The generator separately verifies that each puzzle has exactly one solution. The logical solver then certifies that the puzzle can be completed using only the techniques allowed for its difficulty level.

## Notation

Coordinates use `rNcM` notation:

- `r4c7` means row 4, column 7.
- `{2,5,8}` means a cell currently has candidates 2, 5, and 8.
- A **unit** is one row, one column, or one 3x3 box.
- Two cells **see** one another when they share a row, column, or box.
- A **strong link** for digit `d` joins two cells when they are the only two places for `d` in a unit. If one is false, the other must be true.
- A **weak link** means two candidates cannot both be true, usually because their cells see one another.
- A **bivalue cell** has exactly two candidates.

## Solver ladder

| Level | Techniques |
|---:|---|
| 1 | Naked Single, Hidden Single |
| 2 | Locked Candidates, Naked Pair |
| 3 | Hidden Pair, Naked Triple, Hidden Triple |
| 4 | X-Wing, Skyscraper, Two-String Kite |
| 5 | XY-Wing, XYZ-Wing, Swordfish |
| 6 | W-Wing, Simple Coloring |
| 7 | Jellyfish, bounded XY-Chain |

The solver looks for the easiest available move first. After applying one logical move, it starts again at Level 1. This produces a human-style proof path rather than applying many unrelated advanced eliminations at once.

---

# Level 1: Direct placements

## Naked Single

A **Naked Single** occurs when an unsolved cell has only one remaining candidate.

Example:

```text
r5c4 = {7}
```

The cell must contain 7 because every other digit is already excluded by its row, column, or box.

### Recognition

1. List the legal candidates for an empty cell.
2. If exactly one candidate remains, place it.

### Why it works

A Sudoku cell must contain one digit. If eight digits are impossible, the ninth is forced.

---

## Hidden Single

A **Hidden Single** occurs when a digit can appear in only one cell of a row, column, or box, even though that cell may have several candidates.

Example:

```text
In row 3, digit 6 appears as a candidate only in r3c8.
r3c8 currently shows {2,6,9}.
Therefore r3c8 = 6.
```

The 6 is "hidden" among the cell's other candidates.

### Recognition

For each digit in each unit:

1. Find every unsolved cell that can contain the digit.
2. If only one cell remains, place the digit there.

### Why it works

Every unit must contain the digit exactly once. If only one location is possible, that location is forced.

---

# Level 2: Basic candidate eliminations

## Locked Candidates

**Locked Candidates** use the overlap between a box and a row or column. The technique has two equivalent forms: **pointing** and **claiming**.

## Pointing pair or triple

If all candidates for a digit inside one box lie in the same row, that digit cannot appear elsewhere in that row outside the box.

Example:

```text
In the upper-left box, candidate 5 appears only at r2c1 and r2c3.
Both cells are in row 2.
Remove candidate 5 from every other unsolved cell in row 2.
```

The same logic applies when the candidates align in one column.

## Claiming pair or triple

If all candidates for a digit in one row lie inside the same box, that digit cannot appear elsewhere in that box.

Example:

```text
In row 6, candidate 8 appears only at r6c4 and r6c6.
Both cells are in the center box.
Remove candidate 8 from the other cells in that box.
```

### Why it works

The digit must occur somewhere in the locked intersection. Therefore it cannot also occur in the rest of the overlapping unit.

---

## Naked Pair

A **Naked Pair** occurs when two cells in one unit contain the same two candidates and no others.

Example:

```text
r7c2 = {3,9}
r7c8 = {3,9}
```

Those two cells must contain 3 and 9 in some order. Candidate 3 and candidate 9 can therefore be removed from every other cell in row 7.

### Recognition

Within one unit:

1. Find two unsolved cells whose combined candidates contain exactly two digits.
2. Confirm that those two cells are confined to those two digits.
3. Remove those digits from all other cells in the unit.

The cells do not strictly need to display identical masks in the generalized subset rule, but their union must contain exactly two digits.

### Why it works

Two digits must occupy two cells. There is no room for either digit elsewhere in the unit.

---

# Level 3: Hidden and three-cell subsets

## Hidden Pair

A **Hidden Pair** occurs when two digits can appear in only the same two cells of a unit. Those cells may initially contain additional candidates.

Example:

```text
In column 4:
- Digit 2 can appear only at r3c4 or r8c4.
- Digit 7 can appear only at r3c4 or r8c4.

r3c4 = {2,5,7}
r8c4 = {1,2,7,9}
```

Because 2 and 7 must occupy those two cells, remove all other candidates:

```text
r3c4 = {2,7}
r8c4 = {2,7}
```

### Difference from a Naked Pair

- A Naked Pair is visible from the contents of two cells.
- A Hidden Pair is visible from the locations available to two digits.

---

## Naked Triple

A **Naked Triple** occurs when three cells in one unit collectively contain only three digits.

Example:

```text
r4c1 = {1,4}
r4c5 = {1,7}
r4c9 = {4,7}
```

The three cells collectively contain only `{1,4,7}`. Those digits must fill the three cells, so 1, 4, and 7 can be removed from every other cell in row 4.

A triple can also look like:

```text
{1,4,7}  {1,4}  {4,7}
```

The cells do not all need to contain exactly three candidates. Their union must contain exactly three digits.

### Why it works

Three digits are confined to three cells, leaving no room for those digits elsewhere in the unit.

---

## Hidden Triple

A **Hidden Triple** occurs when three digits can appear only in the same three cells of a unit. The cells may contain other candidates that can be removed.

Example:

```text
In a box, digits 2, 5, and 8 appear only in three cells:

r1c4 = {2,5,7}
r2c5 = {1,2,8}
r3c6 = {3,5,8,9}
```

Restrict the cells to the hidden triple:

```text
r1c4 = {2,5}
r2c5 = {2,8}
r3c6 = {5,8}
```

### Difference from a Naked Triple

- A Naked Triple starts with three cells whose combined candidate set has size three.
- A Hidden Triple starts with three digits whose possible locations are confined to three cells.

---

# Level 4: Single-digit patterns

## X-Wing

An **X-Wing** is a two-row-by-two-column pattern for one digit.

Suppose candidate 6 appears in exactly two positions in row 2 and exactly two positions in row 8, and those positions use the same two columns:

```text
        c3      c7
r2      6       6
r8      6       6
```

The actual 6s in rows 2 and 8 must occupy opposite corners of this rectangle. In either arrangement, columns 3 and 7 each receive one of the two 6s. Candidate 6 can therefore be removed from all other cells in columns 3 and 7.

The pattern can also be transposed: two columns may align across the same two rows.

### Recognition

For a chosen digit:

1. Find two rows where that digit appears in exactly two candidate columns.
2. Confirm that the two rows use the same two columns.
3. Remove the digit from the remaining cells in those columns.

### Why it works

Each base row must place the digit in one of the two cover columns. Whichever diagonal arrangement is correct, both cover columns are occupied by the pattern.

---

## Skyscraper

A **Skyscraper** uses two strong links for the same digit in two rows or two columns.

In the row-based form:

1. Two different rows each contain exactly two candidates for digit `d`.
2. One candidate from each row lies in the same column; these are the aligned **bases**.
3. The other two candidates are the unaligned **roofs**.

Conceptually:

```text
        shared column        different columns
row A       base A                roof A
row B       base B                         roof B
```

At least one roof must be true. Therefore any cell that sees both roofs cannot contain `d`.

### Why at least one roof is true

If roof A were false, base A would be true because its row contains a strong link. Base B would then be false because it shares the base column with base A, forcing roof B to be true. The reverse argument also holds.

### Elimination

Remove `d` from cells that see both roof cells.

---

## Two-String Kite

A **Two-String Kite** combines:

- One strong link for digit `d` in a row.
- One strong link for `d` in a column.
- One endpoint from each link lying in the same box.

The two candidates inside the common box form the **join**. The other endpoints are the **far ends**.

At least one far end must be true, so any cell that sees both far ends cannot contain `d`.

### Logical chain

If the row's far end is false, its box endpoint must be true. That makes the column's box endpoint false, forcing the column's far end true. The reverse case leads to the row's far end being true.

### Elimination

Remove `d` from any candidate cell that sees both far ends.

---

# Level 5: Wings and three-line fish

## XY-Wing

An **XY-Wing** uses three bivalue cells:

```text
Pivot:  {X,Y}
Wing A: {X,Z}
Wing B: {Y,Z}
```

Both wings must see the pivot. The wings do not need to see each other.

Example:

```text
Pivot  r5c5 = {2,7}
Wing A r5c2 = {2,9}
Wing B r2c5 = {7,9}
```

If the pivot is 2, Wing A must be 9. If the pivot is 7, Wing B must be 9. In either case, one wing contains 9.

Therefore candidate 9 can be removed from every cell that sees both wings.

### Recognition

1. Find a bivalue pivot `{X,Y}`.
2. Find a peer `{X,Z}`.
3. Find another peer `{Y,Z}`.
4. Remove `Z` from common peers of the two wings.

### Why it works

The pivot must be either X or Y. Each choice forces Z into one of the wings.

---

## XYZ-Wing

An **XYZ-Wing** resembles an XY-Wing but uses a trivalue pivot:

```text
Pivot:  {X,Y,Z}
Wing A: {X,Z}
Wing B: {Y,Z}
```

Both wings see the pivot. The union of the two wings equals the pivot's three candidates, and the wings share candidate Z.

No matter which value the pivot takes, Z must appear in the pivot or one of the wings:

- If pivot = X, Wing A cannot be X and must be Z.
- If pivot = Y, Wing B cannot be Y and must be Z.
- If pivot = Z, Z is already placed at the pivot.

Therefore Z can be removed from cells that see **all three** pattern cells: the pivot and both wings.

### Key difference from XY-Wing

- XY-Wing eliminations need to see both wings.
- XYZ-Wing eliminations need to see the pivot and both wings.

---

## Swordfish

A **Swordfish** is the three-line extension of an X-Wing.

For a chosen digit:

1. Select three rows.
2. In each row, the digit appears in two or three candidate columns.
3. Across all three rows, the candidates are confined to the same three columns.

Those three rows must place the digit once each within those three columns. Therefore the digit can be removed from all other cells in the three columns.

The pattern may also be transposed, using three columns and three rows.

### Conceptual layout

```text
        c2   c5   c8
r1      x    x
r4           x    x
r7      x         x
```

The exact distribution may vary, but the union of the cover columns must contain exactly three columns.

### Why it works

Three base units require three placements, all confined to three cover units. Those cover units are fully occupied by the fish.

---

# Level 6: Linked wings and coloring

## W-Wing

A **W-Wing** uses:

- Two bivalue cells containing the same candidate pair `{X,Y}`.
- The two bivalue cells do not see each other.
- A strong link for one of the pair's digits, say X.
- Each end of that strong link sees one of the bivalue cells.

Conceptually:

```text
Wing 1 {X,Y} -- sees -- strong-link X ===== X -- sees -- Wing 2 {X,Y}
```

At least one wing must contain Y. Therefore Y can be removed from any cell that sees both wings.

### Why it works

Consider the strong link on X:

- If its first endpoint is X, the wing that sees it cannot be X and must be Y.
- If its first endpoint is not X, the other strong-link endpoint must be X, forcing the other wing to Y.

Thus one of the two wings is always Y.

### Recognition

1. Find two non-seeing bivalue cells with the same pair `{X,Y}`.
2. Find a strong link for X or Y connecting peers of the two wings.
3. Eliminate the other digit from cells that see both wings.

---

## Simple Coloring

**Simple Coloring** follows a network of strong links for one digit.

For a selected digit, color the endpoints of each connected strong link alternately, commonly called color A and color B:

```text
A --strong-- B --strong-- A --strong-- B
```

Every valid solution must choose one color throughout the connected component and reject the other. The solver uses two standard coloring rules.

## Rule 1: Color contradiction

If two candidates of the same color see each other, that color cannot be true. Otherwise the same digit would appear twice in a unit.

Therefore remove the digit from every candidate carrying the contradictory color.

## Rule 2: Color trap

If an uncolored candidate sees at least one candidate of color A and at least one candidate of color B, it cannot be true.

Whichever color is ultimately true, one of those colored candidates will contain the digit and conflict with the uncolored cell.

### Why coloring works

A strong link means exactly one endpoint is true. Alternating colors propagates that either-or relationship through the component without choosing which color is correct.

---

# Level 7: Large fish and candidate chains

## Jellyfish

A **Jellyfish** is the four-line extension of X-Wing and Swordfish.

For a chosen digit:

1. Select four rows.
2. In each selected row, the digit appears in two to four candidate columns.
3. Across those rows, every candidate is confined to the same four columns.

The four rows must place the digit once each in those four columns. Remove the digit from every other cell in those columns.

The transposed column-based form is equally valid.

### Fish family

| Fish | Base units | Cover units |
|---|---:|---:|
| X-Wing | 2 | 2 |
| Swordfish | 3 | 3 |
| Jellyfish | 4 | 4 |

### Why it works

N base units require N placements, all restricted to N cover units. Those cover units must therefore receive exactly the placements belonging to the fish.

---

## XY-Chain

An **XY-Chain** is a sequence of bivalue cells connected through shared candidates.

A typical chain looks like:

```text
{A,B} - {B,C} - {C,D} - {D,E} - {E,A}
```

Each neighboring pair must see one another, and the shared candidate forms the link from one cell to the next. The first and last cells both contain the same endpoint candidate, A.

At least one endpoint must contain A. Therefore A can be removed from any cell that sees both endpoints.

### Step-by-step logic

Start with the assumption that A is false in the first cell:

1. The first cell must then be B.
2. The next cell sees that B and must therefore be C.
3. This forcing sequence continues through the chain.
4. The last cell is forced to A.

So either:

- A is true in the first endpoint, or
- A is true in the last endpoint.

In both cases, a common peer of the endpoints cannot contain A.

### No guessing is involved

The solver does not select a candidate and continue as though it were a possible solution. It searches for a complete logical implication chain whose two endpoint alternatives produce the same elimination.

### Implementation bounds

The Wingames solver intentionally bounds XY-Chain search:

- Only bivalue cells participate.
- Chain depth is capped.
- Total chain-search expansions are capped.

These limits keep browser generation responsive. A puzzle may contain a valid chain longer than the configured bound, but such a chain is outside the solver's certified technique set.

---

# How related techniques differ

## Naked versus hidden subsets

| Type | What is restricted? | What gets eliminated? |
|---|---|---|
| Naked subset | N cells contain only N digits | Those digits from other cells in the unit |
| Hidden subset | N digits appear only in N cells | Other digits from the subset cells |

## Fish versus wings

- **Fish** track one digit across several rows and columns.
- **Wings** combine candidate relationships across two or three bivalue/trivalue cells.

## Strong-link patterns versus chains

- **Skyscraper** and **Two-String Kite** are small, named strong-link chains for one digit.
- **Simple Coloring** propagates many strong links for one digit.
- **XY-Chain** links different digits through a sequence of bivalue cells.

---

# Solver behavior and difficulty

The logical solver applies one move at a time in this order:

1. Naked Single
2. Hidden Single
3. Locked Candidates
4. Naked Pair
5. Hidden Pair
6. Naked Triple
7. Hidden Triple
8. X-Wing
9. Skyscraper
10. Two-String Kite
11. XY-Wing
12. XYZ-Wing
13. Swordfish
14. W-Wing
15. Simple Coloring
16. Jellyfish
17. XY-Chain

After every move, it restarts from Naked Single. An advanced elimination often creates an easier placement, just as it would during human solving.

The difficulty classifier considers more than clue count. It records:

- The hardest technique required.
- The number and weight of logical steps.
- The number of advanced eliminations.
- Whether a solver limited to the previous difficulty tier gets stuck.
- Whether the puzzle remains uniquely solvable.

Current intended ranges are:

| Difficulty | Typical logical range | General character |
|---|---|---|
| Easy | Through Level 2 | Singles plus at least one basic elimination |
| Medium | Levels 2-3 | Pairs and triples become important |
| Hard | Levels 4-5 | Fish, kites, skyscrapers, or wings are required |
| Extreme | Levels 5-7 | Usually wings or Swordfish; coloring and chains are occasional |

Clue count contributes to puzzle shape, but it does not by itself determine logical difficulty. A sparse puzzle can be solved mostly by singles, while a puzzle with more clues can require a sophisticated candidate pattern.

---

# Techniques not currently used by the solver

Many additional valid Sudoku strategies exist, but they are not part of the current certified ladder. Examples include:

- Naked and hidden quads
- Finned and Sashimi fish
- Empty Rectangle
- Remote Pairs
- X-Chains
- Alternating Inference Chains
- ALS-XZ and other Almost Locked Set techniques
- Unique Rectangles and BUG+1
- Forcing chains and forcing nets

Some of these are natural future extensions. Uniqueness-based techniques such as Unique Rectangles rely on the additional premise that the puzzle has exactly one solution. The generator already verifies uniqueness, but such techniques may still be kept separate because some players prefer deductions based only on the row, column, and box constraints.

---

# Summary reference

| Technique | Core pattern | Result |
|---|---|---|
| Naked Single | One candidate in a cell | Place it |
| Hidden Single | One location for a digit in a unit | Place it |
| Locked Candidates | Box-line overlap confines a digit | Eliminate outside the overlap |
| Naked Pair | Two digits confined to two cells | Remove them from peers in the unit |
| Hidden Pair | Two digits appear only in two cells | Remove other candidates from those cells |
| Naked Triple | Three digits confined to three cells | Remove them from peers in the unit |
| Hidden Triple | Three digits appear only in three cells | Remove other candidates from those cells |
| X-Wing | Two base lines and two cover lines | Eliminate from the cover lines |
| Skyscraper | Two offset strong links for one digit | Eliminate from common peers of the roofs |
| Two-String Kite | Row and column strong links joined through a box | Eliminate from common peers of the far ends |
| XY-Wing | `{X,Y}`, `{X,Z}`, `{Y,Z}` | Eliminate Z from common peers of the wings |
| XYZ-Wing | `{X,Y,Z}`, `{X,Z}`, `{Y,Z}` | Eliminate Z from cells seeing all three |
| Swordfish | Three base lines and three cover lines | Eliminate from the cover lines |
| W-Wing | Matching bivalue wings joined by a strong link | Eliminate the other wing digit from common peers |
| Simple Coloring | Alternating strong-link network | Apply color contradiction or color trap |
| Jellyfish | Four base lines and four cover lines | Eliminate from the cover lines |
| XY-Chain | Bivalue implication chain with matching endpoints | Eliminate endpoint digit from common peers |
