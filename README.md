# Retro Style Games

Local, dependency-free implementations of card, puzzle, and arcade games using Javascript/HTML5 (no external assets). A simple landing page (`index.html`) links to the playable games.

## Card Games
- **Klondike**: Draw 1/3 toggle, standard/Vegas/none scoring, undo, auto-move to foundations.
- **FreeCell**: Microsoft-style numbered deals, free cells, foundations, supermove drags.
- **Spider**: 1/2/4-suit difficulty, 10 columns, suited descending moves, deal one card per column, auto-removal of completed K→A runs.
- **Golf**: Clear tableau by playing cards ±1 from waste, configurable rules, 1 or 9 holes.
- **TriPeaks**: Clear three overlapping pyramids by playing cards ±1 from waste.
- **Pyramid**: Remove pairs that sum to 13, Kings remove alone.
- **Video Poker**: 9-6 Jacks or Better, hold/draw, pay table highlighting (fixed bet 5).
- **Blackjack, M.D.**: Configurable deck count/rules (surrender, DAS, double restrictions, soft-17), split/double/surrender buttons, and a built-in basic-strategy hint.

## Puzzle Games
- **Bombflagger**: Minesweeper-style presets, custom boards, and emoji flags.
- **Mahjong Solitaire**: Multiple layouts with matching free pairs and solvable-by-construction deals.
- **Hackerman**: Mastermind/Bulls & Cows hybrid with colors or digits mode.
- **Sudoku**: Difficulty-based logic puzzle with notes, eraser, and resume support.
- **Tile Toggle**: Lights Out puzzle - click tiles to toggle neighbors, turn all off.
- **Blocks**: Configurable polyomino stacker with custom grid sizes and piece sets.

## Arcade Games
- **Puzzle Puncher**: Drop gem pairs, build power blocks, detonate crash clears.
- **Pill Popper**: Dr. Mario-style virus buster with falling capsules and chain clears.
- **PlopPlop**: Puyo-style blob matching with chain scoring.
- **Super Buster**: Pang-style harpoon action with bouncing balls that split.
- **Paddle Royale**: Breakout/Arkanoid brick breaker with progressive difficulty.
- **Snake**: Classic arcade - eat food, grow longer, avoid walls and yourself.

## Extras
- **Soundboard**: Chiptune SFX tester for the shared sound banks.

## Run locally
1. From this folder run a simple server (Python 3 built-in):
   ```bash
   python -m http.server 8000
   ```
2. Open in a browser: `http://localhost:8000/`

## Controls
- **Card games**: Click to select a card/run, click another stack to move; drag also works. Double-click (Klondike) a top face-up card to auto-send to foundation.
- **Puzzle/arcade games**: Use keyboard controls shown on each game screen (typically arrow keys/WASD).
- **Settings**: Most games have a ⚙ settings button for difficulty, rules, and options.

## Technical Notes
- Uses Unicode suit emoji and CSS for card faces; no external assets.
- Tested in modern Chromium-based browsers.
- Arcade/puzzle titles use a shared chiptune SFX engine and sound banks.
- Card games share a common rendering engine with responsive scaling.
