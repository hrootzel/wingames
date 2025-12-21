# Retro Style Games

Local, dependency-free implementations of card, puzzle, and arcade games using Javascript/HTML5 (no external assets). A simple landing page (`index.html`) links to the playable games.

## Games
- **Klondike**: Draw 1/3 toggle, standard/Vegas/none scoring, undo, auto-move to foundations.
- **Spider**: 1/2/4-suit difficulty, 10 columns, suited descending moves, deal one card per column, auto-removal of completed K?A runs.
- **Video Poker**: 9-6 Jacks or Better, hold/draw, pay table highlighting (fixed bet 5).
- **Blackjack, M.D.**: Configurable deck count/rules (surrender, DAS, double restrictions, soft-17), split/double/surrender buttons, and a built-in basic-strategy hint.
- **Puzzle Puncher**: Drop gem pairs, build power blocks, detonate crash clears.
- **Pill Popper**: Dr. Mario-style virus buster with falling capsules and chain clears.
- **PlopPlop**: Puyo-style blob matching with chain scoring.
- **Super Buster**: Pang-style harpoon action with bouncing balls that split.
- **Sudoku**: Difficulty-based logic puzzle with notes, eraser, and resume support.
- **Soundboard (prototype)**: Chiptune SFX tester for the shared sound banks.

## Run locally
1. From this folder run a simple server (Python 3 built-in):
   - `python -m http.server 8000`
2. Open in a browser:
   - `http://localhost:8000/` (Landing)
   - `http://localhost:8000/solitaire.html` (Klondike)
   - `http://localhost:8000/spider.html` (Spider)
   - `http://localhost:8000/videopoker.html` (Video Poker)
   - `http://localhost:8000/blackjackmd.html` (Dr. Blackjack)
   - `http://localhost:8000/puzzle_puncher.html` (Puzzle Puncher)
   - `http://localhost:8000/pill_popper.html` (Pill Popper)
   - `http://localhost:8000/plop_plop.html` (PlopPlop)
   - `http://localhost:8000/super_buster.html` (Super Buster)
   - `http://localhost:8000/sudoku.html` (Sudoku)
   - `http://localhost:8000/soundboard.html` (SFX tester)

## Controls
- Click to select a card/run, click another stack to move; drag also works.
- Double-click (Klondike) a top face-up card to auto-send to foundation.
- Buttons: new game, undo/auto-move (Klondike), deal row (Spider), difficulty/scoring/draw selectors.
- Blackjack, M.D.: set decks/rule toggles, choose bet, deal; per hand you can hit/stand/double/split/surrender, or tap Hint for strategy advice.
- Puzzle/arcade games use keyboard controls shown on each game screen.

## Notes
- Uses Unicode suit emoji and CSS for card faces; no external assets.
- Tested in modern Chromium-based browsers.
- Arcade/puzzle titles use a shared chiptune SFX engine and sound banks.
